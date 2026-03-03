#!/usr/bin/env node
// regex-tester — test, explain, and benchmark regular expressions from the terminal
// Zero dependencies · Node 18+ · ES Modules

import { createReadStream } from 'fs';
import { createInterface } from 'readline';

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const A = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
  bRed:    '\x1b[91m',
  bGreen:  '\x1b[92m',
  bYellow: '\x1b[93m',
  bBlue:   '\x1b[94m',
  bMagenta:'\x1b[95m',
  bCyan:   '\x1b[96m',
  bgCyan:  '\x1b[46m',
  bgGreen: '\x1b[42m',
};

const c = (code, s) => `${code}${s}${A.reset}`;
const bold    = (s) => c(A.bold, s);
const cyan    = (s) => c(A.cyan, s);
const green   = (s) => c(A.bGreen, s);
const yellow  = (s) => c(A.bYellow, s);
const magenta = (s) => c(A.bMagenta, s);
const gray    = (s) => c(A.gray, s);
const red     = (s) => c(A.bRed, s);
const dim     = (s) => c(A.dim, s);

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

// ── Highlight matched portions of a string ───────────────────────────────────
function highlightMatches(str, matches) {
  if (!matches.length) return str;

  // Build non-overlapping ranges from match indices
  const ranges = [];
  for (const m of matches) {
    if (m.indices) {
      ranges.push([m.indices[0][0], m.indices[0][1]]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);

  let result = '';
  let pos = 0;
  for (const [start, end] of ranges) {
    if (start < pos) continue;
    result += str.slice(pos, start);
    result += `${A.bgCyan}${A.bold}${A.white}${str.slice(start, end)}${A.reset}`;
    pos = end;
  }
  result += str.slice(pos);
  return result;
}

// ── Regex engine ──────────────────────────────────────────────────────────────
function buildRegex(pattern, flags) {
  // Always include 'd' flag for indices support (Node 18+)
  const flagSet = new Set(('d' + flags).split(''));
  const finalFlags = [...flagSet].join('');
  return new RegExp(pattern, finalFlags);
}

function getMatches(regex, str) {
  if (regex.flags.includes('g')) {
    return [...str.matchAll(regex)];
  }
  const m = regex.exec(str);
  return m ? [m] : [];
}

// ── Plain-English regex explainer ─────────────────────────────────────────────
function explainRegex(src) {
  const parts = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // Escape sequences
    if (ch === '\\' && i + 1 < src.length) {
      const next = src[i + 1];
      const escMap = {
        d: 'a digit (0-9)',
        D: 'a non-digit',
        w: 'a word character (a-z, A-Z, 0-9, _)',
        W: 'a non-word character',
        s: 'whitespace',
        S: 'a non-whitespace character',
        b: 'a word boundary',
        B: 'a non-word boundary',
        n: 'a newline',
        t: 'a tab',
        r: 'a carriage return',
        f: 'a form feed',
        v: 'a vertical tab',
        0: 'a null byte',
      };
      if (escMap[next]) parts.push(escMap[next]);
      else parts.push(`the literal character "${next}"`);
      i += 2;
      continue;
    }

    // Character classes
    if (ch === '[') {
      const closeIdx = src.indexOf(']', i + 1);
      if (closeIdx !== -1) {
        const inner = src.slice(i + 1, closeIdx);
        const neg = inner.startsWith('^');
        const content = neg ? inner.slice(1) : inner;
        parts.push(`${neg ? 'any character NOT in' : 'any character in'} [${content}]`);
        i = closeIdx + 1;

        // Check for quantifier after class
        const q = parseQuantifier(src, i);
        if (q) { parts[parts.length - 1] += ' ' + q.desc; i = q.end; }
        continue;
      }
    }

    // Groups
    if (ch === '(') {
      let groupType = 'a capturing group';
      let skip = 1;
      if (src.slice(i + 1, i + 3) === '?:') { groupType = 'a non-capturing group'; skip = 3; }
      else if (src.slice(i + 1, i + 3) === '?=') { groupType = 'a lookahead assertion'; skip = 3; }
      else if (src.slice(i + 1, i + 3) === '?!') { groupType = 'a negative lookahead'; skip = 3; }
      else if (src.slice(i + 1, i + 4) === '?<=') { groupType = 'a lookbehind assertion'; skip = 4; }
      else if (src.slice(i + 1, i + 4) === '?<!') { groupType = 'a negative lookbehind'; skip = 4; }
      else if (src[i + 1] === '?') {
        // Named group: (?<name>...)
        const namedMatch = src.slice(i).match(/^\(\?<(\w+)>/);
        if (namedMatch) { groupType = `a named capturing group "${namedMatch[1]}"`; skip = namedMatch[0].length; }
      }
      parts.push(`[START of ${groupType}]`);
      i += skip;
      continue;
    }

    if (ch === ')') { parts.push('[END of group]'); i++; continue; }

    // Quantifiers on standalone tokens
    if (ch === '.') {
      let desc = 'any character (except newline)';
      i++;
      const q = parseQuantifier(src, i);
      if (q) { desc += ' ' + q.desc; i = q.end; }
      parts.push(desc);
      continue;
    }

    if (ch === '^') { parts.push('start of string/line'); i++; continue; }
    if (ch === '$') { parts.push('end of string/line'); i++; continue; }
    if (ch === '|') { parts.push('OR'); i++; continue; }

    if (ch === '*' || ch === '+' || ch === '?') {
      const qMap = { '*': '(0 or more times)', '+': '(1 or more times)', '?': '(optionally)' };
      // Standalone quantifier — applies to previous token
      if (parts.length) parts[parts.length - 1] += ' ' + qMap[ch];
      i++;
      // Lazy modifier
      if (src[i] === '?') { if (parts.length) parts[parts.length - 1] += ' [lazy]'; i++; }
      continue;
    }

    if (ch === '{') {
      const closeIdx = src.indexOf('}', i);
      if (closeIdx !== -1) {
        const inner = src.slice(i + 1, closeIdx);
        const [min, max] = inner.split(',');
        let desc = '';
        if (max === undefined) desc = `exactly ${min} times`;
        else if (max === '') desc = `at least ${min} times`;
        else desc = `between ${min} and ${max} times`;
        if (parts.length) parts[parts.length - 1] += ` (${desc})`;
        i = closeIdx + 1;
        if (src[i] === '?') { if (parts.length) parts[parts.length - 1] += ' [lazy]'; i++; }
        continue;
      }
    }

    // Literal character
    if (ch.charCodeAt(0) >= 32) {
      let desc = `the literal character "${ch}"`;
      i++;
      const q = parseQuantifier(src, i);
      if (q) { desc += ' ' + q.desc; i = q.end; }
      parts.push(desc);
      continue;
    }

    i++;
  }

  return parts;
}

function parseQuantifier(src, i) {
  const ch = src[i];
  if (ch === '*') return { desc: '(0 or more times)', end: i + 1 };
  if (ch === '+') return { desc: '(1 or more times)', end: i + 1 };
  if (ch === '?') return { desc: '(optionally)',      end: i + 1 };
  if (ch === '{') {
    const closeIdx = src.indexOf('}', i);
    if (closeIdx !== -1) {
      const inner = src.slice(i + 1, closeIdx);
      const [min, max] = inner.split(',');
      let desc = '';
      if (max === undefined) desc = `(exactly ${min} times)`;
      else if (max === '') desc = `(at least ${min} times)`;
      else desc = `(between ${min} and ${max} times)`;
      return { desc, end: closeIdx + 1 };
    }
  }
  return null;
}

// ── Format match result for display ──────────────────────────────────────────
function formatMatchResult(m, idx, pattern) {
  const [start, end] = m.indices ? m.indices[0] : ['?', '?'];
  const lines = [];
  lines.push(`  ${bold(cyan(`Match ${idx + 1}:`))} ${yellow(`"${m[0]}"`)}`);
  lines.push(`    ${gray('Position:')} ${start}..${end}  ${gray('Length:')} ${m[0].length}`);

  // Named groups
  if (m.groups && Object.keys(m.groups).length) {
    lines.push(`    ${gray('Named groups:')}`);
    for (const [name, val] of Object.entries(m.groups)) {
      if (val !== undefined) {
        lines.push(`      ${magenta(name)}: ${yellow(`"${val}"`)}`);
      }
    }
  }

  // Numbered groups
  const numbered = m.slice(1).filter((g, idx) => {
    // Skip if already covered by a named group value
    return g !== undefined;
  });
  if (numbered.length) {
    lines.push(`    ${gray('Capture groups:')}`);
    m.slice(1).forEach((g, gi) => {
      if (g !== undefined) {
        const [gs, ge] = m.indices && m.indices[gi + 1] ? m.indices[gi + 1] : ['?', '?'];
        lines.push(`      ${gray(`Group ${gi + 1}:`)} ${magenta(`"${g}"`)}`);
      }
    });
  }

  return lines;
}

// ── Serialize match to plain object for JSON export ───────────────────────────
function serializeMatch(m, inputStr) {
  const [start, end] = m.indices ? m.indices[0] : [null, null];
  const groups = {};
  m.slice(1).forEach((g, gi) => {
    groups[gi + 1] = g ?? null;
  });
  const namedGroups = {};
  if (m.groups) Object.assign(namedGroups, m.groups);

  return {
    match: m[0],
    start,
    end,
    length: m[0].length,
    groups,
    namedGroups,
  };
}

// ── Help text ─────────────────────────────────────────────────────────────────
function printHelp() {
  const usage = `
${bold(cyan('regex-tester'))} ${gray('v1.0.0')} — Test, explain, and benchmark regular expressions

${bold('USAGE')}
  ${cyan('regex-tester')} <pattern> [strings...] [options]
  ${cyan('rgxt')}         <pattern> [strings...] [options]

${bold('ARGUMENTS')}
  ${yellow('pattern')}          Regular expression pattern (without slashes)
  ${yellow('strings...')}       One or more test strings (or use --file / stdin)

${bold('OPTIONS')}
  ${cyan('--flags')} <gimsud>   Regex flags: g=global i=ignoreCase m=multiline
                       s=dotAll u=unicode d=indices (default: g)
  ${cyan('--replace')} <str>    Replace matches with substitution string
                       Supports $1, $2... and $<name> for capture groups
  ${cyan('--file')} <path>      Test against each line of a file
  ${cyan('--benchmark')} [n]    Benchmark over N iterations (default: 10000)
  ${cyan('--explain')}          Describe what the pattern does in plain English
  ${cyan('--json')}             Output results as JSON
  ${cyan('--count')}            Show only total match count
  ${cyan('--no-color')}         Disable ANSI color output
  ${cyan('--help')}             Show this help message

${bold('EXAMPLES')}
  ${gray('# Test a pattern against strings')}
  regex-tester "\\d+" "abc123" "xyz456"

  ${gray('# Global match with flags')}
  rgxt "(\\w+)@(\\w+)" "user@host admin@server" --flags gi

  ${gray('# Replace mode')}
  regex-tester "(\\w+)@(\\w+\\.\\w+)" "hi user@example.com" --replace "[email: $1]"

  ${gray('# Test against a file (one line per test)')}
  regex-tester "^\\d{4}-\\d{2}-\\d{2}$" --file dates.txt

  ${gray('# Stdin')}
  echo "foo bar baz" | regex-tester "\\b\\w{3}\\b"

  ${gray('# Explain a pattern')}
  regex-tester "([\\w.]+)@([\\w.]+)" --explain

  ${gray('# Benchmark')}
  regex-tester "\\b\\w+\\b" "hello world" --benchmark 50000

  ${gray('# JSON export')}
  regex-tester "(\\w+)@(\\w+)" "user@example.com" --json
`;
  process.stdout.write(usage + '\n');
}

// ── Arg parser ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    pattern:   null,
    strings:   [],
    flags:     'g',
    replace:   null,
    file:      null,
    benchmark: false,
    benchN:    10000,
    explain:   false,
    json:      false,
    count:     false,
    color:     true,
    help:      false,
  };

  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--help' || a === '-h') { opts.help = true; i++; continue; }
    if (a === '--explain')            { opts.explain = true; i++; continue; }
    if (a === '--json')               { opts.json = true; i++; continue; }
    if (a === '--count')              { opts.count = true; i++; continue; }
    if (a === '--no-color')           { opts.color = false; i++; continue; }
    if (a === '--flags') {
      opts.flags = args[++i] ?? '';
      i++; continue;
    }
    if (a === '--replace') {
      opts.replace = args[++i] ?? '';
      i++; continue;
    }
    if (a === '--file') {
      opts.file = args[++i] ?? null;
      i++; continue;
    }
    if (a === '--benchmark') {
      opts.benchmark = true;
      const next = args[i + 1];
      if (next && /^\d+$/.test(next)) { opts.benchN = parseInt(next, 10); i++; }
      i++; continue;
    }
    // Positional: first is pattern, rest are test strings
    if (!opts.pattern) { opts.pattern = a; i++; continue; }
    opts.strings.push(a);
    i++;
  }

  return opts;
}

