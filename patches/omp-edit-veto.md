# Project-local OMP native edit and write veto

This patch is for upstream `can1357/oh-my-pi` commit
`61b1b8aef634334eaf1412afd003a763e1d1b9c1` (18.1.16), not a global OMP installation.
It adds optional `edit_prepared` and `write_prepared` extension events at the native
tools' pre-mutation boundaries. It does **not** implement Turnstile's analyzer
integration or model repair loop. Both events share the existing prepared emitter
and managed `ctx.exec` process owner. The current patch is cumulative against the
pristine pin: do not apply it over an older patched tree. Earlier accepted
patch/source identities remain historical in their immutable review archives.
Write support changes only TypeScript SDK ownership; Rust source and the accepted
compiled addon are unchanged, so an existing accepted addon does not need rebuilding.

## Restore and build

The tested host is Windows x64 with Bun 1.4.2, Visual Studio 2022 C++ Build Tools,
CMake/Ninja, and Rust `nightly-2026-08-08`. Other hosts were not verified.
The upstream host build selects its native CPU variant; do not copy an addon from
another installation or force a variant based on this guide.

1. Download the commit-addressed archive from
   `https://codeload.github.com/can1357/oh-my-pi/tar.gz/61b1b8aef634334eaf1412afd003a763e1d1b9c1`.
   Its SHA256 is
   `c0ec66e5410f27f8a9ee2a3d3a63d04e1778ad170469cf853d6930a4233e8f0d`.
   Verify that digest and extract its contents to `.loopx/s4src`. Keep the original
   archive separately; never apply the patch over the only pristine copy.
2. From the **project root**, apply the patch with an explicit destination prefix
   and invocation-local LF settings (not global Git configuration):

   ```powershell
   git -c core.autocrlf=false -c core.eol=lf apply --check --directory=.loopx/s4src patches/omp-edit-veto.patch
   git -c core.autocrlf=false -c core.eol=lf apply --directory=.loopx/s4src patches/omp-edit-veto.patch
   ```

   Do not run an unprefixed apply from a nested directory of this project's Git
   worktree: Git can skip every patch there and still report success.

3. In a dedicated PowerShell child process, set project-local build locations.
   `$project` below is the absolute root of this project. Create the named
   directories first. These are child-process settings, not global settings.

   ```powershell
   $env:RUSTUP_HOME = "$project/.loopx/s4build/rustup"
   $env:CARGO_HOME = "$project/.loopx/s4build/cargo"
   $env:BUN_INSTALL_CACHE_DIR = "$project/.loopx/s4build/bun"
   $env:CARGO_TARGET_DIR = "$project/.loopx/s4target"
   $env:TEMP = "$project/.loopx/s4tmp"
   $env:TMP = $env:TEMP
   $env:RUSTUP_TOOLCHAIN = "nightly-2026-08-08"
   $env:OMP_NATIVE_CARGO_PROFILE = "local"
   rustup toolchain install nightly-2026-08-08 --profile minimal --no-self-update
   # Working directory: .loopx/s4src
   bun install --frozen-lockfile
   bun scripts/bazel-natives.ts host
   ```

   The upstream build regenerates N-API declarations and installs the compiled
   addon under `packages/natives/native`. Do not ship only modified declarations.
   Leave both upstream lockfiles intact. No npm publication, global link/install,
   vendored source tree, or binary belongs in this project's patch commit.

4. Run the focused regression checks from the extracted source directory:

   ```powershell
   cargo test -p pi-edit --test guard --test session --test apply_patch --test patch --test replace --test sloppy
   bun test packages/coding-agent/test/edit-prepared.test.ts packages/coding-agent/test/edit-acp-bridge.test.ts packages/coding-agent/test/streaming-edit-abort.test.ts
   bun --cwd packages/coding-agent run check:types
   ```

   Broader runs on the tested Windows host also observed two path-policy unit failures
   and one tag-recovery fixture failure. They were left visible, not suppressed or
   rerun merely to confirm. Focused passing checks do not imply the full upstream
   suite is green; the review receipt records unchanged-helper/hash evidence.

## Run and opt in

Use a separate runtime process without the build-only Rust environment variables.
Keep normal configured OMP/FCC/plugin discovery; do not override the global agent
directory or change global safety settings. Set `XDG_DATA_HOME` to a project-private
runtime directory and create its `omp` child before importing the addon (the Windows
loader uses this for its cache). Launch the actual source CLI, for example:

```powershell
$env:XDG_DATA_HOME = "$project/.loopx/s4run/xdg"
# Create "$env:XDG_DATA_HOME/omp" first.
bun "$project/.loopx/s4src/packages/coding-agent/src/cli.ts"
```

Registering an `edit_prepared` listener opts that session into the guard. With no
listeners the ordinary unguarded streamed edit path is retained. A listener returns
`{ block: true, reason }` to hold the complete native edit; it cannot replace bytes.
Errors, timeout, abort, or changed inputs hold visibly. The existing
`extensionHandlers.toolCallTimeoutMs` bounds each handler; configure it explicitly
for the intended analyzer instead of adding a second timeout system.

