# Native OMP edit and write quality gate

Turnstile gates the native OMP **edit** and **write** tools with the selected
`clippy::await_holding_lock` check. A held attempt does not change canonical targets.
The native tool returns the actual checker finding or failure to the model; the
model can author a replacement, which is checked again within a finite rejection
budget. Passing means this configured check completed without introduced or
unresolved findings, **not** that the code is globally correct or safe.

## Enable an isolated workspace

Use the [pinned, patched project-local OMP runtime](../patches/omp-edit-veto.md)
and its compiled addon. Keep this repository's `extensions/turnstile.ts` and
`tools/` together. Launch **from the selected test workspace**, retaining normal
OMP authentication, FCC skills, and plugin discovery. Do not install globally.

Before creating the enabled configuration, initialize disclosure storage once:

```text
bun <checkout>/tools/turnstile-disclosures.ts init <workspace>
```

Initialization requires an absent or explicitly disabled `.omp/turnstile.json`
and a nonexistent store. For an existing enabled pre-disclosure workspace, stop
OMP, explicitly disable the configuration, initialize, then re-enable it. Do not
use this provisioning procedure to recover a lost store; restore the original
database instead. Keep the workspace's `.omp/turnstile-disclosures.sqlite` and
SQLite sidecars private and out of version control.

Create `.omp/turnstile.json` in that workspace:

```json
{
	"enabled": true,
	"maxRejections": 3,
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
bun <checkout>/.loopx/s4src/packages/coding-agent/src/cli.ts --session-dir <private-session-directory> --extension <checkout>/extensions/turnstile.ts
```

Follow the native runtime guide's project-private `XDG_DATA_HOME` setup before
launch. Keep the process temporary directory (`TEMP`/`TMP` on Windows) outside the
selected Cargo root. Short paths are useful for Windows linker compatibility.

An absent `.omp/turnstile.json`, or `{"enabled": false}`, installs no gate and
preserves the ordinary native path. A present malformed configuration is not a
disabled configuration: edits and writes are held with a visible explanation.
Missing/false `supportsEditPrepared()` or `supportsWritePrepared()` installs the
existing `tool_call` blocker for both tools, rather than trusting unknown event
registration or merely failing extension loading. Enabled checks also require
`ctx.exec` on the prepared handler context. An older SDK without this managed
executor is held before starting a checker.
Configuration is a loaded-extension snapshot. Restart/reload after changing it or
switching workspaces; there is no hot reload. Disclosure storage is separate from
the loaded configuration and rejection budget.

## Execution and failure contract

- OMP reconstructs all five native modes: hashline, replace, patch, apply_patch,
  and sloppy. Turnstile does not parse edit grammar, replace the tool, create an
  `EditStore`, change arguments, or rewrite candidate bytes.
- `edit_prepared` supplies final effective execute arguments and the complete,
  ordered native vector. Every `op`, `path`, `displayPath`, `moveTo`, `before`,
  `after`, and `moveBefore` is passed unchanged to the existing
  `analyze_staged` owner. Native edit creates, moves, deletes, overwrites, and
  multi-file operations stay native-owned.
- `write_prepared` supplies the native WriteTool's final effective `input` and one
  create/update operation with the same seven keys. `before` is the actual UTF-8
  preimage or null for an absent target; `after` is the complete content **after**
  OMP's existing hashline display-prefix cleaning. Cleaning is native write
  semantics, not permission for an analyzer or later formatter to change bytes.
  BOM, Unicode and line endings in those final strings are preserved. Non-UTF-8
  preimages and unpaired UTF-16 surrogate input are refused.
- The CLI bridge invokes `tools/rust_candidates.py --staged` through the prepared
  handler's `ctx.exec`, not a shell or request-file quoting protocol. The entire
  vector and context arrive over stdin; Python reads binary stdin and decodes it
  explicitly as UTF-8, preserving native Unicode/BOM/CRLF strings on Windows.
  `isolatedTemp:true` asks OMP's existing executor to create an owned temporary
  root outside the selected Cargo context and set child-only `TEMP`/`TMP`/`TMPDIR`.
  Python places copied contexts there. The executor removes the root only after
  its process tree settles.
- Ordinary execution requires `outcome="no_findings"`. The only exception is the
  explicit, exact-attempt `no_rly` path below. Empty findings, a skipped or
  unavailable checker, compilation failure, unresolved attribution, changed
  context, malformed output, and process failure do not permit an exception.
  Actual diagnostic spans, rendered Clippy guidance, and required-failure causes
  remain in tool feedback.
  The bridge validates the analyzer's existing success witness: final
  `no_findings`, an empty final `findings` array, and `candidate_check` with
  `exit_code=0` and `build_finished=[true]`. Preexisting candidate findings and
  no-op/non-Rust vectors retain their existing successful-check semantics.
