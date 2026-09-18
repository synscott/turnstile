import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hookContent, installCommitHooks, processStarted } from "./turnstile-commits";
import { appendPendingDisclosure, initializeDisclosures, readPendingDisclosures } from "./turnstile-disclosures";

const hooks = ["prepare-commit-msg", "reference-transaction", "post-commit"] as const;

function git(root: string, args: string[], input?: string): string {
	const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", input });
	if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
	return result.stdout.trim();
}

function makeRepo(): string {
	const root = mkdtempSync(join(tmpdir(), "turnstile-commits-"));
	git(root, ["init", "-q"]);
	git(root, ["config", "user.name", "Test"]);
	git(root, ["config", "user.email", "test@example.com"]);
	mkdirSync(join(root, "src"));
	writeFileSync(join(root, "src", "lib.rs"), "fn main() {}\n");
	git(root, ["add", "src/lib.rs"]);
	git(root, ["commit", "-q", "-m", "base"]);
	process.chdir(root); // repository() resolves the git root from cwd
	return root;
}

function pendingInput(path = "src/lib.rs") {
	return {
		attempt: {
			tool: "edit" as const,
			sha256: "a".repeat(64),
			files: [{ path, beforeSha256: null, afterSha256: "b".repeat(64) }],
		},
		finding: { rule: "clippy::await_holding_lock", sha256: "c".repeat(64), path, line: 7, message: "test" },
		reason: "test rationale",
	};
}

