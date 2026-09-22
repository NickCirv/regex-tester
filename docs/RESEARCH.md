# Source review — regex-tester

## Revision and method

Inspected public commit: [`081200a54a83570536eb1cd4088cd7de4220a2d8`](https://github.com/NickCirv/regex-tester/commit/081200a54a83570536eb1cd4088cd7de4220a2d8). Source tree: `f9fff022ab00ceb5cbb26a3b852c5ef8448da217`. Capture scope: all eligible text files; 5 of 5 eligible files.

This review read captured implementation and documentation. It did not install dependencies, execute project commands, call project APIs, check package publication or establish live CI status. Examples are source-derived, not captured execution transcripts.

## Claim ledger

| Claim | Evidence | Status |
| --- | --- | --- |
| Regex construction, input reading, match serialization and flags | [index.js](https://github.com/NickCirv/regex-tester/blob/081200a54a83570536eb1cd4088cd7de4220a2d8/index.js) | Verified in inspected source; execution unverified |

## Findings and verification gaps

The engine is Node’s JavaScript RegExp, not PCRE or another language’s regex dialect. Explanation is heuristic. Pathological patterns can take a long time; no isolation timeout is established. File mode tests lines separately, which differs from matching an entire file. No LICENSE file is captured despite MIT metadata.

The captured smoke test only asks Node to syntax-check the entrypoint. It does not exercise behavior, integrations or failure paths. Neither that test nor installation was run in this review.

| Dimension | Result |
| --- | --- |
| Purpose and documented commands | Partially verified: static source inspection |
| Clean installation and examples | Unverified |
| Test suite and live CI | Unverified |
| Performance and security guarantees | Unverified |
| Publication | Local documentation only |

## Documentation inventory

- [README.md](https://github.com/NickCirv/regex-tester/blob/081200a54a83570536eb1cd4088cd7de4220a2d8/README.md) — Rewritten; historic section anchors retained where practical.

## Captured source inventory

- [README.md](https://github.com/NickCirv/regex-tester/blob/081200a54a83570536eb1cd4088cd7de4220a2d8/README.md) — Git blob `ac516cf95406bae8466cb178a53a13684595f283`.
- [package.json](https://github.com/NickCirv/regex-tester/blob/081200a54a83570536eb1cd4088cd7de4220a2d8/package.json) — Git blob `e2ac54f13f1c7faa2e70d3a6c941a7ca9f8fa815`.
- [.github/workflows/ci.yml](https://github.com/NickCirv/regex-tester/blob/081200a54a83570536eb1cd4088cd7de4220a2d8/.github/workflows/ci.yml) — Git blob `44515034a394670de44454a7a1bd2c7ef0c9836e`.
- [index.js](https://github.com/NickCirv/regex-tester/blob/081200a54a83570536eb1cd4088cd7de4220a2d8/index.js) — Git blob `ff2ecaf17ace62844c80737b8b3ee967b02a4a5b`.
- [test/smoke.test.js](https://github.com/NickCirv/regex-tester/blob/081200a54a83570536eb1cd4088cd7de4220a2d8/test/smoke.test.js) — Git blob `ebbccaaf2583b4850575f835313e4b0afd21bff7`.

## Scope boundary

Capture excludes lockfiles, binary artwork, generated output, vendored dependencies and files above the acquisition size limit. The tree records their existence; no verification claim is made for omitted content. Protected documents and historical records are not replaced.

## Reference coverage

Added [command reference](REFERENCE.md) from the argument parser, command handlers and source-defined help at the pinned revision. README examples remain unexecuted.