- OMP owns the existing handler timeout and each handler's managed process scope.
  Timeout, abort, and shutdown cancel and drain registered commands and their
  temporary roots before native completion. Same-tool delegated calls also wait
  at the inner native return; cleanup does not depend on an outer `tool_result`
  ID. Concurrent checks have separate ownership, and saved executors reject late
  launches after closure. Arbitrary noncooperative handler promises are not
  awaited. Ordinary `api.exec` retains its caller-owned lifetime and is not used
  for this checker. OS-level forced termination of the entire host remains
  outside this cleanup guarantee.
  Cancellation during the managed command's temporary-root cleanup still reports
  `killed=true`, even when the child already exited successfully. It cannot refund
  a rejected check. Arbitrary cancellation after the command has fully settled is
  not retrospectively detected.
- The analyzer prepares its response and removes its copied context before its
  final original-file and observed directory-semantics freshness check. Native
  edit independently revalidates its paths, bytes, arguments and store revision.
  Native write reobserves effective arguments, target resolution, preimage bytes,
  file/ancestor identities and missing ancestor components before release. No
  parent creation, file write, snapshot or executable-bit change precedes permission.
  These checks are observations, not filesystem transactions. They do not detect
  transient
  write-and-restore or arbitrary mutation after the last check. Trusted local
  Cargo build scripts/proc macros are not sandboxed.
- After permission, ordinary I/O failure can partially apply a multi-file edit;
  this boundary does not promise filesystem rollback. Earlier permitted edits'
  regular queued LSP diagnostics retain the native drain behavior when a final
  edit is held.

## Explicit write coverage

| Route with an enabled prepared listener                                       | Boundary                                                                                                                                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary local file creation or whole-file replacement                        | Checked in the selected complete Cargo context, then executed by the native WriteTool. Both direct calls and same-tool `ctx.invokeTool` delegation are covered. |
| Native hashline header/content cleaning                                       | Checked after cleaning; effective authored arguments and final candidate bytes remain separately observable.                                                    |
| `local://` paths resolving to an ordinary local file                          | Same local boundary; targets outside the explicitly selected Cargo root are refused by the existing analyzer.                                                   |
| Archive members, SQLite rows, SSH/remote and other handler-owned writes       | Visibly held before route dispatch: the existing analyzer cannot check their final persisted representation as a local Cargo file.                              |
| `conflict://` splicing and `xd://` device dispatch                            | Visibly held before mutation/dispatch; no complete prepared local vector exists at that route. No device permissions are inferred.                              |
| ACP writeTextFile or formatting-enabled writer/older pending formatting batch | Visibly held before mutation; the checked bytes cannot be guaranteed. Diagnostics-only processing stays enabled.                                                |

These route restrictions apply **only** while a `write_prepared` listener is
present. Absent/disabled Turnstile installs no listener and preserves ordinary
write behavior, including special routes. Other tools and arbitrary extension
writes are not policed. Permission-denied fallback writers remain trusted native
infrastructure, not a sandbox for arbitrary extension code.

Write uses the same prepared-handler managed executor as edit. A guarded write
awaits the runner rather than racing its check against `untilAborted`, including
inner delegated completion. Timeout/abort/shutdown drain live checker children and
temporary roots first. A held batch-final write drains earlier permitted writes'
queued diagnostics without formatting; a hold does not roll back earlier writes.

## Bounded revision attempts

`maxRejections` is an optional positive safe integer, default **3**. One loaded
extension instance owns cumulative rejection debt across native edit/write tools,
paths, argument changes and same-tool delegation. A rejection is an admitted
prepared check that does not establish permission, including required-check
failure, malformed output and cancellation during managed checking/cleanup.
Native parsing or unsupported-route refusals before preparation do not run a
checker or spend a prepared-check slot.

Each check reserves a remaining slot synchronously before asynchronous work.
Concurrent calls cannot spend the same slot: if all remaining slots are reserved,
another call is held for capacity without launching a checker or declaring
exhaustion. A successful check releases only its reservation, never earlier debt.
No-op calls, successful repairs, new model turns, `/new`, switching, branching and
compaction do not reset debt. Thus a repair before the limit can execute, but
interleaving successes cannot extend a sequence of rejected checks indefinitely.

The rejection reaching the limit latches exhaustion. That held action and every
later edit/write attempt stay unapplied; later attempts do not launch a checker.
The gate invokes OMP's real abort operation to stop the offending retry turn,
not merely an instruction asking the model to stop. Read-only/explanatory work
remains available; attempting another mutation stops that turn again.

