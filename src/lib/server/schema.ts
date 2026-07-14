import type Database from 'better-sqlite3';

/**
 * Creates all tables/indexes if they don't exist yet. Safe to call on every
 * process start — CREATE TABLE IF NOT EXISTS makes this idempotent.
 */
export function initSchema(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS sets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			slug TEXT UNIQUE NOT NULL,
			title TEXT NOT NULL,
			source_label TEXT,
			type TEXT NOT NULL DEFAULT 'kwt', -- 'kwt' | 'grammar' | 'translation'
			is_public INTEGER NOT NULL DEFAULT 0,
			is_featured INTEGER NOT NULL DEFAULT 0,
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

		CREATE TABLE IF NOT EXISTS attempts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			set_id INTEGER NOT NULL REFERENCES sets(id),
			slug TEXT UNIQUE NOT NULL,
			score INTEGER NOT NULL,
			total INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS answers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
			question_id INTEGER NOT NULL REFERENCES questions(id),
			given TEXT,
			is_correct INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS question_progress (
			device_id TEXT NOT NULL,
			question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
			box INTEGER NOT NULL DEFAULT 1,
			next_due_at DATETIME,
			last_result INTEGER,
			attempts INTEGER NOT NULL DEFAULT 0,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (device_id, question_id)
		);

		CREATE INDEX IF NOT EXISTS idx_questions_set_id ON questions(set_id);
		CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers(attempt_id);
		CREATE INDEX IF NOT EXISTS idx_progress_device_due ON question_progress(device_id, next_due_at);
		CREATE INDEX IF NOT EXISTS idx_sets_type_public ON sets(type, is_public);
	`);

	// Safety net for databases created before `is_featured` existed — CREATE
	// TABLE IF NOT EXISTS above won't add columns to an already-existing
	// table, so add it here if missing (no-op on fresh databases).
	const columns = db.prepare(`PRAGMA table_info(sets)`).all() as { name: string }[];
	if (!columns.some((c) => c.name === 'is_featured')) {
		db.exec(`ALTER TABLE sets ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0`);
	}
}
