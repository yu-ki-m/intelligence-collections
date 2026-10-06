#!/usr/bin/env node
// ガイド作成の下準備。AIが読む範囲を絞るための材料(変更行、変更された関数の呼び出し候補、入口の候補)を集め、
// guide.json の骨組みを作る。.codebase-guide-out が無い、または古い場合は通常生成も行う。

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  git, execFileAsync, sourceSignature, sanitizeName, isLikelyBinary, splitLines, mapLimit, toPosix,
  OUTPUT_DIR_NAME, GUIDES_DIR_NAME, MANIFEST_NAME, EXCLUDE_OUTPUT_PATHSPECS,
} from './lib/common.mjs';
import { resolveDiffSpec, collectDiff, readTargetFile, compressRanges } from './lib/diff.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback = undefined) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};

const root = path.resolve(opt('--root', process.cwd()));
const outputDir = path.join(root, OUTPUT_DIR_NAME);
const refreshBase = args.includes('--refresh-base');
const force = args.includes('--force');

const CALLER_LIMIT = 15;
const CALLER_SKIP_OVER = 200;
const ENTRY_LIMIT = 80;

// 入口(HTTPルート、ジョブ、イベント受信、CLI)を探すパターン。git grep -E (POSIX ERE)で使う。
const ENTRY_PATTERNS = [
  String.raw`(app|router|server|api|route|routes|r)\.(get|post|put|patch|delete|all|route)\([[:space:]]*['"` + '`' + String.raw`]`,
  String.raw`@(Get|Post|Put|Patch|Delete|Request)Mapping`,
  String.raw`@(Get|Post|Put|Patch|Delete|All)\(`,
  String.raw`@[A-Za-z_]+\.(get|post|put|patch|delete|route|api_route)\(`,
  String.raw`\.(HandleFunc|Handle|GET|POST|PUT|PATCH|DELETE)\(`,
  String.raw`Route::(get|post|put|patch|delete|resource|apiResource)\(`,
  String.raw`(^|[^.[:alnum:]_])(re_)?path\([[:space:]]*r?['"]`,
  String.raw`@(Cron|Scheduled|EventPattern|MessagePattern|KafkaListener|RabbitListener|SqsListener|JmsListener)`,
  String.raw`(program|cli)\.command\(|@click\.command|cobra\.Command\{`,
];