The notice uses ordinary interactive/RPC notifications, stderr in print/JSON mode
(leaving JSON stdout parseable), and a displayable custom session message after
the agent is idle. It does not queue a continuation. Fatal startup configuration
or capability failures stop an attempted mutation immediately with a distinct
zero-check failure reason, not a fabricated exhausted candidate count.

Restarting/reloading intentionally constructs a fresh budget. Separate loaded
agents have separate budgets. Nothing persists or globally coordinates this
counter, so it is not an authority boundary against deliberate reloads or other
tools. Exhaustion is never an override. `no_rly` is available only **before**
exhaustion; `maxRejections: 1` deliberately leaves no exception window.

## Explicit last-resort `no_rly`

Prefer revision. When one completed native edit/write check finds exactly one
introduced `clippy::await_holding_lock` finding, with unambiguous attribution and
successful required checks, held feedback identifies a live `hold` ID and a
`finding` SHA256, along with the rule and location. Other findings or required
failures do not become overridable because the author asserts they are safe.

The author (user or model) may explicitly call:

```text
no_rly({
  hold: "<live hold ID>",
  finding: "<named finding SHA256>",
  reason: "<public-safe last-resort rationale explaining why revision is unsuitable>"
})
```

This tool does not mutate a file or approve an arbitrary row. It arms only the
**immediately next native call of the held tool**. Repeat the original tool's
arguments unchanged, without an intervening tool. The rationale must be nonempty;
its semantic sufficiency is an explicit author judgment, not machine-proven
exhaustion of alternatives. No extra co-signer or human-only stage is required.
Do not put raw source, secrets or private paths in the explanation.

One loaded extension owns one live held candidate and one one-use arm. The hold
comes from an actual prepared check, never a caller's prior-hold boolean or a
persisted disclosure. The next attempt must match the native final effective
input, edit mode, complete ordered operation vector (including preimages, move
destinations and destination preimages), the original Cargo-context snapshot,
and the freshly rechecked selected diagnostic. Even different path spelling or
arguments that happen to produce the same bytes invalidate the exception.

All analysis runs again. Only the same sole introduced finding can be excepted;
other findings, ambiguous attribution, missing/failed checks and compilation
errors remain held. Ordinary preexisting-finding and non-Rust success semantics
are unchanged. Native path, transform, argument and freshness guards still run;
`no_rly` cannot override those boundaries, tool approval policy, or authorize a
different tool, command, device, archive or remote route.

The boundary tracks only observed outer calls for this exception. Arming requires
the held call to have completed, with no competing observed call or check active.
The first prepared callback consumes the arm. Direct native calls and supported
same-tool `ctx.invokeTool` delegation use the same exclusive outer ownership;
delegated `invoke-*` IDs are not mistaken for outer call IDs. Another observed
call or prepared callback invalidates an in-flight exception. Completion/error,
tool-execution end and agent end clean up ownership. This is not retrospective
cancellation after native permission already returned.

An unconsumed hold can survive an ordinary end of turn, but an arm cannot.
Session start/switch/branch/tree/shutdown clears live exception state, not S6
rejection debt. Restart/reload cannot recover authority from an old hold or row.
Stale or failed authorization consumes its arm; obtain a newly held attempt
before asking again. Successful authorization releases only its current budget
reservation and does not refund earlier rejections.

After the fresh match, the prepared handler synchronously appends through the
existing SQLite writer and waits for its committed/read-back record **before
returning permission to native code**. Missing, corrupt, triggered, locked or
otherwise unavailable storage holds visibly. A row conservatively describes
**attempted exception authorization**, not confirmed application: a later native
freshness guard or ordinary I/O failure may leave that row pending without
applying the candidate. There is no automatic retirement or rollback claim.
Existing rows are disclosure data only, including after fresh-session recovery.

## Pending disclosure storage

The launch workspace owning `.omp/turnstile.json` also owns the fixed
`.omp/turnstile-disclosures.sqlite`. There is no Git-root discovery or session-ID
partition: every fresh enabled OMP session in that workspace discovers the same
pending records. All record paths are normalized slash-separated paths relative
to **that launch workspace**, not implicitly relative to a Git root. A later
commit consumer must resolve the workspace-to-Git prefix.

`tools/turnstile-disclosures.ts` is the concrete Bun SQLite owner. Its
`appendPendingDisclosure(workspace, input)` writes exception **data**, not
authorization. The prepared release owner derives the exact live held attempt,
selected finding and actual effects before recording. It does not release if
recording fails. No automatic retirement or commit hook is implemented.