Required integrations must first check `api.supportsEditPrepared?.() === true`.
The method queries `EditSession.supportsPreparedGuard()` in the **loaded compiled
addon**. Patched SDK code paired with an older addon visibly refuses guarded edits.
A stock SDK can accept unknown event registration without ever emitting it: when
the capability method is missing or false, install an existing `tool_call` blocker
for `edit`, rather than merely registering `edit_prepared` or failing extension load.
The upstream API documentation includes the fail-closed registration pattern.

Required subprocess checks must additionally hold when the prepared handler's
`ctx.exec` is absent. `supportsEditPrepared()` proves native staging support, not
this SDK process-lifetime contract. Use `ctx.exec`, not ordinary `api.exec`, for
managed checks: it inherits this handler's existing timeout/abort, rejects late
launches, and cancels/drains only its own process trees before native completion.
This includes same-tool `ctx.invokeTool` delegation and separate concurrent calls;
it does not correlate cleanup through outer `tool_result` IDs.

`ctx.exec` accepts `input` (UTF-8 text or bytes over stdin) and `isolatedTemp:true`.
The existing executor owns a short temporary root, sets child-only
`TEMP`/`TMP`/`TMPDIR`, and removes that root after the process tree settles.
Put copied checker contexts there; keep it outside the selected Cargo root.
Runner shutdown drains these managed processes too. Noncooperative handler
promises remain bounded by the existing handler timeout; only registered managed
command work is awaited. Native TypeScript completion awaits the started runner
check even when native cancellation wins first. No extra timeout, generic cleanup
callback, arbitrary cleanup-path API, parser, or Rust/addon change is involved.

The listener receives immutable final execute `input` and ordered `operations`, each
with `op`, `path`, `displayPath`, `moveTo`, `before`, `after`, and `moveBefore`.
All seven keys survive JSON serialization, with explicit `null` for nullable fields.
Preimages are actual pre-call persisted UTF-8, including create-overwrite originals.
Validate them against one untouched baseline before native-order replay. Preserve
move-source identity for attribution; add no new collision/overwrite restrictions.
Native parsing, register expansion, path recovery and serialization remain native-owned.
The patched upstream `docs/extensions.md` contains the complete API contract.

### Explicit coverage boundary

An opted-in isolated workspace must start with `lsp.formatOnWrite=false` and
`edit.autoRepair.enabled=false`, with no relevant transforming ACP `writeTextFile`
route and no older formatting-enabled LSP batch pending. Conflicts or non-UTF-8
preimages hold; the hook never silently changes settings. Ordinary LSP diagnostics
remain configured normally. These restrictions do not affect unguarded sessions.
If a batch's final edit is held, prior permitted edits' queued diagnostics are drained
through the existing already-written path without formatting, returned as ordinary
diagnostic metadata, and the batch is removed. This was exercised with both a custom
linter regression and an actual project-local rust-analyzer syntax diagnostic.

The native guard revalidates its original paths, bytes, arguments and store state.
The analyzer must separately revalidate the surrounding Cargo context it used.
Permission consumes the same staged operations. Unrelated I/O failures after release
can leave earlier files applied: there is no filesystem rollback promise.

This boundary covers native `edit` and local native `write`, including same-tool
delegation. It does not police other tools or arbitrary extension writes.

### Native write veto

Register `write_prepared` only after `api.supportsWritePrepared?.() === true`;
otherwise use the existing `tool_call` blocker for `write`. Integrations requiring
both tools must check both capabilities and block both on missing support.
The write marker is an SDK capability; the unchanged native addon supplies edit
support only. Required external checkers must still detect managed `ctx.exec`.

The event contains `{ type, toolCallId, input, operations }`. The single operation
is a create or update with the same seven explicit keys as native edit. `input`
is the final execute input; `after` is the complete native-cleaned write content.
The WriteTool applies its existing display-prefix cleaning before preparation,
then refuses formatting/ACP transformations rather than analyzing authored text
and later persisting different bytes. Exact UTF-8/BOM/line endings are retained.
Missing-target parents are observed without creating them. The tool revalidates
arguments, target resolution, preimage and path/ancestor identities before release.

With a listener, handler/remote writes, archive members, database rows, conflict
resolution and device dispatch are explicitly refused before mutation because
they have no supported complete local-file preparation. Ordinary local and
`local://`-resolved files use the same boundary; an analyzer can additionally
refuse paths outside its selected context. Without listeners all existing routes
remain unchanged. A listener is not a filesystem transaction or a sandbox:
trusted extensions/fallback writers can perform arbitrary work, and mutation
after the final observation remains outside the guarantee.

Write shares the runner's prepared process lifetime, including inner same-tool
delegation, late-executor rejection and shutdown drain. It does not return from
an abort while its prepared runner is still draining. Guarded writes refuse an
older formatting-enabled batch; a held batch-final write drains prior diagnostics
through the existing diagnostics-only path. See the
[Turnstile operator contract](../docs/omp-edit-gate.md) for explicit coverage.
