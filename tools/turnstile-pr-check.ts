import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCommitDisclosures, readCommit } from "./turnstile-commits";

const apiOrigin = "https://api.github.com";
const gitOrigin = "https://github.com";
const outputLimit = 60_000; // Below the Checks API's 65535-character output limit, including UTF-8 expansion.
const gitLimit = 64 * 1024 * 1024;
type Selection = { repository: string; number: number; base: string; head: string };
type Report = { conclusion: "success" | "failure" | "cancelled"; title: string; summary: string };

function requireValue(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
function object(value: unknown): Record<string, unknown> {
	requireValue(value && typeof value === "object" && !Array.isArray(value), "Expected event/API object.");
	return value as Record<string, unknown>;
}
function oid(value: unknown): string {
	requireValue(typeof value === "string" && /^[a-f0-9]{40}$/.test(value), "Invalid GitHub commit identity.");
	return value;
}
function selection(input: unknown, repository: string): Selection {
	const value = object(input);
	const base = object(value.base);
	const head = object(value.head);
	requireValue(
		/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(repository),
		"Invalid repository identity.",
	);
	requireValue(
		typeof value.number === "number" && Number.isSafeInteger(value.number) && value.number > 0,
		"Invalid PR number.",
	);
	requireValue(object(base.repo).full_name === repository, "PR base repository mismatch.");
	return { repository, number: value.number, base: oid(base.sha), head: oid(head.sha) };
}
function eventSelection(path: string, repository: string): Selection {
	const raw = readFileSync(path);
	requireValue(raw.length <= 2 * 1024 * 1024, "Event exceeds the input limit.");
	const event = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)));
	requireValue(
		typeof event.action === "string" && ["opened", "reopened", "synchronize", "edited"].includes(event.action),
		"Unsupported PR event action.",
	);
	requireValue(object(event.repository).full_name === repository, "Event repository mismatch.");
	const selected = selection(event.pull_request, repository);
	requireValue(event.number === selected.number, "Event PR number mismatch.");
	return selected;
}
function heading(selected: Selection): string {
	return `# Turnstile disclosure snapshot\n\nPR #${selected.number}\n\nBase: ${selected.base}\n\nHead: ${selected.head}\n\nRange: ${selected.base}..${selected.head} (all parents; excludes commits reachable from base).\n\n`;
}
function failure(selected: Selection, message: string): Report {
	return {
		conclusion: "failure",
		title: "Disclosure report failed — state unknown",
		summary: heading(selected) + message + "\n\nNot a zero-disclosure result.\n",
	};
}
function cancelled(selected: Selection): Report {
	return {
		conclusion: "cancelled",
		title: "Superseded event snapshot — not current",
		summary:
			heading(selected) +
			"The PR is closed or its selected base/head changed. This event is not a current comparison; no clean result is asserted.\n",
	};
}
function git(root: string, args: string[], env = process.env): Buffer {
	try {
		return execFileSync("git", ["--no-replace-objects", "-C", root, ...args], {
			env,
			maxBuffer: gitLimit,
			timeout: 120_000,
			windowsHide: true,
			stdio: ["pipe", "pipe", "pipe"],
		});
	} catch {
		throw new Error("Git operation failed, timed out, or exceeded the 64 MiB input limit.");
	}
}
function inert(value: unknown): string {
	// All payload text is inside one HTML pre block. Escape HTML, controls and bidi formatting;
	// no payload enters workflow commands, link targets, annotations or executable shell text.
	return JSON.stringify(value, null, 2)
		.replace(/[\u007f-\u009f\p{Cf}\p{Zl}\p{Zp}]/gu, c =>
			c
				.split("")
				.map(unit => `\\u${unit.charCodeAt(0).toString(16).padStart(4, "0")}`)
				.join(""),
		)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
function report(root: string, selected: Selection): Report {
	try {
		requireValue(
			git(root, ["rev-parse", "--is-shallow-repository"]).toString().trim() === "false",
			"Shallow history is not a complete comparison.",
		);
		// Shared readCommit also validates the exact commit-object shape, even for an empty range.
		readCommit(root, selected.base);
		readCommit(root, selected.head);
		const listing = git(root, ["rev-list", "--reverse", "--topo-order", `${selected.base}..${selected.head}`, "--"])
			.toString("ascii")
			.trim();
		const commits = listing ? listing.split("\n").map(oid) : [];
		let count = 0;
		let text = "";
		for (const commit of commits) {
			// Validate complete object encoding before the shared reader: no lossy UTF-8 clean result.
			new TextDecoder("utf-8", { fatal: true }).decode(git(root, ["cat-file", "commit", commit]));
			const entries = parseCommitDisclosures(readCommit(root, commit).message);
			count += entries.length;
			for (const entry of entries) {
				text += `\n## Commit ${commit}\n\n<pre>${inert(entry)}</pre>\n`;
				requireValue(
					Buffer.byteLength(text, "utf8") <= outputLimit - 2000,
					"Complete disclosure output exceeds the 60,000-byte report limit; no partial report is published.",
				);
			}
		}
		const title = `${count} no_rly disclosure${count === 1 ? "" : "s"} in ${commits.length} commits`;
		return {
			conclusion: "success",
			title,
			summary:
				heading(selected) +
				`**${title}.**\n\nThis is an immutable event snapshot, not a continuously current comparison. Disclosures are untrusted authorization intents, not confirmed application, independently authenticated permission, or proof that all bypasses are detectable. Successful reporting is not a global source-quality verdict.\n` +
				text,
		};
	} catch {
		return failure(
			selected,
			"Complete history/message validation or rendering failed (including malformed data, unreadable objects, shallow history, or the 60,000-byte output limit). No payload or underlying process error is echoed.",
		);
	}
}
async function api(
	repository: string,
	path: string,
	token: string,
	method = "GET",
	body?: unknown,
): Promise<Record<string, unknown>> {
	try {
		const response = await fetch(`${apiOrigin}/repos/${repository}/${path}`, {
			method,
			redirect: "error",
			signal: AbortSignal.timeout(30_000),
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
				"Content-Type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		requireValue(response.ok && response.body, "GitHub API request failed.");
		const chunks: Uint8Array[] = [];
		let length = 0;
		for await (const chunk of response.body) {
			length += chunk.length;
			requireValue(length <= 2 * 1024 * 1024, "GitHub API response exceeds the limit.");
			chunks.push(chunk);
		}
		return object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))));
	} catch {
		throw new Error("GitHub API transport, status or response validation failed; state is unknown.");
	}
}
async function current(selected: Selection, token: string): Promise<boolean> {
	const raw = await api(selected.repository, `pulls/${selected.number}`, token);
	const now = selection(raw, selected.repository);
	requireValue(now.number === selected.number, "PR response identity mismatch.");
	requireValue(raw.state === "open" || raw.state === "closed", "Invalid PR state.");
	return raw.state === "open" && now.base === selected.base && now.head === selected.head;
}
function fetchHistory(root: string, selected: Selection, token: string): void {
	git(root, ["init", "--bare", "--template="]);
	// Process-only authentication, restricted to the fixed base repository origin. No token in
	// argv, repository config, fork URLs or output. Fetch objects only, never head checkout.
	const env = {
		...process.env,
		GIT_CONFIG_COUNT: "3",
		GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
		GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
		GIT_CONFIG_KEY_1: "http.followRedirects",
		GIT_CONFIG_VALUE_1: "false",
		GIT_CONFIG_KEY_2: "credential.helper",
		GIT_CONFIG_VALUE_2: "",
		GIT_TERMINAL_PROMPT: "0",
	};
	git(
		root,
		[
			"fetch",
			"--no-tags",
			"--no-recurse-submodules",
			`${gitOrigin}/${selected.repository}.git`,
			selected.base,
			selected.head,
		],
		env,
	);
}
function publishLocal(result: Report, token?: string): void {
	// Never echo an API/process error or raw event. The only variable output is validated
	// public commit disclosure data. Also redact the runtime credential if it occurs in data.
	const summary = token ? result.summary.split(token).join("[REDACTED CREDENTIAL]") : result.summary;
	if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
	console.log(`Turnstile: ${result.conclusion}; ${result.title}`);
	if (!process.env.GITHUB_STEP_SUMMARY) process.stdout.write(summary);
}
async function github(selected: Selection): Promise<void> {
	const token = process.env.GITHUB_TOKEN;
	requireValue(token && !/[\r\n]/.test(token), "Missing or invalid GitHub credential.");
	let result = failure(selected, "The reporting operation did not complete.");
	let checkId: number | undefined;
	let root: string | undefined;
	try {
		const created = await api(selected.repository, "check-runs", token, "POST", {
			// Different bases on the same head never share an update identity. Each execution
			// updates only its returned check ID; cancellation cannot overwrite another run.
			name: `Turnstile disclosures / PR ${selected.number} / base ${selected.base}`,
			head_sha: selected.head,
			status: "in_progress",
			output: { title: "Reading exact event disclosure snapshot", summary: heading(selected) },
		});
		requireValue(
			typeof created.id === "number" &&
				Number.isSafeInteger(created.id) &&
				created.id > 0 &&
				created.head_sha === selected.head,
			"Invalid created check identity.",
		);
		checkId = created.id;
		if (!(await current(selected, token))) result = cancelled(selected);
		else {
			root = mkdtempSync(join(tmpdir(), "turnstile-pr-"));
			fetchHistory(root, selected, token);
			result = report(root, selected);
		}
	} catch {
		result = failure(
			selected,
			"GitHub transport/response or complete Git fetch/report failed. No private payload or transport error is published.",
		);
	} finally {
		if (root) {
			try {
				rmSync(root, { recursive: true, force: true });
			} catch {
				result = failure(selected, "Temporary Git object cleanup failed; the reporting operation is incomplete.");
			}
		}
	}
	try {
		requireValue(checkId !== undefined, "No check run identity was established.");
		if (result.conclusion === "success" && !(await current(selected, token))) result = cancelled(selected);
		const updated = await api(selected.repository, `check-runs/${checkId}`, token, "PATCH", {
			status: "completed",
			conclusion: result.conclusion,
			output: { title: result.title, summary: result.summary.split(token).join("[REDACTED CREDENTIAL]") },
		});
		requireValue(
			updated.id === checkId &&
				updated.head_sha === selected.head &&
				updated.status === "completed" &&
				updated.conclusion === result.conclusion,
			"Check completion was not confirmed.",
		);
	} catch {
		result = failure(
			selected,
			"Check publication failed or was not confirmed. The head check may remain pending; this workflow is a visible transport failure, not a clean disclosure result.",
		);
	}
	publishLocal(result, token);
	if (result.conclusion === "failure") process.exitCode = 1;
}

