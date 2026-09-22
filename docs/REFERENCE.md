# Command reference

Use `node index.js` from the pinned source checkout described in the [README](../README.md). The entries below describe the inspected implementation.

| Command or argument | Behavior |
| --- | --- |
| `PATTERN [STRINGS...]` | Compile a JavaScript regular expression and test input strings; stdin is another input source. |
| `--flags FLAGS` | Pass flags such as g, i, m, s, u or d to RegExp. |
| `--file PATH` | Test each line from an input file. |
| `--replace TEXT` | Apply a replacement string to matches. |
| `--benchmark [N]` | Repeat matching for timing; defaults to 10000 iterations. |
| `--explain` | Print the tool's pattern explanation. |
| `--json` | Emit structured results. |
| `--count` | Print only the total match count. |
| `--no-color` | Disable ANSI formatting. |

For prerequisites, file writes, external services and known limitations, see [Behavior and limits](../README.md#behavior-and-limits).

Implementation: [index.js](https://github.com/NickCirv/regex-tester/blob/081200a54a83570536eb1cd4088cd7de4220a2d8/index.js); [review evidence](RESEARCH.md).
