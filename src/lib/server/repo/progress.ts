import {db} from '../db';
import type {Question} from '$lib/types';
import {isAnswerCorrect} from '../answerUtils';
import {getQuestionById} from './questions';
import {nextBox, nextDueAt} from '../leitner';

interface ProgressRow {
	device_id: string;
	question_id: number;
	box: number;
	next_due_at: string | null;
	last_result: number | null;
	attempts: number;
}

function getProgressRow(deviceId: string, questionId: number): ProgressRow | undefined {
	return db
		.prepare('SELECT * FROM question_progress WHERE device_id = ? AND question_id = ?')
		.get(deviceId, questionId) as ProgressRow | undefined;
}

/**
 * Records the result of a single Study-mode (or Review) check and advances
 * the Leitner box accordingly.
 */
export function recordStudyCheck(deviceId: string, questionId: number, isCorrect: boolean) {
	const existing = getProgressRow(deviceId, questionId);
	const currentBox = existing?.box ?? 1;
	const box = nextBox(currentBox, isCorrect);
	const dueAt = nextDueAt(box).toISOString();

	db.prepare(
		`INSERT INTO question_progress (device_id, question_id, box, next_due_at, last_result, attempts, updated_at)
		 VALUES (@deviceId, @questionId, @box, @dueAt, @lastResult, 1, CURRENT_TIMESTAMP)
		 ON CONFLICT(device_id, question_id) DO UPDATE SET
			box = @box,
			next_due_at = @dueAt,
			last_result = @lastResult,
			attempts = attempts + 1,
			updated_at = CURRENT_TIMESTAMP`
	).run({
		deviceId,
		questionId,
		box,
		dueAt,
		lastResult: isCorrect ? 1 : 0
	});
}

/**
 * Logs that a hint was used, without touching the box or due date — hints
 * are purely educational and must never affect the SRS schedule (spec 4.1).
 */
export function recordHintUsed(deviceId: string, questionId: number) {
	const existing = getProgressRow(deviceId, questionId);
	if (existing) {
		db.prepare(
			`UPDATE question_progress SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
			 WHERE device_id = ? AND question_id = ?`
		).run(deviceId, questionId);
	} else {
		db.prepare(
			`INSERT INTO question_progress (device_id, question_id, box, next_due_at, last_result, attempts)
			 VALUES (?, ?, 1, NULL, NULL, 1)`
		).run(deviceId, questionId);
	}
}

interface DueRow {
	question_id: number;
	box: number;
}

/** Questions due for review right now, across all sets, weakest boxes first (spec 6.3). */
export function getDueQuestions(deviceId: string, limit = 15): Question[] {
	const rows = db
		.prepare(
			`SELECT question_id, box FROM question_progress
			 WHERE device_id = ?
			   AND (next_due_at IS NULL OR datetime(next_due_at) <= datetime('now'))
			 ORDER BY box ASC, next_due_at ASC
			 LIMIT ?`
		)
		.all(deviceId, limit) as DueRow[];

	return rows
		.map((r) => getQuestionById(r.question_id))
		.filter((q): q is Question => !!q);
}

/** Same as getDueQuestions, but joined with the parent set for display + navigation. */
export function getDueQuestionsWithSetInfo(deviceId: string, limit = 15) {
	const rows = db
		.prepare(
			`SELECT question_progress.question_id AS question_id
			 FROM question_progress
			 WHERE question_progress.device_id = ?
			   AND (question_progress.next_due_at IS NULL OR datetime(question_progress.next_due_at) <= datetime('now'))
			 ORDER BY question_progress.box ASC, question_progress.next_due_at ASC
			 LIMIT ?`
		)
		.all(deviceId, limit) as { question_id: number }[];

	const result: { question: Question; setTitle: string; setSlug: string; setType: string }[] = [];
	for (const row of rows) {
		const question = getQuestionById(row.question_id);
		if (!question) continue;
		const setRow = db
			.prepare('SELECT title, slug, type FROM sets WHERE id = ?')
			.get(question.setId) as { title: string; slug: string; type: string } | undefined;
		if (!setRow) continue;
		result.push({ question, setTitle: setRow.title, setSlug: setRow.slug, setType: setRow.type });
	}
	return result;
}

/** Count of questions due right now, for deciding whether to show the review banner at all. */
export function getDueQuestionsCount(deviceId: string): number {
	const row = db
		.prepare(
			`SELECT COUNT(*) AS count
			 FROM question_progress
			 WHERE device_id = ?
			   AND (next_due_at IS NULL OR datetime(next_due_at) <= datetime('now'))`
		)
		.get(deviceId) as { count: number };
	return row.count;
}

export function hasAnyProgress(deviceId: string): boolean {
	const row = db
		.prepare('SELECT 1 FROM question_progress WHERE device_id = ? LIMIT 1')
		.get(deviceId);
	return !!row;
}

export function checkAnswerForQuestion(question: Question, given: string) {
	return isAnswerCorrect(given, {
		correctAnswer: question.correctAnswer,
		alternativeAnswers: question.alternativeAnswers
	});
}
