import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	chmodSync,
	existsSync,
	lstatSync,
	readFileSync,
	readdirSync,
	realpathSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
	acknowledgePendingDisclosures,
	disclosurePath,
	readPendingDisclosures,
	validatePendingDisclosure,
	type PendingDisclosure,
} from "./turnstile-disclosures";

const trailer = "Turnstile-Disclosure: ";
const semantics = "authorization-intent-not-confirmed-application";
const setupName = "turnstile-commit.json";
const witnessName = "turnstile-commit-attempt";
const hooks = ["prepare-commit-msg", "reference-transaction", "post-commit"] as const;
export type CommitDisclosure = {
	version: 1;
	workspacePrefix: string;
	semantics: typeof semantics;
	record: PendingDisclosure;
};
type Commit = { tree: string; parents: string[]; message: string };
type Witness = {
	pid: number;
	started: string;
	head: string | null;
	tree: string;
	validated: string | null;
	committed: string | null;
};

function hookContent(hook: (typeof hooks)[number]): string {
	const module = fileURLToPath(import.meta.url)
		.split(sep)
		.join("/");
	return `#!${process.execPath.split(sep).join("/")}\nimport { runHook } from ${JSON.stringify(module)};\nawait runHook(${JSON.stringify(hook)}, process.argv.slice(2));\n`;
}

function privateArtifacts(workspacePrefix: string): string[] {
	const state = effectPath(workspacePrefix, disclosurePath);
	return [state, `${state}-journal`, `${state}-wal`, `${state}-shm`];
}

function refusePrivatePaths(paths: string[], artifacts: string[]): void {
	if (paths.some(path => artifacts.some(artifact => path.toLowerCase() === artifact.toLowerCase())))
		throw new Error(
			"disclosure storage is tracked/staged, or its path casing is ambiguous; resolve privately without discarding the user index",
		);
}

function prefix(value: unknown): string {
	if (
		typeof value !== "string" ||
		(value !== "" && (/[\\:\x00-\x1f]/.test(value) || value.split("/").some(p => !p || p === "." || p === "..")))
	)
		throw new Error("invalid Git-root workspacePrefix");
	return value;
}

export function parseCommitDisclosures(message: string): CommitDisclosure[] {
	const found = new Map<string, CommitDisclosure>();
	for (const line of message.split(/\r?\n/)) {
		if (!line.startsWith("Turnstile-Disclosure:")) continue;
		if (!line.startsWith(trailer)) throw new Error("invalid Turnstile disclosure separator");
		const raw = JSON.parse(line.slice(trailer.length));
		if (
			!raw ||
			Object.keys(raw).sort().join() !== "record,semantics,version,workspacePrefix" ||
			raw.version !== 1 ||
			raw.semantics !== semantics
		)
			throw new Error("invalid Turnstile disclosure envelope");
		const entry: CommitDisclosure = {
			version: 1,
			workspacePrefix: prefix(raw.workspacePrefix),
			semantics,
			record: validatePendingDisclosure(raw.record),
		};
		const key = `${entry.workspacePrefix}:${entry.record.id}`;
		if (found.has(key)) throw new Error("duplicate Turnstile disclosure");
		found.set(key, entry);
	}
	return [...found.values()];
}

export function formatCommitDisclosure(workspacePrefix: string, record: PendingDisclosure): string {
	return (
		trailer +
		JSON.stringify({
			version: 1,
			workspacePrefix: prefix(workspacePrefix),
			semantics,
			record: validatePendingDisclosure(record),
		})
	);
}

function git(root: string, args: string[], input?: string | Buffer): Buffer {
	return execFileSync("git", ["--literal-pathspecs", "-C", root, ...args], {
		input,
		maxBuffer: 64 * 1024 * 1024,
		windowsHide: true,
		stdio: ["pipe", "pipe", "pipe"],
	});
}
function text(root: string, ...args: string[]): string {
	return git(root, args).toString("utf8").trim();
}
function head(root: string): string | null {
	const result = spawnSync("git", ["-C", root, "rev-parse", "--verify", "--quiet", "HEAD"], {
		encoding: "utf8",
		windowsHide: true,
	});
	if (result.status === 1) return null;
	if (result.status !== 0) throw new Error("cannot read Git HEAD", { cause: result.error });
	return result.stdout.trim();
}
function oid(value: unknown): string {
	if (typeof value !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value))
		throw new Error("invalid Git object ID");
	return value;
}
export function readCommit(root: string, value: string): Commit {
	const raw = git(root, ["cat-file", "commit", oid(value)]).toString("utf8");
	const split = raw.indexOf("\n\n");
	if (split < 0) throw new Error("invalid Git commit object");
	const headers = raw.slice(0, split).split("\n");
	const tree = headers.find(line => line.startsWith("tree "))?.slice(5);
	return {
		tree: oid(tree),
		parents: headers.filter(line => line.startsWith("parent ")).map(line => oid(line.slice(7))),
		message: raw.slice(split + 2),
	};
}
function emptyTree(root: string): string {
	return git(root, ["hash-object", "-w", "-t", "tree", "--stdin"], "").toString().trim();
}
function effectPath(workspacePrefix: string, path: string): string {
	return workspacePrefix ? `${workspacePrefix}/${path}` : path;
}

