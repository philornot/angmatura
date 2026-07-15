import { db } from '../db';
import type { Question, QuestionPrompt } from '$lib/types';

interface QuestionRow {
	id: number;
	set_id: number;
	position: number;
	sentence1: string;
	sentence2_with_gap: string;
	keyword: string;
	correct_answer: string;
	alternative_answers: string;
	example_wrong_answers: string;
	explanation: string | null;
	grammar_tags: string;
	min_words: number;
	max_words: number;
}

function parseJsonArray(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function toQuestion(row: QuestionRow): Question {
	return {
		id: row.id,
		setId: row.set_id,
		position: row.position,
		sentence1: row.sentence1,
		sentence2WithGap: row.sentence2_with_gap,
		keyword: row.keyword,
		correctAnswer: row.correct_answer,
		alternativeAnswers: parseJsonArray(row.alternative_answers),
		exampleWrongAnswers: parseJsonArray(row.example_wrong_answers),
		explanation: row.explanation,
		grammarTags: parseJsonArray(row.grammar_tags),
		minWords: row.min_words,
		maxWords: row.max_words
	};
}

export function toPrompt(q: Question): QuestionPrompt {
	return {
		id: q.id,
		setId: q.setId,
		position: q.position,
		sentence1: q.sentence1,
		sentence2WithGap: q.sentence2WithGap,
		keyword: q.keyword,
		grammarTags: q.grammarTags,
		minWords: q.minWords,
		maxWords: q.maxWords
	};
}

export function getQuestionsForSet(setId: number): Question[] {
	const rows = db
		.prepare('SELECT * FROM questions WHERE set_id = ? ORDER BY position ASC, id ASC')
		.all(setId) as QuestionRow[];
	return rows.map(toQuestion);
}

export function getQuestionById(id: number): Question | null {
	const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as QuestionRow | undefined;
	return row ? toQuestion(row) : null;
}

export function getQuestionsByIds(ids: number[]): Question[] {
	if (ids.length === 0) return [];
	const placeholders = ids.map(() => '?').join(',');
	const rows = db
		.prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`)
		.all(...ids) as QuestionRow[];
	const byId = new Map(rows.map((r) => [r.id, toQuestion(r)]));
	return ids.map((id) => byId.get(id)).filter((q): q is Question => !!q);
}

export interface NewQuestionInput {
	sentence1?: string;
	sentence2WithGap: string;
	keyword?: string;
	correctAnswer: string;
	alternativeAnswers?: string[];
	exampleWrongAnswers?: string[];
	explanation?: string | null;
	grammarTags?: string[];
	minWords?: number;
	maxWords?: number;
}

export function insertQuestions(setId: number, questions: NewQuestionInput[]) {
	const insert = db.prepare(
		`INSERT INTO questions
			(set_id, position, sentence1, sentence2_with_gap, keyword, correct_answer,
			 alternative_answers, example_wrong_answers, explanation, grammar_tags, min_words, max_words)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const insertMany = db.transaction((items: NewQuestionInput[]) => {
		items.forEach((q, index) => {
			insert.run(
				setId,
				index,
				q.sentence1 ?? '',
				q.sentence2WithGap,
				q.keyword ?? '',
				q.correctAnswer,
				JSON.stringify(q.alternativeAnswers ?? []),
				JSON.stringify(q.exampleWrongAnswers ?? []),
				q.explanation ?? null,
				JSON.stringify(q.grammarTags ?? []),
				q.minWords ?? 0,
				q.maxWords ?? 0
			);
		});
	});
	insertMany(questions);
}

export function updateQuestion(id: number, patch: Partial<NewQuestionInput>) {
	const current = getQuestionById(id);
	if (!current) throw new Error('Question not found');
	db.prepare(
		`UPDATE questions SET
			sentence1 = ?, sentence2_with_gap = ?, keyword = ?, correct_answer = ?,
			alternative_answers = ?, example_wrong_answers = ?, explanation = ?,
			grammar_tags = ?, min_words = ?, max_words = ?
		 WHERE id = ?`
	).run(
		patch.sentence1 ?? current.sentence1,
		patch.sentence2WithGap ?? current.sentence2WithGap,
		patch.keyword ?? current.keyword,
		patch.correctAnswer ?? current.correctAnswer,
		JSON.stringify(patch.alternativeAnswers ?? current.alternativeAnswers),
		JSON.stringify(patch.exampleWrongAnswers ?? current.exampleWrongAnswers),
		patch.explanation !== undefined ? patch.explanation : current.explanation,
		JSON.stringify(patch.grammarTags ?? current.grammarTags),
		patch.minWords ?? current.minWords,
		patch.maxWords ?? current.maxWords,
		id
	);
}

/** Replaces every question in a set with a new list — used by the manual editor, which
 *  works against a single in-memory array rather than diffing individual rows. */
export function replaceQuestions(setId: number, questions: NewQuestionInput[]) {
	// CRITICAL: delete + insert must happen in a single transaction. Previously
	// the DELETE ran in its own transaction and insertQuestions() ran
	// afterwards, unprotected. If insertQuestions() threw for any reason (bad
	// row, constraint violation, etc.) the DELETE was already committed and
	// the set was left with zero questions with no rollback — this is what
	// caused "all fields disappear after saving" reports.
	const del = db.prepare('DELETE FROM questions WHERE set_id = ?');
	const insert = db.prepare(
		`INSERT INTO questions
			(set_id, position, sentence1, sentence2_with_gap, keyword, correct_answer,
			 alternative_answers, example_wrong_answers, explanation, grammar_tags, min_words, max_words)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const run = db.transaction((items: NewQuestionInput[]) => {
		del.run(setId);
		items.forEach((q, index) => {
			insert.run(
				setId,
				index,
				q.sentence1 ?? '',
				q.sentence2WithGap,
				q.keyword ?? '',
				q.correctAnswer,
				JSON.stringify(q.alternativeAnswers ?? []),
				JSON.stringify(q.exampleWrongAnswers ?? []),
				q.explanation ?? null,
				JSON.stringify(q.grammarTags ?? []),
				q.minWords ?? 0,
				q.maxWords ?? 0
			);
		});
	});
	run(questions);
}

export function setExplanation(id: number, explanation: string) {
	db.prepare('UPDATE questions SET explanation = ? WHERE id = ?').run(explanation, id);
}

export function deleteQuestion(id: number) {
	db.prepare('DELETE FROM questions WHERE id = ?').run(id);
}
