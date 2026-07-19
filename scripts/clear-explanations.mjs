#!/usr/bin/env node
// Clears cached AI-generated explanations (questions.explanation) so the next
// time a student clicks "Wyjaśnij" on a given question, it's regenerated
// against the CURRENT prompt in src/lib/server/gemini.ts instead of serving
// whatever was cached under an older, worse prompt.
//
// This is a server-side SQLite cache (see the `if (question.explanation)`
// early-return in src/routes/api/questions/[id]/explain/+server.ts) — a
// browser hard refresh (Ctrl+Shift+R) has no effect on it, only clearing the
// column does.
//
// Usage:
//   node scripts/clear-explanations.mjs            # clear ALL cached explanations
//   node scripts/clear-explanations.mjs --id=123    # clear just one question
//   bun scripts/clear-explanations.mjs
//
// Respects DATABASE_PATH the same way the app and other scripts do.

import path from 'node:path';
import Database from 'better-sqlite3';

const idArg = process.argv.find((a) => a.startsWith('--id='));
const questionId = idArg ? Number(idArg.slice('--id='.length)) : null;
if (idArg && (!Number.isInteger(questionId) || questionId <= 0)) {
	console.error(`--id must be a positive integer, got: ${idArg}`);
	process.exit(1);
}

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'worksheet.db');
const db = new Database(dbPath);

const result = questionId
	? db.prepare('UPDATE questions SET explanation = NULL WHERE id = ?').run(questionId)
	: db.prepare('UPDATE questions SET explanation = NULL WHERE explanation IS NOT NULL').run();

console.log(
	questionId
		? `Wyczyszczono wyjaśnienie dla pytania #${questionId} (${result.changes} zmian).`
		: `Wyczyszczono ${result.changes} zapisanych wyjaśnień — zostaną wygenerowane od nowa przy następnym kliknięciu "Wyjaśnij".`
);

db.close();
