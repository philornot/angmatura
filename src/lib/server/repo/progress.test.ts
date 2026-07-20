import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Database from 'better-sqlite3';
import {initSchema} from '../schema';

// `../db` is a module-level singleton wrapped in a Proxy that opens (and
// keeps) one connection for the whole process — great for production, bad
// for test isolation. We swap it out with vi.doMock for a fresh in-memory
// database per test, and vi.resetModules() so each test's `await
// import('./progress')` re-evaluates against that fresh mock instead of a
// previous test's connection.
//
// This runs the real SQL against a real better-sqlite3 database with the
// production schema — a pure-function test (like leitner.test.ts) can't
// catch bugs that only show up in the SQL itself, which is exactly how the
// next_due_at / CURRENT_TIMESTAMP string-comparison bug slipped through:
// nextBox()/nextDueAt() were both individually correct, the bug was purely
// in how the WHERE clause compared the two timestamp formats.
let testDb: Database.Database;

beforeEach(() => {
    vi.resetModules();
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    initSchema(testDb);
    vi.doMock('../db', () => ({db: testDb}));

    testDb
        .prepare(`INSERT INTO sets (id, slug, title, type, is_public)
                  VALUES (1, 'test-set', 'Test Set', 'kwt', 1)`)
        .run();
    testDb
        .prepare(
            `INSERT INTO questions (id, set_id, position, sentence2_with_gap, correct_answer)
             VALUES (1, 1, 1, 'He ______ tired.', 'is')`
        )
        .run();
});

afterEach(() => {
    testDb.close();
    vi.doUnmock('../db');
});

describe('review / spaced-repetition system (integration, real SQLite)', () => {
    it('a question missed just now is immediately due for review', async () => {
        const {recordStudyCheck, getDueQuestions} = await import('./progress');

        recordStudyCheck('device-a', 1, false); // wrong answer -> box 1, due "now"

        expect(getDueQuestions('device-a').map((q) => q.id)).toEqual([1]);
    });

    it('a question just answered correctly for the first time is NOT due today', async () => {
        // First-ever correct answer moves box 1 -> 2, due in 1 day — it must
        // not reappear in the same session.
        const {recordStudyCheck, getDueQuestions} = await import('./progress');

        recordStudyCheck('device-a', 1, true);

        expect(getDueQuestions('device-a')).toEqual([]);
    });

    it('getDueQuestionsCount matches getDueQuestions for the same device', async () => {
        const {recordStudyCheck, getDueQuestions, getDueQuestionsCount} = await import('./progress');

        recordStudyCheck('device-a', 1, false);

        expect(getDueQuestionsCount('device-a')).toBe(1);
        expect(getDueQuestions('device-a')).toHaveLength(1);
    });

    it('getDueQuestionsCount is 0 for a device with no progress at all (banner should stay hidden)', async () => {
        const {getDueQuestionsCount} = await import('./progress');

        expect(getDueQuestionsCount('brand-new-device')).toBe(0);
    });

    it('a question due in the future (box >= 2, not yet elapsed) is excluded', async () => {
        const {getDueQuestions, getDueQuestionsCount} = await import('./progress');

        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        testDb
            .prepare(`INSERT INTO question_progress (device_id, question_id, box, next_due_at)
                      VALUES (?, ?, 2, ?)`)
            .run('device-a', 1, tomorrow);

        expect(getDueQuestions('device-a')).toEqual([]);
        expect(getDueQuestionsCount('device-a')).toBe(0);
    });

    it('a question due on a past calendar date is included', async () => {
        const {getDueQuestions} = await import('./progress');

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        testDb
            .prepare(`INSERT INTO question_progress (device_id, question_id, box, next_due_at)
                      VALUES (?, ?, 2, ?)`)
            .run('device-a', 1, yesterday);

        expect(getDueQuestions('device-a').map((q) => q.id)).toEqual([1]);
    });

    it(
        'regression: a same-calendar-day ISO next_due_at is due (this is the exact bug that ' +
        'made the review banner look permanently empty — raw string comparison between an ' +
        "ISO next_due_at ('...T...Z') and SQLite's CURRENT_TIMESTAMP ('YYYY-MM-DD HH:MM:SS') " +
        "fails for same-day due dates because 'T' sorts after a space)",
        async () => {
            const {getDueQuestions} = await import('./progress');

            // A due date a few seconds in the past, same calendar day, stored
            // exactly as JS's Date#toISOString() produces it (as recordStudyCheck does).
            const justNow = new Date(Date.now() - 5000).toISOString();
            testDb
                .prepare(`INSERT INTO question_progress (device_id, question_id, box, next_due_at)
                          VALUES (?, ?, 3, ?)`)
                .run('device-a', 1, justNow);

            expect(getDueQuestions('device-a').map((q) => q.id)).toEqual([1]);
        }
    );

    it('recording a review result advances the Leitner box and reschedules next_due_at', async () => {
        const {recordStudyCheck} = await import('./progress');

        recordStudyCheck('device-a', 1, false); // -> box 1
        recordStudyCheck('device-a', 1, true); // -> box 2, due tomorrow

        const row = testDb
            .prepare('SELECT box, next_due_at FROM question_progress WHERE device_id = ? AND question_id = ?')
            .get('device-a', 1) as { box: number; next_due_at: string };

        expect(row.box).toBe(2);
        expect(new Date(row.next_due_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('due questions are ordered weakest box first', async () => {
        testDb
            .prepare(
                `INSERT INTO questions (id, set_id, position, sentence2_with_gap, correct_answer)
                 VALUES (2, 1, 2, 'She ______ happy.', 'is')`
            )
            .run();
        const {getDueQuestions} = await import('./progress');

        const now = new Date().toISOString();
        testDb
            .prepare(`INSERT INTO question_progress (device_id, question_id, box, next_due_at)
                      VALUES (?, ?, 4, ?)`)
            .run('device-a', 2, now);
        testDb
            .prepare(`INSERT INTO question_progress (device_id, question_id, box, next_due_at)
                      VALUES (?, ?, 1, ?)`)
            .run('device-a', 1, now);

        expect(getDueQuestions('device-a').map((q) => q.id)).toEqual([1, 2]); // box 1 before box 4
    });

    it('recording a hint does not affect the due schedule (spec 4.1)', async () => {
        const {recordHintUsed, getDueQuestions} = await import('./progress');

        recordHintUsed('device-a', 1);

        // next_due_at is NULL after only a hint -> treated as immediately due,
        // but a hint alone must never advance the box or set a future date.
        expect(getDueQuestions('device-a').map((q) => q.id)).toEqual([1]);
    });

    it('getDueQuestionsWithSetInfo returns matching set title/slug/type', async () => {
        const {recordStudyCheck, getDueQuestionsWithSetInfo} = await import('./progress');

        recordStudyCheck('device-a', 1, false);

        const rows = getDueQuestionsWithSetInfo('device-a');
        expect(rows).toHaveLength(1);
        expect(rows[0].setTitle).toBe('Test Set');
        expect(rows[0].setSlug).toBe('test-set');
        expect(rows[0].setType).toBe('kwt');
    });
});