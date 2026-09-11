import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const disclosurePath = ".omp/turnstile-disclosures.sqlite";
const schema = "CREATE TABLE pending (id TEXT PRIMARY KEY NOT NULL, record TEXT NOT NULL) STRICT";

export type DisclosureInput = {
	attempt: {
		tool: "edit" | "write";
		sha256: string;
		/** Effects keyed by normalized paths relative to the launch workspace owning .omp. */
		files: { path: string; beforeSha256: string | null; afterSha256: string | null }[];
	};
	finding: { rule: string; sha256: string; path: string; line: number; message: string };
	reason: string;
};
export type PendingDisclosure = DisclosureInput & { id: string; kind: "no_rly"; recordedAt: string };

export class DisclosureStorageError extends Error {
	constructor(
		readonly category: "missing" | "corrupt" | "unavailable",
		operation: string,
		cause?: unknown,
	) {
		super(
			`Turnstile disclosure ${operation}: ${category} ${disclosurePath}; pending state is unknown, not empty. Restore the original store or resolve the storage error; it was not recreated.`,
			{ cause },
		);
	}
}

function object(value: unknown, keys: string[]): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected object");
	const result = value as Record<string, unknown>;
	if (Object.keys(result).length !== keys.length || keys.some(key => !(key in result)))
		throw new Error("invalid fields");
	return result;
}
function text(value: unknown): string {
	if (typeof value !== "string" || !value.trim()) throw new Error("expected nonempty text");
	return value;
}
function digest(value: unknown): string {
	if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new Error("expected SHA256");
	return value;
}
function path(value: unknown): string {
	const result = text(value);
	if (/[\\:\x00-\x1f]/.test(result) || result.split("/").some(part => !part || part === "." || part === ".."))
		throw new Error("expected normalized launch-workspace-relative path");
	return result;
}
function input(value: unknown): DisclosureInput {
	const raw = object(value, ["attempt", "finding", "reason"]);
	const attempt = object(raw.attempt, ["tool", "sha256", "files"]);
	if (attempt.tool !== "edit" && attempt.tool !== "write") throw new Error("invalid tool");
	if (!Array.isArray(attempt.files) || !attempt.files.length) throw new Error("expected affected files");
	const files = attempt.files.map(value => {
		const file = object(value, ["path", "beforeSha256", "afterSha256"]);
		if (file.beforeSha256 === null && file.afterSha256 === null) throw new Error("absent before and after");
		return {
			path: path(file.path),
			beforeSha256: file.beforeSha256 === null ? null : digest(file.beforeSha256),
			afterSha256: file.afterSha256 === null ? null : digest(file.afterSha256),
		};
	});
	if (new Set(files.map(file => file.path)).size !== files.length) throw new Error("duplicate affected path");
	const finding = object(raw.finding, ["rule", "sha256", "path", "line", "message"]);
	if (typeof finding.line !== "number" || !Number.isSafeInteger(finding.line) || finding.line < 1)
		throw new Error("invalid finding line");
	const findingPath = path(finding.path);
	if (!files.some(file => file.path === findingPath)) throw new Error("finding outside affected files");
	return {
		attempt: { tool: attempt.tool, sha256: digest(attempt.sha256), files },
		finding: {
			rule: text(finding.rule),
			sha256: digest(finding.sha256),
			path: findingPath,
			line: finding.line,
			message: text(finding.message),
		},
		reason: text(raw.reason),
	};
}
function id(value: DisclosureInput): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function records(db: Database): PendingDisclosure[] {
	try {
		if (
			db.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version !== 1 ||
			db.query<{ sql: string }, []>("SELECT sql FROM sqlite_schema WHERE name = 'pending' AND type = 'table'").get()
				?.sql !== schema ||
			db.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode !== "delete" ||
			db.query("SELECT 1 FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = 'pending' LIMIT 1").get()
		)
			throw new Error("invalid disclosure schema");
		return db
			.query<{ id: string; record: string }, []>("SELECT id, record FROM pending ORDER BY id")
			.all()
			.map(row => {
				const raw = object(JSON.parse(row.record), ["id", "kind", "recordedAt", "attempt", "finding", "reason"]);
				const payload = input({ attempt: raw.attempt, finding: raw.finding, reason: raw.reason });
				if (
					raw.kind !== "no_rly" ||
					raw.id !== row.id ||
					raw.id !== id(payload) ||
					typeof raw.recordedAt !== "string" ||
					new Date(raw.recordedAt).toISOString() !== raw.recordedAt
				)
					throw new Error("invalid disclosure record");
				return { id: row.id, kind: "no_rly", recordedAt: raw.recordedAt, ...payload };
			});
	} catch (error) {
		if (error instanceof Error && "code" in error) throw error;
		throw new DisclosureStorageError("corrupt", "read", error);
	}
}
function storageError(error: unknown, operation: string): DisclosureStorageError {
	if (error instanceof DisclosureStorageError) return error;
	const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
	return new DisclosureStorageError(
		code === "ENOENT" ? "missing" : code === "SQLITE_CORRUPT" || code === "SQLITE_NOTADB" ? "corrupt" : "unavailable",
		operation,
		error,
	);
}
function open(workspace: string, write: boolean): Database {
	const target = join(workspace, disclosurePath);
	const stat = statSync(target);
	if (!stat.isFile()) throw new DisclosureStorageError("unavailable", write ? "write" : "read");
	if (stat.size === 0) throw new DisclosureStorageError("corrupt", write ? "write" : "read");
	const db = new Database(target, { readwrite: write, readonly: !write, create: false });
	try {
		db.exec("PRAGMA busy_timeout = 5000");
		if (write) db.exec("PRAGMA synchronous = FULL");
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}

/** No CREATE on reads or appends: enabled workspace configuration witnesses expected state. */
export function readPendingDisclosures(workspace: string): PendingDisclosure[] {
	let db: Database | undefined;
	try {
		db = open(workspace, false);
		return db.transaction(() => records(db!))();
	} catch (error) {
		throw storageError(error, "read");
	} finally {
		db?.close();
	}
}

/** Stores descriptive exception data only. This function cannot authorize or release an action. */
export function appendPendingDisclosure(workspace: string, value: DisclosureInput): PendingDisclosure {
	const payload = input(value);
	const key = id(payload);
	let db: Database | undefined;
	try {
		db = open(workspace, true);
		return db
			.transaction(() => {
				const existing = records(db!).find(record => record.id === key);
				if (existing) return existing;
				const record: PendingDisclosure = {
					id: key,
					kind: "no_rly",
					recordedAt: new Date().toISOString(),
					...payload,
				};
				const serialized = JSON.stringify(record);
				const inserted = db!.query("INSERT INTO pending (id, record) VALUES (?, ?)").run(key, serialized);
				const stored = db!.query<{ record: string }, [string]>("SELECT record FROM pending WHERE id = ?").get(key);
				if (inserted.changes !== 1 || stored?.record !== serialized)
					throw new DisclosureStorageError("corrupt", "write");
				return record;
			})
			.immediate();
	} catch (error) {
		throw storageError(error, "write");
	} finally {
		db?.close();
	}
}

/** Explicit provisioning, never startup recovery. A failed init leaves its file visibly invalid. */
export function initializeDisclosures(workspace: string): void {
	try {
		let config: unknown;
		try {
			config = JSON.parse(readFileSync(join(workspace, ".omp/turnstile.json"), "utf8"));
		} catch (error) {
			if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
		}
		if (
			config !== undefined &&
			(!config || typeof config !== "object" || !("enabled" in config) || config.enabled !== false)
		)
			throw new Error("initialization requires absent or explicitly disabled configuration");
		mkdirSync(join(workspace, ".omp"), { recursive: true });
		closeSync(openSync(join(workspace, disclosurePath), "wx", 0o600));
		const db = new Database(join(workspace, disclosurePath), { readwrite: true, create: false });
		try {
			db.exec("PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL");
			db.transaction(() => db.exec(`${schema}; PRAGMA user_version = 1`)).immediate();
		} finally {
			db.close();
		}
	} catch (error) {
		throw storageError(error, "initialize (requires absent/disabled configuration and a new target)");
	}
}

if (import.meta.main) {
	try {
		const [command, workspace, ...extra] = process.argv.slice(2);
		if (!workspace || extra.length || (command !== "init" && command !== "read"))
			throw new Error("Usage: bun tools/turnstile-disclosures.ts <init|read> <workspace>");
		if (command === "init") initializeDisclosures(workspace);
		console.log(
			JSON.stringify({
				state: command === "init" ? "initialized" : "pending",
				records: readPendingDisclosures(workspace),
			}),
		);
	} catch (error) {
		console.error(error instanceof Error ? error.message : "Turnstile disclosure operation failed");
		process.exitCode = 1;
	}
}
