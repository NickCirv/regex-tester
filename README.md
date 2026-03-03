# regex-tester

> Test, explain, and benchmark regular expressions from the terminal.

Zero dependencies · Node 18+ · ES Modules · Single file

```
npm install -g regex-tester
```

---

## Demo

```
$ rgxt "(\w+)@(\w+\.\w+)" "nick@example.com" "admin@cirvgreen.com"

2 matches for /(\w+)@(\w+\.\w+)/g
Input: "nick@example.com"
  Match 1: "nick@example.com"
    Position: 0..16  Length: 16
    Capture groups:
      Group 1: "nick"
      Group 2: "example.com"

Input: "admin@cirvgreen.com"
  Match 1: "admin@cirvgreen.com"
    Position: 0..19  Length: 19
    Capture groups:
      Group 1: "admin"
      Group 2: "cirvgreen.com"

Summary: 2 total matches across 2 inputs
```

---

## Usage

```
regex-tester <pattern> [strings...] [options]
rgxt         <pattern> [strings...] [options]
```

### Arguments

| Argument    | Description                                      |
|-------------|--------------------------------------------------|
| pattern     | Regular expression (without slashes)             |
| strings..   | One or more test strings (or --file / stdin)     |

### Options

| Flag               | Description                                                         |
|--------------------|---------------------------------------------------------------------|
| --flags gimsud     | Regex flags: g=global i=ignoreCase m=multiline s=dotAll u=unicode  |
| --replace str      | Replace matches; supports $1, $2, $<name> back-references          |
| --file path        | Test against each line of a file                                    |
| --benchmark [n]    | Benchmark N iterations (default: 10000)                             |
| --explain          | Describe the pattern in plain English                               |
| --json             | Output results as JSON                                              |
| --count            | Print only total match count                                        |
| --no-color         | Disable ANSI output                                                 |
| --help             | Show help                                                           |

---

## Examples

### Test a pattern

```bash
regex-tester "\d+" "abc123def456"
# 2 matches for /\d+/g
#   Match 1: "123"  @[3..6]
#   Match 2: "456"  @[9..12]
```

### Multiple strings

```bash
rgxt "\d{4}" "born 1995" "year: 2026" "no digits here"
```

### Named capture groups

```bash
regex-tester "(?<user>\w+)@(?<domain>[\w.]+)" "nick@example.com"
```

### Replace mode

```bash
regex-tester "(\w+)@(\w+\.\w+)" "contact user@example.com" --replace "[email redacted]"
# Replaced: "contact [email redacted]"
```

### Test a file

```bash
regex-tester "^\d{4}-\d{2}-\d{2}$" --file dates.txt --count
```

### Stdin

```bash
cat urls.txt | regex-tester "https?://[\w./]+"
echo "foo bar baz" | rgxt "\b\w{3}\b"
```

### Explain mode

```bash
regex-tester "([\w.]+)@([\w.]+)" --explain
# Pattern: /([\w.]+)@([\w.]+)/g
# Explanation:
#    1. [START of a capturing group]
#    2. any character in [\w.] (1 or more times)
#    3. [END of group]
#    4. the literal character "@"
#    5. [START of a capturing group]
#    6. any character in [\w.] (1 or more times)
#    7. [END of group]
```

### Benchmark

```bash
regex-tester "\b\w+\b" "the quick brown fox" --benchmark 100000
# Benchmark  /\b\w+\b/g
#   Iterations:    100,000
#   Total time:    52.3ms
#   Per iteration: 0.523us
#   Ops/second:    1,912,045
```

### JSON output

```bash
regex-tester "(\w+)@(\w+)" "user@example.com" --json
```

```json
{
  "pattern": "(\\w+)@(\\w+)",
  "flags": "g",
  "totalInputs": 1,
  "totalMatches": 1,
  "results": [
    {
      "input": "user@example.com",
      "matchCount": 1,
      "matches": [
        {
          "match": "user@example",
          "start": 0,
          "end": 12,
          "length": 12,
          "groups": { "1": "user", "2": "example" },
          "namedGroups": {}
        }
      ]
    }
  ]
}
```

---

## Features

- ANSI highlighting of matched portions in terminal output
- Numbered and named capture groups with exact positions
- Replace mode with back-reference support ($1, $<name>)
- File mode — test each line independently
- Stdin — pipe from any source
- Benchmark — ops/second and per-iteration microseconds
- Explain — plain-English breakdown of each pattern token
- JSON export for scripting and pipelines
- Count mode — summary stats only

---

## Requirements

- Node.js 18+
- Zero external dependencies

---

## License

MIT