The validated input contains:

- `attempt.tool` (`edit` or `write`), `attempt.sha256` (exact attempt digest), and
  `attempt.files`: unique `{path, beforeSha256, afterSha256}` effects. Null means
  absent; both cannot be null. Moves use source and destination effects. These
  concrete identities and byte hashes support later partial-commit relevance
  without retaining raw authored source.
- `finding`: `{rule, sha256, path, line, message}` identifying the selected
  finding; its path must occur in the affected files and line is positive.
- `reason`: the exception explanation. The producer owns public-safe explanatory
  text; storage does not infer consent or trust arbitrary local input.

The writer derives `id` from the validated input's stable JSON representation and
adds `kind: "no_rly"` and `recordedAt` (UTC ISO timestamp). Identical input, including
file-effect order, is idempotent and returns the original record/timestamp.
The digests are content identifiers, not authenticated approval receipts.
Paths cannot be absolute, contain traversal, backslashes or drive prefixes.
Storage error messages expose only the fixed relative store identity, not
private filesystem paths; underlying causes remain attached to thrown errors.

Startup and session switching publish a displayable custom-message snapshot.
Each provider-context construction rereads storage and replaces only Turnstile's
ephemeral disclosure message with current data. Compaction or a new conversation
therefore need not recall an old dump. Repeated context construction does not
append identical full records to the transcript or change the system prompt.
Changed snapshots/errors also use notifications and stderr in print/JSON mode,
where notifications alone may be no-ops; JSON stdout stays separate. Disclosure
failure means **unknown**, not permission or a clean empty result. Ordinary
quality checking remains active, but exception release requires a successful
durable append at the prepared boundary.

Inspect the same store without an OMP/model request:

```text
bun <checkout>/tools/turnstile-disclosures.ts read <workspace>
```

| State                                                               | Observable behavior                                                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| New, not provisioned                                                | Read fails `missing`; explicit initialization is required before enabling.                                       |
| Valid initialized empty                                             | Read succeeds with `records: []`; this is not missing.                                                           |
| Enabled but missing target                                          | Read/write fail `missing`; enabled configuration witnesses expected state. Initialization refuses while enabled. |
| Zero-byte, wrong schema/version, invalid SQLite or malformed record | Read/write fail `corrupt`; no row is silently dropped, repaired or recreated.                                    |
| Unreadable path, I/O error or exhausted lock wait                   | Read/write fail `unavailable`; no empty fallback.                                                                |

Restore a lost/corrupt store from a known complete backup with users of that store
stopped, preserving its configuration witness. If no backup exists, obligations
are unresolved: do not disable/reinitialize to describe them as cleared. There
is no reset or migration command. Deliberately deleting configuration or editing
the store with ordinary local tools remains possible; this is not an enforced
adversarial sandbox.

Readers reopen the target in a SQLite snapshot transaction. Writers use
`BEGIN IMMEDIATE`, a five-second SQLite busy timeout, DELETE journaling and
`synchronous=FULL`; all existing rows are validated before append. The owned
schema/version and returned domain records are checked, not a full integrity
sweep on every prompt. Unexpected triggers attached to the owned pending table
are corrupt schema. Append validates that schema inside its write transaction,
then requires one inserted row and an exact stored-record readback before the
transaction commits. Competing supported writers serialize; readers see a
committed snapshot. A failed append throws and does not acknowledge success.

Initialization reserves a new path exclusively and then commits the schema.
That entire provisioning sequence is **not atomic publication**: interruption
can leave an invalid file, which is visibly refused rather than silently retried.
Normal committed-write durability is bounded by SQLite, the OS and filesystem
honoring synchronization; no hardware power-loss or arbitrary external
write/delete/replacement race guarantee is claimed. Back up only a quiescent
closed store (including recovery sidecars if present), or use SQLite's own
consistent backup facilities.

## Verification and continuation

The dedicated [Sprint 4 handoff](../.omp/handoffs/sprint-04.md) preserves accepted
native edit/model evidence. The [Sprint 5 handoff](../.omp/handoffs/sprint-05.md)
records actual native WriteTool/Cargo consumer proof, lifecycle/route controls and
its exact private review-snapshot pointer. The [Sprint 6 handoff](../.omp/handoffs/sprint-06.md)
records bounded rejection, actual model termination/notice, and managed-cleanup
cancellation evidence. The [Sprint 7 handoff](../.omp/handoffs/sprint-07.md)
records durable writer/fresh-reader, storage failure and recovery proof.
Director review and acceptance are separate from an author's successful run.
