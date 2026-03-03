#!/usr/bin/env node
// regex-tester — interactive regex playground in your terminal
// Zero dependencies · Node 18+

const { argv, stdout, stdin, exit } = process;

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const ESC = '\x1b[';
const ansi = {
  reset:     '\x1b[0m',
  bold:      '\x1b[1m',
  dim:       '\x1b[2m',
  red:       '\x1b[31m',
  green:     '\x1b[32m',
  yellow:    '\x1b[33m',
  blue:      '\x1b[34m',
  magenta:   '\x1b[35m',
  cyan:      '\x1b[36m',
  white:     '\x1b[37m',
  gray:      '\x1b[90m',
  bRed:      '\x1b[91m',
  bGreen:    '\x1b[92m',
  bYellow:   '\x1b[93m',
  bBlue:     '\x1b[94m',
  bMagenta:  '\x1b[95m',
  bCyan:     '\x1b[96m',
  bWhite:    '\x1b[97m',
  bgBlue:    '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan:    '\x1b[46m',
  clear:     '\x1b[2J\x1b[H',
  hideCursor:'\x1b[?25l',
  showCursor:'\x1b[?25h',
  moveTo: (r, c) => `${ESC}${r};${c}H`,
  clearLine: `${ESC}2K`,
};

const write = (s) => stdout.write(s);
const col = (code, s) => `${code}${s}${ansi.reset}`;

// ── Box drawing ───────────────────────────────────────────────────────────────
function box(title, lines, width, focused = false) {
  const titleColor  = focused ? ansi.bCyan : ansi.gray;
  const borderColor = focused ? ansi.cyan  : ansi.dim;
  const titleStr    = `─ ${title} `;
  const top    = `${borderColor}┌${titleColor}${ansi.bold}${titleStr}${ansi.reset}${borderColor}${'─'.repeat(Math.max(0, width - titleStr.length - 2))}┐${ansi.reset}`;
  const bottom = `${borderColor}└${'─'.repeat(width - 2)}┘${ansi.reset}`;
  const out = [top];
  for (const line of lines) {
    const pad = Math.max(0, width - 4 - visibleLen(line));
    out.push(`${borderColor}│${ansi.reset} ${line}${' '.repeat(pad)} ${borderColor}│${ansi.reset}`);
  }
  out.push(bottom);
  return out;
}

function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ''); }
function visibleLen(s) { return stripAnsi(s).length; }

function truncate(s, maxLen) {
  let len = 0; let result = ''; let inEsc = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\x1b') inEsc = true;
    if (inEsc) { result += s[i]; if (s[i] === 'm') inEsc = false; continue; }
    if (len >= maxLen) break;
    result += s[i]; len++;
  }
  return result + ansi.reset;
}

