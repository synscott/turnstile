import { createHash, randomUUID } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext, EditPreparedEvent, WritePreparedEvent } from "@oh-my-pi/pi-coding-agent";
import { appendPendingDisclosure, readPendingDisclosures, type DisclosureInput } from "../tools/turnstile-disclosures";

function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected an object");
	return value as Record<string, unknown>;
}

type Prepared = EditPreparedEvent | WritePreparedEvent;
type HeldAttempt = Omit<DisclosureInput, "reason"> & { hold: string; context: string };
const rule = "clippy::await_holding_lock";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const imageHash = (value: string | null) => (value === null ? null : sha256(value));

/**
 * Deterministic re-serialization of the caller's parsed argument object: object
 * keys sorted recursively, arrays and scalars untouched. Caller key order is a
 * serialization artifact, not a property of the native final effective input, so
 * it is normalized before the attempt identity is computed. Values are never
 * merged or rewritten: different path spelling, different argument values, and
 * arguments that happen to produce the same bytes still change the digest.
 */
function canonicalizeKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalizeKeys);
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const record = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(record).sort()) out[key] = canonicalizeKeys(record[key]);
		return out;
	}
	return value;
}

function workspacePath(workspace: string, path: string): string {
	const name = relative(workspace, path).split(sep).join("/");
	if (!name || isAbsolute(name) || name.split("/").includes("..") || name.includes(":"))
		throw new Error("no_rly effect is outside the launch workspace");
	return name;
}

/** Only the native vector supplies effects; this does not reconstruct edits. */
function attemptIdentity(event: Prepared, workspace: string): DisclosureInput["attempt"] {
	const files = new Map<string, DisclosureInput["attempt"]["files"][number]>();
	const effect = (path: string, before: string | null, after: string | null) => {
		const name = workspacePath(workspace, path);
		const previous = files.get(name);
		files.set(name, {
			path: name,
			beforeSha256: previous ? previous.beforeSha256 : imageHash(before),
			afterSha256: imageHash(after),
		});
	};
	for (const operation of event.operations) {
		if (operation.op === "noop") continue;
		if (operation.op === "move") {
			effect(operation.moveTo!, operation.moveBefore, operation.after);
			effect(operation.path, operation.before, null);
		} else effect(operation.path, operation.before, operation.after);
	}
	return {
		tool: event.type === "edit_prepared" ? "edit" : "write",
		sha256: sha256(
			JSON.stringify({
				type: event.type,
				mode: "mode" in event ? event.mode : null,
				input: canonicalizeKeys(event.input),
				operations: event.operations,
			}),
		),
		files: [...files.values()].filter(file => file.beforeSha256 !== null || file.afterSha256 !== null),
	};
}

function completedCheck(value: unknown): boolean {
	const check = object(value);
	return (
		check.exit_code === 0 &&
		Array.isArray(check.build_finished) &&
		check.build_finished.length === 1 &&
		check.build_finished[0] === true
	);
}

