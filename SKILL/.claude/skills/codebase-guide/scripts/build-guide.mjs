#!/usr/bin/env node
// guide.json(AIが書いた順路・解説・指摘)を検証し、ガイドのHTML(表紙と注釈付きコードページ)を生成する。
// アンカー(コード片)から行番号を求め、差分の行・全体図の配置・リンクはすべてここで計算する。

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  escapeHtml as esc, toPosix, hrefFrom, outputFileFor, baseCss, makeTree, sortTree, renderTree, isLikelyBinary,
  refreshTreePageGuides, sanitizeName,
  OUTPUT_DIR_NAME, GUIDES_DIR_NAME, MANIFEST_NAME, GUIDE_META_NAME, GUIDE_COVER_NAME, TREE_PAGE_NAME,
} from './lib/common.mjs';
import { highlightCode, languageFor } from './lib/highlight.mjs';
import { resolveDiffSpec, collectDiff, readTargetFile } from './lib/diff.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback = undefined) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};

const root = path.resolve(opt('--root', process.cwd()));
const outputDir = path.join(root, OUTPUT_DIR_NAME);
const guidesDir = path.join(outputDir, GUIDES_DIR_NAME);
const repoName = path.basename(root);

const DEFAULT_TYPES = {
  explain: { label: '解説', short: '解説', color: '#4daafc', shape: 'square', finding: false },
  bug: { label: '指摘（バグ）', short: 'バグ', color: '#f14c4c', shape: 'circle', finding: true },
  concern: { label: '指摘（懸念）', short: '懸念', color: '#e8913a', shape: 'triangle', finding: true },
  improve: { label: '指摘（改善）', short: '改善', color: '#4ec9b0', shape: 'diamond', finding: true },
};
const SHAPES = new Set(['square', 'circle', 'triangle', 'diamond']);
const KINDS = { entry: '入口', branch: '分岐', call: '呼び出し', process: '処理', data: 'データ', external: '外部連携' };
const NODE_KINDS = { result: '処理の終わり', db: 'DB テーブル', external: '外部連携', other: '' };
// ガイドのフォルダーで生成物ではないファイル(再ビルド時に残す)
const KEEP_FILES = new Set(['guide.json', 'guide.brief.md']);

