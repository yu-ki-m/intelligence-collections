#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

const TEMPLATE_VERSION = "2026.09.12.4";
const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: node verify-generated-report.mjs <review-data.json> <review-report.html>");
  process.exit(1);
}

const data = JSON.parse(await readFile(inputPath, "utf8"));
const html = await readFile(outputPath, "utf8");
const commits = data.commits ?? [{ hash: "working-tree", message: "変更内容", steps: data.steps }];
const flattenedSteps = commits.flatMap((commit) => flattenSteps(commit.steps));
const expectedTableCount = flattenedSteps.length;
const expectedToggleCount = flattenedSteps.filter(hasDisplayedDescendants).length;
const expectedBranchCount = commits.reduce((total, commit) => total + countCallEntries(commit.steps), 0);
const expectedDisconnectedCount = commits.reduce(
  (total, commit) => total + commit.steps.slice(1).filter((step) => step.connectFromPrevious === false).length,
  0
);
const expectedBreakCount = flattenedSteps.reduce(
  (total, step) => total + [step.overview, step.reason, step.specification, step.remarks]
    .reduce((count, value) => count + countMatches(String(value), /。[ \t]*(?=\S)/g), 0),
  0
);

requireText(`<meta name="code-change-flow-template-version" content="${TEMPLATE_VERSION}">`, "テンプレート版メタ情報");
requireText(`data-template-version="${TEMPLATE_VERSION}"`, "テンプレート版属性");
requireText("--table-width:2460px", "表全体の横幅");
requireText("grid-template-columns:2fr 2fr 1fr 1fr", "820:820:410:410の列比率");
requireText(".column-title{margin:0;padding:2px 8px;border-bottom:1px solid var(--line);background:#f2f2f2;font-size:14px", "薄いグレーの列タイトル");
requireText(".detail:last-child{max-height:536px;overflow-y:auto", "処理仕様の高さ上限とスクロール");
requireText(".detail:last-child{max-height:none;overflow:visible", "印刷時の処理仕様展開");
requireText(".editor .shiki .diff-line--removed{background:#ffebe9}", "削除行の薄い赤色");
requireText('.editor .shiki .diff-line--removed::before{color:#cf222e;content:"-"}', "削除行のマイナス記号");
requireText(".editor .shiki .diff-line--added{background:#dafbe1}", "追加行の薄い緑色");
requireText('.editor .shiki .diff-line--added::before{color:#1a7f37;content:"+"}', "追加行のプラス記号");
requireText(".connector-track{top:0;bottom:0}", "縦の接続線");
requireText(".entry-stem{top:0;height:var(--source-height)}", "入れ子入口の縦線");
requireText(".entry-branch{position:absolute", "入れ子入口の横線");
requireText(".commit-panel[hidden]{display:block!important}", "印刷時の全コミット表示");
requireText(".flow-item[hidden]{display:block!important}", "印刷時の全入れ子表示");
requireText("const collapsedRanges", "段ごとの入れ子開閉処理");
requireText("tab.focus({ preventScroll: true })", "ページを移動させないタブフォーカス");
requireText("tabViewport.scrollLeft", "タブ欄内だけの横スクロール調整");

requireCount('<button class="commit-tab"', commits.length, "コミットタブ");
requireCount('<div class="review-unit">', expectedTableCount, "比較表");
requireCount('<h2 class="column-title">変更前</h2>', expectedTableCount, "変更前タイトル");
requireCount('<h2 class="column-title">変更後</h2>', expectedTableCount, "変更後タイトル");
requireCount('<h2 class="column-title">解説</h2>', expectedTableCount, "解説タイトル");
requireCount('<h2 class="column-title">備考</h2>', expectedTableCount, "備考タイトル");
requireCount('<button class="nest-toggle"', expectedToggleCount, "入れ子開閉シェブロン");
requireCount('<span class="entry-branch"', expectedBranchCount, "各入れ子入口の横線");
requireCount('<div class="flow-connector flow-connector--disconnected"', expectedDisconnectedCount, "独立した1段目の線なし間隔");
requireCount("<br>", expectedBreakCount, "句点直後の改行");