/** A named, unambiguous introduced finding, never a required-check failure. */
function selectedFinding(
	result: Record<string, unknown>,
	attempt: DisclosureInput["attempt"],
	root: string,
	workspace: string,
): HeldAttempt | undefined {
	if (
		result.outcome !== "findings" ||
		!Array.isArray(result.findings) ||
		result.findings.length !== 1 ||
		!Array.isArray(result.ambiguous_findings) ||
		result.ambiguous_findings.length !== 0 ||
		result.originals_unchanged !== true ||
		result.analyzed_sources_unchanged !== true ||
		typeof result.original_snapshot_sha256 !== "string" ||
		!/^[a-f0-9]{64}$/.test(result.original_snapshot_sha256) ||
		!completedCheck(result.candidate_check)
	)
		return;
	const candidate = object(result.candidate_check);
	if (
		candidate.outcome !== "findings" ||
		!Array.isArray(candidate.diagnostics) ||
		candidate.diagnostics.some(value => object(value).level === "error")
	)
		return;
	const baseline = object(result.baseline);
	if (baseline.status !== "not_required" && (baseline.status !== "required" || !completedCheck(baseline.check)))
		return;
	const diagnostic = object(result.findings[0]);
	if (
		object(diagnostic.code).code !== rule ||
		typeof diagnostic.message !== "string" ||
		!Array.isArray(diagnostic.spans)
	)
		return;
	const primary = diagnostic.spans.map(object).filter(span => span.is_primary === true);
	if (primary.length !== 1) return;
	const span = primary[0];
	if (
		typeof span.file_name !== "string" ||
		typeof span.line_start !== "number" ||
		!Number.isSafeInteger(span.line_start) ||
		span.line_start < 1 ||
		typeof candidate.diagnostic_root !== "string"
	)
		return;
	// The analyzer replaces its private copied-context prefix with <candidate>.
	const diagnosticRoot = candidate.diagnostic_root.replaceAll("\\", "/");
	if (diagnosticRoot !== "<candidate>" && !diagnosticRoot.startsWith("<candidate>/")) return;
	const name = span.file_name.replaceAll("\\", "/");
	if (isAbsolute(name) || name.includes(":") || name.includes("<") || name.split("/").includes("..")) return;
	const path = workspacePath(
		workspace,
		resolve(root, diagnosticRoot.slice("<candidate>".length).replace(/^\//, ""), name),
	);
	if (!attempt.files.some(file => file.path === path && file.afterSha256 !== null)) return;
	return {
		hold: randomUUID(),
		attempt,
		context: result.original_snapshot_sha256,
		finding: {
			rule,
			sha256: sha256(JSON.stringify(diagnostic)),
			path,
			line: span.line_start,
			message: diagnostic.message,
		},
	};
}

/** Explicit workspace opt-in; native OMP owns edit reconstruction and final write bytes. */
export default async function turnstile(api: ExtensionAPI) {
	const workspace = process.cwd();
	const configPath = join(workspace, ".omp", "turnstile.json");
	let config:
		| { context: Record<string, unknown>; python: string; cargo: string; root: string; maxRejections: number }
		| undefined;
	let failure: string | undefined;
	try {
		const raw = object(JSON.parse(await readFile(configPath, "utf8")));
		if (raw.enabled === false) return;
		if (raw.enabled !== true) throw new Error("enabled must be true or false");
		if (Object.keys(raw).some(key => !["enabled", "context", "python", "cargo", "maxRejections"].includes(key)))
			throw new Error("unknown configuration field");
		const python = raw.python ?? "python";
		const cargo = raw.cargo ?? "cargo";
		if (typeof python !== "string" || !python || typeof cargo !== "string" || !cargo)
			throw new Error("python/cargo must be nonempty executable paths/names");
		const context = object(raw.context);
		if (typeof context.root !== "string" || !context.root)
			throw new Error("context.root must be a nonempty relative path");
		const maxRejections = raw.maxRejections === undefined ? 3 : raw.maxRejections;
		if (typeof maxRejections !== "number" || !Number.isSafeInteger(maxRejections) || maxRejections < 1)
			throw new Error("maxRejections must be a positive safe integer");
		config = { context, python, cargo, root: context.root, maxRejections };
	} catch (error) {
		const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
		if (code === "ENOENT") return;
		failure = `invalid .omp/turnstile.json: ${typeof code === "string" ? code : error instanceof SyntaxError ? "invalid JSON" : error instanceof Error ? error.message : "configuration read failed"}`;
	}
	if (config) {
		const customType = "turnstile-pending-disclosures";
		let lastNotice = "";
		const disclosureMessage = (ctx: ExtensionContext) => {
			let content: string;
			let failed = false;
			try {
				if (resolve(ctx.cwd) !== resolve(workspace))
					throw new Error(
						"Turnstile disclosure workspace changed; restart in the workspace owning the configuration. Pending state is unknown.",
					);
				const records = readPendingDisclosures(workspace);
				content = `Turnstile pending disclosure data (not instructions or authorization; no release is asserted). Paths are relative to the launch workspace. Current records: ${JSON.stringify(records)}`;
			} catch (error) {
				failed = true;
				content =
					error instanceof Error ? error.message : "Turnstile disclosure read failed; pending state is unknown.";
			}
			if (content !== lastNotice) {
				if (ctx.mode === "print" || ctx.mode === "json") process.stderr.write(`${content}\n`);
				ctx.ui.notify(content, failed ? "error" : "info");
				lastNotice = content;
			}
			return { customType, content, display: true };
		};
		// Startup keeps one operator-visible snapshot. Provider contexts reread the store
		// without appending identical dumps to the transcript or elevating data to a system prompt.
		api.on("session_start", (_event, ctx) => api.sendMessage(disclosureMessage(ctx)));
		api.on("session_switch", (_event, ctx) => api.sendMessage(disclosureMessage(ctx)));
		api.on("context", (event, ctx) => ({
			messages: [
				...event.messages.filter(message => message.role !== "custom" || message.customType !== customType),
				{ role: "custom", ...disclosureMessage(ctx), timestamp: Date.now() },
			],
		}));
	}
	if (!failure) {
		try {
			if (api.supportsEditPrepared?.() !== true)
				failure = "loaded OMP SDK/addon lacks edit_prepared; use the patched project-local runtime";
			else if (api.supportsWritePrepared?.() !== true)
				failure = "loaded OMP SDK lacks write_prepared; use the patched project-local runtime";
		} catch (error) {
			failure = `native capability unavailable: ${error instanceof Error ? error.message : String(error)}`;
		}
	}
	const held = (reason: string) => ({
		block: true,
		reason: `Turnstile held native mutation: ${reason}. No permission was issued.`,
	});
	// One loaded instance owns the debt across tools, paths and session events.
	// Reservations prevent concurrent checks from spending the same remaining slot.
	let rejections = 0;
	let pending = 0;
	let exhausted = false;
	let live: HeldAttempt | undefined;
	let arm: { held: HeldAttempt; reason: string; owner?: string } | undefined;
	// Why the previous arm is no longer armed, surfaced once to the next refusal so
	// a destroyed/consumed arm is distinguishable from a first-time refusal.
	let lastArm: { destroyed: string } | undefined;
	// Only observed calls can own the next exception attempt. Prepared IDs differ
	// for same-tool invokeTool, so they are deliberately not treated as outer IDs.
	const active = new Map<string, string>();
	let generation = 0;
	const invalidate = () => {
		generation++;
		live = undefined;
		if (arm) lastArm = { destroyed: "cleared by a session state reset" };
		arm = undefined;
	};
	const finishCall = (id: string) => {
		active.delete(id);
		if (arm?.owner === id) {
			arm = undefined;
			generation++;
			lastArm = { destroyed: "consumed: the armed call already completed (one-use arm)" };
		}
	};
	api.on("tool_result", event => finishCall(event.toolCallId));
	api.on("tool_execution_end", event => finishCall(event.toolCallId));
	const resetLive = () => {
		invalidate();
		active.clear();
	};
	api.on("session_start", resetLive);
	api.on("session_switch", resetLive);
	api.on("session_branch", resetLive);
	api.on("session_tree", resetLive);
	api.on("session_shutdown", resetLive);
	api.on("agent_end", () => {
		active.clear();
		if (arm) lastArm = { destroyed: "cleared at agent turn end" };
		arm = undefined;
		generation++;
	});
	let noticePending = false;
	let exhaustionReason = failure
		? `Turnstile configuration/capability failure; zero checks ran. Native edits and writes remain held, and this mutation turn is stopped. Read-only work remains available. Restart/reload after correcting the configuration/runtime.\n${failure}`
		: "";
	const announce = (ctx: ExtensionContext) => {
		if (ctx.mode === "print" || ctx.mode === "json") process.stderr.write(`${exhaustionReason}\n`);
		ctx.ui.notify(exhaustionReason, "error");
		if (ctx.isIdle()) {
			api.sendMessage({
				customType: failure ? "turnstile-stopped" : "turnstile-exhausted",
				content: exhaustionReason,
				display: true,
			});
			noticePending = false;
		} else {
			noticePending = true;
		}
	};
	const stop = (ctx: ExtensionContext) => {
		announce(ctx);
		ctx.abort();
		return held(exhaustionReason);
	};
	api.on("agent_end", (_event, ctx) => {
		if (noticePending) announce(ctx);
	});
	api.on("tool_call", (event, ctx) => {
		generation++;
		active.set(event.toolCallId, event.toolName);
		if (arm) {
			if (!arm.owner && active.size === 1 && event.toolName === arm.held.attempt.tool) arm.owner = event.toolCallId;
			else {
				arm = undefined;
				lastArm = { destroyed: "destroyed by an intervening or non-matching tool call" };
			}
		}
		if (event.toolName !== "no_rly") live = undefined;
		if ((failure || exhausted) && (event.toolName === "edit" || event.toolName === "write")) return stop(ctx);
	});
	if (failure) {
		api.on("session_start", (_event, ctx) => announce(ctx));
		return;
	}
	const enabled = config!;
	api.registerTool({
		name: "no_rly",
		label: "Last-resort rule exception",
		description:
			"Explicit last-resort exception for one live held native edit/write and named clippy finding. Prefer revising. Explain why revision is unsuitable. This arms only the immediately next exact native attempt; no mutation occurs here, required checks and native authority remain active. Exhaustion cannot be overridden.",
		approval: "write",
		loadMode: "essential",
		parameters: api.typebox.Type.Object({
			hold: api.typebox.Type.String({ minLength: 1, description: "Live hold ID from the held native result" }),
			finding: api.typebox.Type.String({ minLength: 1, description: "Exact named finding SHA256 from that result" }),
			reason: api.typebox.Type.String({
				minLength: 1,
				description: "Public-safe last-resort rationale; explain why revision is unsuitable, without raw source",
			}),
		}),
		async execute(id, params, signal, _update, ctx) {
			signal?.throwIfAborted();
			const selected = live;
			live = undefined;
			arm = undefined;
			if (exhausted) return { content: [{ type: "text", text: stop(ctx).reason }], isError: true };
			if (
				!selected ||
				selected.hold !== params.hold ||
				selected.finding.sha256 !== params.finding ||
				!params.reason.trim() ||
				pending !== 0 ||
				active.size !== 1 ||
				active.get(id) !== "no_rly"
			)
				return {
					content: [
						{
							type: "text",
							text: "no_rly refused: no matching exclusive live held attempt/finding. No permission or record was issued.",
						},
					],
					isError: true,
				};
			arm = { held: selected, reason: params.reason.trim() };
			lastArm = undefined;
			return {
				content: [
					{
						type: "text",
						text: `no_rly armed for exactly the next ${selected.attempt.tool} call. Repeat its original argument values with no intervening tool call. Caller key order is normalized before comparison, so it need not be reproduced. A fresh full check and durable disclosure must succeed before native release. This is not an application receipt.`,
					},
				],
			};
		},
	});

	api.on("session_start", (_event, ctx) =>
		ctx.ui.notify(
			`Turnstile enabled: native edits and writes require clippy::await_holding_lock analysis; ${enabled.maxRejections} cumulative rejections exhaust this loaded gate. Passing is not global correctness or safety.`,
			"info",
		),
	);
	const check = async (event: EditPreparedEvent | WritePreparedEvent, ctx: ExtensionContext) => {
		const requested = arm;
		arm = undefined;
		live = undefined;
		const version = ++generation;
		const outer = active.size === 1 ? [...active.entries()][0] : undefined;
		const owner = outer?.[1] === (event.type === "edit_prepared" ? "edit" : "write") ? outer[0] : undefined;
		const exclusive = () => generation === version && active.size === 1 && owner !== undefined && active.has(owner);
		const exception = requested;
		if (exhausted) return stop(ctx);
		if (rejections + pending >= enabled.maxRejections)
			return held("remaining rejection slots are reserved by in-flight checks; wait for those checks to finish");
		pending++;
		let permitted = false;
		let reason = "";
		let selected: HeldAttempt | undefined;
		try {
			if (resolve(ctx.cwd) !== resolve(workspace))
				throw new Error("workspace changed; restart to load its explicit configuration");
			if (typeof ctx.exec !== "function")
				throw new Error(
					"loaded OMP SDK lacks handler-managed edit checking; apply the current project-local patch",
				);
			const [root, temporary] = await Promise.all([realpath(resolve(workspace, enabled.root)), realpath(tmpdir())]);
			const location = relative(root, temporary);
			if (location === "" || (!isAbsolute(location) && location !== ".." && !location.startsWith(`..${sep}`))) {
				throw new Error(
					"the process temporary directory is inside the selected Cargo context; choose an external TEMP/TMP",
				);
			}
			const checker = resolve(dirname(fileURLToPath(import.meta.url)), "../tools/rust_candidates.py");
			const process = await ctx.exec(enabled.python, [checker, "--staged"], {
				cwd: workspace,
				isolatedTemp: true,
				input: JSON.stringify({
					context: enabled.context,
					workspace,
					cargo: enabled.cargo,
					operations: event.operations,
				}),
			});
			if (process.killed || process.code !== 0) {
				reason = `required checker process failed (${process.code}): ${process.stderr || process.stdout}`;
			} else {
				const result = object(JSON.parse(process.stdout));
				permitted =
					result.outcome === "no_findings" &&
					Array.isArray(result.findings) &&
					result.findings.length === 0 &&
					completedCheck(result.candidate_check);
				if (!permitted) selected = selectedFinding(result, attemptIdentity(event, workspace), root, workspace);
				if (exception) {
					permitted = false;
					let invalidated: string | undefined;
					if (!exclusive())
						invalidated =
							"exclusivity: another call is active, or the armed call is not the sole observed outer call";
					else if (!selected)
						invalidated = "selected finding: the fresh check produced no matching single introduced finding";
					else if (selected.attempt.sha256 !== exception.held.attempt.sha256)
						invalidated =
							"attempt identity: the native final effective input (argument values, path spelling or vector) no longer matches the held attempt";
					else if (selected.context !== exception.held.context)
						invalidated = "Cargo context: the original snapshot no longer matches the held attempt";
					else if (selected.finding.sha256 !== exception.held.finding.sha256)
						invalidated = "selected finding: the freshly rechecked diagnostic no longer matches the held finding";
					if (invalidated) {
						reason = `no_rly invalidated: ${invalidated}`;
					} else {
						// Synchronous SQLite commit/readback must finish before returning native permission.
						// The record describes attempted authorization, not successful native application.
						appendPendingDisclosure(workspace, {
							attempt: selected.attempt,
							finding: selected.finding,
							reason: exception.reason,
						});
						lastArm = { destroyed: "consumed: the one-use arm was spent by the preceding release" };
						permitted = true;
					}
				}
				// Preserve actual diagnostic spans, rendered Clippy explanation and failure causes.
				if (!permitted && !reason)
					reason = `required clippy::await_holding_lock check returned ${result.outcome ?? "invalid output"}\n${JSON.stringify(result)}`;
			}
		} catch (error) {
			reason = `required check unavailable: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			pending--;
			if (!permitted) rejections++;
		}
		if (exhausted) return stop(ctx);
		if (permitted) return;
		if (rejections >= enabled.maxRejections) {
			exhausted = true;
			invalidate();
			exhaustionReason = `Turnstile revision limit exhausted (${rejections}/${enabled.maxRejections}). Native edits and writes remain held; no permission was issued. The retry turn is stopped. Read-only work remains available. Restart/reload explicitly begins a new gate budget; session events and successful calls do not reset it.\nLast rejection: ${reason}`;
			return stop(ctx);
		}
		if (!permitted && !requested && lastArm) {
			reason = `no armed exception: ${lastArm.destroyed}. Re-arm from a fresh hold.\n${reason}`;
			lastArm = undefined;
		}
		if (selected && exclusive() && !requested) {
			live = selected;
			reason += `\nLast-resort no_rly is available before exhaustion only: hold=${selected.hold} finding=${selected.finding.sha256} rule=${selected.finding.rule} path=${selected.finding.path}:${selected.finding.line}. Prefer revision; an explicit rationale is required, not proof that alternatives are exhausted.`;
		}
		return held(
			`${reason}\nRejections: ${rejections}/${enabled.maxRejections}; this rejection remains charged after successful calls`,
		);
	};
	api.on("edit_prepared", check);
	api.on("write_prepared", check);
}