describe("turnstile commit boundary (Linux port)", () => {
	const originalCwd = process.cwd();
	const roots: string[] = [];
	afterEach(() => {
		process.chdir(originalCwd);
		for (const root of roots) rmSync(root, { recursive: true, force: true });
		roots.length = 0;
	});

	// A1 — installation writes the three owned hooks and sets core.hooksPath.
	test("A1: install writes owned hooks and core.hooksPath", () => {
		const root = makeRepo();
		roots.push(root);
		initializeDisclosures(root);
		installCommitHooks(root);
		const dir = git(root, ["rev-parse", "--absolute-git-dir"]);
		for (const hook of hooks) {
			const path = join(dir, "hooks", hook);
			expect(existsSync(path)).toBe(true);
			expect(readFileSync(path, "utf8")).toBe(hookContent(hook)); // byte-exact owned content
			expect(statSync(path).mode & 0o111).not.toBe(0); // executable
		}
		expect(git(root, ["config", "core.hooksPath"])).toBe(join(dir, "hooks"));
	});

	// A2 — installation refuses on a platform the port does not declare verified.
	test("A2: install refuses on an unverified platform", () => {
		const root = makeRepo();
		roots.push(root);
		initializeDisclosures(root);
		const original = process.platform;
		Object.defineProperty(process, "platform", { value: "darwin" });
		try {
			expect(() => installCommitHooks(root)).toThrow(/verified native Linux/);
		} finally {
			Object.defineProperty(process, "platform", { value: original });
		}
	});

	// W3 — installation refuses on a pre-existing core.hooksPath instead of overwriting it.
	test("W3: install refuses on a pre-existing core.hooksPath", () => {
		const root = makeRepo();
		roots.push(root);
		initializeDisclosures(root);
		git(root, ["config", "core.hooksPath", join(root, "custom-hooks")]);
		expect(() => installCommitHooks(root)).toThrow(/existing or unreadable core.hooksPath/);
	});

// A3 — the identity binds a hook invocation to one process instance (boot_id + starttime).
	test("A3: process identity is boot_id + starttime, distinct across processes", () => {
		const self = processStarted(process.pid);
		expect(self).toBeDefined();
		expect(self).toMatch(/^[0-9a-f-]{36}:\d+$/);
		// A fresh process has a different starttime -> distinguishable identity. The child stays
		// alive on stdin (no fixed timer) so its /proc stat is readable while it lives.
		const child = spawn(process.execPath, ["-e", "process.stdin.resume()"], {
			stdio: ["pipe", "ignore", "ignore"],
		});
		const childIdentity = processStarted(child.pid);
		child.stdin.end();
		child.kill();
		expect(childIdentity).toBeDefined();
		expect(childIdentity).not.toBe(self);
	});

	// A4 — an ordinary commit carries the disclosure line and retires the record.
	test("A4: ordinary commit carries disclosure and retires the record", () => {
		const root = makeRepo();
		roots.push(root);
		initializeDisclosures(root);
		const record = appendPendingDisclosure(root, pendingInput());
		installCommitHooks(root);
		writeFileSync(join(root, "src", "lib.rs"), "fn main() { let x = 1; }\n");
		git(root, ["add", "src/lib.rs"]);
		git(root, ["commit", "-q", "-m", "fix"]);
		const message = git(root, ["log", "-1", "--format=%B"]);
		expect(message).toContain("Turnstile-Disclosure:");
		expect(message).toContain(record.id);
		expect(readPendingDisclosures(root)).toHaveLength(0);
	});

	// A5 — a failed/partial commit does not retire the pending record.
	test("A5: failed commit does not retire the record", () => {
		const root = makeRepo();
		roots.push(root);
		initializeDisclosures(root);
		appendPendingDisclosure(root, pendingInput());
		installCommitHooks(root);
		// A genuinely failing commit: a pre-commit hook that exits non-zero aborts the commit.
		const dir = git(root, ["rev-parse", "--absolute-git-dir"]);
		writeFileSync(join(dir, "hooks", "pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o700 });
		writeFileSync(join(root, "src", "lib.rs"), "fn main() { let y = 2; }\n");
		git(root, ["add", "src/lib.rs"]);
		const result = spawnSync("git", ["-C", root, "commit", "-q", "-m", "failing"], { encoding: "utf8" });
		expect(result.status).not.toBe(0);
		expect(readPendingDisclosures(root)).toHaveLength(1);
	});

	// A6 — the PR-check CLI reports the carried disclosure for a local base..head range.
	test("A6: pr-check reports the disclosure locally", () => {
		const root = makeRepo();
		roots.push(root);
		initializeDisclosures(root);
		appendPendingDisclosure(root, pendingInput());
		installCommitHooks(root);
		const base = git(root, ["rev-parse", "HEAD"]);
		writeFileSync(join(root, "src", "lib.rs"), "fn main() { let z = 3; }\n");
		git(root, ["add", "src/lib.rs"]);
		git(root, ["commit", "-q", "-m", "fix"]);
		const head = git(root, ["rev-parse", "HEAD"]);
		const event = JSON.stringify({
			action: "opened",
			number: 1,
			pull_request: {
				number: 1,
				base: { sha: base, repo: { full_name: "test/repo" } },
				head: { sha: head },
			},
			repository: { full_name: "test/repo" },
		});
		const eventPath = join(root, "pr-event.json");
		writeFileSync(eventPath, event);
		const result = spawnSync(
			process.execPath,
			[resolve(import.meta.dir, "turnstile-pr-check.ts"), "report", eventPath, root],
			{ encoding: "utf8", env: { ...process.env, GITHUB_REPOSITORY: "test/repo" } },
		);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("1 no_rly disclosure in 1 commits");
	});

	// A7 — the win32 branch stays intact; a forced-win32 execution on Linux still refuses.
	test("A7: win32 branch intact; forced-win32 on Linux refuses", () => {
		const root = makeRepo();
		roots.push(root);
		initializeDisclosures(root);
		const original = process.platform;
		Object.defineProperty(process, "platform", { value: "win32" });
		try {
			// On Linux, git --version does not include ".windows." -> the win32 guard refuses.
			expect(() => installCommitHooks(root)).toThrow(/verified native Windows/);
		} finally {
			Object.defineProperty(process, "platform", { value: original });
		}
	});
});
