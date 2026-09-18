# Native OMP edit and write quality gate

Turnstile gates the native OMP **edit** and **write** tools with the selected
`clippy::await_holding_lock` check. A held attempt does not change canonical targets.
The native tool returns the actual checker finding or failure to the model; the
model can author a replacement, which is checked again within a finite rejection
budget. Passing means this configured check completed without introduced or
unresolved findings, **not** that the code is globally correct or safe.

## Enable an isolated workspace

Use the [pinned, patched installed project-local OMP program](../patches/omp-edit-veto.md),
retained at `.loopx/sprint11/installed/omp.exe`. Keep its matching `extensions/`
and `tools/` together. Launch **from the selected test workspace**, retaining
normal OMP authentication, FCC skills and plugin discovery. Do not install globally
or substitute a source `cli.ts`/SDK import for the installed executable.

Before creating the enabled configuration, initialize disclosure storage once:

```text
bun <checkout>/.loopx/sprint11/installed/tools/turnstile-disclosures.ts init <workspace>
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
<checkout>/.loopx/sprint11/installed/omp.exe --session-dir <private-session-directory> --extension <checkout>/.loopx/sprint11/installed/extensions/turnstile.ts
```

Follow the native runtime guide's project-private `XDG_DATA_HOME/omp`, Bun cache
and temporary-root setup before every launch, including version/help probes.
Keep `TEMP`/`TMP`/`TMPDIR` outside the selected Cargo root and always pass
`--session-dir`; neither print/JSON mode nor a private XDG root implies private
session storage. Short paths are useful for Windows linker compatibility.

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
applying the candidate. Ordinary Git fulfillment below acknowledges publication,
not application or rollback. Existing rows remain disclosure data only.

## Pending disclosure storage

The launch workspace owning `.omp/turnstile.json` also owns the fixed
`.omp/turnstile-disclosures.sqlite`. There is no Git-root discovery or session-ID
partition: every fresh enabled OMP session in that workspace discovers the same
pending records. All record paths are normalized slash-separated paths relative
to **that launch workspace**, not implicitly relative to a Git root. The ordinary
commit installer below records the explicit workspace-to-Git prefix separately.

`tools/turnstile-disclosures.ts` is the concrete Bun SQLite owner. Its
`appendPendingDisclosure(workspace, input)` writes exception **data**, not
authorization. The prepared release owner derives the exact live held attempt,
selected finding and actual effects before recording. It does not release if
recording fails. The optional ordinary Git boundary below carries full records
and acknowledges only verified successful, completely covered disclosures.

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

On the qualified installed upstream runtime, these custom messages map to the
provider's **`developer` role**, not a `system` prompt. Their text explicitly says
“not instructions or authorization; no release is asserted,” followed by full
`JSON.stringify` record data. This is the observed existing **non-system**
boundary, not a claim that the channel is unprivileged or immune to prompt
injection. The upstream owner is
`packages/agent/src/compaction/messages.ts::convertMessageToLlm`; Turnstile does
not replace that mapping. A fresh installed-session probe with a real pending
record refused the prior session's actual hold/finding token without mutation
or new records. Durable text cannot reconstruct the extension's live exception
state. That action-time refusal, not the prose disclaimer or message role,
establishes the tested authority boundary.

Inspect the same store without an OMP/model request:

