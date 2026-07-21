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
			custom_slug TEXT UNIQUE,
			title TEXT NOT NULL,
			source_label TEXT,
			type TEXT NOT NULL DEFAULT 'kwt', -- 'kwt' | 'grammar' | 'translation'
			is_public INTEGER NOT NULL DEFAULT 0,
			is_featured INTEGER NOT NULL DEFAULT 0,
			parent_slug TEXT,
			creator_device_id TEXT,
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

		CREATE TABLE IF NOT EXISTS admin_sessions (
			token TEXT PRIMARY KEY,
			expires_at INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_questions_set_id ON questions(set_id);
		CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers(attempt_id);
		CREATE INDEX IF NOT EXISTS idx_progress_device_due ON question_progress(device_id, next_due_at);
		CREATE INDEX IF NOT EXISTS idx_sets_type_public ON sets(type, is_public);
	`);

	// Safety net for databases created before `is_featured` / `custom_slug`
	// existed — CREATE TABLE IF NOT EXISTS above won't add columns to an
	// already-existing table, so add them here if missing (no-op on fresh
	// databases).
	const columns = db.prepare(`PRAGMA table_info(sets)`).all() as { name: string }[];
	if (!columns.some((c) => c.name === 'is_featured')) {
		db.exec(`ALTER TABLE sets ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0`);
	}
	if (!columns.some((c) => c.name === 'custom_slug')) {
		db.exec(`ALTER TABLE sets ADD COLUMN custom_slug TEXT`);
		db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sets_custom_slug ON sets(custom_slug)`);
	}
	// `creator_device_id` powers the "quiet account" system: a set created by
	// a given anonymous device id can be edited in place (no forced fork) by
	// that same device later on. Nullable — older sets simply have no owner,
	// so they keep behaving exactly as before (public ones always fork).
	if (!columns.some((c) => c.name === 'creator_device_id')) {
		db.exec(`ALTER TABLE sets
			ADD COLUMN creator_device_id TEXT`);
		db.exec(`CREATE INDEX IF NOT EXISTS idx_sets_creator_device_id ON sets (creator_device_id)`);
	}
	// Soft-delete ("trash") support: a set with `deleted_at` set is hidden
	// from every normal query (public listing, "my sets", direct /set/ view,
	// admin's main list) but its row — and its questions, via the existing
	// ON DELETE CASCADE only firing on a *hard* delete — stays intact for 30
	// days so an admin can restore it from /admin/trash. NULL means "not in
	// the trash", which is the state of every pre-existing row.
	if (!columns.some((c) => c.name === 'deleted_at')) {
		db.exec(`ALTER TABLE sets
			ADD COLUMN deleted_at DATETIME`);
		db.exec(`CREATE INDEX IF NOT EXISTS idx_sets_deleted_at ON sets (deleted_at)`);
	}
}
