#!/usr/bin/env node
// Imports zestawy (sets) from the old version's export file into the new schema.
//
// Usage:
//   node scripts/import-old-sets.mjs [path/to/sets-export.json]
//   bun scripts/import-old-sets.mjs [path/to/sets-export.json]
//
// Expects sets-export.json to be an array of objects shaped like:
//   {
//     "slug": "matura-maj-2023-kwt",
//     "title": "Matura maj 2023 - transformacje",
//     "sourceLabel": "Matura maj 2023",     // optional
//     "type": "kwt" | "grammar" | "translation",
//     "isPublic": true,
//     "questions": [
//       {
//         "sentence1": "...",               // '' for grammar/translation
//         "sentence2WithGap": "... ______ ...",
//         "keyword": "AWAY",                // '' unless kwt
//         "correctAnswer": "...",
//         "alternativeAnswers": ["..."],     // optional, default []
//         "exampleWrongAnswers": ["..."],    // optional, default []
//         "minWords": 0,                     // optional, default 0
//         "maxWords": 0                      // optional, default 0
//       }
//     ]
//   }
//
// The new columns added in this version — explanation and grammar_tags — are
// left blank/default; fill them in later by hand or by letting the app
// generate `explanation` on demand (see spec 4.3).
//
// Field names are also accepted in snake_case (as they'd appear straight out
// of the old SQLite database), in case sets-export.json was produced by a
// simple `SELECT *` dump rather than the camelCase API shape described above.

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const inputPath = path.resolve(process.argv[2] ?? 'sets-export.json');
const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'worksheet.db');

if (!fs.existsSync(inputPath)) {
	console.error(`Nie znaleziono pliku: ${inputPath}`);
	process.exit(1);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
	CREATE TABLE IF NOT EXISTS sets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		slug TEXT UNIQUE NOT NULL,
		title TEXT NOT NULL,
		source_label TEXT,
		type TEXT NOT NULL DEFAULT 'kwt',
		is_public INTEGER NOT NULL DEFAULT 0,
		parent_slug TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS questions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
		position INTEGER NOT NULL,
		sentence1 TEXT NOT NULL DEFAULT '',
		sentence2_with_gap TEXT NOT NULL,
		keyword TEXT NOT NULL DEFAULT '',
		correct_answer TEXT NOT NULL,
		alternative_answers TEXT NOT NULL DEFAULT '[]',
		example_wrong_answers TEXT NOT NULL DEFAULT '[]',
		explanation TEXT,
		grammar_tags TEXT NOT NULL DEFAULT '[]',
		min_words INTEGER NOT NULL DEFAULT 0,
		max_words INTEGER NOT NULL DEFAULT 0
	);
`);

function pick(obj, camelKey, snakeKey, fallback) {
	if (obj[camelKey] !== undefined) return obj[camelKey];
	if (obj[snakeKey] !== undefined) return obj[snakeKey];
	return fallback;
}

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
const sets = Array.isArray(raw) ? raw : (raw.sets ?? []);

const insertSet = db.prepare(
	`INSERT INTO sets (slug, title, source_label, type, is_public, parent_slug)
	 VALUES (@slug, @title, @sourceLabel, @type, @isPublic, @parentSlug)
	 ON CONFLICT(slug) DO NOTHING`
);
const getSetIdBySlug = db.prepare('SELECT id FROM sets WHERE slug = ?');
const insertQuestion = db.prepare(
	`INSERT INTO questions
		(set_id, position, sentence1, sentence2_with_gap, keyword, correct_answer,
		 alternative_answers, example_wrong_answers, grammar_tags, min_words, max_words)
	 VALUES (@setId, @position, @sentence1, @sentence2WithGap, @keyword, @correctAnswer,
	         @alternativeAnswers, @exampleWrongAnswers, @grammarTags, @minWords, @maxWords)`
);

let importedSets = 0;
let importedQuestions = 0;
let skippedSets = 0;

const importAll = db.transaction((sets) => {
	for (const s of sets) {
		const slug = pick(s, 'originalSlug', 'original_slug', null) ?? pick(s, 'slug', 'slug', null);
		const title = pick(s, 'title', 'title', null);
		if (!slug || !title) {
			console.warn('Pomijam zestaw bez slug/title:', s);
			skippedSets++;
			continue;
		}

		const result = insertSet.run({
			slug,
			title,
			sourceLabel: pick(s, 'sourceLabel', 'source_label', null),
			type: pick(s, 'type', 'type', 'kwt'),
			isPublic: pick(s, 'isPublic', 'is_public', true) ? 1 : 0,
			parentSlug: pick(s, 'parentSlug', 'parent_slug', null)
		});

		let setId;
		if (result.changes === 0) {
			// slug already existed (ON CONFLICT DO NOTHING) — re-run is safe/idempotent.
			const row = getSetIdBySlug.get(slug);
			setId = row?.id;
			console.warn(`Zestaw "${slug}" już istnieje, pomijam pytania.`);
			skippedSets++;
			continue;
		} else {
			setId = result.lastInsertRowid;
		}

		const questions = pick(s, 'questions', 'questions', []);
		questions.forEach((q, index) => {
			insertQuestion.run({
				setId,
				position: index,
				sentence1: pick(q, 'sentence1', 'sentence1', ''),
				sentence2WithGap: pick(q, 'sentence2WithGap', 'sentence2_with_gap', ''),
				keyword: pick(q, 'keyword', 'keyword', ''),
				correctAnswer: pick(q, 'correctAnswer', 'correct_answer', ''),
				alternativeAnswers: JSON.stringify(pick(q, 'alternativeAnswers', 'alternative_answers', [])),
				exampleWrongAnswers: JSON.stringify(pick(q, 'exampleWrongAnswers', 'example_wrong_answers', [])),
				grammarTags: JSON.stringify(pick(q, 'grammarTags', 'grammar_tags', [])),
				minWords: pick(q, 'minWords', 'min_words', 0),
				maxWords: pick(q, 'maxWords', 'max_words', 0)
			});
			importedQuestions++;
		});

		importedSets++;
	}
});

importAll(sets);

console.log(`Zaimportowano ${importedSets} zestawów (${importedQuestions} pytań).`);
if (skippedSets > 0) console.log(`Pominięto ${skippedSets} zestawów (brak danych lub duplikat sluga).`);
db.close();
