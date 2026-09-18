import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import turnstile from "./turnstile";
import { readPendingDisclosures, initializeDisclosures } from "../tools/turnstile-disclosures";

// ---------------------------------------------------------------------------
// Fake OMP API + context harness. The extension is driven exactly as the real
// harness drives it: tool_call / tool_result events around prepared callbacks,
// and a checker subprocess whose stdout is crafted per call. The fake is a
// deliberate test seam, so its shapes are declared here rather than imported
// from the (not locally installed) @oh-my-pi/pi-coding-agent types.
// ---------------------------------------------------------------------------

const RULE = "clippy::await_holding_lock";

interface Diagnostic {
	code: { code: string };
	message: string;
	spans: Array<{ file_name: string; line_start: number; is_primary: boolean }>;
}

interface Operation {
	op: "edit" | "move" | "noop";
	path: string;
	before: string | null;
	after: string | null;
	moveTo?: string;
	moveBefore?: string | null;
}

interface PreparedEvent {
	type: "edit_prepared" | "write_prepared";
	mode: string;
	input: Record<string, unknown>;
	operations: Operation[];
}

interface ToolCallEvent {
	toolCallId: string;
	toolName: string;
}

interface HoldResult {
	block: true;
	reason: string;
}

interface ArmedText {
	content: Array<{ type: string; text: string }>;
}

type Handler = (...args: unknown[]) => unknown;

interface FakeCtx {
	cwd: string;
	mode: string;
	isIdle: () => boolean;
	abort: () => void;
	ui: { notify: () => void };
	exec: (python: string, args: string[], options: unknown) => Promise<{
		killed: boolean;
		code: number;
		stdout: string;
		stderr: string;
	}>;
}

interface ToolDef {
	name: string;
	execute: (
		id: string,
		params: Record<string, unknown>,
		signal: unknown,
		update: unknown,
		ctx: FakeCtx,
	) => unknown;
}

interface FakeApi {
	supportsEditPrepared: () => boolean;
	supportsWritePrepared: () => boolean;
	on: (event: string, fn: Handler) => void;
	registerTool: (tool: ToolDef) => void;
	sendMessage: () => void;
	typebox: { Type: { Object: (o: unknown) => unknown; String: (o: unknown) => unknown } };
}

function diagnostic(message = "this lock is held across an await point"): Diagnostic {
	return {
		code: { code: RULE },
		message,
		spans: [{ file_name: "src/lib.rs", line_start: 7, is_primary: true }],
	};
}

function checkerResult(overrides: { message?: string; snapshot?: string } = {}): Record<string, unknown> {
	const diag = diagnostic(overrides.message);
	return {
		outcome: "findings",
		findings: [diag],
		ambiguous_findings: [],
		originals_unchanged: true,
		analyzed_sources_unchanged: true,
		original_snapshot_sha256: overrides.snapshot ?? "0".repeat(64),
		candidate_check: {
			exit_code: 0,
			build_finished: [true],
			outcome: "findings",
			diagnostics: [diag],
			diagnostic_root: "<candidate>",
		},
		baseline: { status: "not_required" },
	};
}

function isHoldResult(value: unknown): value is HoldResult {
	return (
		typeof value === "object" &&
		value !== null &&
		"block" in value &&
		value.block === true &&
		"reason" in value &&
		typeof value.reason === "string"
	);
}

function isArmedText(value: unknown): value is ArmedText {
	if (typeof value !== "object" || value === null || !("content" in value)) return false;
	const content = value.content;
	return Array.isArray(content) && content.length === 1 && "text" in content[0] && typeof content[0].text === "string";
}

function editEvent(workspace: string, input: Record<string, unknown>): PreparedEvent {
	return {
		type: "edit_prepared",
		mode: "default",
		input,
		operations: [
			{
				op: "edit",
				path: resolve(workspace, "src/lib.rs"),
				before: "fn main() {\n    let lock = m.lock();\n    await f();\n}",
				after: "fn main() {\n    { let lock = m.lock(); }\n    await f();\n}",
			},
		],
	};
}

const INPUT = { path: "src/lib.rs", old_string: "let lock = m.lock();", new_string: "{ let lock = m.lock(); }" };
const PERMUTED_INPUT = { new_string: INPUT.new_string, path: INPUT.path, old_string: INPUT.old_string };

function armCycle(
	handlers: Map<string, Handler>,
	tools: Map<string, ToolDef>,
	ctx: FakeCtx,
	workspace: string,
	input: Record<string, unknown>,
): Promise<{ held: HoldResult; armedText: string; hold: string; finding: string }> {
	return (async () => {
		handlers.get("tool_call")?.({ toolCallId: "c1", toolName: "edit" }, ctx);
		const heldValue = await handlers.get("edit_prepared")?.(editEvent(workspace, input), ctx);
		handlers.get("tool_result")?.({ toolCallId: "c1" });
		if (!isHoldResult(heldValue)) throw new Error("expected a held refusal");
		const match = /hold=([0-9a-f-]+)\s+finding=([0-9a-f]{64})/.exec(heldValue.reason);
		if (!match) throw new Error(`held reason did not name hold/finding: ${heldValue.reason}`);
		const hold = match[1];
		const finding = match[2];
		handlers.get("tool_call")?.({ toolCallId: "c2", toolName: "no_rly" }, ctx);
		const armed = await tools.get("no_rly")?.execute(
			"c2",
			{ hold, finding, reason: "test rationale" },
			undefined,
			undefined,
			ctx,
		);
		handlers.get("tool_result")?.({ toolCallId: "c2" });
		if (!isArmedText(armed)) throw new Error("no_rly did not arm");
		return { held: heldValue, armedText: armed.content[0].text, hold, finding };
	})();
}