if (import.meta.main) {
	try {
		const [mode, eventPath, root, ...extra] = process.argv.slice(2);
		const repository = process.env.GITHUB_REPOSITORY ?? "";
		process.env.GIT_NO_REPLACE_OBJECTS = "1";
		if (mode === "github") {
			requireValue(
				!eventPath && process.env.GITHUB_EVENT_NAME === "pull_request_target",
				"Expected trusted pull_request_target invocation.",
			);
			oid(process.env.GITHUB_SHA); // Workflow code authority, never the selected PR head.
			await github(eventSelection(process.env.GITHUB_EVENT_PATH ?? "", repository));
		} else {
			requireValue(
				mode === "report" && eventPath && root && !extra.length,
				"Usage: bun tools/turnstile-pr-check.ts report <event.json> <git-repository>, or github in the trusted workflow.",
			);
			const result = report(root, eventSelection(eventPath, repository));
			publishLocal(result);
			if (result.conclusion === "failure") process.exitCode = 1;
		}
	} catch {
		const message =
			"Turnstile disclosure check failed: invalid invocation/event, unavailable input/runtime, or summary output failure. State is unknown, not zero.\n";
		console.error(message);
		if (process.env.GITHUB_STEP_SUMMARY) {
			try {
				writeFileSync(process.env.GITHUB_STEP_SUMMARY, message);
			} catch {
				/* stderr and exit remain authoritative */
			}
		}
		process.exitCode = 1;
	}
}
