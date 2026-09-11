import { readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext, EditPreparedEvent, WritePreparedEvent } from "@oh-my-pi/pi-coding-agent";

function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected an object");
	return value as Record<string, unknown>;
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
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		failure = `invalid ${configPath}: ${error instanceof Error ? error.message : String(error)}`;
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
		if ((failure || exhausted) && (event.toolName === "edit" || event.toolName === "write")) return stop(ctx);
	});
	if (failure) {
		api.on("session_start", (_event, ctx) => ctx.ui.notify(exhaustionReason, "error"));
		return;
	}
	const enabled = config!;

	api.on("session_start", (_event, ctx) =>
		ctx.ui.notify(
			`Turnstile enabled: native edits and writes require clippy::await_holding_lock analysis; ${enabled.maxRejections} cumulative rejections exhaust this loaded gate. Passing is not global correctness or safety.`,
			"info",
		),
	);
	const check = async (event: EditPreparedEvent | WritePreparedEvent, ctx: ExtensionContext) => {
		if (exhausted) return stop(ctx);
		if (rejections + pending >= enabled.maxRejections)
			return held("remaining rejection slots are reserved by in-flight checks; wait for those checks to finish");
		pending++;
		let permitted = false;
		let reason = "";
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
				const candidate = result.outcome === "no_findings" ? object(result.candidate_check) : undefined;
				permitted =
					result.outcome === "no_findings" &&
					Array.isArray(result.findings) &&
					result.findings.length === 0 &&
					candidate?.exit_code === 0 &&
					Array.isArray(candidate.build_finished) &&
					candidate.build_finished.length === 1 &&
					candidate.build_finished[0] === true;
				// Preserve actual diagnostic spans, rendered Clippy explanation and failure causes.
				if (!permitted)
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
			exhaustionReason = `Turnstile revision limit exhausted (${rejections}/${enabled.maxRejections}). Native edits and writes remain held; no permission was issued. The retry turn is stopped. Read-only work remains available. Restart/reload explicitly begins a new gate budget; session events and successful calls do not reset it.\nLast rejection: ${reason}`;
			return stop(ctx);
		}
		return held(
			`${reason}\nRejections: ${rejections}/${enabled.maxRejections}; this rejection remains charged after successful calls`,
		);
	};
	api.on("edit_prepared", check);
	api.on("write_prepared", check);
}