function treeRows(root: string, tree: string, paths: string[]): string[] {
	const rows = git(root, ["ls-tree", "-r", "-z", "--full-tree", oid(tree)])
		.toString("utf8")
		.split("\0")
		.filter(Boolean);
	const expected = new Map(paths.map(path => [path.toLowerCase(), path]));
	for (const row of rows) {
		const actual = row.slice(row.indexOf("\t") + 1),
			spelling = expected.get(actual.toLowerCase());
		if (spelling !== undefined && spelling !== actual)
			throw new Error(
				"effect/index path casing is ambiguous; use exact Git path spelling (case-sensitive directories are not case-folded)",
			);
	}
	return rows;
}
/** Reads Git blobs, not checkout bytes: partial index and clean-filter results stay Git-owned. */
function treeBlobs(root: string, tree: string, paths: string[]): Map<string, string | null> {
	const images = new Map<string, string | null>(paths.map(path => [path, null]));
	if (!paths.length) return images;
	const rows = treeRows(root, tree, paths);
	for (const row of rows) {
		if (!row) continue;
		const tab = row.indexOf("\t"),
			path = row.slice(tab + 1);
		if (!images.has(path)) continue;
		const [mode, type, blob] = row.slice(0, tab).split(" ");
		if (type !== "blob" || (mode !== "100644" && mode !== "100755"))
			throw new Error("disclosure effect is not an ordinary Git file");
		images.set(path, oid(blob));
	}
	return images;
}

export function treeImages(root: string, tree: string, paths: string[]): Map<string, string | null> {
	return new Map(
		[...treeBlobs(root, tree, paths)].map(([path, blob]) => [
			path,
			blob === null
				? null
				: createHash("sha256")
						.update(git(root, ["cat-file", "blob", blob]))
						.digest("hex"),
		]),
	);
}

/** A complete observation, not a filesystem lock or a proof of candidate application. */
function canonicalImages(root: string, paths: string[], clean = true) {
	const config = git(root, ["config", "--null", "--list", "--show-origin"]).toString("base64");
	const attributes = git(root, ["check-attr", "-z", "--all", "--", ...paths]).toString("base64");
	const images = paths.map(path => {
		let location = root;
		const identities: string[] = [];
		const parts = path.split("/");
		for (let i = 0; i < parts.length; i++) {
			const parent = lstatSync(location);
			if (!parent.isDirectory() || parent.isSymbolicLink())
				throw new Error("affected ancestor is not an ordinary directory");
			identities.push(`${parent.dev}:${parent.ino}`);
			const names = readdirSync(location);
			if (names.some(name => name !== parts[i] && name.toLowerCase() === parts[i].toLowerCase()))
				throw new Error("canonical effect path casing is ambiguous");
			const candidate = join(location, parts[i]);
			if (!names.includes(parts[i])) {
				// Bun's exact-name lookup can miss aliases accepted by ordinary Windows callers.
				const lookup = execFileSync(
					"powershell.exe",
					[
						"-NoProfile",
						"-NonInteractive",
						"-Command",
						"try { [void][System.IO.File]::GetAttributes($env:TURNSTILE_PATH_LOOKUP); 'present' } catch [System.IO.FileNotFoundException] { 'absent' } catch [System.IO.DirectoryNotFoundException] { 'absent' }",
					],
					{
						encoding: "utf8",
						windowsHide: true,
						stdio: ["ignore", "pipe", "pipe"],
						env: { ...process.env, TURNSTILE_PATH_LOOKUP: candidate },
					},
				).trim();
				if (lookup === "absent") return { path, identities, raw: null, blob: null };
				if (lookup !== "present") throw new Error("native Windows path lookup returned no usable evidence");
				throw new Error(
					"canonical effect path resolves without its exact directory spelling; filesystem alias is ambiguous",
				);
			}
			location = candidate;
		}
		const before = lstatSync(location);
		if (!before.isFile() || before.isSymbolicLink())
			throw new Error("affected canonical path is not an ordinary file");
		const bytes = readFileSync(location);
		const after = lstatSync(location);
		const stamp = (value: typeof before) =>
			`${value.dev}:${value.ino}:${value.size}:${value.mtimeMs}:${value.ctimeMs}:${value.mode}`;
		if (stamp(before) !== stamp(after)) throw new Error("canonical file changed while reading");
		identities.push(stamp(after));
		return {
			path,
			identities,
			raw: createHash("sha256").update(bytes).digest("hex"),
			blob: clean
				? oid(
						git(root, ["hash-object", `--path=${path}`, "--stdin"], bytes)
							.toString("utf8")
							.trim(),
					)
				: null,
		};
	});
	return { config, attributes, images };
}

