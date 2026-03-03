# regex-tester
> Interactive regex playground in your terminal. Live preview, capture groups, pattern library.

```bash
npx regex-tester
npx regex-tester '/(\w+)@\w+\.\w+/' "email: nick@example.com"
```

```
┌─ Pattern ──────────────────────────────────────────┐
│ /([a-z]+)@([a-z]+)\.[a-z]{2,}/gi                  │
└────────────────────────────────────────────────────┘
┌─ Test String ──────────────────────────────────────┐
│ hello [nick@example.com] and [test@test.io]        │
└────────────────────────────────────────────────────┘
┌─ Matches (2) ──────────────────────────────────────┐
│ 1: "nick@example.com"  Group 1: "nick"             │
│ 2: "test@test.io"      Group 1: "test"             │
└────────────────────────────────────────────────────┘
Tab: switch · p: presets · ?: explain · Ctrl+C: quit
```

## Commands
| Command | Description |
|---------|-------------|
| `regex-tester` | Launch interactive TUI |
| `rxt '/pattern/' "string"` | One-shot match test |
| `--explain` | Explain pattern in English |

## Install
```bash
npx regex-tester
npm install -g regex-tester
```

---
**Zero dependencies** · **Node 18+** · Made by [NickCirv](https://github.com/NickCirv) · MIT