// ── Pattern presets ───────────────────────────────────────────────────────────
const PRESETS = [
  { name: 'Email',      pattern: '([\\w.+-]+)@([\\w-]+)\\.([\\w.]+)',   flags: 'gi', description: 'Match email addresses' },
  { name: 'URL',        pattern: 'https?:\\/\\/[\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]+', flags: 'gi', description: 'Match HTTP/HTTPS URLs' },
  { name: 'IPv4',       pattern: '(\\d{1,3}\\.){3}\\d{1,3}',            flags: 'g',  description: 'Match IPv4 addresses' },
  { name: 'Date',       pattern: '(\\d{4})-(\\d{2})-(\\d{2})',           flags: 'g',  description: 'Match YYYY-MM-DD dates' },
  { name: 'UUID',       pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', flags: 'gi', description: 'Match UUIDs' },
  { name: 'Phone (US)', pattern: '(\\+1[-.\\s]?)?\\(?([0-9]{3})\\)?[-.\\s]?([0-9]{3})[-.\\s]?([0-9]{4})', flags: 'g', description: 'Match US phone numbers' },
  { name: 'Hex color',  pattern: '#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b', flags: 'g',  description: 'Match CSS hex colors' },
  { name: 'HTML tag',   pattern: '<([a-z][a-z0-9]*)\\b[^>]*>(.*?)<\\/\\1>', flags: 'gis', description: 'Match HTML element pairs' },
  { name: 'Word',       pattern: '\\b\\w+\\b',                           flags: 'g',  description: 'Match individual words' },
  { name: 'Number',     pattern: '-?\\d+(\\.\\d+)?',                    flags: 'g',  description: 'Match integers and decimals' },
];

// ── Regex engine ──────────────────────────────────────────────────────────────
function parsePatternInput(raw) {
  const m = raw.match(/^\/(.*)\/([gimsuy]*)$/s);
  if (m) return { src: m[1], flags: m[2] };
  return { src: raw, flags: '' };
}

function compileRegex(src, flags) {
  const allFlags = [...new Set(('d' + flags).split(''))].join('');
  return new RegExp(src, allFlags);
}

function getMatches(regex, str) {
  if (regex.flags.includes('g')) return [...str.matchAll(regex)];
  const m = regex.exec(str);
  return m ? [m] : [];
}

// ── Highlight matches in test string ─────────────────────────────────────────
function highlightMatches(str, matches) {
  if (!matches.length) return str;
  const ranges = [];
  for (const m of matches) {
    if (m.indices) ranges.push(m.indices[0]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let result = ''; let pos = 0;
  for (const [start, end] of ranges) {
    if (start < pos) continue;
    result += str.slice(pos, start);
    result += `${ansi.bgCyan}${ansi.bold}${ansi.white}${str.slice(start, end)}${ansi.reset}`;
    pos = end;
  }
  result += str.slice(pos);
  return result;
}

// ── Explain regex in English ──────────────────────────────────────────────────
function explainRegex(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && i + 1 < src.length) {
      const next = src[i + 1];
      const map = { d:'digit', D:'non-digit', w:'word char', W:'non-word char',
                    s:'whitespace', S:'non-whitespace', b:'word boundary',
                    B:'non-word boundary', n:'newline', t:'tab', r:'carriage return' };
      tokens.push(map[next] ? `[${map[next]}]` : `literal "${next}"`);
      i += 2;
    } else if (ch === '.') { tokens.push('[any char]'); i++; }
    else if (ch === '^') { tokens.push('[start]'); i++; }
    else if (ch === '$') { tokens.push('[end]'); i++; }
    else if (ch === '*') { tokens.push('[0 or more]'); i++; }
    else if (ch === '+') { tokens.push('[1 or more]'); i++; }
    else if (ch === '?') { tokens.push('[optional]'); i++; }
    else if (ch === '{') {
      const end = src.indexOf('}', i);
      if (end !== -1) { tokens.push(`[repeat ${src.slice(i, end + 1)}]`); i = end + 1; }
      else { tokens.push(ch); i++; }
    } else if (ch === '[') {
      const end = src.indexOf(']', i);
      if (end !== -1) { tokens.push(`[char class ${src.slice(i, end + 1)}]`); i = end + 1; }
      else { tokens.push(ch); i++; }
    } else if (ch === '(') { tokens.push('[group start]'); i++; }
    else if (ch === ')') { tokens.push('[group end]'); i++; }
    else if (ch === '|') { tokens.push('[or]'); i++; }
    else { tokens.push(`"${ch}"`); i++; }
  }
  return tokens.join(' ');
}

// ══════════════════════════════════════════════════════════════════════════════
// ONE-SHOT MODE
// ══════════════════════════════════════════════════════════════════════════════
function oneshotMode(args) {
  const patternArg = args[0];
  const testStr    = args[1] ?? '';
  const explain    = args.includes('--explain');
  const { src, flags } = parsePatternInput(patternArg);

  let regex;
  try { regex = compileRegex(src, flags); }
  catch (e) { console.error(`Invalid regex: ${e.message}`); exit(1); }

  if (explain) {
    console.log(`\n${ansi.bold}Pattern:${ansi.reset} /${src}/${flags}`);
    console.log(`${ansi.bold}Explanation:${ansi.reset} ${explainRegex(src)}\n`);
  }

  const matches = getMatches(regex, testStr);

  if (!matches.length) {
    console.log(`${ansi.yellow}No matches${ansi.reset} for /${src}/${flags} in "${testStr}"`);
    exit(0);
  }

  console.log(`\n${col(ansi.bGreen, `${matches.length} match${matches.length === 1 ? '' : 'es'}`)} for ${col(ansi.cyan, `/${src}/${flags}`)}\n`);

  matches.forEach((m, idx) => {
    const groups = m.slice(1);
    const [start, end] = m.indices?.[0] ?? ['?', '?'];
    console.log(`  ${col(ansi.bold + ansi.bWhite, `${idx + 1}:`)} ${col(ansi.bYellow, `"${m[0]}"`)}  ${col(ansi.gray, `@[${start}..${end}]`)}`);
    groups.forEach((g, gi) => {
      if (g !== undefined) {
        const [gs, ge] = m.indices?.[gi + 1] ?? ['?', '?'];
        console.log(`     ${col(ansi.gray, `Group ${gi + 1}:`)} ${col(ansi.bMagenta, `"${g}"`)}  ${col(ansi.gray, `@[${gs}..${ge}]`)}`);
      }
    });
  });
  console.log();
  exit(0);
}

// ══════════════════════════════════════════════════════════════════════════════
// INTERACTIVE TUI
// ══════════════════════════════════════════════════════════════════════════════
const STATE = {
  pattern: '', testStr: '',
  flags: { g: true, i: false, m: false, s: false },
  focus: 'pattern',
  mode: 'normal',   // 'normal' | 'presets' | 'help' | 'explain'
  presetIdx: 0,
  error: '', matches: [],
  dirty: true,
};

function flagString() {
  return Object.entries(STATE.flags).filter(([, v]) => v).map(([k]) => k).join('');
}

function recompute() {
  STATE.error = ''; STATE.matches = [];
  if (!STATE.pattern) return;
  try {
    const regex = compileRegex(STATE.pattern, flagString());
    STATE.matches = getMatches(regex, STATE.testStr);
  } catch (e) { STATE.error = e.message; }
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const W = stdout.columns || 80;
  const lines = [];

  if      (STATE.mode === 'presets') renderPresets(lines, W);
  else if (STATE.mode === 'help')    renderHelp(lines, W);
  else if (STATE.mode === 'explain') renderExplain(lines, W);
  else                               renderMain(lines, W);

  write(ansi.clear + ansi.hideCursor + lines.join('\n'));
}

function renderMain(lines, W) {
  lines.push(`${ansi.bold}${ansi.bCyan} regex-tester${ansi.reset}  ${ansi.gray}Tab:switch · p:presets · ?:explain · g/i/m/s:flags · Ctrl+C:quit${ansi.reset}`);
  lines.push('');

  // Flags
  const flagRow = Object.entries(STATE.flags).map(([k, v]) => {
    const label = { g:'global', i:'ignoreCase', m:'multiline', s:'dotAll' }[k];
    return (v ? col(ansi.bGreen + ansi.bold, `[${k}]`) : col(ansi.gray, `[${k}]`)) + ' ' + col(ansi.gray, label);
  }).join('  ');
  lines.push(`${ansi.gray}Flags:${ansi.reset}  ${flagRow}`);
  lines.push('');

  // Pattern box
  const patternDisplay = STATE.pattern
    ? col(ansi.bYellow, `/${STATE.pattern}/${flagString()}`)
    : col(ansi.gray, '(type a pattern)');
  const patBoxLines = [truncate(patternDisplay, W - 6)];
  if (STATE.error) patBoxLines.push(truncate(col(ansi.bRed, `! ${STATE.error}`), W - 6));
  box('Pattern', patBoxLines, W, STATE.focus === 'pattern').forEach(l => lines.push(l));
  lines.push('');

  // Test string box
  const testDisplay = STATE.testStr
    ? highlightMatches(STATE.testStr, STATE.matches)
    : col(ansi.gray, '(type a test string)');
  box('Test String', [truncate(testDisplay, W - 6)], W, STATE.focus === 'testStr').forEach(l => lines.push(l));
  lines.push('');

  // Matches box
  const mc = STATE.matches.length;
  const matchTitle = mc
    ? col(ansi.bGreen, `Matches (${mc})`)
    : STATE.error ? col(ansi.bRed, 'Matches (error)') : col(ansi.gray, 'Matches (0)');

  const matchLines = [];
  if (!STATE.pattern) {
    matchLines.push(col(ansi.gray, 'Enter a pattern above to see matches'));
  } else if (STATE.error) {
    matchLines.push(col(ansi.bRed, 'Fix the pattern error first'));
  } else if (!mc) {
    matchLines.push(col(ansi.yellow, 'No matches found'));
  } else {
    let shown = 0;
    for (let idx = 0; idx < mc; idx++) {
      const m = STATE.matches[idx];
      const [s, e] = m.indices?.[0] ?? ['?', '?'];
      matchLines.push(truncate(`${col(ansi.bold, `${idx + 1}:`)} ${col(ansi.bYellow, `"${m[0]}"`)}  ${col(ansi.gray, `@[${s}..${e}]`)}`, W - 6));
      shown++;
      m.slice(1).forEach((g, gi) => {
        if (g !== undefined) {
          const [gs, ge] = m.indices?.[gi + 1] ?? ['?', '?'];
          matchLines.push(truncate(`   ${col(ansi.gray, `Group ${gi + 1}:`)} ${col(ansi.bMagenta, `"${g}"`)}  ${col(ansi.gray, `@[${gs}..${ge}]`)}`, W - 6));
          shown++;
        }
      });
      if (shown > 12) { matchLines.push(col(ansi.gray, `  ... and ${mc - idx - 1} more match${mc - idx - 1 === 1 ? '' : 'es'}`)); break; }
    }
  }
  box(matchTitle, matchLines, W, false).forEach(l => lines.push(l));
  lines.push('');
  lines.push(`${ansi.gray}Active: ${STATE.focus === 'pattern' ? 'PATTERN' : 'TEST STRING'} · backspace:delete · Tab:switch${ansi.reset}`);
}

function renderPresets(lines, W) {
  lines.push(`${ansi.bold}${ansi.bCyan} Pattern Presets${ansi.reset}  ${ansi.gray}Up/Down:navigate · Enter:select · Esc:cancel${ansi.reset}`);
  lines.push('');
  PRESETS.forEach((p, i) => {
    const sel = i === STATE.presetIdx;
    const marker  = sel ? col(ansi.bCyan + ansi.bold, '> ') : '  ';
    const name    = sel ? col(ansi.bWhite + ansi.bold, p.name.padEnd(12)) : col(ansi.white, p.name.padEnd(12));
    const pattern = truncate(sel ? col(ansi.bYellow, `/${p.pattern}/${p.flags}`) : col(ansi.gray, `/${p.pattern}/${p.flags}`), Math.floor(W / 2) - 4);
    const desc    = truncate(col(ansi.gray, p.description), Math.floor(W / 2) - 4);
    lines.push(`${marker}${name}  ${pattern}  ${desc}`);
  });
  lines.push('');
  lines.push(`${ansi.gray}Press Enter to load preset, Esc to cancel${ansi.reset}`);
}

function renderHelp(lines, W) {
  const kv = (k, v) => `  ${col(ansi.bCyan + ansi.bold, k.padEnd(20))} ${col(ansi.white, v)}`;
  lines.push(`${ansi.bold}${ansi.bCyan} Key Bindings${ansi.reset}  ${ansi.gray}Press any key to close${ansi.reset}`);
  lines.push('');
  [
    ['Tab',             'Switch between Pattern / Test String'],
    ['Backspace',       'Delete last character in active field'],
    ['g / i / m / s',  'Toggle regex flags (only when pattern field active)'],
    ['p',               'Open pattern presets library'],
    ['?',               'Explain current pattern in English'],
    ['Esc',             'Close overlay / cancel'],
    ['Ctrl+C',          'Quit'],
  ].forEach(([k, v]) => lines.push(kv(k, v)));
}

function renderExplain(lines, W) {
  lines.push(`${ansi.bold}${ansi.bCyan} Pattern Explanation${ansi.reset}  ${ansi.gray}Press any key to close${ansi.reset}`);
  lines.push('');
  if (!STATE.pattern) {
    lines.push(col(ansi.gray, 'No pattern entered yet.'));
  } else {
    lines.push(`${ansi.gray}Pattern:${ansi.reset}  ${col(ansi.bYellow, `/${STATE.pattern}/${flagString()}`)}`);
    lines.push('');
    const explanation = explainRegex(STATE.pattern);
    const words = explanation.split(' ');
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).length > W - 4) { lines.push('  ' + cur); cur = w; }
      else { cur = cur ? cur + ' ' + w : w; }
    }
    if (cur) lines.push('  ' + cur);
    lines.push('');
    if (STATE.error) lines.push(col(ansi.bRed, `  Error: ${STATE.error}`));
    else if (STATE.matches.length) lines.push(col(ansi.bGreen, `  ${STATE.matches.length} match${STATE.matches.length === 1 ? '' : 'es'} on current test string`));
  }
}