function fulfill(root: string, workspace: string, workspacePrefix: string, committed: string): void {
	const commit = readCommit(root, committed);
	const published = parseCommitDisclosures(commit.message).filter(entry => entry.workspacePrefix === workspacePrefix);
	const live = readPendingDisclosures(workspace);
	const candidates = live.filter(record =>
		published.some(entry => JSON.stringify(entry.record) === JSON.stringify(record)),
	);
	const paths = [
		...new Set(
			candidates.flatMap(record => record.attempt.files.map(file => effectPath(workspacePrefix, file.path))),
		),
	];
	refusePrivatePaths(
		treeRows(root, commit.tree, []).map(row => row.slice(row.indexOf("\t") + 1)),
		privateArtifacts(workspacePrefix),
	);
	let covered: PendingDisclosure[] = [];
	if (paths.length) {
		const tree = treeBlobs(root, commit.tree, paths);
		const first = canonicalImages(root, paths);
		const second = canonicalImages(root, paths);
		const final = canonicalImages(root, paths, false);
		const unfiltered = { ...second, images: second.images.map(image => ({ ...image, blob: null })) };
		if (
			JSON.stringify(first) !== JSON.stringify(second) ||
			JSON.stringify(unfiltered) !== JSON.stringify(final) ||
			head(root) !== committed
		)
			throw new Error(
				"canonical content, Git attributes/configuration or successful HEAD changed during acknowledgment",
			);
		const canonical = new Map(second.images.map(image => [image.path, image.blob]));
		covered = candidates.filter(record =>
			record.attempt.files.every(file => {
				const path = effectPath(workspacePrefix, file.path);
				return tree.get(path) === canonical.get(path);
			}),
		);
	}
	const result = acknowledgePendingDisclosures(workspace, covered);
	console.error(
		`Turnstile commit succeeded: acknowledged ${result.removed.length} complete disclosure(s); ${result.retained} pending record(s) retained at the storage transaction${result.retained ? " (missing exact message or complete canonical coverage, or newer records). Use an ordinary commit carrying each full disclosure; --allow-empty is available when only disclosure remains" : ""}.`,
	);
}

/** Conservative intent relevance. Hashes cannot locate an excepted hunk in a later image. */
export function relevantDisclosures(
	root: string,
	beforeTree: string,
	tree: string,
	entries: CommitDisclosure[],
): CommitDisclosure[] {
	const changed = new Set(
		git(root, ["diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z", oid(beforeTree), oid(tree)])
			.toString("utf8")
			.split("\0"),
	);
	const paths = [
		...new Set(
			entries.flatMap(entry => entry.record.attempt.files.map(file => effectPath(entry.workspacePrefix, file.path))),
		),
	];
	if (paths.length) treeRows(root, beforeTree, paths);
	const images = treeImages(root, tree, paths);
	return entries.filter(entry =>
		entry.record.attempt.files.some(file => {
			const path = effectPath(entry.workspacePrefix, file.path);
			return changed.has(path) && images.get(path) !== file.beforeSha256;
		}),
	);
}
function pending(workspace: string, workspacePrefix: string): CommitDisclosure[] {
	return readPendingDisclosures(workspace).map(record => ({ version: 1, workspacePrefix, semantics, record }));
}
function requireEntries(message: string, required: CommitDisclosure[]): void {
	const entries = parseCommitDisclosures(message);
	for (const entry of required) {
		const actual = entries.find(
			value => value.workspacePrefix === entry.workspacePrefix && value.record.id === entry.record.id,
		);
		if (!actual || JSON.stringify(actual) !== JSON.stringify(entry))
			throw new Error(
				`commit message lacks exact disclosure ${entry.record.id}; preserve its complete Turnstile-Disclosure line. For replacement-message amend use --amend -c HEAD/--no-edit, or retain the full existing disclosure explicitly`,
			);
	}
}

