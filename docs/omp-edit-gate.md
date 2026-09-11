# Native OMP edit quality gate

Turnstile gates the native OMP **edit** tool with the selected
`clippy::await_holding_lock` check. A held attempt does not change canonical files.
The native tool returns the actual checker finding or failure to the model; the
model can author a replacement, which is checked again. Passing means this
configured check completed without introduced or unresolved findings, **not**
that the code is globally correct or safe.

## Enable an isolated workspace

Use the [pinned, patched project-local OMP runtime](../patches/omp-edit-veto.md)
and its compiled addon. Keep this repository's `extensions/turnstile.ts` and
`tools/` together. Launch **from the selected test workspace**, retaining normal
OMP authentication, FCC skills, and plugin discovery. Do not install globally.

Create `.omp/turnstile.json` in that workspace:

```json
{
  "enabled": true,
  "context": {
    "root": ".",
    "manifest": "Cargo.toml",
    "cwd": "."
  }
}
```

`root` is relative to the launch workspace; `manifest` and `cwd` are relative to
that Cargo root. Include the complete trusted Cargo context, not just a target
file. The existing analyzer also accepts `features` (string array),
`no_default_features`, `all_features`, `package`, and `target` in `context`.
Selection is explicit: the extension neither discovers a different workspace nor
splits a native operation vector into independent checks. Optional top-level
`python` and `cargo` name executables or executable paths; their defaults are
`python` and `cargo`. Python 3.11+, Cargo, Clippy, and the platform linker are
required. Cargo runs offline; dependencies must already be available.

Before starting the guarded session, create workspace-only `.omp/config.yml`:

```yaml
lsp:
  formatOnWrite: false
edit:
  autoRepair:
    enabled: false
extensionHandlers:
  toolCallTimeoutMs: 120000
```

Keep ordinary LSP diagnostics configured normally. The native boundary also
requires no relevant transforming ACP write route and no older formatting-enabled
batch. It holds visibly when those conditions conflict; Turnstile does not change
them, and never changes global settings. The handler budget above is an example
using OMP's existing timeout owner, not a second Turnstile retry/timeout system.

Launch from that workspace, substituting the path to this checkout:

```text
bun <checkout>/.loopx/s4src/packages/coding-agent/src/cli.ts --extension <checkout>/extensions/turnstile.ts
```

Follow the native runtime guide's project-private `XDG_DATA_HOME` setup before
launch. Keep the process temporary directory (`TEMP`/`TMP` on Windows) outside the
selected Cargo root. Short paths are useful for Windows linker compatibility.

An absent `.omp/turnstile.json`, or `{"enabled": false}`, installs no gate and
preserves the ordinary native path. A present malformed configuration is not a
disabled configuration: edits are held with a visible explanation. Missing/false
`supportsEditPrepared()` installs the existing `tool_call` edit blocker, rather
than trusting an unknown event registration or merely failing extension loading.
Enabled checks also require `ctx.exec` on the prepared handler context. An older
SDK without this managed executor is held before starting a checker, even if its
addon supports native staging.
Configuration is a session-start snapshot. Restart after changing it or switching
workspaces; this sprint adds no hot reload or persistent policy store.

## Execution and failure contract

- OMP reconstructs all five native modes: hashline, replace, patch, apply_patch,
  and sloppy. Turnstile does not parse edit grammar, replace the tool, create an
  `EditStore`, change arguments, or rewrite candidate bytes.
- `edit_prepared` supplies final effective execute arguments and the complete,
  ordered native vector. Every `op`, `path`, `displayPath`, `moveTo`, `before`,
  `after`, and `moveBefore` is passed unchanged to the existing
  `analyze_staged` owner. Native edit creates, moves, deletes, overwrites, and
  multi-file operations stay native-owned.
- The CLI bridge invokes `tools/rust_candidates.py --staged` through the prepared
  handler's `ctx.exec`, not a shell or request-file quoting protocol. The entire
  vector and context arrive over stdin; Python reads binary stdin and decodes it
  explicitly as UTF-8, preserving native Unicode/BOM/CRLF strings on Windows.
  `isolatedTemp:true` asks OMP's existing executor to create an owned temporary
  root outside the selected Cargo context and set child-only `TEMP`/`TMP`/`TMPDIR`.
  Python places copied contexts there. The executor removes the root only after
  its process tree settles.
- Only `outcome="no_findings"` permits execution. Empty findings, a skipped or
  unavailable checker, compilation failure, unresolved attribution, changed
  context, malformed output, and process failure do not permit an edit. Actual
  diagnostic spans, rendered Clippy guidance, and required-failure causes remain
  in tool feedback.
- OMP owns the existing handler timeout and each handler's managed process scope.
  Timeout, abort, and shutdown cancel and drain registered commands and their
  temporary roots before native completion. Same-tool delegated calls also wait
  at the inner native return; cleanup does not depend on an outer `tool_result`
  ID. Concurrent checks have separate ownership, and saved executors reject late
  launches after closure. Arbitrary noncooperative handler promises are not
  awaited. Ordinary `api.exec` retains its caller-owned lifetime and is not used
  for this checker. OS-level forced termination of the entire host remains
  outside this cleanup guarantee.
- The analyzer prepares its response and removes its copied context before its
  final original-file and observed directory-semantics freshness check. Native
  OMP independently revalidates its paths, bytes, arguments, and store revision
  before release. There remains an unavoidable post-observation race: these are
  observations, not filesystem transactions, and do not detect transient
  write-and-restore or arbitrary mutation after the last check. Trusted local
  Cargo build scripts/proc macros are not sandboxed.
- After permission, ordinary I/O failure can partially apply a multi-file edit;
  this boundary does not promise filesystem rollback. Earlier permitted edits'
  regular queued LSP diagnostics retain the native drain behavior when a final
  edit is held.

The boundary is **native edit only**, including native same-tool delegation.
Write-tool integration, bounded revision attempts, `no_rly`, durable disclosures,
commit/PR policy, and other tools' arbitrary writes belong to later sprints. The
current hold/revise loop is not an override or an approval-ticket system.

## Verification and continuation

The dedicated [Sprint 4 handoff](../.omp/handoffs/sprint-04.md) records author proof
and the exact private review-snapshot pointer. Its evidence separates native/SDK
consumer smoke, actual configured-model hold/feedback/repair, required-check
failure, and accepted prerequisite coverage. Director review and acceptance are
separate from an author's successful run.
