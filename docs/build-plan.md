# Turnstile initial-testing build

Status: owner-approved build direction and sprint plan, 2026-09-10. Implementation is authorized in this project. The first execution session is Sprint 1 only.

## Product contract

Turnstile (Harness Contradictionary) is a source-quality gate for proposed coding-agent edits. Rust is the first analyzed language; OMP is the first harness. The analysis target is written Rust code, not Bash command authorization.

- Reconstruct the resulting Rust file from the original and proposed edit/write. Use the original/diff to distinguish introduced findings. The checker may need surrounding crate context even though the review unit is one resulting file.
- Reuse an existing analyzer. Begin with one explicitly enabled quality check demonstrated against a bad example and its acceptable near-match. A syntax error or process success alone does not establish quality-rule coverage.
- Hold -> explain -> author revises -> recheck. A rejected attempt must not change the real target. Do not silently rewrite the author's arguments or autofix the real worktree while claiming it is held.
- A successful required check with no findings differs from a failed/unavailable checker. Required-check failure holds visibly. Parsing/diagnostic exit conventions are checker-specific.
- Bound revision attempts; exhaustion remains held and visible. It does not earn an override.
- `no_rly` is explicit, last-resort, rule-scoped, and bound to one exact held attempt and named finding. Other checks remain active. No additional co-signer or mandatory human-only stage was selected. Real hard authority boundaries are not overridable by model assertion.
- Record an exception durably before release. Carry relevant disclosures in ordinary end-of-session commit messages, then surface them through a normal server-side PR check. No special PR skill or submission tool. Commit messages may carry the actual disclosure; an external receipt service is not required.
- Passing means the configured checks passed, not that the code is globally correct or safe.
- Context-dependent design judgments do not become automatic blockers merely because their syntax is easy to match. Cover the supplied principles in example/review material, not by manufacturing one automatic rule per principle.

## Session execution contract

One sprint must fit investigation, implementation, verification, review, commit, and concise handoff in one fresh bounded OMP session. A sprint that takes multiple sessions was not decomposed sufficiently. Assess fit before edits; split oversized work rather than dropping acceptance criteria. Do not execute the next sprint in the same OMP session.

Compaction is an exceptional recovery boundary, not the normal continuation plan. If compaction is imminent or occurs, preserve exact unfinished work and verification state, end the session, and re-decompose the remaining work before starting a fresh session. Never mark interrupted work complete.

LoopX owns goal/task/evidence continuity. Each task session reads this brief and its selected sprint. Later sprint entries are a roadmap, not permission to execute all of them in one session. Every sprint has its own verification; the final rehearsal does not defer earlier checks.

Execution sessions inherit the normal configured OMP context and available skills, including plugin-provided skills. The FCC foundation and skill-routing instructions must be present at startup; load the applicable FCC design, change, verification, collaboration, and durable-state skills when their activities arise. Availability is not blanket activation: do not enable every optional persona or load unrelated skills. A missing required skill is a visible configuration failure, not permission to skip it. Private launch/runtime receipts are indexed under `.loopx/materials/`.

## Approved sprint sequence

| Sprint | Deliverable | Acceptance |
|---|---|---|
| 1 | Prove the first quality check | Select an existing Rust checker and one rule grounded in the supplied example material. The bad case produces the intended finding, the acceptable near-match passes, and checker failure is distinguishable. Keep a reproducible, bounded probe and record exact versions/results. |
| 2 | Prepare candidate files | Reconstruct edits and writes separately from real files, with the checker context established in Sprint 1. Existing-file edits and new-file writes are analyzed without changing real targets. |
| 3 | Identify introduced findings | Existing violations do not block an unrelated edit; newly introduced violations do. Do not use only added-line overlap as a proxy for causation. |
| 4 | Gate OMP edits | In an explicitly enabled test workspace, a real bad edit is withheld, the finding reaches the model, and a repaired replacement executes. |
| 5 | Gate OMP writes | The same mechanism covers file creation and replacement through the write tool. Bad writes stay unapplied; acceptable writes execute; coverage is explicit. |
| 6 | Bound the revision loop | Repeated rejection terminates visibly. Retry exhaustion and checker failure never release the held action. |
| 7 | Preserve pending disclosures | A fresh session can retrieve pending no_rly records. Storage failure is reported rather than swallowed. |
| 8 | Implement no_rly | Bind an exception to an exact overridable held attempt/finding and record before release. Changed arguments invalidate it, other checks apply, and recording failure prevents release. |
| 9 | Carry disclosures into commits | Successful end-of-session commits carry relevant disclosures. Failed and partial commits do not silently retire outstanding records. |
| 10 | Surface disclosures on PRs | An ordinary server-side check reads commit messages, visibly reports overrides, and updates for a new PR head. Do not claim live PR verification without a configured approved remote. |
| 11 | Exercise the installed test build | Through actual OMP in an isolated test workspace, prove bad/good edits, repaired retry, exhaustion, checker failure, no_rly, and fresh-session commit disclosure. |

The smallest usable hold/revise loop is Sprint 4. Later sprints complete the agreed safeguards; a larger policy catalog is not in this build.

## Sprint 1 boundary

Read the private material index at `.loopx/materials/index.json`, then the Rust example seed. The original workshop is historical context and is superseded by this brief wherever it suggests Bash policy is the analysis target. The Prodagent checkout is read-only prior art, not this project's implementation or selected parser foundation.

Own only the first analyzer-fit result: inspect candidate existing Rust diagnostics, select one that genuinely distinguishes a relevant bad/good pair, create minimal runnable fixtures/probe as needed, run it, and report outcomes. Explicitly distinguish constructed examples from actual defects. Prefer installed Rust tooling where it fits; do not invent a universal regex for tiny functions, ignored results, or abstraction quality. Do not start the OMP gate, retry controller, journal, or PR integration in this session.

The finish line is an executable quality-check demonstration, exact analyzer/rule/version and invocation, evidence for bad/good/failure outcomes, a local commit, and a concise handoff to Sprint 2. If no candidate meets the contract in a bounded investigation, record the discriminating failed attempts and a concrete blocker; do not substitute a syntax-error test or claim completion.

## Authority, scope, and privacy

This owner-approved brief is the current product authority. Supplied workshop/example packets are attributed research, not blanket adopted rules or independently verified Dione defects. Preserve their provenance and caveats.

Allowed: project-local implementation, fixtures, tests, documentation, build artifacts, dependency research/downloads needed for the selected analyzer, local commits, and LoopX state/evidence writeback for this goal. Keep source packets, private links, and personal filesystem locations out of tracked/public files.

Not authorized: modifying the read-only Prodagent/Dione/LoopX reference checkouts; disabling global safety settings; production operations; remote publication/push/PR creation; unrelated filesystem changes. Later native-hook testing should use explicit workspace opt-in, not a global harness install. Escalate genuine missing external prerequisites without silently narrowing a sprint.

## Navigation

- Current task and durable evidence: LoopX goal `turnstile`.
- Local-private material index: `.loopx/materials/index.json`.
- Historical Prodagent investigation: `prodagent-source/graphify-out/source-provenance.json` and `prior-art-probes.json` (read-only, not tracked here).
- Handoff convention: project-local `.omp/handoffs/` with an exact-name index, keeping summaries public-safe when committed.