function processStarted(pid: number): string | undefined {
	if (process.platform !== "win32")
		throw new Error("this installation requires verified Windows native Git/Bun hook process identity");
	if (!Number.isSafeInteger(pid) || pid <= 1) throw new Error("native Git parent process is unavailable");
	const started = execFileSync(
		"powershell.exe",
		[
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			`try { [System.Diagnostics.Process]::GetProcessById(${pid}).StartTime.ToUniversalTime().Ticks } catch [System.ArgumentException] { 'absent' }`,
		],
		{ encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
	).trim();
	if (started === "absent") return undefined;
	if (!/^\d{18}$/.test(started)) throw new Error("native Git process creation identity is unavailable");
	return started;
}
function witness(path: string): Witness | undefined {
	if (!existsSync(path)) return undefined;
	const value = JSON.parse(readFileSync(path, "utf8"));
	if (
		!value ||
		!["head,pid,started,tree", "committed,head,pid,started,tree,validated"].includes(
			Object.keys(value).sort().join(),
		) ||
		!Number.isSafeInteger(value.pid) ||
		value.pid <= 1 ||
		!/^\d{18}$/.test(value.started)
	)
		throw new Error("invalid local commit witness; pending records are unchanged");
	return {
		pid: value.pid,
		started: value.started,
		head: value.head === null ? null : oid(value.head),
		tree: oid(value.tree),
		// Preparation-only witnesses have no success evidence, including after an upgrade.
		validated: value.validated === null || !("validated" in value) ? null : oid(value.validated),
		committed: value.committed === null || !("committed" in value) ? null : oid(value.committed),
	};
}
function removeWitness(path: string): void {
	try {
		unlinkSync(path);
	} catch (e) {
		if (!(e && typeof e === "object" && "code" in e && e.code === "ENOENT")) throw e;
	}
}
function repository(): { root: string; dir: string } {
	const root = realpathSync(text(process.cwd(), "rev-parse", "--show-toplevel"));
	const dir = realpathSync(text(root, "rev-parse", "--absolute-git-dir"));
	if (realpathSync(resolve(root, text(root, "rev-parse", "--git-common-dir"))) !== dir)
		throw new Error("linked worktrees require separately verified hook ownership; installation refused");
	return { root, dir };
}

export async function runHook(hook: string, args: string[]): Promise<void> {
	try {
		const { root, dir } = repository();
		// History replay is not this ordinary end-of-session commit boundary.
		if (existsSync(join(dir, "rebase-merge")) || existsSync(join(dir, "rebase-apply"))) return;
		const statePath = join(dir, `${witnessName}-${process.ppid}.json`);
		// AUTO_MERGE and other ref housekeeping are not a commit abort or success.
		let transition: string[] | undefined;
		if (hook === "reference-transaction") {
			if (!["prepared", "committed", "aborted"].includes(args[0])) return;
			const rows = (await Bun.stdin.text())
				.trim()
				.split("\n")
				.filter(Boolean)
				.map(line => line.trim().split(" "));
			transition = rows.find(row => row.length === 3 && row[2] === "HEAD" && !/^0+$/.test(row[1]));
			if (!transition) return;
			const preparePath = join(dir, "hooks", "prepare-commit-msg");
			if (!existsSync(preparePath) || readFileSync(preparePath, "utf8") !== hookContent("prepare-commit-msg"))
				throw new Error(
					"broken installation: required prepare-commit-msg hook is missing or differs from its exact owned bytes; restore the owned hook before updating HEAD",
				);
		}
		const config = JSON.parse(readFileSync(join(dir, setupName), "utf8"));
		if (!config || Object.keys(config).join() !== "workspacePrefix") throw new Error("invalid local commit setup");
		const workspacePrefix = prefix(config.workspacePrefix),
			workspace = join(root, workspacePrefix);
		const started = processStarted(process.ppid);
		if (!started) throw new Error("native Git parent process ended before observation");
		const current = { pid: process.ppid, started };
		if (hook === "prepare-commit-msg") {
			refusePrivatePaths(
				git(root, ["ls-files", "-z"]).toString("utf8").split("\0"),
				privateArtifacts(workspacePrefix),
			);
			if (!args[0]) throw new Error("missing Git message path");
			for (const name of readdirSync(dir)) {
				const match = /^turnstile-commit-attempt-(\d+)\.json$/.exec(name);
				if (!match || Number(match[1]) === current.pid) continue;
				const stalePath = join(dir, name),
					stale = witness(stalePath);
				if (stale && stale.pid === Number(match[1]) && processStarted(stale.pid) !== stale.started)
					removeWitness(stalePath);
			}
			const entries = pending(workspace, workspacePrefix);
			const previous = head(root),
				tree = text(root, "write-tree");
			const messagePath = resolve(root, args[0]);
			const message = readFileSync(messagePath, "utf8");
			const existing = parseCommitDisclosures(message);
			const required = relevantDisclosures(
				root,
				previous ? readCommit(root, previous).tree : emptyTree(root),
				tree,
				entries,
			);
			const missing = required.filter(
				entry =>
					!existing.some(
						value => value.workspacePrefix === entry.workspacePrefix && value.record.id === entry.record.id,
					),
			);
			requireEntries(
				message,
				required.filter(entry => !missing.includes(entry)),
			);
			// Git removes scissors tails after hooks; keep new data before an existing cut.
			if (missing.length) {
				const cut = message.search(/^.* ------------------------ >8 ------------------------\r?$/m);
				const position = cut < 0 ? message.length : cut;
				writeFileSync(
					messagePath,
					`${message.slice(0, position).trimEnd()}\n\n${missing.map(entry => formatCommitDisclosure(entry.workspacePrefix, entry.record)).join("\n")}\n${message.slice(position)}`,
				);
			}
			writeFileSync(
				statePath,
				JSON.stringify({ ...current, head: previous, tree, validated: null, committed: null }),
				{ mode: 0o600 },
			);
			return;
		}
		const prepared = witness(statePath);
		if (!prepared) {
			if (hook === "post-commit")
				throw new Error(
					"Git commit succeeded but acknowledgment skipped: missing invocation success evidence; retry with an ordinary commit carrying the complete disclosure (--allow-empty if needed)",
				);
			return;
		}
		if (prepared.pid !== current.pid || prepared.started !== current.started) {
			removeWitness(statePath);
			if (hook === "post-commit")
				throw new Error("Git commit succeeded but acknowledgment skipped: invocation identity mismatch");
			return;
		}
		if (hook === "post-commit") {
			try {
				if (!prepared.committed || prepared.committed !== prepared.validated || head(root) !== prepared.committed)
					throw new Error("missing or inconsistent successful HEAD evidence");
				fulfill(root, workspace, workspacePrefix, prepared.committed);
			} finally {
				try {
					removeWitness(statePath);
				} catch (error) {
					console.error(
						`Turnstile Git commit succeeded; private witness cleanup failed: ${String(error)}. This does not change the separately reported acknowledgment outcome. Release the file lock or resolve the filesystem error; later preparation can remove the ended invocation witness.`,
					);
					process.exitCode = 1;
				}
			}
			return;
		}
		if (hook !== "reference-transaction" || !transition) throw new Error("unknown commit hook");
		const [old, next] = transition;
		if ((/^0+$/.test(old) ? null : oid(old)) !== prepared.head)
			throw new Error("Git HEAD changed since message preparation");
		if (args[0] === "aborted") {
			removeWitness(statePath);
			return;
		}
		if (args[0] === "committed") {
			if (prepared.validated !== oid(next) || head(root) !== next)
				throw new Error("successful HEAD callback lacks matching validated commit evidence");
			writeFileSync(statePath, JSON.stringify({ ...prepared, committed: next }), { mode: 0o600 });
			return;
		}
		const commit = readCommit(root, next),
			previous = prepared.head ? readCommit(root, prepared.head) : undefined;
		refusePrivatePaths(
			treeRows(root, commit.tree, []).map(row => row.slice(row.indexOf("\t") + 1)),
			privateArtifacts(workspacePrefix),
		);
		const ordinary = previous ? commit.parents[0] === prepared.head : commit.parents.length === 0;
		const amend = previous !== undefined && JSON.stringify(commit.parents) === JSON.stringify(previous.parents);
		if (!ordinary && !amend) throw new Error("prepared commit has unexpected Git parents");
		if (commit.tree !== prepared.tree)
			throw new Error("effective commit index changed after message preparation; retry the ordinary commit");
		const beforeTree = commit.parents.length ? readCommit(root, commit.parents[0]).tree : emptyTree(root);
		const required = relevantDisclosures(root, beforeTree, commit.tree, pending(workspace, workspacePrefix));
		if (amend) required.push(...parseCommitDisclosures(previous!.message));
		requireEntries(commit.message, required);
		writeFileSync(statePath, JSON.stringify({ ...prepared, validated: oid(next), committed: null }), { mode: 0o600 });
	} catch (error) {
		const outcome =
			hook === "post-commit" ? "Git commit succeeded; acknowledgment outcome unknown" : "commit boundary";
		const recovery =
			hook === "post-commit"
				? "Inspect pending disclosures with the ordinary reader; resolve the error and retry only outstanding full records in an ordinary commit (--allow-empty if needed)."
				: "Pending disclosure records were not retired.";
		console.error(
			`Turnstile ${outcome}: ${error instanceof Error ? error.message : String(error)}${error instanceof Error && error.cause ? `: ${String(error.cause)}` : ""}. ${recovery}`,
		);
		process.exitCode = 1;
	}
}

export function installCommitHooks(workspace: string): void {
	if (process.platform !== "win32" || !text(process.cwd(), "--version").includes(".windows."))
		throw new Error("installer supports the verified native Windows Git/Bun hook boundary only");
	const { root, dir } = repository();
	workspace = realpathSync(workspace);
	const workspacePrefix = prefix(relative(root, workspace).split(sep).join("/"));
	if (isAbsolute(workspacePrefix)) throw new Error("workspace must be inside this Git worktree");
	readPendingDisclosures(workspace);
	const configured = spawnSync("git", ["-C", root, "config", "--show-origin", "--get-all", "core.hooksPath"], {
		encoding: "utf8",
		windowsHide: true,
	});
	if (configured.status !== 1)
		throw new Error(
			"existing or unreadable core.hooksPath; preserve and explicitly resolve hook ownership before installation",
		);
	const tracked = git(root, ["ls-files", "-z"]).toString("utf8").split("\0");
	const artifacts = privateArtifacts(workspacePrefix);
	refusePrivatePaths(tracked, artifacts);
	if (/\s/.test(process.execPath)) throw new Error("direct Bun hook interpreter path cannot contain whitespace");
	const contents = hooks.map(hook => ({
		path: join(dir, "hooks", hook),
		content: hookContent(hook),
	}));
	const config = JSON.stringify({ workspacePrefix });
	for (const item of [...contents, { path: join(dir, setupName), content: config }]) {
		if (existsSync(item.path) && readFileSync(item.path, "utf8") !== item.content)
			throw new Error("existing commit hook/setup ownership differs; nothing was overwritten");
	}
	const excludePath = join(dir, "info", "exclude");
	const exclude = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";
	const existingPatterns = exclude.split(/\r?\n/);
	const missingPatterns = artifacts
		.map(path => `/${path.replace(/[\\*?[\]#!]/g, "\\$&")}`)
		.filter(pattern => !existingPatterns.includes(pattern));
	const updatedExclude = missingPatterns.length
		? `${exclude}${exclude.endsWith("\n") || !exclude ? "" : "\n"}${missingPatterns.join("\n")}\n`
		: exclude;
	const created: { path: string; content: string }[] = [];
	try {
		for (const item of [...contents, { path: join(dir, setupName), content: config }]) {
			if (!existsSync(item.path)) {
				writeFileSync(item.path, item.content, { flag: "wx", mode: 0o600 });
				created.push(item);
			}
		}
		for (const item of contents) chmodSync(item.path, 0o700);
		if (updatedExclude !== exclude) writeFileSync(excludePath, updatedExclude);
	} catch (error) {
		for (const item of created.reverse()) {
			if (readFileSync(item.path, "utf8") === item.content) unlinkSync(item.path);
		}
		if (existsSync(excludePath) && readFileSync(excludePath, "utf8") === updatedExclude && updatedExclude !== exclude)
			writeFileSync(excludePath, exclude);
		throw new Error("hook installation failed; exclusively created owned files were rolled back", { cause: error });
	}
	console.log(
		`Turnstile ordinary Git hooks installed for workspacePrefix=${JSON.stringify(workspacePrefix)}; only verified successful full-message and complete canonical coverage acknowledges pending records.`,
	);
}

if (import.meta.main) {
	try {
		const [command, workspace, ...extra] = process.argv.slice(2);
		if (command !== "install" || !workspace || extra.length)
			throw new Error("Usage: bun tools/turnstile-commits.ts install <launch-workspace>");
		installCommitHooks(workspace);
	} catch (error) {
		console.error(`Turnstile commit setup: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	}
}
