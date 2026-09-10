# Local OMP baseline prerequisite

Observed at `2026-09-10T22:51:20.554911+00:00`: unmodified OMP 18.1.16 at upstream commit `61b1b8aef634334eaf1412afd003a763e1d1b9c1` built and launched successfully on the Windows host. The director accepted this source-build prerequisite after reviewing its evidence, **not** a native veto boundary, Sprint 4 or a Turnstile gate.

## Evidence

- Exact commit archive retained privately at `.loopx/s4build/omp-61b1b8a.tar.gz`; source root is `.loopx/s4src/`. All 7,099 regular upstream files still match the pristine SHA256 manifest after build and launch, including Rust, TypeScript, both locks, vendored code, patches and notices. Manifest: `.loopx/s4build/pristine-source-sha256.json` (`11663235e98f7604c5f68d1a87ade0865fd4da132f6159c603a710e1c47858de`). No upstream source patch was applied.
- Project-private `nightly-2026-08-08`, Bun's frozen dependency installation and local NAPI CLI 3.7.2 succeeded. The existing `bun scripts/bazel-natives.ts host` route built via Cargo/NAPI without Bazel, global installation or linking.
- Upstream host detection selected **win32-x64-modern**, not the baseline variant predicted by earlier research. The built and actually loaded addon SHA256 is `f205dd92b80896b8d13865439c9eeed7f0cfa44c8567608ce4cc304ef8f70fe4`.
- The actual source CLI (`packages/coding-agent/src/cli.ts`) started in RPC mode, returned `ready` and a successful `get_state`, and exited zero after stdin closed. Its native module cache identifies the local addon above. The returned system prompt contains the FCC foundation/routing and normal plugin skills; extension startup events were observed. No model call was made.
- A separate actual native `EditSession` performed an ordinary hashline edit in a disposable Rust fixture. Preview preserved the original; apply wrote the expected bytes once; disk and native store agreed; the outcome succeeded. This is ordinary edit proof, not interception proof.

## Reuse

The private executable command/evidence receipt is `.loopx/materials/omp-local-baseline.json`. It contains exact argv, child-only build/runtime environments, source/dependency hashes, embedded replay probes, CLI protocol evidence, loaded module identity and limits. Keep source and caches project-local.

Before runtime launch, create the private `XDG_DATA_HOME/omp` directory. This isolates native-cache cleanup while preserving normal Windows agent configuration and extensions. The global native cache was unchanged before/after the probes. Do **not** carry the private build's Rustup/Cargo/toolchain environment into the Turnstile checker. Use the source CLI, not an installed bundled CLI. Close stdin and bound unattended launches.

MSVC reported audiopus CRT linkage warnings, and Cargo reported a future-compatibility warning for pinned `nix`; the build and scoped probes succeeded. Audio and the complete native surface were not tested. No bit-reproducibility claim is made.

The baseline implementation scope applied no native/product patch and created no child agents. Source/build ownership has been released for the separately scoped native-hook worker, who must record its patched source/addon identity. Native veto and complete staged Cargo-context prerequisites remain outstanding before original Sprint 4 integration and real-model acceptance. Director owns acceptance and continuation; the [handoff index](index.json) and [Sprint 4 handoff](sprint-04.md) record this accepted baseline boundary.