// 関数・メソッド・クラス定義らしい行から名前を取り出す(言語をまたいだ簡易判定)。
const DEF_PATTERNS = [
  /\bfunction\*?\s+([A-Za-z_$][\w$]*)\s*\(/,
  /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/,
  /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*[[(]/,
  /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_]\w*)/,
  /^\s*(?:[\w@]+\s+)*fun\s+(?:<[^>]*>\s*)?(?:[\w.]+\.)?([A-Za-z_]\w*)\s*\(/,
  /^\s*def\s+(?:self\.)?([A-Za-z_]\w*[?!]?)/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/,
  /^\s*(?:(?:public|private|protected|static|readonly|override)\s+)*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::[^=]+)?=>/,
  /^\s*(?:(?:public|private|protected|internal|static|final|abstract|override|virtual|async|synchronized|sealed|extern|unsafe|partial)\s+)*(?:[\w<>[\],.?]+\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\([^;]*\)\s*(?::\s*[^{;=]+)?(?:throws\s+[\w.,\s]+)?\s*\{\s*$/,
  /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:class|interface|struct|enum|trait)\s+([A-Za-z_$][\w$]*)/,
];
const NOT_NAMES = new Set('if for while switch catch return else do try function new typeof sizeof await yield with elif except match case'.split(' '));

function definitionName(line) {
  for (const re of DEF_PATTERNS) {
    const m = line.match(re);
    if (m && !NOT_NAMES.has(m[1])) return m[1];
  }
  return null;
}

const indentOf = line => (line.match(/^\s*/)?.[0] || '').replace(/\t/g, '    ').length;

// 行 lineNo を含む関数(定義行の字下げが本体より浅いもの)を上へたどって探す。
function enclosingDefinition(lines, lineNo) {
  let bodyIndent = null;
  for (let k = lineNo; k <= Math.min(lines.length, lineNo + 5); k++) {
    if (lines[k - 1]?.trim()) { bodyIndent = indentOf(lines[k - 1]); break; }
  }
  for (let k = lineNo; k >= Math.max(1, lineNo - 400); k--) {
    const line = lines[k - 1];
    if (!line || !line.trim()) continue;
    const name = definitionName(line);
    if (name && (k === lineNo || bodyIndent === null || indentOf(line) < bodyIndent)) return { name, line: k, text: line.trim() };
  }
  return null;
}

async function readRequest() {
  const file = opt('--request-file');
  if (file) return (await fs.readFile(path.resolve(file), 'utf8')).trim();
  return (opt('--request', '') || '').trim();
}

async function ensureBase() {
  const manifestPath = path.join(outputDir, MANIFEST_NAME);
  let manifest = null;
  try { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); } catch { /* 未生成または古い形式 */ }
  const sig = await sourceSignature(root);
  let reason = null;
  if (!manifest) reason = '.codebase-guide-out が無い、または記録ファイルの無い古い形式';
  else if (refreshBase) reason = '--refresh-base の指定';
  else if (sig && manifest.source?.signature !== sig.signature) reason = '前回の生成からソースが変わっている';
  if (!reason) return { action: '既存の .codebase-guide-out をそのまま使う', manifest };
  const opts = manifest?.options || {};
  const genArgs = [path.join(here, 'generate-html-code.mjs'), '--root', root];
  if (opts.includeIgnored) genArgs.push('--include-ignored');
  for (const d of opts.includeDirs || []) genArgs.push('--include-dir', d);
  for (const f of opts.includeFiles || []) genArgs.push('--include-file', f);
  try {
    await execFileAsync(process.execPath, genArgs, { maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    throw new Error(`通常生成(generate-html-code.mjs)が失敗した:\n${err.stdout || ''}${err.stderr || err.message}`);
  }
  manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  return { action: `通常生成をやり直した（${reason}）`, manifest };
}

async function grepLines(argsForGrep, target) {
  const gitArgs = ['grep', '-n', '-I', ...argsForGrep];
  if (target) gitArgs.push(target);
  gitArgs.push('--', '.', ...EXCLUDE_OUTPUT_PATHSPECS);
  try {
    const out = await git(root, gitArgs);
    const prefix = target ? `${target}:` : '';
    return out.split('\n').filter(Boolean).map(l => (prefix && l.startsWith(prefix) ? l.slice(prefix.length) : l));
  } catch (err) {
    if (err.code === 1) return []; // 一致なし
    throw err;
  }
}

const clip = (s, n = 150) => (s.length > n ? `${s.slice(0, n)}…` : s);

async function main() {
  const started = Date.now();
  const request = await readRequest();
  if (!request) {
    console.error('--request "<依頼文>" または --request-file <ファイル> を指定する');
    process.exit(1);
  }
  const date = new Date();
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const name = sanitizeName(opt('--name') || `${ymd}-${request.slice(0, 30)}`);
  const guideDir = path.join(outputDir, GUIDES_DIR_NAME, name);
  const guideFile = path.join(guideDir, 'guide.json');

  const base = await ensureBase();
  const diff = await resolveDiffSpec(root, opt('--diff'));
  const diffFiles = diff ? await collectDiff(root, diff) : new Map();
  const reviewGuess = /レビュー|指摘|review|問題点|バグ|懸念|不具合/i.test(request);

  // 変更ファイルごとに、変更行・削除位置・変更を含む関数・追加された定義を集める
  const changed = [];
  const symbols = new Map(); // name -> {definedAt}
  for (const [rel, f] of [...diffFiles.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const item = { rel, f, hunks: [] };
    changed.push(item);
    if (f.status === 'D' || f.binary) continue;
    const buf = await readTargetFile(root, diff, rel);
    if (!buf || isLikelyBinary(buf)) continue;
    const lines = splitLines(buf.toString('utf8'));
    for (const h of f.hunks) {
      const at = h.newLines > 0 ? h.newStart : Math.max(1, h.newStart);
      const enclosing = enclosingDefinition(lines, at);
      const defs = [];
      for (let n = h.newStart; n < h.newStart + h.newLines; n++) {
        const d = definitionName(lines[n - 1] || '');
        if (d) defs.push({ name: d, line: n });
      }
      item.hunks.push({ h, enclosing, defs });
      for (const d of [enclosing, ...defs].filter(Boolean)) {
        if (d.name.length < 3 || symbols.has(d.name)) continue;
        symbols.set(d.name, { file: rel, line: d.line });
      }
    }
  }

  // 変更された関数・追加された定義を、名前の一致で呼んでいそうな箇所(git grep -w)
  const callers = [];
  await mapLimit([...symbols.entries()], 8, async ([sym, def]) => {
    const hits = (await grepLines(['-w', '-F', '-e', sym], diff?.target || null))
      .filter(l => !l.startsWith(`${def.file}:${def.line}:`));
    callers.push({ sym, def, hits });
  });
  callers.sort((a, b) => a.sym.localeCompare(b.sym));

  const target = diff?.target || null;
  const entryHits = await grepLines(['-E', ...ENTRY_PATTERNS.flatMap(p => ['-e', p])], target);

  // guide.json の骨組み(既にあれば --force 以外では上書きしない)
  await fs.mkdir(guideDir, { recursive: true });
  let skeletonNote;
  const exists = await fs.access(guideFile).then(() => true, () => false);
  if (exists && !force) {
    skeletonNote = '既存の guide.json を残した（作り直す場合は --force）';
  } else {
    const skeleton = {
      title: '',
      request,
      diff: diff ? diff.spec : null,
      review: reviewGuess,
      summary: [],
      steps: [],
      notes: [],
      unverified: [],
    };
    await fs.writeFile(guideFile, `${JSON.stringify(skeleton, null, 2)}\n`);
    skeletonNote = '骨組みを作成した';
  }

  // AIが読むための下準備メモ
  const relRoot = p => toPosix(path.relative(root, p));
  const out = [];
  out.push('# ガイド作成の下準備', '');
  out.push(`- ガイド名: ${name}`);
  out.push(`- guide.json: ${relRoot(guideFile)}（${skeletonNote}）`);
  out.push(`- 依頼文: ${request}`);
  out.push(`- レビュー依頼かどうか（依頼文からの推定）: ${reviewGuess ? 'レビュー依頼と推定（review: true）' : 'レビュー依頼ではないと推定（review: false）'}。依頼文を読んで判断し、guide.json の review を確定する`);
  out.push(`- .codebase-guide-out: ${base.action}（${base.manifest.files.length} ファイル）`);
  out.push('');
  if (diff) {
    const plus = changed.reduce((s, c) => s + c.f.plus, 0);
    const minus = changed.reduce((s, c) => s + c.f.minus, 0);
    out.push(`## 差分: ${diff.label}`, '');
    out.push(`比較元 ${diff.base.slice(0, 10)} → 比較先 ${diff.target ? diff.target.slice(0, 10) : '作業ツリー'}、${changed.length} ファイル、+${plus} −${minus}`, '');
    if (!changed.length) out.push('変更は無い。', '');
    else {
      out.push('| 状態 | ファイル | +/− | 変更行（新しい版の行番号） |', '|---|---|---|---|');
      for (const c of changed) {
        const lines = c.f.binary ? 'バイナリ' : c.f.status === 'D' ? '削除されたファイル' : compressRanges([...c.f.added, ...c.f.modified]) || '（削除だけ）';
        const name2 = c.f.status === 'R' ? `${c.f.oldPath} → ${c.rel}` : c.rel;
        out.push(`| ${c.f.status} | ${name2} | +${c.f.plus} −${c.f.minus} | ${lines} |`);
      }
      out.push('');
      out.push('### 変更を含む関数（字下げからの推定）', '');
      for (const c of changed) {
        for (const { h, enclosing, defs } of c.hunks) {
          const range = h.newLines ? `${h.newStart}-${h.newStart + h.newLines - 1}` : `${h.newStart} の後ろ（削除だけ）`;
          const where = enclosing ? `${enclosing.name}（${enclosing.line} 行目: \`${clip(enclosing.text, 100)}\`）` : '関数を特定できない';
          const added = defs.length ? `／追加された定義: ${defs.map(d => `${d.name}（${d.line} 行目）`).join(', ')}` : '';
          out.push(`- ${c.rel}:${range}（−${h.oldLines} +${h.newLines}） ${where}${added}`);
        }
      }
      out.push('');
    }
    out.push(`### 呼び出し候補（名前が一致する箇所。各 ${CALLER_LIMIT} 件まで）`, '');
    if (!callers.length) out.push('対象の名前が無い。', '');
    for (const c of callers) {
      if (c.hits.length > CALLER_SKIP_OVER) { out.push(`- \`${c.sym}\`（定義 ${c.def.file}:${c.def.line}）: ${c.hits.length} 件。一般的な名前のため省略`); continue; }
      out.push(`- \`${c.sym}\`（定義 ${c.def.file}:${c.def.line}）: ${c.hits.length} 件`);
      for (const h of c.hits.slice(0, CALLER_LIMIT)) out.push(`  - ${clip(h.replace(/\s+/g, ' '))}`);
      if (c.hits.length > CALLER_LIMIT) out.push(`  - …ほか ${c.hits.length - CALLER_LIMIT} 件`);
    }
    out.push('');
  } else {
    out.push('## 差分: 指定なし', '', '依頼文が差分を対象にしている場合は --diff で範囲を指定して実行し直す。', '');
  }
  out.push(`## 入口の候補（ルート定義・ジョブ・イベント受信など。${ENTRY_LIMIT} 件まで）`, '');
  if (!entryHits.length) out.push('見つからない。入口は呼び出し候補をたどって探す。');
  for (const h of entryHits.slice(0, ENTRY_LIMIT)) out.push(`- ${clip(h.replace(/\s+/g, ' '))}`);
  if (entryHits.length > ENTRY_LIMIT) out.push(`- …ほか ${entryHits.length - ENTRY_LIMIT} 件（git grep で絞り込む）`);
  out.push('');
  out.push('## 次にやること', '');
  out.push('1. 上の変更行・呼び出し候補・入口の候補を起点に、必要な範囲だけを読む（候補は名前の一致による推定。呼び出し関係はコードで確かめる）。');
  out.push('2. guide.json に steps・notes・summary を書く（書式は references/guide-format.md）。');
  out.push(`3. node "${toPosix(path.join(here, 'build-guide.mjs'))}" --root "${toPosix(root)}" --name "${name}" を実行し、エラーが出たら guide.json を直して再実行する。`);
  const brief = out.join('\n');
  await fs.writeFile(path.join(guideDir, 'guide.brief.md'), `${brief}\n`);
  console.log(brief);
  console.log(`\n(下準備 ${((Date.now() - started) / 1000).toFixed(2)}s。このメモは ${relRoot(path.join(guideDir, 'guide.brief.md'))} にも保存した)`);
}

main().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});