describe("no_rly arm (a): canonicalized key order", () => {
	const originalCwd = process.cwd();
	const workspaces: string[] = [];

	function makeWorkspace(): string {
		const workspace = mkdtempSync(join(tmpdir(), "turnstile-test-"));
		mkdirSync(join(workspace, ".omp"));
		mkdirSync(join(workspace, "src"));
		initializeDisclosures(workspace);
		writeFileSync(
			join(workspace, ".omp", "turnstile.json"),
			JSON.stringify({
				enabled: true,
				context: { root: "." },
				python: "python",
				cargo: "cargo",
				maxRejections: 10,
			}),
		);
		writeFileSync(join(workspace, "src", "lib.rs"), "fn main() {}");
		workspaces.push(workspace);
		return workspace;
	}

	function setup(): {
		workspace: string;
		state: { checker: () => Record<string, unknown> };
		api: FakeApi;
		handlers: Map<string, Handler>;
		tools: Map<string, ToolDef>;
		ctx: FakeCtx;
	} {
		const workspace = makeWorkspace();
		process.chdir(workspace);
		const state = { checker: () => checkerResult() };
		const handlers = new Map<string, Handler>();
		const tools = new Map<string, ToolDef>();
		const ctx: FakeCtx = {
			cwd: workspace,
			mode: "json",
			isIdle: () => true,
			abort: () => {},
			ui: { notify: () => {} },
			exec: async (python: string, args: string[], options: unknown) => ({
				killed: false,
				code: 0,
				stdout: JSON.stringify(state.checker()),
				stderr: "",
			}),
		};
		const api: FakeApi = {
			supportsEditPrepared: () => true,
			supportsWritePrepared: () => true,
			on: (event, fn) => handlers.set(event, fn),
			registerTool: tool => tools.set(tool.name, tool),
			sendMessage: () => {},
			typebox: { Type: { Object: (o: unknown) => o, String: (o: unknown) => o } },
		};
		return { workspace, state, api, handlers, tools, ctx };
	}

	afterEach(() => {
		process.chdir(originalCwd);
		for (const workspace of workspaces) rmSync(workspace, { recursive: true, force: true });
		workspaces.length = 0;
	});

	// A4-iii + A1: identical values in permuted caller key order release, once.
	test("releases on identical values with permuted caller key order (A4-iii, A1)", async () => {
		const { workspace, api, handlers, tools, ctx } = setup();
		await turnstile(api);
		await armCycle(handlers, tools, ctx, workspace, INPUT);
		handlers.get("tool_call")?.({ toolCallId: "c3", toolName: "edit" }, ctx);
		const released = await handlers.get("edit_prepared")?.(editEvent(workspace, PERMUTED_INPUT), ctx);
		handlers.get("tool_result")?.({ toolCallId: "c3" });
		expect(released).toBeUndefined(); // no hold -> native release
		const records = readPendingDisclosures(workspace);
		expect(records).toHaveLength(1);
		expect(records[0].kind).toBe("no_rly");
		expect(records[0].attempt.tool).toBe("edit");
		// A1 second half: a further replay does nothing (one-use arm).
		handlers.get("tool_call")?.({ toolCallId: "c4", toolName: "edit" }, ctx);
		const again = await handlers.get("edit_prepared")?.(editEvent(workspace, PERMUTED_INPUT), ctx);
		handlers.get("tool_result")?.({ toolCallId: "c4" });
		expect(isHoldResult(again)).toBe(true);
		if (isHoldResult(again)) {
			expect(again.reason).toContain("no armed exception");
			expect(again.reason).toContain("consumed");
		}
		expect(readPendingDisclosures(workspace)).toHaveLength(1);
	});

	// A2: a changed argument value refuses with the attempt-identity reason.
	test("refuses with the attempt-identity reason when a value changes (A2)", async () => {
		const { workspace, api, handlers, tools, ctx } = setup();
		await turnstile(api);
		await armCycle(handlers, tools, ctx, workspace, INPUT);
		handlers.get("tool_call")?.({ toolCallId: "c3", toolName: "edit" }, ctx);
		const result = await handlers.get("edit_prepared")?.(
			editEvent(workspace, { ...INPUT, old_string: "let lock = m.lock(); " }),
			ctx,
		);
		handlers.get("tool_result")?.({ toolCallId: "c3" });
		expect(isHoldResult(result)).toBe(true);
		if (isHoldResult(result)) expect(result.reason).toContain("attempt identity");
	});

	// A4-i: a different path spelling refuses while the native vector is unchanged.
	test("refuses when a path spelling differs while the native vector is unchanged (A4-i)", async () => {
		const { workspace, api, handlers, tools, ctx } = setup();
		await turnstile(api);
		await armCycle(handlers, tools, ctx, workspace, INPUT);
		handlers.get("tool_call")?.({ toolCallId: "c3", toolName: "edit" }, ctx);
		const result = await handlers.get("edit_prepared")?.(
			editEvent(workspace, { ...INPUT, path: "./src/lib.rs" }),
			ctx,
		);
		handlers.get("tool_result")?.({ toolCallId: "c3" });
		expect(isHoldResult(result)).toBe(true);
		if (isHoldResult(result)) expect(result.reason).toContain("attempt identity");
	});

	// A4-ii: substituted arguments that would produce the same native bytes refuse.
	test("refuses when a substituted argument would produce the same native bytes (A4-ii)", async () => {
		const { workspace, api, handlers, tools, ctx } = setup();
		await turnstile(api);
		await armCycle(handlers, tools, ctx, workspace, INPUT);
		handlers.get("tool_call")?.({ toolCallId: "c3", toolName: "edit" }, ctx);
		const result = await handlers.get("edit_prepared")?.(
			editEvent(workspace, { ...INPUT, new_string: `${INPUT.new_string}\n` }),
			ctx,
		);
		handlers.get("tool_result")?.({ toolCallId: "c3" });
		expect(isHoldResult(result)).toBe(true);
		if (isHoldResult(result)) expect(result.reason).toContain("attempt identity");
	});

	// A3: each condition individually distinguishable.
	test("refuses with the Cargo-context reason when the snapshot changes (A3)", async () => {
		const { workspace, state, api, handlers, tools, ctx } = setup();
		await turnstile(api);
		await armCycle(handlers, tools, ctx, workspace, INPUT);
		state.checker = () => checkerResult({ snapshot: "1".repeat(64) });
		handlers.get("tool_call")?.({ toolCallId: "c3", toolName: "edit" }, ctx);
		const result = await handlers.get("edit_prepared")?.(editEvent(workspace, PERMUTED_INPUT), ctx);
		handlers.get("tool_result")?.({ toolCallId: "c3" });
		expect(isHoldResult(result)).toBe(true);
		if (isHoldResult(result)) expect(result.reason).toContain("Cargo context");
	});

	test("refuses with the selected-finding reason when the diagnostic changes (A3)", async () => {
		const { workspace, state, api, handlers, tools, ctx } = setup();
		await turnstile(api);
		await armCycle(handlers, tools, ctx, workspace, INPUT);
		state.checker = () => checkerResult({ message: "different clippy explanation text" });
		handlers.get("tool_call")?.({ toolCallId: "c3", toolName: "edit" }, ctx);
		const result = await handlers.get("edit_prepared")?.(editEvent(workspace, PERMUTED_INPUT), ctx);
		handlers.get("tool_result")?.({ toolCallId: "c3" });
		expect(isHoldResult(result)).toBe(true);
		if (isHoldResult(result)) expect(result.reason).toContain("no_rly invalidated: selected finding:");
	});

	test("refuses with the exclusivity reason when no observed call owns the arm (A3)", async () => {
		const { workspace, api, handlers, tools, ctx } = setup();
		await turnstile(api);
		await armCycle(handlers, tools, ctx, workspace, INPUT);
		// No tool_call before the prepared callback: no outer call owns the arm.
		const result = await handlers.get("edit_prepared")?.(editEvent(workspace, PERMUTED_INPUT), ctx);
		expect(isHoldResult(result)).toBe(true);
		if (isHoldResult(result)) expect(result.reason).toContain("exclusivity");
	});

	test("refuses with the destroyed-arm reason after an intervening call (A3)", async () => {
		const { workspace, api, handlers, tools, ctx } = setup();
		await turnstile(api);
		await armCycle(handlers, tools, ctx, workspace, INPUT);
		handlers.get("tool_call")?.({ toolCallId: "c3", toolName: "read" }, ctx);
		handlers.get("tool_result")?.({ toolCallId: "c3" });
		handlers.get("tool_call")?.({ toolCallId: "c4", toolName: "edit" }, ctx);
		const result = await handlers.get("edit_prepared")?.(editEvent(workspace, PERMUTED_INPUT), ctx);
		handlers.get("tool_result")?.({ toolCallId: "c4" });
		expect(isHoldResult(result)).toBe(true);
		if (isHoldResult(result)) {
			expect(result.reason).toContain("no armed exception");
			expect(result.reason).toContain("intervening");
		}
	});

	// A5: arming text states arm (a) semantics.
	test("arming text states same values, normalized key order, no intervening call (A5)", async () => {
		const { workspace, api, handlers, tools, ctx } = setup();
		await turnstile(api);
		const { armedText } = await armCycle(handlers, tools, ctx, workspace, INPUT);
		expect(armedText).toContain("argument values");
		expect(armedText).toContain("key order is normalized");
		expect(armedText).toContain("no intervening tool call");
	});
});
