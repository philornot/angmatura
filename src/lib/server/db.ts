import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { initSchema } from './schema';

const DB_PATH = env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'worksheet.db');

let realDb: Database.Database | null = null;

function openDb(): Database.Database {
	fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
	const instance = new Database(DB_PATH);
	instance.pragma('journal_mode = WAL');
	instance.pragma('foreign_keys = ON');
	initSchema(instance);
	return instance;
}

function getDb(): Database.Database {
	if (building) {
		// `vite build` (and prerendering) must never touch the native binding.
		// This is what keeps a build on Windows (or any machine that isn't the
		// deploy target) from crashing when better-sqlite3's prebuilt binary is
		// compiled for Linux ARM64 (the Raspberry Pi).
		throw new Error('angmatura: the database cannot be opened during the build step.');
	}
	if (!realDb) {
		realDb = openDb();
	}
	return realDb;
}

/**
 * A drop-in stand-in for a better-sqlite3 Database instance. The native
 * binding is only ever loaded the first time a method is actually called
 * (e.g. the first `db.prepare(...)` at request time), never at import time.
 */
export const db: Database.Database = new Proxy({} as Database.Database, {
	get(_target, prop, _receiver) {
		const instance = getDb();
		const value = Reflect.get(instance, prop, instance);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});