const isStr = v => typeof v === 'string' && v.trim() !== '';
const clip = (s, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);
const circ = n => (n >= 1 && n <= 20 ? String.fromCharCode(0x245f + n) : `(${n})`);
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const paras = s => String(s).trim().split(/\n{2,}/).map(p => `<p>${inline(p).replace(/\n/g, '<br>')}</p>`).join('');
const basename = rel => rel.split('/').pop();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function normRel(v) {
  if (typeof v !== 'string') return null;
  const p = toPosix(v.trim()).replace(/^\.\//, '');
  if (!p || p.startsWith('/') || /^[A-Za-z]:/.test(p) || p.split('/').some(s => s === '..' || s === '' || s === '.')) return null;
  return p;
}

// アンカーは1行の部分一致。見つからなければ空白の違いを無視してもう一度探す。
function findAll(lines, needle, fromIndex) {
  const hits = [];
  for (let i = fromIndex; i < lines.length; i++) if (lines[i].includes(needle)) hits.push(i + 1);
  if (hits.length) return hits;
  const n = needle.replace(/\s+/g, ' ').trim();
  if (!n) return hits;
  for (let i = fromIndex; i < lines.length; i++) if (lines[i].replace(/\s+/g, ' ').includes(n)) hits.push(i + 1);
  return hits;
}

function locate(entry, spec, file, where, problems) {
  const { lines } = entry;
  if (!isStr(spec.anchor)) { problems.push(`${where}.anchor: 対象の行にあるコード片を書く`); return null; }
  if (/\n/.test(spec.anchor)) { problems.push(`${where}.anchor: 1行のコード片で書く（範囲は anchorEnd か lines で指定する）`); return null; }
  const hits = findAll(lines, spec.anchor, 0);
  if (!hits.length) { problems.push(`${where}.anchor: "${clip(spec.anchor)}" が ${file} に見つからない`); return null; }
  let line;
  if (spec.occurrence !== undefined) {
    if (!Number.isInteger(spec.occurrence) || spec.occurrence < 1 || spec.occurrence > hits.length) {
      problems.push(`${where}.occurrence: 1〜${hits.length} で指定する（一致した行: ${hits.slice(0, 10).join(', ')}）`);
      return null;
    }
    line = hits[spec.occurrence - 1];
  } else if (hits.length > 1) {
    problems.push(`${where}.anchor: "${clip(spec.anchor)}" が ${file} の ${hits.length} か所に一致する（${hits.slice(0, 10).join(', ')} 行目）。長いコード片にするか、occurrence（何番目か）を指定する`);
    return null;
  } else line = hits[0];
  let end = line;
  if (spec.anchorEnd !== undefined) {
    if (!isStr(spec.anchorEnd) || /\n/.test(spec.anchorEnd)) { problems.push(`${where}.anchorEnd: 1行のコード片で書く`); return null; }
    const endHits = findAll(lines, spec.anchorEnd, line - 1);
    if (!endHits.length) { problems.push(`${where}.anchorEnd: "${clip(spec.anchorEnd)}" が ${line} 行目以降に見つからない`); return null; }
    end = endHits[0];
  } else if (spec.lines !== undefined) {
    if (!Number.isInteger(spec.lines) || spec.lines < 1) { problems.push(`${where}.lines: 1 以上の整数で書く`); return null; }
    end = Math.min(lines.length, line + spec.lines - 1);
  }
  return { line, end };
}

function buildTypes(custom, problems) {
  const types = structuredClone(DEFAULT_TYPES);
  if (custom === undefined || custom === null) return types;
  if (typeof custom !== 'object' || Array.isArray(custom)) { problems.push('noteTypes: オブジェクトで書く'); return types; }
  for (const [key, t] of Object.entries(custom)) {
    const w = `noteTypes.${key}`;
    if (!/^[a-z][a-z0-9-]*$/.test(key)) { problems.push(`${w}: 種類の名前は英小文字・数字・- で書く`); continue; }
    if (!t || typeof t !== 'object') { problems.push(`${w}: オブジェクトで書く`); continue; }
    const prev = types[key] || {};
    const label = t.label ?? prev.label;
    const color = t.color ?? prev.color ?? '#c586c0';
    const shape = t.shape ?? prev.shape ?? 'circle';
    if (!isStr(label)) { problems.push(`${w}.label: 表示名を書く`); continue; }
    if (!/^#[0-9a-fA-F]{3,8}$/.test(color)) { problems.push(`${w}.color: #rrggbb 形式で書く`); continue; }
    if (!SHAPES.has(shape)) { problems.push(`${w}.shape: ${[...SHAPES].join(' / ')} のどれかにする`); continue; }
    types[key] = { label, short: t.short ?? prev.short ?? label, color, shape, finding: key === 'explain' ? false : (t.finding ?? prev.finding ?? true) };
  }
  return types;
}

const shapeEl = (types, t) => `<span class="mk s-${types[t].shape} t-${t}"></span>`;

function svgShape(shape, cx, cy, cls) {
  if (shape === 'circle') return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="4.5"/>`;
  if (shape === 'square') return `<rect class="${cls}" x="${cx - 4}" y="${cy - 4}" width="8" height="8" rx="1.5"/>`;
  if (shape === 'triangle') return `<polygon class="${cls}" points="${cx - 4.5},${cy + 4} ${cx},${cy - 4.5} ${cx + 4.5},${cy + 4}"/>`;
  return `<rect class="${cls}" x="${cx - 3.5}" y="${cy - 3.5}" width="7" height="7" transform="rotate(45 ${cx} ${cy})"/>`;
}

// 表示幅の見積もり(全角は1文字=フォントサイズ、半角は0.62倍)
function textWidth(s, size) {
  let w = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    w += c >= 0x2e80 || (c >= 0xff00 && c <= 0xffef) ? size : size * 0.62;
  }
  return w;
}

function fitText(s, size, max) {
  if (textWidth(s, size) <= max) return s;
  let out = '';
  for (const ch of String(s)) {
    if (textWidth(`${out}${ch}…`, size) > max) break;
    out += ch;
  }
  return `${out}…`;
}

// ブラウザで動く処理。各ページに直接埋め込む(共通ファイルは読み込まない)。
function guideRuntime(G) {
  const $ = id => document.getElementById(id);
  const stepById = new Map(G.steps.map(s => [s.id, s]));
  const findingById = new Map(G.findings.map(f => [f.id, f]));
  let store = null;
  try { store = window.localStorage; } catch (e) { store = null; }
  const load = (key, fallback) => { try { const v = store && store.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } };
  const save = (key, value) => { try { if (store) store.setItem(key, JSON.stringify(value)); } catch (e) { /* 保存できない環境では保持しない */ } };
  const hidden = new Set(load('cbg-hidden-types', []));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const circ = n => (n >= 1 && n <= 20 ? String.fromCharCode(0x245f + n) : '(' + n + ')');
  let lastFindingType = null;

  function applyFilters() {
    for (const t of G.types) {
      document.body.classList.toggle('hide-' + t, hidden.has(t));
      const chip = document.querySelector('.chip[data-type="' + t + '"]');
      if (chip) chip.setAttribute('aria-pressed', String(!hidden.has(t)));
    }
  }
  function setTab(tab) {
    if (!$('g-findings')) tab = 'steps';
    document.querySelectorAll('[data-ptab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ptab === tab)));
    [['g-steps', 'steps'], ['g-nav-steps', 'steps'], ['g-findings', 'findings'], ['g-nav-findings', 'findings']].forEach(([id, t]) => {
      const el = $(id);
      if (el) el.hidden = t !== tab;
    });
    save('cbg-tab', tab);
  }
  function current() {
    const h = decodeURIComponent(location.hash.slice(1));
    const f = findingById.get(h);
    if (f) return { step: f.step ? stepById.get(f.step) : null, finding: f };
    const s = G.steps.find(x => x.anchor === h);
    if (s) return { step: s, finding: null };
    return { step: G.firstStep ? stepById.get(G.firstStep) : null, finding: null };
  }
  function setNav(id, href) {
    const a = $(id);
    if (!a) return;
    if (href) { a.setAttribute('href', href); a.removeAttribute('aria-disabled'); }
    else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
  }
  function rows(from, to) {
    const out = [];
    for (let n = from; n <= to; n++) {
      const r = document.querySelector('tr.row[data-line="' + n + '"]');
      if (r) out.push(r);
    }
    return out;
  }
  function update(scroll) {
    const { step, finding } = current();
    document.querySelectorAll('tr.cur').forEach(r => r.classList.remove('cur'));
    document.querySelectorAll('tr.fsel').forEach(r => { r.classList.remove('fsel'); if (lastFindingType) r.classList.remove('t-' + lastFindingType); });
    if (step && step.file === G.page) rows(step.line, step.end).forEach(r => r.classList.add('cur'));
    if (finding && finding.file === G.page) {
      rows(finding.line, finding.end).forEach(r => r.classList.add('fsel', 't-' + finding.type));
      lastFindingType = finding.type;
    }
    document.querySelectorAll('.note.is-cur, .note.sel').forEach(n => n.classList.remove('is-cur', 'sel'));
    if (step && $(step.anchor)) $(step.anchor).classList.add('is-cur');
    if (finding && $(finding.id)) $(finding.id).classList.add('sel');
    document.querySelectorAll('.badge.on').forEach(b => b.classList.remove('on'));
    if (step) document.querySelectorAll('.badge[data-step="' + step.id + '"]').forEach(b => b.classList.add('on'));
    document.querySelectorAll('.plist a.on').forEach(a => a.classList.remove('on'));
    const stepItem = step && document.querySelector('#g-steps a[data-id="' + step.id + '"]');
    if (stepItem) stepItem.classList.add('on');
    const findingItem = finding && document.querySelector('#g-findings a[data-id="' + finding.id + '"]');
    if (findingItem) findingItem.classList.add('on');
    const chain = [];
    for (let s = step; s && chain.length < 50; s = s.parent ? stepById.get(s.parent) : null) chain.unshift(s);
    $('g-stack').innerHTML = chain.length
      ? chain.map((s, d) => '<a class="stk' + (s === step ? ' now' : '') + '" href="' + esc(s.href) + '" style="padding-left:' + (14 + d * 14) + 'px">' + (d ? '└ ' : '') + esc(s.title) + (s === step ? '<em>現在地</em>' : '') + '</a>').join('')
      : '<div class="empty">ステップを選ぶと表示する</div>';
    const i = step ? G.steps.indexOf(step) : -1;
    setNav('g-prev', i > 0 ? G.steps[i - 1].href : null);
    setNav('g-next', i < G.steps.length - 1 ? G.steps[i + 1].href : null);
    setNav('g-up', step && step.parent ? stepById.get(step.parent).href : null);
    const visible = G.findings.filter(f => !hidden.has(f.type));
    const p = finding ? visible.indexOf(finding) : -1;
    setNav('g-pf', p > 0 ? visible[p - 1].href : null);
    setNav('g-nf', p + 1 < visible.length ? visible[p + 1].href : null);
    const pos = $('g-pos');
    if (pos) pos.textContent = step ? circ(step.n) + ' / ' + G.steps.length : '– / ' + G.steps.length;
    if (scroll) {
      const target = finding && finding.file === G.page ? finding.line : step && step.file === G.page ? step.line : null;
      const editor = document.querySelector('.editor');
      const row = target ? document.querySelector('tr.row[data-line="' + target + '"]') : null;
      if (editor && row) editor.scrollTop += row.getBoundingClientRect().top - editor.getBoundingClientRect().top - 42;
    }
  }
  document.addEventListener('click', e => {
    const chip = e.target.closest('.chip[data-type]');
    if (chip) {
      const t = chip.dataset.type;
      if (hidden.has(t)) hidden.delete(t); else hidden.add(t);
      save('cbg-hidden-types', [...hidden]);
      applyFilters();
      update(false);
      return;
    }
    const tab = e.target.closest('[data-ptab]');
    if (tab) setTab(tab.dataset.ptab);
  });
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const follow = id => {
      const a = $(id);
      if (a && a.getAttribute('href')) { location.href = a.href; return true; }
      return false;
    };
    if (e.key === 'n' && follow('g-next')) e.preventDefault();
    else if (e.key === 'p' && follow('g-prev')) e.preventDefault();
    else if (e.key === 'F8') { e.preventDefault(); setTab('findings'); follow(e.shiftKey ? 'g-pf' : 'g-nf'); }
  });
  window.addEventListener('hashchange', () => update(true));
  // 読み込み完了後にもう一度合わせ、ブラウザ自身の #id へのスクロールより後で対象行を表示する
  window.addEventListener('load', () => update(true));
  applyFilters();
  setTab(load('cbg-tab', 'steps'));
  update(true);
}

function guideCss(types) {
  let css = `
[hidden]{display:none!important}
:root{--panel:#252526;--hover:#2a2d2e;--line2:#3a3a3a;--accent:#0078d4;--hl:rgba(77,170,252,.12);--add:#81b88b;--add-bg:rgba(129,184,139,.10);--mod:#e2c08d;--del:#f14c4c;--del-bg:rgba(241,76,76,.10);--branch:#c586c0;--warn:#d7ba7d;--edge:#707070;--chip:#3a3d41;--btn:#2d2d30;--btn-border:#3c3c3c;--codebg:#1a1a1a;--dbfill:#1d2826;--ui:Segoe UI,system-ui,-apple-system,sans-serif;--mono:Consolas,'Cascadia Code','SFMono-Regular',monospace}
.mk{display:inline-block;width:9px;height:9px;flex:none;background:var(--c)}.mk.s-square{border-radius:2px}.mk.s-circle{border-radius:50%}.mk.s-triangle{width:10px;clip-path:polygon(50% 0,100% 100%,0 100%)}.mk.s-diamond{transform:rotate(45deg) scale(.85)}
.kl{display:inline-flex;align-items:center;gap:6px;font-size:11px;line-height:1.6;color:var(--c);border:1px solid var(--c);border-radius:3px;padding:0 6px;white-space:nowrap}
.tag{display:inline-block;font-size:10px;line-height:1.5;padding:0 5px;border-radius:3px;border:1px solid var(--line2);color:var(--muted);margin-left:6px;vertical-align:1px;font-weight:400;white-space:nowrap}.tag-entry{color:var(--link);border-color:var(--link)}.tag-branch{color:var(--branch);border-color:var(--branch)}.tag-diff{color:var(--mod);border-color:var(--mod)}.tag-data,.tag-external{color:var(--syn-title);border-color:var(--syn-title)}
.badge{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;font:600 11px/1 var(--ui);background:var(--chip);color:var(--text);flex:none;vertical-align:middle}.badge.d{box-shadow:inset 0 0 0 1.5px var(--mod)}.badge.on{background:var(--accent);color:#fff}.badge.on.d{box-shadow:0 0 0 1.5px var(--mod)}a.badge:hover{background:#4a4d52}a.badge.on:hover{background:var(--accent)}
.titlebar .tb-guide{margin-left:auto;color:var(--link)}.titlebar .tb-guide:hover{text-decoration:underline}
.guide-panel{border-bottom:1px solid var(--border);padding-bottom:12px;font-size:13px}.g-title{padding:0 14px;font-weight:600;line-height:1.5}.g-title a:hover{text-decoration:underline}.subh{padding:12px 14px 4px;font-size:11px;color:var(--muted)}
.filters{display:flex;flex-wrap:wrap;gap:4px;padding:0 12px}.chip{display:inline-flex;align-items:center;gap:5px;background:var(--btn);border:1px solid var(--btn-border);border-radius:10px;padding:1px 8px;font:11.5px var(--ui);color:var(--text);cursor:pointer}.chip:hover{background:var(--chip)}.chip b{font-weight:400;color:var(--muted)}.chip[aria-pressed="false"]{opacity:.45}.chip[aria-pressed="false"] span:not(.mk){text-decoration:line-through}
.stack .stk{display:block;font:12px var(--mono);padding:2px 14px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stack .stk:hover{background:var(--hover)}.stack .stk.now{color:var(--text)}.stack .stk em{font:11px var(--ui);color:var(--link);margin-left:8px}.empty{padding:4px 14px;color:var(--muted);font-size:12px}
.ptabs{display:flex;margin:12px 12px 4px;border-bottom:1px solid var(--border)}.ptab{background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:4px 10px;font:12px var(--ui);color:var(--muted);cursor:pointer}.ptab[aria-selected="true"]{color:var(--text);border-bottom-color:var(--accent)}.ptab b{font-weight:400;margin-left:6px;background:var(--chip);border-radius:8px;padding:0 6px;font-size:11px}
.plist{display:grid}.step-i{display:grid;grid-template-columns:22px minmax(0,1fr);column-gap:8px;padding:4px 12px}.step-i .badge{grid-row:1/3;margin-top:1px}.f-i{display:grid;grid-template-columns:12px minmax(0,1fr);column-gap:8px;padding:5px 12px}.f-i .mk{grid-row:1/3;margin-top:5px}.step-i:hover,.f-i:hover{background:var(--hover)}.step-i.on,.f-i.on{background:var(--active)}.step-t,.f-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.step-f,.f-l{font:11px var(--mono);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.f-k{color:var(--c);font-family:var(--ui)}
.navs{display:flex;gap:6px;padding:12px 12px 0}.nb{flex:1;text-align:center;background:var(--btn);border:1px solid var(--btn-border);border-radius:3px;padding:5px 4px;font-size:12px;white-space:nowrap;cursor:pointer}.nb:hover{background:var(--chip)}.nb[aria-disabled="true"]{opacity:.35;pointer-events:none}.keys{padding:8px 14px 0;font-size:11px;color:var(--muted)}
.tree-file.tf-x{display:flex;align-items:center;gap:4px}.tf-n{overflow:hidden;text-overflow:ellipsis}.tf-d{display:inline-flex;align-items:center;gap:5px;margin-left:auto;padding-left:6px}.tf-d .badge{width:16px;height:16px;font-size:10px}.tree-file.tf-m,.tree-file.tf-r{color:var(--mod)}.tree-file.tf-a{color:var(--add)}.tree-file.tf-here{background:var(--active)}
.scm{font-size:11px;color:var(--mod);margin-left:6px}.fc{display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--c)}.crumbs .base-link{color:var(--link)}
.code-table.g .ln{position:static;min-width:44px;padding:0 10px 0 6px;border-right:0}.code-table.g .dm{width:4px;min-width:4px;padding:0}.code-table.g .st{width:26px;min-width:26px;padding:0;text-align:center}.code-table.g .st .badge{margin-top:2px}.code-table.g .mkc{width:16px;min-width:16px;padding:0;text-align:center}.code-table.g .src{padding:0 24px 0 6px}.mkb{display:inline-grid;place-items:center;width:14px;height:20px}
.row.add .dm{background:var(--add)}.row.add .src{background:var(--add-bg)}.row.mod .dm{background:var(--mod)}.row.del .dm{background:var(--del)}.row.del .src{background:var(--del-bg);opacity:.8}.row.del .ln::after{content:"−";color:var(--del)}
.row.cur .ln,.row.cur .st,.row.cur .mkc,.row.cur .src{background:var(--hl)}.row.cur .ln{color:#c6c6c6}.row.fsel .ln,.row.fsel .st,.row.fsel .mkc,.row.fsel .src{background:color-mix(in srgb,var(--c) 16%,transparent)}
.code-table.g .note-cell{padding:4px 24px 10px 6px}.note{max-width:680px;white-space:normal;font:13px/1.7 var(--ui);background:var(--panel);border:1px solid var(--line2);border-left:3px solid var(--c);border-radius:4px;padding:10px 14px}.note.is-cur,.note.sel{box-shadow:0 0 0 1px var(--c)}.note-h{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:4px}.note-h .tag{margin-left:0}.note-h .pos{margin-left:auto;color:var(--muted);font-size:12px}.note p{margin:0}.note p+p{margin-top:6px}
.note code,.cv code{font:12px var(--mono);background:var(--codebg);border:1px solid #333;padding:0 4px;border-radius:3px}.fix{margin-top:8px}.fix>span{display:block;font-size:11.5px;color:var(--muted);margin-bottom:2px}.fix pre{margin:0;font:12px/1.6 var(--mono);background:var(--codebg);border:1px solid #333;border-radius:3px;padding:4px 10px;white-space:pre;overflow-x:auto}
.br{border-collapse:collapse;margin:8px 0 2px;font-size:12.5px}.br th,.br td{border:1px solid var(--line2);padding:4px 10px;text-align:left;font-weight:400;vertical-align:top}.br th{color:var(--muted);font-size:11.5px}.br a,.links a{color:var(--link)}
.unv{margin-top:8px;padding:6px 10px;border:1px solid rgba(215,186,125,.4);background:rgba(215,186,125,.07);border-radius:3px;color:var(--warn);font-size:12.5px}.links{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.lk{border:1px solid var(--btn-border);font-size:12px;padding:2px 9px;border-radius:3px}.lk:hover{background:var(--hover)}
.status .sc{display:inline-flex;align-items:center;gap:4px}.status .mk{background:#fff}.status .r{margin-left:auto}
.cover-page{height:auto;min-height:100vh}.cover-page .titlebar{height:35px}.cv{padding:22px 28px 40px;display:grid;grid-template-columns:minmax(0,1fr);gap:26px;max-width:1280px}.cv-crumbs{font-size:12px;color:var(--muted)}.cv-crumbs a{color:var(--link)}.cv h1{margin:4px 0 0;font-size:22px;font-weight:600}.cv h2{margin:0 0 8px;font-size:12px;letter-spacing:.06em;color:#bbb;font-weight:600}
.facts{display:grid;grid-template-columns:auto 1fr;gap:4px 18px;margin:0;font-size:13px;line-height:1.6}.facts dt{color:var(--muted)}.facts dd{margin:0}.plus{color:var(--add)}.minus{color:var(--del)}.sum{margin:0;padding-left:18px;line-height:1.85;max-width:90ch}.fsum{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.fsum .kl{font-size:12px;padding:1px 8px}.none{margin:0;color:var(--muted)}
.diagram{background:var(--codebg);border:1px solid var(--border);border-radius:4px;padding:14px;overflow:auto}.diagram svg{display:block}.n rect.box{fill:var(--panel);stroke:#4a4a4a;stroke-width:1}.n.d rect.box{stroke:var(--mod);stroke-width:1.6}.n.k-result rect.box{fill:none;stroke:#7a7a7a;stroke-dasharray:4 3}.n.k-db rect.box{fill:var(--dbfill);stroke:var(--syn-title)}.n.k-external rect.box{fill:none;stroke:var(--syn-title);stroke-dasharray:2 3}a:hover .n rect.box,a:focus .n rect.box{fill:var(--hover);stroke:var(--link)}
.n .t{fill:var(--text);font:600 13px var(--ui)}.n .s{fill:var(--muted);font:11px var(--mono)}.n.k-db .t{font:12px var(--mono)}.dtag{fill:var(--mod);font:11px var(--ui)}.fm{fill:var(--c)}.fmt{fill:var(--c);font:11px var(--ui)}.e{fill:none;stroke:var(--edge);stroke-width:1.3}.e.back{stroke-dasharray:4 3}.el{fill:var(--muted);font:11px var(--ui)}
.legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:10px}.legend i{display:inline-block;width:16px;height:11px;border:1.5px solid var(--mod);margin-right:6px;vertical-align:-1px;border-radius:2px}.legend i.r{border:1.5px dashed #7a7a7a;border-radius:6px}.legend i.db{border-color:var(--syn-title);background:var(--dbfill)}.legend i.x{border:1.5px dotted var(--syn-title)}
.ctable{border-collapse:collapse;width:100%;font-size:13px}.ctable th,.ctable td{border-bottom:1px solid var(--border);padding:8px 10px;text-align:left;vertical-align:top}.ctable th{color:var(--muted);font-weight:400;font-size:12px}.ctable a{color:var(--link)}.ctable a:hover{text-decoration:underline}.ctable .f{font:12px var(--mono);color:var(--muted)}.ctable .tag{margin:0 4px 0 0}.fms{display:flex;gap:6px;align-items:center;padding-top:5px}.unv-list{margin:0;padding-left:18px;line-height:1.9;color:var(--warn)}.unv-list a{color:var(--link);margin-left:8px}
`;
  for (const [k, t] of Object.entries(types)) css += `.t-${k}{--c:${t.color}}body.hide-${k} tr.nr-${k},body.hide-${k} .mkb.t-${k},body.hide-${k} .f-i.t-${k}{display:none}`;
  return css;
}

async function main() {
  const started = Date.now();
  const guideArg = opt('--guide');
  const nameArg = opt('--name');
  if (!guideArg && !nameArg) fail('--name <ガイド名> か --guide <guide.json のパス> を指定する');
  const guideFile = guideArg ? path.resolve(guideArg) : path.join(guidesDir, sanitizeName(nameArg), 'guide.json');
  const guideDir = path.dirname(guideFile);
  if (path.dirname(guideDir) !== guidesDir) fail(`guide.json は ${toPosix(path.relative(root, guidesDir))}/<ガイド名>/guide.json に置く`);
  const guideName = path.basename(guideDir);

  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(outputDir, MANIFEST_NAME), 'utf8')); }
  catch { fail(`${OUTPUT_DIR_NAME}/${MANIFEST_NAME} が無い。先に prepare-guide.mjs（または generate-html-code.mjs）を実行する`); }
  let guide;
  try { guide = JSON.parse(await fs.readFile(guideFile, 'utf8')); }
  catch (err) { fail(`guide.json を読めない: ${err.message}`); }

  // ---- 検証と、アンカーから行への変換 ----
  const problems = [];
  if (!guide || typeof guide !== 'object' || Array.isArray(guide)) fail('guide.json はオブジェクトで書く');
  if (!isStr(guide.title)) problems.push('title: ガイドの題名を書く');
  if (!isStr(guide.request)) problems.push('request: 依頼文を書く');
  if (guide.review !== undefined && typeof guide.review !== 'boolean') problems.push('review: true か false で書く');
  const review = guide.review === true;
  if (!Array.isArray(guide.summary) || !guide.summary.length || !guide.summary.every(isStr)) problems.push('summary: 要約を1行以上、文字列の配列で書く');
  if (!Array.isArray(guide.steps) || !guide.steps.length) problems.push('steps: 順路のステップを1つ以上書く');
  if (guide.notes !== undefined && !Array.isArray(guide.notes)) problems.push('notes: 配列で書く');
  if (guide.unverified !== undefined && !Array.isArray(guide.unverified)) problems.push('unverified: 配列で書く');
  const types = buildTypes(guide.noteTypes, problems);

  let diff = null;
  let diffFiles = new Map();
  if (guide.diff !== undefined && guide.diff !== null) {
    try {
      diff = await resolveDiffSpec(root, guide.diff);
      if (diff) diffFiles = await collectDiff(root, diff);
    } catch (err) { problems.push(`diff: ${err.message}`); }
  }

  const fileCache = new Map();
  async function loadFile(rel) {
    if (!fileCache.has(rel)) {
      const buf = await readTargetFile(root, diff, rel);
      let entry;
      if (!buf) entry = { missing: true };
      else if (isLikelyBinary(buf)) entry = { binary: true };
      else {
        const normalized = buf.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        entry = { normalized, lines: normalized.split('\n') };
      }
      fileCache.set(rel, entry);
    }
    return fileCache.get(rel);
  }
  async function resolveFile(value, where) {
    const rel = normRel(value);
    if (!rel) { problems.push(`${where}.file: リポジトリのルートからの相対パスで書く`); return null; }
    const entry = await loadFile(rel);
    if (entry.missing) { problems.push(`${where}.file: ${rel} が${diff?.target ? `比較先（${diff.target.slice(0, 10)}）` : '作業ツリー'}に無い`); return null; }
    if (entry.binary) { problems.push(`${where}.file: ${rel} はバイナリのため対象にできない`); return null; }
    return { rel, entry };
  }

  const steps = [];
  const stepIds = new Set();
  for (const [i, s] of (Array.isArray(guide.steps) ? guide.steps : []).entries()) {
    const w = `steps[${i}]`;
    if (!s || typeof s !== 'object') { problems.push(`${w}: オブジェクトで書く`); continue; }
    if (!isStr(s.id) || !/^[A-Za-z0-9_-]+$/.test(s.id)) problems.push(`${w}.id: 英数字・_・- で書く`);
    else if (stepIds.has(s.id)) problems.push(`${w}.id: "${s.id}" が重複している`);
    else stepIds.add(s.id);
    const kind = s.kind ?? 'call';
    if (!KINDS[kind]) problems.push(`${w}.kind: ${Object.keys(KINDS).join(' / ')} のどれかにする`);
    if (!isStr(s.title)) problems.push(`${w}.title: ステップの題名を書く`);
    if (!isStr(s.body)) problems.push(`${w}.body: 解説を書く`);
    if (s.summary !== undefined && typeof s.summary !== 'string') problems.push(`${w}.summary: 文字列で書く`);
    if (s.unverified !== undefined && !isStr(s.unverified)) problems.push(`${w}.unverified: 文字列で書く`);
    if (s.branches !== undefined && (!Array.isArray(s.branches) || !s.branches.every(b => b && isStr(b.when) && isStr(b.then)))) problems.push(`${w}.branches: [{ "when": 条件, "then": 結果, "to": 次のステップid（任意） }] の形で書く`);
    if (s.links !== undefined && (!Array.isArray(s.links) || !s.links.every(l => l && isStr(l.to)))) problems.push(`${w}.links: [{ "to": ステップid, "label": 表示名（任意） }] の形で書く`);
    const f = await resolveFile(s.file, w);
    const pos = f ? locate(f.entry, s, f.rel, w, problems) : null;
    if (!f || !pos) continue;
    steps.push({ id: s.id, n: 0, file: f.rel, line: pos.line, end: pos.end, kind, title: s.title, body: s.body, summary: s.summary || '', parent: s.parent ?? null, branches: s.branches || [], links: s.links, unverified: s.unverified || '' });
  }
  steps.forEach((s, i) => { s.n = i + 1; });
  const stepById = new Map(steps.map(s => [s.id, s]));
  for (const s of steps) {
    const w = `steps(${s.id})`;
    if (s.parent !== null && (!stepIds.has(s.parent) || s.parent === s.id)) problems.push(`${w}.parent: 存在する別のステップidを書く（"${s.parent}"）`);
    for (const b of s.branches) if (b.to !== undefined && !stepIds.has(b.to)) problems.push(`${w}.branches.to: "${b.to}" というステップが無い`);
    for (const l of s.links || []) if (!stepIds.has(l.to)) problems.push(`${w}.links.to: "${l.to}" というステップが無い`);
    const seen = new Set([s.id]);
    for (let p = s.parent ? stepById.get(s.parent) : null; p; p = p.parent ? stepById.get(p.parent) : null) {
      if (seen.has(p.id)) { problems.push(`${w}.parent: 呼び出し元をたどると循環している`); break; }
      seen.add(p.id);
    }
  }

  const notes = [];
  for (const [i, n] of (Array.isArray(guide.notes) ? guide.notes : []).entries()) {
    const w = `notes[${i}]`;
    if (!n || typeof n !== 'object') { problems.push(`${w}: オブジェクトで書く`); continue; }
    if (!types[n.type]) { problems.push(`${w}.type: ${Object.keys(types).join(' / ')} のどれかにする（増やす場合は noteTypes に書く）`); continue; }
    if (types[n.type].finding && !review) problems.push(`${w}.type: review が false なのに「${types[n.type].label}」がある。レビュー依頼でなければ指摘は書かず、レビュー依頼なら review を true にする`);
    if (!isStr(n.title)) problems.push(`${w}.title: 見出しを書く`);
    if (!isStr(n.body)) problems.push(`${w}.body: 本文を書く`);
    if (n.fix !== undefined && !isStr(n.fix)) problems.push(`${w}.fix: 修正案のコードを文字列で書く`);
    if (n.step !== undefined && !stepIds.has(n.step)) problems.push(`${w}.step: "${n.step}" というステップが無い`);
    const f = await resolveFile(n.file, w);
    const pos = f ? locate(f.entry, n, f.rel, w, problems) : null;
    if (!f || !pos) continue;
    notes.push({ type: n.type, file: f.rel, line: pos.line, end: pos.end, title: n.title, body: n.body, fix: n.fix, step: n.step ?? null });
  }

  const unverified = [];
  for (const s of steps) if (s.unverified) unverified.push({ text: s.unverified, step: s.id });
  for (const [i, u] of (Array.isArray(guide.unverified) ? guide.unverified : []).entries()) {
    if (isStr(u)) unverified.push({ text: u, step: null });
    else if (u && isStr(u.text) && (u.step === undefined || stepIds.has(u.step))) unverified.push({ text: u.text, step: u.step ?? null });
    else problems.push(`unverified[${i}]: 文字列か { "text": 内容, "step": ステップid（任意） } で書く`);
  }

  // 全体図: ステップと分岐から自動で作り、flow.nodes / flow.edges を足す
  const flow = guide.flow ?? {};
  if (typeof flow !== 'object' || Array.isArray(flow)) problems.push('flow: オブジェクトで書く');
  const flowNodes = new Map();
  const flowEdges = [];
  if (flow.auto !== false) {
    const branchTargets = new Set(steps.flatMap(s => s.branches.filter(b => b.to).map(b => b.to)));
    for (const s of steps) flowNodes.set(s.id, { id: s.id, kind: 'step', step: s });
    for (const s of steps) if (s.parent && stepById.has(s.parent) && !branchTargets.has(s.id)) flowEdges.push({ from: s.parent, to: s.id, label: '' });
    for (const s of steps) {
      s.branches.forEach((b, k) => {
        if (b.to) { if (stepById.has(b.to)) flowEdges.push({ from: s.id, to: b.to, label: b.when }); }
        else {
          const id = `${s.id}~${k}`;
          flowNodes.set(id, { id, kind: 'result', label: b.then, sub: '' });
          flowEdges.push({ from: s.id, to: id, label: b.when });
        }
      });
    }
  }
  for (const [i, node] of (Array.isArray(flow.nodes) ? flow.nodes : []).entries()) {
    const w = `flow.nodes[${i}]`;
    if (!node || !isStr(node.id) || !/^[A-Za-z0-9_-]+$/.test(node.id)) { problems.push(`${w}.id: 英数字・_・- で書く`); continue; }
    if (flowNodes.has(node.id) || stepIds.has(node.id)) { problems.push(`${w}.id: "${node.id}" はステップか他のノードと重複している`); continue; }
    const kind = node.kind ?? 'other';
    if (!(kind in NODE_KINDS)) { problems.push(`${w}.kind: ${Object.keys(NODE_KINDS).join(' / ')} のどれかにする`); continue; }
    if (!isStr(node.label)) { problems.push(`${w}.label: 表示名を書く`); continue; }
    flowNodes.set(node.id, { id: node.id, kind, label: node.label, sub: typeof node.sub === 'string' ? node.sub : NODE_KINDS[kind] });
  }
  if (flow.nodes !== undefined && !Array.isArray(flow.nodes)) problems.push('flow.nodes: 配列で書く');
  if (flow.edges !== undefined && !Array.isArray(flow.edges)) problems.push('flow.edges: 配列で書く');
  for (const [i, e] of (Array.isArray(flow.edges) ? flow.edges : []).entries()) {
    const w = `flow.edges[${i}]`;
    if (!e || !flowNodes.has(e.from) || !flowNodes.has(e.to)) { problems.push(`${w}: from / to にステップidかノードidを書く`); continue; }
    flowEdges.push({ from: e.from, to: e.to, label: typeof e.label === 'string' ? e.label : '' });
  }

  const pageRels = [...new Set([...steps.map(s => s.file), ...notes.map(n => n.file)])];
  if (pageRels.includes(GUIDE_COVER_NAME.replace(/\.html$/, ''))) problems.push(`リポジトリ直下の「${GUIDE_COVER_NAME.replace(/\.html$/, '')}」は表紙のファイル名と衝突するため対象にできない`);

  if (problems.length) {
    console.error(`guide.json に ${problems.length} 件の問題がある。直して再実行する:`);
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }

  // ---- モデルの組み立て ----
  const typeOrder = Object.keys(types);
  const findingTypes = typeOrder.filter(t => types[t].finding);
  for (const s of steps) {
    const fd = diffFiles.get(s.file);
    s.diff = !!fd && Array.from({ length: s.end - s.line + 1 }, (_, k) => s.line + k).some(n => fd.added.has(n) || fd.modified.has(n) || fd.deleted.has(n));
  }
  const stepIndex = new Map(steps.map((s, i) => [s.id, i]));
  for (const n of notes) {
    if (n.step) continue;
    const inFile = steps.filter(s => s.file === n.file);
    const containing = inFile.filter(s => n.line >= s.line && n.line <= s.end).sort((a, b) => (a.end - a.line) - (b.end - b.line));
    const before = inFile.filter(s => s.line <= n.line).sort((a, b) => b.line - a.line);
    n.step = (containing[0] || before[0] || inFile[0])?.id ?? null;
  }
  notes.sort((a, b) => (stepIndex.get(a.step) ?? 1e9) - (stepIndex.get(b.step) ?? 1e9) || a.file.localeCompare(b.file) || a.line - b.line || typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
  notes.forEach((n, i) => { n.key = `note-${i + 1}`; });
  const findings = notes.filter(n => types[n.type].finding);
  const typeCount = t => (t === 'explain' ? steps.length : 0) + notes.filter(n => n.type === t).length;
  const presentTypes = typeOrder.filter(t => typeCount(t) > 0);

  const pageFileOf = rel => path.join(guideDir, ...rel.split('/')) + '.html';
  const pages = new Map(pageRels.map(rel => [rel, pageFileOf(rel)]));
  const coverFile = path.join(guideDir, GUIDE_COVER_NAME);
  const manifestFiles = new Set(manifest.files);
  const stepAnchor = s => `step-${s.id}`;
  const linkTo = (fromFile, rel, anchor) => `${fromFile === pages.get(rel) ? '' : hrefFrom(fromFile, pages.get(rel))}#${anchor}`;
  const stepHref = (s, fromFile) => linkTo(fromFile, s.file, stepAnchor(s));
  const noteHref = (n, fromFile) => linkTo(fromFile, n.file, n.key);
  const children = new Map(steps.map(s => [s.id, steps.filter(c => c.parent === s.id)]));

  const tree = makeTree(manifest.files);
  sortTree(tree);

  function explorer(fromFile, currentRel) {
    return renderTree(tree, fromFile, {
      outputDir,
      hrefFor: rel => (pages.has(rel) ? hrefFrom(fromFile, pages.get(rel)) : null),
      decorate: rel => {
        const fd = diffFiles.get(rel);
        const isPage = pages.has(rel);
        if (!fd && !isPage) return null;
        const cls = [fd ? `tf-${fd.status.toLowerCase()}` : '', isPage ? 'tf-g' : '', rel === currentRel ? 'tf-here' : ''].filter(Boolean).join(' ');
        let after = '<span class="tf-d">';
        if (isPage) {
          for (const t of findingTypes) {
            const c = findings.filter(n => n.file === rel && n.type === t).length;
            if (c) after += `<span class="fc t-${t}">${shapeEl(types, t)}${c}</span>`;
          }
          for (const s of steps.filter(x => x.file === rel)) after += `<span class="badge${s.diff ? ' d' : ''}" data-step="${s.id}">${s.n}</span>`;
        }
        if (fd) after += `<span class="scm">${fd.status}</span>`;
        return { cls, after: `${after}</span>` };
      },
    });
  }

  function panel(fromFile) {
    const chips = presentTypes.map(t => `<button type="button" class="chip t-${t}" data-type="${t}" aria-pressed="true">${shapeEl(types, t)}<span>${esc(types[t].short)}</span><b>${typeCount(t)}</b></button>`).join('');
    const stepItems = steps.map(s => `<a class="step-i" data-id="${s.id}" href="${stepHref(s, fromFile)}"><span class="badge${s.diff ? ' d' : ''}" data-step="${s.id}">${s.n}</span><span class="step-t">${esc(s.title)}${s.kind !== 'call' ? `<span class="tag tag-${s.kind}">${KINDS[s.kind]}</span>` : ''}${s.diff ? '<span class="tag tag-diff">差分</span>' : ''}</span><span class="step-f">${esc(basename(s.file))}:${s.line}</span></a>`).join('');
    const findingItems = findings.map(n => `<a class="f-i t-${n.type}" data-id="${n.key}" href="${noteHref(n, fromFile)}">${shapeEl(types, n.type)}<span class="f-t">${esc(n.title)}</span><span class="f-l"><span class="f-k">${esc(types[n.type].short)}</span>　${esc(basename(n.file))}:${n.line}</span></a>`).join('');
    const hasF = findings.length > 0;
    return `<section class="guide-panel"><div class="sidebar-title">ガイド</div><div class="g-title"><a href="${hrefFrom(fromFile, coverFile)}">${esc(guide.title)}</a></div>`
      + `<div class="subh">表示する解説の種類</div><div class="filters">${chips}</div>`
      + `<div class="subh">コールスタック</div><div class="stack" id="g-stack"></div>`
      + (hasF ? `<div class="ptabs" role="tablist"><button type="button" class="ptab" role="tab" data-ptab="steps" aria-selected="true">順路<b>${steps.length}</b></button><button type="button" class="ptab" role="tab" data-ptab="findings" aria-selected="false">指摘<b>${findings.length}</b></button></div>` : '<div class="subh">順路</div>')
      + `<div class="plist" id="g-steps">${stepItems}</div>${hasF ? `<div class="plist" id="g-findings" hidden>${findingItems}</div>` : ''}`
      + `<div class="navs" id="g-nav-steps"><a class="nb" id="g-prev">◀ 前へ</a><a class="nb" id="g-up">↑ 呼び出し元</a><a class="nb" id="g-next">次へ ▶</a></div>`
      + (hasF ? '<div class="navs" id="g-nav-findings" hidden><a class="nb" id="g-pf">◀ 前の指摘</a><a class="nb" id="g-nf">次の指摘 ▶</a></div>' : '')
      + `<div class="keys">n / p: 次・前のステップ${hasF ? '　F8 / Shift+F8: 次・前の指摘' : ''}</div></section>`;
  }

  function stepNote(s, fromFile) {
    let h = `<div class="note t-explain" id="${stepAnchor(s)}"><div class="note-h"><span class="kl t-explain">${shapeEl(types, 'explain')}${esc(types.explain.label)}</span><a class="badge${s.diff ? ' d' : ''}" data-step="${s.id}" href="#${stepAnchor(s)}">${s.n}</a><strong>${esc(s.title)}</strong><span class="tag tag-${s.kind}">${KINDS[s.kind]}</span>${s.diff ? '<span class="tag tag-diff">差分</span>' : ''}<span class="pos">ステップ ${s.n} / ${steps.length}</span></div>${paras(s.body)}`;
    if (s.branches.length) {
      h += `<table class="br"><tr><th>条件</th><th>結果</th></tr>${s.branches.map(b => {
        const t = b.to ? stepById.get(b.to) : null;
        return `<tr><td>${inline(b.when)}</td><td>${inline(b.then)}${t ? `　<a href="${stepHref(t, fromFile)}">→ ${circ(t.n)} ${esc(t.title)}</a>` : ''}</td></tr>`;
      }).join('')}</table>`;
    }
    if (s.unverified) h += `<div class="unv">未確認: ${inline(s.unverified)}</div>`;
    const branchTo = new Set(s.branches.map(b => b.to).filter(Boolean));
    const links = s.links ? s.links.map(l => ({ t: stepById.get(l.to), label: l.label })) : children.get(s.id).filter(c => !branchTo.has(c.id)).map(c => ({ t: c, label: '' }));
    if (links.length) h += `<div class="links">${links.map(({ t, label }) => `<a class="lk" href="${stepHref(t, fromFile)}">${label ? inline(label) : `↓ 呼び出し先: ${circ(t.n)} ${esc(t.title)}`}</a>`).join('')}</div>`;
    return `${h}</div>`;
  }

  function noteBox(n) {
    const range = n.line === n.end ? `${n.line} 行目` : `${n.line}–${n.end} 行目`;
    let h = `<div class="note t-${n.type}" id="${n.key}"><div class="note-h"><span class="kl t-${n.type}">${shapeEl(types, n.type)}${esc(types[n.type].label)}</span><strong>${esc(n.title)}</strong><span class="pos">${range}</span></div>${paras(n.body)}`;
    if (n.fix) h += `<div class="fix"><span>修正案</span><pre>${highlightCode(n.fix.replace(/\r\n?/g, '\n'), n.file)}</pre></div>`;
    return `${h}</div>`;
  }

  function codePage(rel) {
    const outFile = pages.get(rel);
    const entry = fileCache.get(rel);
    const fd = diffFiles.get(rel);
    const { lines } = entry;
    const hl = highlightCode(entry.normalized, rel).split('\n');
    const fileSteps = steps.filter(s => s.file === rel);
    const fileNotes = notes.filter(n => n.file === rel);
    // 注釈は対象行の直後に挟む。ステップの範囲内にある注釈は、その範囲(最も狭いもの)の末尾にまとめる。
    // 同じ位置では、ステップの解説を先に、残りは行番号順(サイドバーの指摘一覧と同じ順)に並べる。
    const placements = fileSteps.map(s => ({ at: s.end, order: 0, sub: s.n, kind: 0, type: 'explain', html: stepNote(s, outFile) }));
    for (const n of fileNotes) {
      const inside = fileSteps.filter(s => n.end >= s.line && n.end <= s.end).sort((a, b) => (a.end - a.line) - (b.end - b.line));
      placements.push({ at: inside.length ? inside[0].end : n.end, order: 1, sub: n.line, kind: typeOrder.indexOf(n.type), type: n.type, html: noteBox(n) });
    }
    placements.sort((a, b) => a.at - b.at || a.order - b.order || a.sub - b.sub || a.kind - b.kind);
    const group = (items, key) => items.reduce((m, x) => m.set(x[key], [...(m.get(x[key]) || []), x]), new Map());
    const placeAt = group(placements, 'at');
    const badgeAt = group(fileSteps, 'line');
    const markAt = group(fileNotes, 'line');
    const delRow = d => `<tr class="row del"><td class="ln"></td><td class="dm"></td><td class="st"></td><td class="mkc"></td><td class="src">${highlightCode(d, rel)}</td></tr>`;
    const rows = [];
    for (let n = 1; n <= lines.length; n++) {
      for (const d of fd?.deleted.get(n) || []) rows.push(delRow(d));
      const cls = fd?.added.has(n) ? ' add' : fd?.modified.has(n) ? ' mod' : '';
      const badges = (badgeAt.get(n) || []).map(s => `<a class="badge${s.diff ? ' d' : ''}" data-step="${s.id}" href="#${stepAnchor(s)}" title="${esc(`ステップ ${s.n}: ${s.title}`)}">${s.n}</a>`).join('');
      const marks = (markAt.get(n) || []).map(x => `<a class="mkb t-${x.type}" href="#${x.key}" title="${esc(`${types[x.type].label}: ${x.title}`)}">${shapeEl(types, x.type)}</a>`).join('');
      rows.push(`<tr class="row${cls}" data-line="${n}"><td class="ln">${n}</td><td class="dm"></td><td class="st">${badges}</td><td class="mkc">${marks}</td><td class="src">${hl[n - 1] ?? esc(lines[n - 1])}</td></tr>`);
      for (const p of placeAt.get(n) || []) rows.push(`<tr class="note-row nr-${p.type}"><td class="ln"></td><td class="dm"></td><td class="st"></td><td class="mkc"></td><td class="note-cell">${p.html}</td></tr>`);
    }
    for (const d of fd?.deleted.get(lines.length + 1) || []) rows.push(delRow(d));
    const data = {
      page: rel,
      firstStep: fileSteps[0]?.id || null,
      types: typeOrder,
      steps: steps.map(s => ({ id: s.id, n: s.n, title: s.title, anchor: stepAnchor(s), href: stepHref(s, outFile), parent: s.parent, file: s.file, line: s.line, end: s.end })),
      findings: findings.map(n => ({ id: n.key, type: n.type, href: noteHref(n, outFile), file: n.file, line: n.line, end: n.end, step: n.step })),
    };
    const baseLink = manifestFiles.has(rel) ? ` · <a class="base-link" href="${hrefFrom(outFile, outputFileFor(outputDir, rel))}">通常のページ</a>` : '';
    const counts = findingTypes.map(t => [t, findings.filter(n => n.type === t).length]).filter(([, c]) => c).map(([t, c]) => `<span class="sc" title="${esc(types[t].label)}">${shapeEl(types, t)}${c}</span>`).join('');
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(`${rel} — ${guide.title}`)}</title><style>${baseCss()}${guideCss(types)}</style></head>`
      + `<body class="guide-page"><div class="app"><div class="titlebar">${esc(repoName)} — Codebase Guide<a class="tb-guide" href="${hrefFrom(outFile, coverFile)}">ガイド: ${esc(guide.title)}</a></div>`
      + `<aside class="sidebar">${panel(outFile)}<div class="sidebar-title">Explorer</div><nav class="tree">${explorer(outFile, rel)}</nav></aside>`
      + `<main class="main"><div class="tabbar"><div class="tab">${esc(basename(rel))}${fd ? `<span class="scm">${fd.status}</span>` : ''}</div></div><div class="crumbs">${esc(rel.split('/').join('  ›  '))}<span class="meta">${esc(languageFor(rel))} · ${lines.length} lines${baseLink}</span></div>`
      + `<div class="editor"><table class="code-table g"><tbody>${rows.join('')}</tbody></table></div></main>`
      + `<footer class="status"><span>${esc(diff ? `差分 ${diff.label}` : 'ガイド')}</span>${counts}<span>ステップ <b id="g-pos"></b></span><span class="r">${esc(languageFor(rel))}</span><span>UTF-8</span></footer></div>`
      + `<script>(${guideRuntime.toString()})(${JSON.stringify(data).replace(/</g, '\\u003c')});</script></body></html>`;
  }

  // 全体図の配置: 深さ優先でたどった木を左から右へ並べ、葉を上から順に置き、親は子の中央に置く
  function flowSvg(fromFile) {
    const NODE_H = 54; const ROW = 78; const TOP = 26; const LEFT = 20;
    const nodes = [...flowNodes.values()];
    const out = new Map(nodes.map(n => [n.id, []]));
    for (const e of flowEdges) out.get(e.from).push(e);
    const hasIn = new Set(flowEdges.map(e => e.to));
    const depth = new Map(); const kids = new Map(); const treeRoots = [];
    const visit = (id, d) => {
      depth.set(id, d); kids.set(id, []);
      for (const e of out.get(id)) if (!depth.has(e.to)) { kids.get(id).push(e.to); visit(e.to, d + 1); }
    };
    for (const n of nodes) if (!hasIn.has(n.id) && !depth.has(n.id)) { treeRoots.push(n.id); visit(n.id, 0); }
    for (const n of nodes) if (!depth.has(n.id)) { treeRoots.push(n.id); visit(n.id, 0); }
    let slot = 0; const slots = new Map();
    const place = id => {
      const ch = kids.get(id);
      if (!ch.length) { slots.set(id, slot++); return; }
      ch.forEach(place);
      slots.set(id, (slots.get(ch[0]) + slots.get(ch.at(-1))) / 2);
    };
    treeRoots.forEach(place);
    const box = new Map();
    for (const n of nodes) {
      let title; let sub;
      if (n.kind === 'step') { title = `${circ(n.step.n)} ${n.step.title}`; sub = `${basename(n.step.file)}:${n.step.line}`; }
      else { title = n.label; sub = n.sub || ''; }
      const w = Math.min(300, Math.max(110, Math.max(textWidth(title, 13), textWidth(sub, 11)) + 26));
      box.set(n.id, { n, title: fitText(title, 13, w - 24), fullTitle: title, sub: fitText(sub, 11, w - 24), w, col: depth.get(n.id), y: TOP + slots.get(n.id) * ROW });
    }
    const cols = Math.max(...[...box.values()].map(b => b.col)) + 1;
    const colW = Array(cols).fill(0); const gap = Array(cols).fill(52);
    for (const b of box.values()) colW[b.col] = Math.max(colW[b.col], b.w);
    for (const e of flowEdges) {
      const a = box.get(e.from); const b = box.get(e.to);
      if (e.label && b.col === a.col + 1) gap[a.col] = Math.max(gap[a.col], textWidth(fitText(e.label, 11, 200), 11) + 34);
    }
    const colX = []; let x = LEFT;
    for (let c = 0; c < cols; c++) { colX.push(x); x += colW[c] + gap[c]; }
    for (const b of box.values()) b.x = colX[b.col];
    const width = Math.ceil(colX[cols - 1] + colW[cols - 1] + LEFT);
    let height = Math.ceil(Math.max(...[...box.values()].map(b => b.y)) + NODE_H + 18);
    const parts = [];
    let hasBack = false;
    for (const e of flowEdges) {
      const a = box.get(e.from); const b = box.get(e.to);
      const sx = a.x + a.w; const sy = a.y + NODE_H / 2; const tx = b.x; const ty = b.y + NODE_H / 2;
      const label = e.label ? fitText(e.label, 11, 200) : '';
      const titleEl = e.label && label !== e.label ? `<title>${esc(e.label)}</title>` : '';
      if (b.col > a.col) {
        if (Math.abs(sy - ty) < 1) {
          parts.push(`<path class="e" d="M${sx},${sy} H${tx - 2}" marker-end="url(#ah)"/>`);
          if (label) parts.push(`<text class="el" x="${sx + 8}" y="${sy - 6}">${esc(label)}${titleEl}</text>`);
        } else {
          const xm = sx + 14;
          parts.push(`<path class="e" d="M${sx},${sy} H${xm} V${ty} H${tx - 2}" marker-end="url(#ah)"/>`);
          if (label) parts.push(`<text class="el" x="${xm + 6}" y="${ty - 6}">${esc(label)}${titleEl}</text>`);
        }
      } else {
        hasBack = true;
        const ax = a.x + a.w / 2; const bx = b.x + b.w / 2; const ay = a.y + NODE_H; const by = b.y + NODE_H;
        parts.push(`<path class="e back" d="M${ax},${ay} C${ax},${ay + 34} ${bx},${by + 34} ${bx},${by + 2}" marker-end="url(#ah)"/>`);
      }
    }
    if (hasBack) height += 34;
    for (const b of box.values()) {
      const { n } = b;
      const s = n.kind === 'step' ? n.step : null;
      const cls = `n k-${n.kind}${s?.diff ? ' d' : ''}`;
      const rx = n.kind === 'result' ? NODE_H / 2 : n.kind === 'db' ? 10 : 4;
      const textX = b.x + (n.kind === 'result' ? 18 : 12);
      let g = `<g class="${cls}"><title>${esc(b.fullTitle)}</title><rect class="box" x="${b.x}" y="${b.y}" width="${b.w}" height="${NODE_H}" rx="${rx}"/>`;
      if (b.sub) g += `<text class="t" x="${textX}" y="${b.y + 23}">${esc(b.title)}</text><text class="s" x="${textX}" y="${b.y + 42}">${esc(b.sub)}</text>`;
      else g += `<text class="t" x="${textX}" y="${b.y + 32}">${esc(b.title)}</text>`;
      if (s?.diff) g += `<text class="dtag" x="${b.x + b.w}" y="${b.y - 6}" text-anchor="end">差分</text>`;
      if (s) {
        let cx = b.x + 5;
        for (const t of findingTypes) {
          const c = findings.filter(f => f.step === s.id && f.type === t).length;
          if (!c) continue;
          const label = `${types[t].short} ${c}`;
          g += svgShape(types[t].shape, cx, b.y - 10, `fm t-${t}`) + `<text class="fmt t-${t}" x="${cx + 8}" y="${b.y - 6}">${esc(label)}</text>`;
          cx += textWidth(label, 11) + 22;
        }
      }
      g += '</g>';
      parts.push(s ? `<a href="${stepHref(s, fromFile)}">${g}</a>` : g);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(`${guide.title} の全体図`)}"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#707070"/></marker></defs>${parts.join('')}</svg>`;
  }

  function coverPage() {
    const out = coverFile;
    const short = sha => (sha ? sha.slice(0, 10) : '');
    const changed = [...diffFiles.values()].sort((a, b) => a.path.localeCompare(b.path));
    const plus = changed.reduce((s, f) => s + f.plus, 0);
    const minus = changed.reduce((s, f) => s + f.minus, 0);
    const counts = findingTypes.map(t => ({ t, c: findings.filter(n => n.type === t).length }));
    const facts = [
      ['依頼', inline(guide.request)],
      ['対象の差分', diff ? `<code>${esc(diff.label)}</code>　比較元 ${short(diff.base)} → 比較先 ${diff.target ? short(diff.target) : '作業ツリー'}　${changed.length} ファイル　<span class="plus">+${plus}</span> <span class="minus">−${minus}</span>` : 'なし（作業ツリーのコードを読む）'],
      ['生成', [new Date().toLocaleString('ja-JP'), `${steps.length} ステップ`, review ? `指摘 ${findings.length} 件${findings.length ? `（${counts.filter(x => x.c).map(x => `${esc(types[x.t].short)} ${x.c}`).join('・')}）` : ''}` : '', `未確認 ${unverified.length} 件`].filter(Boolean).join('　')],
    ];
    let h = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(guide.title)}</title><style>${baseCss()}${guideCss(types)}</style></head><body class="cover-page"><div class="titlebar">${esc(repoName)} — Codebase Guide</div><main class="cv">`;
    h += `<div><div class="cv-crumbs"><a href="${hrefFrom(out, path.join(outputDir, TREE_PAGE_NAME))}">フォルダーツリー</a> › ガイド</div><h1>${esc(guide.title)}</h1></div>`;
    h += `<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    h += `<section><h2>要約</h2><ul class="sum">${guide.summary.map(s => `<li>${inline(s)}</li>`).join('')}</ul></section>`;
    if (review) {
      h += '<section><h2>指摘</h2>';
      if (!findings.length) h += '<p class="none">指摘はない。</p>';
      else {
        h += `<div class="fsum">${counts.map(({ t, c }) => `<span class="kl t-${t}">${shapeEl(types, t)}${esc(types[t].label)}　${c}</span>`).join('')}</div>`;
        h += `<table class="ctable"><thead><tr><th style="width:130px">種類</th><th>内容</th><th style="width:300px">場所</th></tr></thead><tbody>${findings.map(n => {
          const s = n.step ? stepById.get(n.step) : null;
          return `<tr><td><span class="kl t-${n.type}">${shapeEl(types, n.type)}${esc(types[n.type].label)}</span></td><td><a href="${noteHref(n, out)}">${esc(n.title)}</a></td><td><span class="f">${esc(n.file)}:${n.line}</span>${s ? `<div class="f">ステップ ${s.n}: ${esc(s.title)}</div>` : ''}</td></tr>`;
        }).join('')}</tbody></table>`;
      }
      h += '</section>';
    }
    const legend = [];
    if (steps.some(s => s.diff)) legend.push('<span><i></i>差分を含む</span>');
    const kindsUsed = new Set([...flowNodes.values()].map(n => n.kind));
    if (kindsUsed.has('result')) legend.push('<span><i class="r"></i>処理の終わり</span>');
    if (kindsUsed.has('db')) legend.push('<span><i class="db"></i>DB テーブル</span>');
    if (kindsUsed.has('external')) legend.push('<span><i class="x"></i>外部連携</span>');
    legend.push('<span>ノードを押すと、そのステップのコードを開く</span>');
    h += `<section><h2>全体図</h2><div class="diagram">${flowSvg(out)}</div><div class="legend">${legend.join('')}</div></section>`;
    h += `<section><h2>順路</h2><table class="ctable"><thead><tr><th style="width:44px">順</th><th style="width:120px">種別</th><th>ステップ</th><th>内容</th>${findings.length ? '<th style="width:90px">指摘</th>' : ''}</tr></thead><tbody>${steps.map(s => {
      const marks = findings.filter(n => n.step === s.id).map(n => shapeEl(types, n.type)).join('');
      return `<tr><td><span class="badge${s.diff ? ' d' : ''}">${s.n}</span></td><td><span class="tag tag-${s.kind}">${KINDS[s.kind]}</span>${s.diff ? '<span class="tag tag-diff">差分</span>' : ''}</td><td><a href="${stepHref(s, out)}">${esc(s.title)}</a><div class="f">${esc(s.file)}:${s.line}</div></td><td>${inline(s.summary || '')}</td>${findings.length ? `<td><div class="fms">${marks}</div></td>` : ''}</tr>`;
    }).join('')}</tbody></table></section>`;
    if (unverified.length) {
      h += `<section><h2>未確認事項</h2><ul class="unv-list">${unverified.map(u => {
        const s = u.step ? stepById.get(u.step) : null;
        return `<li>${inline(u.text)}${s ? `<a href="${stepHref(s, out)}">${circ(s.n)} を開く</a>` : ''}</li>`;
      }).join('')}</ul></section>`;
    }
    if (diff) {
      h += `<section><h2>変更ファイル</h2><table class="ctable"><thead><tr><th style="width:50px">状態</th><th>ファイル</th><th style="width:110px">行数</th></tr></thead><tbody>${changed.map(f => {
        const href = pages.has(f.path) ? hrefFrom(out, pages.get(f.path)) : manifestFiles.has(f.path) ? hrefFrom(out, outputFileFor(outputDir, f.path)) : null;
        const label = f.status === 'R' && f.oldPath ? `${f.oldPath} → ${f.path}` : f.path;
        return `<tr><td>${f.status}</td><td>${href ? `<a href="${href}">${esc(label)}</a>` : esc(label)}${f.binary ? '（バイナリ）' : ''}</td><td><span class="plus">+${f.plus}</span> <span class="minus">−${f.minus}</span></td></tr>`;
      }).join('')}</tbody></table></section>`;
    }
    return `${h}</main></body></html>`;
  }

  // ---- 書き出し ----
  await fs.mkdir(guideDir, { recursive: true });
  for (const entry of await fs.readdir(guideDir)) {
    if (!KEEP_FILES.has(entry)) await fs.rm(path.join(guideDir, entry), { recursive: true, force: true });
  }
  const written = new Map();
  for (const rel of pageRels) written.set(pages.get(rel), codePage(rel));
  written.set(coverFile, coverPage());
  for (const [file, html] of written) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, html);
  }
  const now = new Date();
  const meta = {
    title: guide.title,
    name: guideName,
    builtAt: now.toISOString(),
    builtAtLabel: now.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    diffLabel: diff ? diff.label : '',
    review,
    stepCount: steps.length,
    findingCounts: findingTypes.map(t => ({ type: t, short: types[t].short, count: findings.filter(n => n.type === t).length })),
  };
  await fs.writeFile(path.join(guideDir, GUIDE_META_NAME), `${JSON.stringify(meta, null, 2)}\n`);
  const treeUpdated = await refreshTreePageGuides(outputDir);

  // ---- リンクの検査(生成したページ内の href と #id がすべて存在するか) ----
  const known = new Set([...written.keys()].map(f => path.resolve(f)));
  for (const rel of manifest.files) known.add(path.resolve(outputFileFor(outputDir, rel)));
  known.add(path.resolve(path.join(outputDir, TREE_PAGE_NAME)));
  const ids = new Map([...written].map(([f, html]) => [path.resolve(f), new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))]));
  let checked = 0;
  const broken = [];
  for (const [file, html] of written) {
    for (const m of html.replace(/<script>[\s\S]*?<\/script>/g, '').matchAll(/href="([^"]*)"/g)) {
      const href = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
      checked++;
      const [p, hash] = href.split('#');
      const target = p ? path.resolve(path.dirname(file), decodeURIComponent(p)) : path.resolve(file);
      if (!known.has(target)) broken.push(`${toPosix(path.relative(outputDir, file))} → ${href}`);
      else if (hash && ids.has(target) && !ids.get(target).has(decodeURIComponent(hash))) broken.push(`${toPosix(path.relative(outputDir, file))} → ${href}（#${hash} が無い）`);
    }
  }

  const rel = p => toPosix(path.relative(root, p));
  console.log(`Guide          : ${guide.title}`);
  console.log(`Guide dir      : ${rel(guideDir)}`);
  console.log(`Cover          : ${rel(coverFile)}`);
  console.log(`Steps          : ${steps.length}`);
  console.log(`Notes          : ${typeOrder.map(t => `${types[t].short} ${t === 'explain' ? notes.filter(n => n.type === t).length : findings.filter(n => n.type === t).length}`).join(' / ')}（解説は各ステップにも1件ずつ）`);
  console.log(`Unverified     : ${unverified.length}`);
  console.log(`Pages          : コード ${pageRels.length} + 表紙 1`);
  console.log(`Diff           : ${diff ? `${diff.label}（${diffFiles.size} ファイル）` : 'なし'}`);
  console.log(`Tree page      : ${treeUpdated ? 'ガイド一覧を更新した' : `${TREE_PAGE_NAME} が無いため更新していない`}`);
  console.log(`Links checked  : ${checked}（リンク切れ ${broken.length}）`);
  console.log(`Elapsed        : ${((Date.now() - started) / 1000).toFixed(2)}s`);
  if (broken.length) {
    console.error('\nリンク切れ:');
    for (const b of broken.slice(0, 30)) console.error(`- ${b}`);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err?.stack || err);
  process.exit(1);
});