if (html.includes("marker-end=") || html.includes("marker-start=") || html.includes("<polygon")) {
  fail("接続線に矢印の先端が含まれています");
}
if (html.includes("scrollIntoView(")) {
  fail("ページ全体を動かすスクロール処理が含まれています");
}
if (/<script\b[^>]*\bsrc\s*=/i.test(html) || /<link\b[^>]*\bhref\s*=/i.test(html)) {
  fail("HTMLが外部のJavaScriptまたはCSSを参照しています");
}
if (/<(?:img|source)\b[^>]*\bsrc\s*=\s*["'](?!data:)/i.test(html)) {
  fail("HTMLが別ファイルの画像またはメディアを参照しています");
}
if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(html)) {
  fail("HTMLがWeb APIまたはサーバー通信を必要としています");
}
if (/diff-(?:spacer|placeholder)|diff-line--empty/.test(html)) {
  fail("差分位置をそろえるための人工的な空行が含まれています");
}

const comparisonRule = html.match(/\.comparison\{([^}]*)\}/)?.[1] ?? "";
if (/(?:^|;)\s*(?:min-)?height\s*:/.test(comparisonRule)) {
  fail("比較表に固定の縦幅が設定されています");
}

const renderedUnits = html.split('<div class="review-unit">').slice(1);
if (renderedUnits.length !== flattenedSteps.length) {
  fail(`比較表の分割数が不正です: expected ${flattenedSteps.length}, actual ${renderedUnits.length}`);
}

flattenedSteps.forEach((step, index) => {
  const unit = renderedUnits[index];
  requireUnitText(unit, '<pre class="shiki', index, "シンタックスハイライト領域");
  const locationPosition = unit.indexOf('<p class="source-location">');
  const control = hasDisplayedDescendants(step)
    ? '<button class="nest-toggle"'
    : '<span class="nest-toggle-placeholder"';
  const controlPosition = unit.indexOf(control);
  if (controlPosition < 0 || locationPosition < 0 || controlPosition > locationPosition) {
    fail(`${index + 1}番目の表で、ファイルパス左側の開閉領域が不正です`);
  }
  const expectedLocation = `<p class="source-location">${escapeHtml(String(step.filePath))}:${escapeHtml(String(step.startLine))}-${escapeHtml(String(step.endLine))}</p>`;
  requireUnitText(unit, expectedLocation, index, "コロン区切りのファイル位置");

  const hasRenderedDiff = /class="line diff-line diff-line--(?:added|removed)"/.test(unit);
  if (step.beforeCode === step.afterCode && hasRenderedDiff) {
    fail(`${index + 1}番目の未変更ステップに差分色が付いています`);
  }
  if (step.beforeCode !== step.afterCode && !hasRenderedDiff) {
    fail(`${index + 1}番目の変更ステップに差分色がありません`);
  }
});

console.log(`HTML verification passed: template ${TEMPLATE_VERSION}, ${commits.length} commits, ${expectedTableCount} tables`);

function flattenSteps(rootSteps) {
  const result = [];
  const tasks = [{ kind: "flow", steps: rootSteps }];

  while (tasks.length > 0) {
    const task = tasks.pop();
    if (task.kind === "step") {
      result.push(task.step);
      continue;
    }

    for (let stepIndex = task.steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
      const step = task.steps[stepIndex];
      const calls = step.calls ?? [];
      for (let callIndex = calls.length - 1; callIndex >= 0; callIndex -= 1) {
        tasks.push({ kind: "flow", steps: calls[callIndex].steps });
      }
      tasks.push({ kind: "step", step });
    }
  }

  return result;
}

function hasDisplayedDescendants(step) {
  return (step.calls ?? []).some((call) => Array.isArray(call.steps) && call.steps.length > 0);
}

function countCallEntries(rootSteps) {
  let count = 0;
  const pendingFlows = [rootSteps];

  while (pendingFlows.length > 0) {
    const steps = pendingFlows.pop();
    steps.forEach((step) => {
      (step.calls ?? []).forEach((call) => {
        if (Array.isArray(call.steps) && call.steps.length > 0) {
          count += 1;
          pendingFlows.push(call.steps);
        }
      });
    });
  }

  return count;
}

function countMatches(value, expression) {
  return [...value.matchAll(expression)].length;
}

function countText(value, needle) {
  return value.split(needle).length - 1;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function requireText(needle, label) {
  if (!html.includes(needle)) fail(`${label}がHTMLにありません`);
}

function requireUnitText(unit, needle, index, label) {
  if (!unit.includes(needle)) fail(`${index + 1}番目の表に${label}がありません`);
}

function requireCount(needle, expected, label) {
  const actual = countText(html, needle);
  if (actual !== expected) fail(`${label}の数が不正です: expected ${expected}, actual ${actual}`);
}

function fail(message) {
  throw new Error(message);
}