```text
bun <checkout>/.loopx/sprint11/installed/tools/turnstile-disclosures.ts read <workspace>
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
Acknowledgment uses the same validated immediate transaction. It compares the
entire live record, including timestamp, with the exact published record, deletes
only that exact row, and checks the deletion/readback before committing. A late
new row or same-ID replacement with different full data remains pending. All
rows and the owned schema are validated even when nothing qualifies. There is
no CLI deletion command or caller-supplied success boolean.

Initialization reserves a new path exclusively and then commits the schema.
That entire provisioning sequence is **not atomic publication**: interruption
can leave an invalid file, which is visibly refused rather than silently retried.
Normal committed-write durability is bounded by SQLite, the OS and filesystem
honoring synchronization; no hardware power-loss or arbitrary external
write/delete/replacement race guarantee is claimed. Back up only a quiescent
closed store (including recovery sidecars if present), or use SQLite's own
consistent backup facilities.

## Ordinary Git disclosure boundary

This opt-in boundary carries real pending records into ordinary `git commit`
messages and acknowledges only verified successful full-message publication with
complete canonical coverage. It is not a PR check or a special commit tool.
Native quality gating and `no_rly` remain unchanged.

The installer is qualified for native **Windows Git for Windows and Bun** (with
Windows PowerShell available; exercised Git version `2.44.0.windows.1`) and native
**Linux Git and Bun** (process identity via `/proc/sys/kernel/random/boot_id` plus
`/proc/<pid>/stat` starttime).
Direct Bun hook interpreters must have whitespace-free executable paths; shell
wrappers are not equivalent because their parent identity differs. Linked
worktrees, bare repositories and other platforms are visibly refused rather
than silently inheriting an unverified hook/process relationship.

With Git/OMP activity quiescent, run from the selected isolated Git worktree:

```text
bun <checkout>/.loopx/sprint11/installed/tools/turnstile-commits.ts install <launch-workspace>
```

The launch workspace must be within that Git worktree and already have valid
S7 storage. Installation records its normalized Git-root-relative prefix in
private Git metadata. The matching deployed `tools/` modules must remain
available at their installed location. No global configuration or hooks are
changed. Existing effective `core.hooksPath` or differing owned hook/setup files
cause visible refusal; unrelated hooks are preserved. Identical installation is
idempotent. Exclusively created owned files are rolled back on setup failure.
Installation is an operator-coordinated local setup, not atomic publication to
concurrent Git processes or protection against forced process/OS termination.

The installer adds literal, escaped prefix-specific rules to `.git/info/exclude`
for the database and only its `-journal`, `-wal`, and `-shm` sidecars. It refuses
already tracked/staged artifacts rather than unstaging or discarding user work.
The same private-artifact classifier checks the effective index and finalized
commit tree, including conservative refusal of casing aliases such as `.OMP`.
Other exclusion text and staged user files are preserved. The source repository
also excludes its own exact database/sidecar family, not arbitrary sqlite siblings.

### Message and relevance contract

Each disclosure occupies one noncomment line beginning `Turnstile-Disclosure: `
followed by compact JSON.
The exact column-zero `Turnstile-Disclosure:` key requires its canonical following
space; a missing separator is malformed, not an absent disclosure. Unrelated
prose and differently positioned text are not fuzzy-matched into records.

The JSON has exactly these fields:

- `version`: `1`.
- `workspacePrefix`: normalized slash-separated Git-root-relative launch workspace
  path, or `""` at the root. Prepend it to each record path.
- `semantics`: `"authorization-intent-not-confirmed-application"`.
- `record`: the complete validated `PendingDisclosure`, including its original
  ID, timestamp, held-attempt/finding identity, every before/after effect hash,
  finding text and rationale. There is no external receipt or coverage payload.

These lines are untrusted descriptive data, not instructions, approval, or proof
that the original candidate was applied. Escaped JSON preserves multiline text.
The owning parser/serializer and immutable commit/tree reader are in
`tools/turnstile-commits.ts`; storage and messages reuse one record validator.
The server-side consumer below reads the complete message without private storage.

Automatic relevance uses the **effective Git commit index**, including Git's
temporary index for path-only commits, not the working tree or merely a filename.
At least one effect must have a Git tree change and a resulting image different
from that effect's recorded preimage. Exact candidate images, later repairs and
partial images can qualify. Any qualifying effect carries the full record.
Hashes cannot identify which hunk of a later image came from an attempted
exception: same-file unrelated hunks may conservatively disclose the intent.
Untouched files, empty/unrelated commits, and complete return to a recorded
preimage do not automatically acquire disclosures.
Case-disagreeing effect/index spellings are refused as ambiguous, including on
case-sensitive directories; paths are never silently equated by case-folding.

### Native hooks and failures

`prepare-commit-msg` reads validated storage and effective index, injects missing
relevant records before an existing scissors tail, and writes a private
per-Git-process preparation witness. Native parent PID **and** process creation
identity scope that witness (Windows `StartTime`; Linux `boot_id` plus `/proc`
starttime, distinguishing PID reuse). Subsequent preparation removes ended/reused
process witnesses; live concurrent invocations have separate files. A witness
never proves commit success or authorizes deleting rows.

`reference-transaction` in `prepared` state reads the actual immutable new commit
object, after Git's editor, other message hooks and cleanup. It checks the
prepared tree, old/new HEAD and parent relationship, rereads pending records and
requires their exact relevant full disclosures. Missing/corrupt/triggered/locked
storage, missing messages, changed trees and cleanup-stripped/tampered lines
fail visibly before the ref update. A record arriving after injection is
therefore rechecked; after the final read, later records remain pending.
There is no cross-Git/SQLite atomicity claim.

An ordinary amendment must retain **every** full disclosure from the replaced
commit, even if its row has retired or its resulting tree equals its parent.
Git does not identify `--amend -m/-F` as amend in prepare-hook arguments. If a replacement message would
drop required disclosures, the final hook refuses it. Use ordinary
`--amend -c HEAD`, `--amend --no-edit`, or explicitly retain the complete lines.
There is no guess that pollutes unrelated commits and no post-success amend.

For HEAD transactions the surviving reference hook first checks the required
prepare hook's presence and exact owned bytes. Missing/replaced/no-op preparation
is a visibly broken installation, not an unchecked successful commit. This
configuration refusal does not apply to unrelated refs or rebase replay.
Only a matching preparation invocation's actual HEAD transition receives full
commit validation. Transactions with no witness or a mismatched process identity
are **unclassified and unchecked**, never validated by the final-object gate.
Healthy reset/fetch and rebase replay are not a new command policy.
`AUTO_MERGE` housekeeping, including its abort callback after successful HEAD
update, cannot clear the meaningful witness. A validated immutable new commit OID
is recorded only after the prepared gate passes; the matching successful HEAD
callback records that exact OID as committed. `post-commit` requires both OIDs,
the same process generation and current HEAD agreement before acknowledgment,
then removes the witness. Preparation-only witnesses never establish success.
Pre-ref failures retain all pending records; a failed editor may leave an inert
private witness until later preparation cleans it. Post-ref errors cannot undo
a successful Git commit. A known acknowledgment result stays reported as such:
private-witness cleanup failure is a separate visible filesystem error, not a
failed acknowledgment or a claim that deleted rows remain. A generic post-success
error without a known storage result reports the acknowledgment outcome as
unknown. Inspect the ordinary pending reader and retry only outstanding records;
there is no automatic amend or fabricated rollback.

Ordinary `--no-verify` does not skip prepare/ref hooks. The surviving final hook
detects missing/replaced preparation, but deliberately disabling the final hook,
changing configuration or private witness files, arbitrary OS writes, and
history rewriting remain operator-controlled boundaries, not a sandbox.
An editor that only removes message disclosures is denied. An editor that
directly deletes the valid private invocation witness and strips the message
demonstrates an excluded operator-state bypass: the resulting unwitnessed update
is not validated. Missing or mismatched witnesses visibly skip acknowledgment;
absence never establishes successful full-message/tree evidence.
Records cannot retroactively cancel a ref update after the final observation.
Required external OS/process queries can fail; that is an explicit availability
failure, not empty disclosure state.

### Successful publication and pending fulfillment

At `post-commit`, the owner rereads the actual immutable successful commit
message/tree and pending store. A row qualifies only if that message contains its
**exact complete envelope**, including the installed workspace prefix, and
**every** affected path's committed Git image matches its current canonical
workspace image. Moves include both paths; deletion requires absence. Partial
paths, staged hunks or remaining affected work retain the full record visibly.

Canonical means **Git's representation under the observed attributes and clean
filters**, not identical raw checkout bytes. The owner uses Git's own
`hash-object --path --stdin` conversion, without modifying the index, config or
user content. Thus CRLF working files may match LF blobs, and a configured clean
filter may intentionally map different raw bytes to the same committed image.
The original candidate's recorded-after hashes need not match later fully
committed repairs: rows describe authorization intent, not confirmed application.

Only ordinary local files and ordinary directory ancestors with exact path
spelling qualify. At every missing directory component, an actual filesystem
lookup must also report absence. If lookup resolves without the exact listed
spelling (for example a Windows trailing-dot/space or short-name alias), coverage
is refused rather than normalized or mistaken for deletion. Symlink/directory
effects, unreadable paths, casing ambiguity or failed Git conversion retain
records. Two full-vector observations must
agree on raw bytes, file/ancestor identities, canonical Git object IDs and
observed Git configuration/attributes. A final non-converting full observation
also checks for clean-driver side effects. Unstable filters or observed changes
retain records rather than guessing. Git clean drivers remain trusted local
programs; Turnstile does not sandbox them or prove their semantics.

An unapplied/reverted intent can be explicitly disclosed in an ordinary commit:
retain its complete `Turnstile-Disclosure: ...` line and use `git commit
--allow-empty` when no code delta remains. An unrelated empty commit alone does
not fulfill anything. The same ordinary route retries a previously successful
commit whose acknowledgment failed: restore unavailable storage or complete the
affected work, then carry the exact outstanding record in another ordinary
commit. Never delete rows manually or assume Git success cleared them. Inspect
the store or start a fresh enabled OMP session to see current pending data.

Git refs/objects, filesystem observations and SQLite are **not one transaction**.
The exact live-row comparison protects supported late writers inside SQLite;
later rows, arbitrary OS writes after the last observation, transient
write-and-restore, externally replaced stores/configuration and history rewriting
remain outside a cross-resource atomicity guarantee. The success notice reports
the count retained at the acknowledgment transaction, not a promise that no later
record can arrive. Durability remains bounded by SQLite/OS/filesystem
synchronization; forced termination may leave a successful disclosure pending
for an ordinary retry. No power-loss proof or OS sandbox is claimed.

## Server-side PR disclosure snapshots

`.github/workflows/turnstile-disclosures.yml` runs ordinary `pull_request_target`
events: opened, reopened, synchronize (including force-pushed heads), and edited
(including base retargets). It needs no special PR submission tool or receipt
service. Install this workflow and the adjacent `tools/` code on the repository's
trusted default branch through the normal reviewed integration process.

The workflow checks out only its immutable `github.sha` reporting-code revision,
never a PR head or merge checkout. Current GitHub documentation identifies
`pull_request_target` workflow/code authority as the **base repository's default
branch**, not the PR head. Its automatic workflow check is a transport result,
not the head disclosure check. The reporter explicitly creates a Checks API run
with the validated event's `pull_request.head.sha`. The sole write permission is
`checks: write`; `contents: read` and `pull-requests: read` supply Git objects and
fresh PR identity. No other secrets, fork URLs, head programs, hooks, submodules,
dependency installation from the PR, or private disclosure databases are used.
The workflow uses hosted Linux and Bun; the local hook installation (Windows or
Linux) does not restrict this read-only server consumer.

The selected range is exactly **`base.sha..head.sha`**: all commits reachable from
the selected head but not from the selected base, following every parent.
Messages on merge commits and merged side histories are included; synthetic PR
merge commits and first-parent-only sampling are not substituted. Full histories
are fetched into an owned temporary bare repository without checking out head
files. Full immutable messages use the existing commit parser and record validator.
Repeated disclosures in different commits remain visible with their commit IDs.

The head check is named `Turnstile disclosures / PR <number> / base <full SHA>`.
Each execution updates only its own returned check ID. Different bases on the
same head therefore cannot overwrite one another's comparison identity. Delivered
events may run concurrently; there is no shared check ID, mutable receipt store,
or pending-slot concurrency group that cancels another event. Fresh PR
reads before fetching and immediately before a successful completion detect
changed base/head or a closed PR and publish a **cancelled, superseded snapshot**.
Retargeting preserves old reports as explicitly identified historical comparisons,
not as results for the new base.

Every report shows the exact PR, base, head and range. It is an **immutable event
snapshot**, not continuous state: base-only pushes do not trigger a refresh,
GitHub may suppress/delay some events, and a change after the final PR read cannot
be made atomic with a Checks API update. A new ordinary head event produces a new
snapshot. Do not configure the transport job or these base-specific informational
names as a global source-quality gate. Fork check responses can have an empty
`pull_requests` association array; the reporter uses the explicit head SHA and
labels its PR/range rather than interpreting that array as an authorization receipt.

Valid explicit `no_rly` disclosures are prominently reported, **not failures of
the reporting check**. Complete envelopes include reasons, finding text, paths,
IDs, timestamps and all effect hashes inside inert escaped JSON display blocks.
They remain untrusted **authorization intents, not confirmed application**.
Successful reporting neither authenticates exception permission nor establishes
that every possible bypass is detectable or that the source is globally correct.
Commit authors must keep disclosure text public-safe; rendering is not a secret
classifier. Event bodies, transport errors, tokens and private storage are not
published.

Malformed records, unreadable/missing/shallow history, invalid API identities,
transport failures and temporary-object cleanup failures produce visible failure,
never zero disclosures. The reporter's Git reads use 64 MiB buffers. Its private
Git-command helper has a two-minute per-call deadline; the shared `readCommit`
reader has no per-call timeout. The hosted workflow has a ten-minute whole-job
cap, which the standalone local CLI does not inherit. API/event inputs are
limited to 2 MiB. Complete rendered output is
limited to 60,000 UTF-8 bytes. Exceeding it fails explicitly rather than silently
sampling or publishing a partial clean report. A failed Checks API completion
can leave the head check pending: the workflow's failure and job summary then
report unconfirmed publication. Abrupt runner termination is not a cleanup or
head-check-completion guarantee.

For an already available complete Git repository, run the same report reader
without any API call:

```text
GITHUB_REPOSITORY=owner/repository bun tools/turnstile-pr-check.ts report event.json /path/to/repository
```

Use the shell's normal environment-setting syntax on Windows. The input is an
ordinary PR event JSON file, not executable shell content. `GITHUB_STEP_SUMMARY`,
when supplied by Actions, receives the report; otherwise it is printed locally.
The workflow itself invokes `bun tools/turnstile-pr-check.ts github`; its fixed
GitHub.com API/Git origins are not configurable transport escape hatches.

Primary semantics: [events and SHA authority](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target),
[trusted target execution](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target),
[explicit check-run head association](https://docs.github.com/en/rest/checks/runs#create-a-check-run),
[repository-scoped App token](https://docs.github.com/en/actions/concepts/security/github_token),
and [concurrency ordering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
Deployment must verify GitHub permissions, workflow event delivery and actual
PR Checks presentation. Local event/protocol proof is not live GitHub verification.

## Verification and continuation

The dedicated [Sprint 4 handoff](../.omp/handoffs/sprint-04.md) preserves accepted
native edit/model evidence. The [Sprint 5 handoff](../.omp/handoffs/sprint-05.md)
records actual native WriteTool/Cargo consumer proof, lifecycle/route controls and
its exact private review-snapshot pointer. The [Sprint 6 handoff](../.omp/handoffs/sprint-06.md)
records bounded rejection, actual model termination/notice, and managed-cleanup
cancellation evidence. The [Sprint 7 handoff](../.omp/handoffs/sprint-07.md)
records durable writer/fresh-reader, storage failure and recovery proof.
The [Sprint 8 handoff](../.omp/handoffs/sprint-08.md) records exact-attempt
exceptions; [Sprint 9](../.omp/handoffs/sprint-09.md) records ordinary commit
fulfillment; [Sprint 10](../.omp/handoffs/sprint-10.md) records bounded PR reporting.
The [Sprint 11 handoff](../.omp/handoffs/sprint-11.md) binds the actual installed
Windows program, upstream build/dependency identities, real configured-model
CLI/RPC scenarios, native addon/module observations and independent filesystem,
SQLite and immutable Git oracles. It preserves the failed stronger user-only
context oracle rather than relabeling the actual developer role. It also
identifies the retained installation/demo, reproducible private evidence and
independent own-copy review boundary. No live GitHub, Linux execution, TUI visual,
universal quality, OS sandbox, hardware power-loss or cross-resource transaction
guarantee is implied.
Director review and acceptance are separate from an author's successful run.