// ── Read lines from file ──────────────────────────────────────────────────────
async function readFileLines(filePath) {
  const lines = [];
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) lines.push(line);
  }
  return lines;
}

// ── Read stdin ────────────────────────────────────────────────────────────────
async function readStdin() {
  if (process.stdin.isTTY) return [];
  const lines = [];
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) lines.push(line);
  }
  return lines;
}

// ── Main processing logic ─────────────────────────────────────────────────────
async function run() {
  const opts = parseArgs(process.argv);

  // Disable color if requested or not a TTY
  const useColor = opts.color && process.stdout.isTTY;
  if (!useColor) {
    // Strip all color functions
    for (const key of Object.keys(A)) A[key] = '';
    ['c', 'bold', 'cyan', 'green', 'yellow', 'magenta', 'gray', 'red', 'dim'].forEach(() => {});
  }

  if (opts.help) { printHelp(); process.exit(0); }

  if (!opts.pattern) {
    process.stderr.write(red('Error: pattern is required.\n'));
    process.stderr.write(`Run ${cyan('regex-tester --help')} for usage.\n`);
    process.exit(1);
  }

  // Build regex
  let regex;
  try {
    regex = buildRegex(opts.pattern, opts.flags);
  } catch (err) {
    process.stderr.write(red(`Invalid regex: ${err.message}\n`));
    process.exit(1);
  }

  // Gather test strings
  let inputs = [...opts.strings];

  if (opts.file) {
    try {
      const fileLines = await readFileLines(opts.file);
      inputs = inputs.concat(fileLines);
    } catch (err) {
      process.stderr.write(red(`Cannot read file: ${err.message}\n`));
      process.exit(1);
    }
  }

  const stdinLines = await readStdin();
  inputs = inputs.concat(stdinLines);

  // ── EXPLAIN MODE ──────────────────────────────────────────────────────────
  if (opts.explain) {
    const parts = explainRegex(opts.pattern);
    if (opts.json) {
      process.stdout.write(JSON.stringify({
        pattern: opts.pattern,
        flags: opts.flags,
        explanation: parts,
      }, null, 2) + '\n');
    } else {
      process.stdout.write('\n');
      process.stdout.write(bold(`Pattern: `) + cyan(`/${opts.pattern}/${opts.flags}`) + '\n');
      process.stdout.write(bold('Explanation:\n'));
      parts.forEach((part, i) => {
        process.stdout.write(`  ${gray(String(i + 1).padStart(2, ' ') + '.')} ${part}\n`);
      });
      process.stdout.write('\n');
    }
    if (!inputs.length) process.exit(0);
  }

  // If no inputs at this point, show help nudge
  if (!inputs.length) {
    process.stderr.write(yellow('No input strings provided.\n'));
    process.stderr.write(`Usage: ${cyan('regex-tester')} <pattern> <string> [--flags gi]\n`);
    process.exit(1);
  }

  // ── BENCHMARK MODE ────────────────────────────────────────────────────────
  if (opts.benchmark) {
    const n = opts.benchN;
    const testStr = inputs[0];

    process.stdout.write('\n');
    process.stdout.write(bold('Benchmark') + `  /${cyan(opts.pattern)}/${opts.flags}\n`);
    process.stdout.write(`  ${gray('Input:')}    "${testStr.slice(0, 60)}${testStr.length > 60 ? '...' : ''}"\n`);
    process.stdout.write(`  ${gray('Iterations:')} ${n.toLocaleString()}\n\n`);

    // Warm up
    for (let k = 0; k < 100; k++) {
      const r = buildRegex(opts.pattern, opts.flags);
      getMatches(r, testStr);
    }

    const start = performance.now();
    let matchCount = 0;
    for (let k = 0; k < n; k++) {
      const r = buildRegex(opts.pattern, opts.flags);
      const ms = getMatches(r, testStr);
      matchCount = ms.length;
    }
    const elapsed = performance.now() - start;
    const perOp = elapsed / n;
    const opsPerSec = Math.round(1000 / perOp);

    if (opts.json) {
      process.stdout.write(JSON.stringify({
        pattern: opts.pattern,
        flags: opts.flags,
        iterations: n,
        totalMs: parseFloat(elapsed.toFixed(3)),
        perIterationUs: parseFloat((perOp * 1000).toFixed(3)),
        opsPerSecond: opsPerSec,
        matchesPerInput: matchCount,
      }, null, 2) + '\n');
    } else {
      process.stdout.write(`  ${green('Total time:')}    ${elapsed.toFixed(2)}ms\n`);
      process.stdout.write(`  ${green('Per iteration:')} ${(perOp * 1000).toFixed(3)}μs\n`);
      process.stdout.write(`  ${green('Ops/second:')}    ${opsPerSec.toLocaleString()}\n`);
      process.stdout.write(`  ${green('Matches/input:')} ${matchCount}\n`);
      process.stdout.write('\n');
    }
    process.exit(0);
  }

  // ── TEST / REPLACE MODE ───────────────────────────────────────────────────
  const jsonResults = [];
  let totalMatches = 0;
  let totalInputs = inputs.length;

  for (const input of inputs) {
    const matches = getMatches(regex, input);
    totalMatches += matches.length;

    if (opts.json) {
      jsonResults.push({
        input,
        matchCount: matches.length,
        matches: matches.map((m) => serializeMatch(m, input)),
        ...(opts.replace !== null
          ? { replaced: input.replace(regex, opts.replace) }
          : {}),
      });
      continue;
    }

    if (opts.count) continue; // collect counts, print summary later

    // Normal output
    const multiInput = totalInputs > 1;
    if (multiInput) {
      process.stdout.write('\n' + bold('Input: ') + `"${input}"\n`);
    } else {
      process.stdout.write('\n');
    }

    if (opts.replace !== null) {
      // Replace mode
      const replaced = input.replace(regex, opts.replace);
      process.stdout.write(bold('Pattern:  ') + cyan(`/${opts.pattern}/${opts.flags}`) + '\n');
      process.stdout.write(bold('Input:    ') + `"${input}"\n`);
      process.stdout.write(bold('Replaced: ') + green(`"${replaced}"`) + '\n');
      process.stdout.write(gray(`(${matches.length} replacement${matches.length !== 1 ? 's' : ''})\n`));
      process.stdout.write('\n');
      continue;
    }

    if (!matches.length) {
      process.stdout.write(yellow('No matches') + ` for ${cyan(`/${opts.pattern}/${opts.flags}`)}\n`);
      if (!multiInput) {
        process.stdout.write(dim('  Input: ') + `"${input}"\n`);
      }
      continue;
    }

    // Show highlighted string + matches
    process.stdout.write(
      bold(green(`${matches.length} match${matches.length !== 1 ? 'es' : ''}`)) +
      ` for ${cyan(`/${opts.pattern}/${opts.flags}`)}\n`
    );
    if (!multiInput) {
      process.stdout.write(bold('Input: ') + `"${highlightMatches(input, matches)}"\n`);
    } else {
      process.stdout.write(`       "${highlightMatches(input, matches)}"\n`);
    }

    matches.forEach((m, idx) => {
      const matchLines = formatMatchResult(m, idx, opts.pattern);
      matchLines.forEach((l) => process.stdout.write(l + '\n'));
    });
  }

  // ── OUTPUT ────────────────────────────────────────────────────────────────
  if (opts.json) {
    process.stdout.write(JSON.stringify({
      pattern: opts.pattern,
      flags: opts.flags,
      totalInputs,
      totalMatches,
      results: jsonResults,
    }, null, 2) + '\n');
    process.exit(0);
  }

  if (opts.count) {
    process.stdout.write('\n');
    process.stdout.write(bold('Pattern: ') + cyan(`/${opts.pattern}/${opts.flags}`) + '\n');
    process.stdout.write(bold('Inputs:  ') + String(totalInputs) + '\n');
    process.stdout.write(bold('Matches: ') + (totalMatches > 0 ? green(String(totalMatches)) : yellow('0')) + '\n');
    process.stdout.write('\n');
    process.exit(0);
  }

  // Summary line when testing multiple inputs
  if (totalInputs > 1) {
    process.stdout.write('\n');
    process.stdout.write(
      bold('Summary: ') +
      green(`${totalMatches} total match${totalMatches !== 1 ? 'es' : ''}`) +
      ` across ${totalInputs} inputs\n\n`
    );
  } else {
    process.stdout.write('\n');
  }
}

run().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