// ── Input ─────────────────────────────────────────────────────────────────────
function handleKey(buf) {
  const str = buf.toString();

  if (str === '\x03' || str === '\x04') { cleanup(); exit(0); }

  // Overlays
  if (STATE.mode === 'presets') {
    if (str === '\x1b[A') { STATE.presetIdx = (STATE.presetIdx - 1 + PRESETS.length) % PRESETS.length; }
    else if (str === '\x1b[B') { STATE.presetIdx = (STATE.presetIdx + 1) % PRESETS.length; }
    else if (str === '\r' || str === '\n') {
      const p = PRESETS[STATE.presetIdx];
      STATE.pattern = p.pattern;
      for (const k of Object.keys(STATE.flags)) STATE.flags[k] = false;
      for (const f of p.flags.split('')) if (f in STATE.flags) STATE.flags[f] = true;
      STATE.mode = 'normal'; recompute();
    } else { STATE.mode = 'normal'; }
    STATE.dirty = true; return;
  }

  if (STATE.mode === 'help' || STATE.mode === 'explain') {
    STATE.mode = 'normal'; STATE.dirty = true; return;
  }

  // Normal mode
  if (str === '\x1b' || str === '\x1b[') { STATE.mode = 'normal'; STATE.dirty = true; return; }
  if (str === '\t')  { STATE.focus = STATE.focus === 'pattern' ? 'testStr' : 'pattern'; STATE.dirty = true; return; }
  if (str === 'p')   { STATE.mode = 'presets'; STATE.dirty = true; return; }
  if (str === '?')   { STATE.mode = 'explain'; STATE.dirty = true; return; }

  // Flag toggles — only when pattern field focused
  if (STATE.focus === 'pattern' && ['g', 'i', 'm', 's'].includes(str) && STATE.pattern === '') {
    STATE.flags[str] = !STATE.flags[str]; recompute(); STATE.dirty = true; return;
  }

  // Backspace
  if (str === '\x7f' || str === '\b') {
    if (STATE.focus === 'pattern') STATE.pattern = STATE.pattern.slice(0, -1);
    else STATE.testStr = STATE.testStr.slice(0, -1);
    recompute(); STATE.dirty = true; return;
  }

  // Printable
  if (str.length === 1 && str.charCodeAt(0) >= 32) {
    if (STATE.focus === 'pattern') STATE.pattern += str;
    else STATE.testStr += str;
    recompute(); STATE.dirty = true; return;
  }
}

function cleanup() {
  write(ansi.showCursor + '\n');
  if (stdin.isTTY) stdin.setRawMode(false);
  stdin.pause();
}

// ── Entry ─────────────────────────────────────────────────────────────────────
function main() {
  const args = argv.slice(2);

  if (args.length >= 1 && !args[0].startsWith('--')) { oneshotMode(args); return; }
  if (args.includes('--explain') && args.length < 2)  {
    console.error('Usage: regex-tester \'/pattern/\' "string" --explain'); exit(1);
  }

  if (!stdin.isTTY) { console.error('regex-tester requires an interactive terminal.'); exit(1); }

  stdin.setRawMode(true);
  stdin.resume();
  stdin.on('data', (buf) => { handleKey(buf); if (STATE.dirty) { render(); STATE.dirty = false; } });
  stdout.on('resize', () => render());

  recompute(); render();
}

main();
