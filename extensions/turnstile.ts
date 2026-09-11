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
	let config: { context: Record<string, unknown>; python: string; cargo: string; root: string } | undefined;
	let failure: string | undefined;
	try {
		const raw = object(JSON.parse(await readFile(configPath, "utf8")));
		if (raw.enabled === false) return;
		if (raw.enabled !== true) throw new Error("enabled must be true or false");
		if (Object.keys(raw).some(key => !["enabled", "context", "python", "cargo"].includes(key)))
			throw new Error("unknown configuration field");
		const python = raw.python ?? "python";
		const cargo = raw.cargo ?? "cargo";
		if (typeof python !== "string" || !python || typeof cargo !== "string" || !cargo)
			throw new Error("python/cargo must be nonempty executable paths/names");
		const context = object(raw.context);
		if (typeof context.root !== "string" || !context.root)
			throw new Error("context.root must be a nonempty relative path");
		config = { context, python, cargo, root: context.root };
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
	if (failure) {
		api.on("tool_call", event =>
			event.toolName === "edit" || event.toolName === "write" ? held(failure!) : undefined,
		);
		api.on("session_start", (_event, ctx) =>
			ctx.ui.notify(`Turnstile: ${failure}; native edits and writes are blocked`, "error"),
		);
		return;
	}
	const enabled = config!;

	api.on("session_start", (_event, ctx) =>
		ctx.ui.notify(
			"Turnstile enabled: native edits and writes require clippy::await_holding_lock analysis. Passing is not global correctness or safety.",
			"info",
		),
	);
	const check = async (event: EditPreparedEvent | WritePreparedEvent, ctx: ExtensionContext) => {
		if (resolve(ctx.cwd) !== resolve(workspace))
			return held("workspace changed; restart to load its explicit configuration");
		if (typeof ctx.exec !== "function")
			return held("loaded OMP SDK lacks handler-managed edit checking; apply the current project-local patch");
		try {
			const [root, temporary] = await Promise.all([realpath(resolve(workspace, enabled.root)), realpath(tmpdir())]);
			const location = relative(root, temporary);
			if (location === "" || (!isAbsolute(location) && location !== ".." && !location.startsWith(`..${sep}`))) {
				return held(
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
			if (process.killed || process.code !== 0)
				return held(`required checker process failed (${process.code}): ${process.stderr || process.stdout}`);
			const result = object(JSON.parse(process.stdout));
			if (result.outcome === "no_findings") return;
			// Preserve actual diagnostic spans, rendered Clippy explanation and failure causes.
			return held(
				`required clippy::await_holding_lock check returned ${result.outcome ?? "invalid output"}\n${JSON.stringify(result)}`,
			);
		} catch (error) {
			return held(`required check unavailable: ${error instanceof Error ? error.message : String(error)}`);
		}
	};
	api.on("edit_prepared", check);
	api.on("write_prepared", check);
}
