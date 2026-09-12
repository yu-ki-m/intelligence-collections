import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MAX_LEVELS = 10_000;
const INDENT_PX = 64;
const PRINT_INDENT_MM = 12;
const THEME = "github-light";
const TEMPLATE_VERSION = "2026.09.12.4";

const [inputPath, outputPath] = process.argv.slice(2);

if (inputPath === "--version") {
  console.log(TEMPLATE_VERSION);
  process.exit(0);
}

if (inputPath === "--self-test-depth") {
  const requestedLevels = Number(outputPath);
  const fixture = buildDepthFixture(requestedLevels);
  const flattened = flattenExecution(fixture.steps);
  const detectedLevels = flattened.reduce((maximum, item) => Math.max(maximum, item.depth + 1), 0);
  if (detectedLevels !== requestedLevels) {
    throw new Error(`Expected ${requestedLevels} levels, detected ${detectedLevels}`);
  }
  console.log(`Depth test passed: ${detectedLevels} levels`);
  process.exit(0);
}

if (inputPath === "--self-test-connections") {
  const fixture = {
    steps: [
      { filePath: "FlowA.java", calls: [{ steps: [{ filePath: "FlowAChild.java", calls: [] }] }] },
      { filePath: "Independent.java", connectFromPrevious: false, calls: [] },
      { filePath: "FlowB.java", calls: [] }
    ]
  };
  const flattened = flattenExecution(fixture.steps);
  const [flowA, flowAChild, independent, flowB] = flattened;
  const passed = flowA.connectFromPrevious
    && flowAChild.connectFromPrevious
    && !flowAChild.activeTracks.includes(0)
    && !independent.connectFromPrevious
    && flowB.connectFromPrevious;
  if (!passed) {
    throw new Error("Root connection test failed");
  }
  console.log("Root connection test passed");
  process.exit(0);
}

if (inputPath === "--self-test-collapse") {
  const fixture = {
    steps: [
      {
        filePath: "Caller.java",
        calls: [{
          steps: [
            { filePath: "Service.java", calls: [{ steps: [{ filePath: "Repository.java", calls: [] }] }] },
            { filePath: "ServiceContinuation.java", calls: [] }
          ]
        }]
      },
      { filePath: "CallerContinuation.java", calls: [] }
    ]
  };
  const flattened = flattenExecution(fixture.steps);
  const ranges = flattened.map(({ flowIndex, descendantEndIndex }) => [flowIndex, descendantEndIndex]);
  const expectedRanges = [[0, 3], [1, 2], [2, 2], [3, 3], [4, 4]];
  if (JSON.stringify(ranges) !== JSON.stringify(expectedRanges)) {
    throw new Error(`Collapse range test failed: ${JSON.stringify(ranges)}`);
  }
  console.log("Collapse range test passed");
  process.exit(0);
}

if (!inputPath || !outputPath) {
  console.error("Usage: node generate-report.mjs <input.json> <output.html>");
  process.exit(1);
}

const { diffArrays } = await import("diff");
const documentData = JSON.parse(await readFile(inputPath, "utf8"));
const commitDefinitions = normalizeCommits(documentData);
const commits = commitDefinitions.map((commit, index) => {
  const sequence = flattenExecution(commit.steps, commit.location);
  const maxDepth = sequence.reduce((maximum, item) => Math.max(maximum, item.depth), 0);
  return { ...commit, sequence, maxDepth, index };
});
const maxDepth = commits.reduce((maximum, commit) => Math.max(maximum, commit.maxDepth), 0);

const { bundledLanguages, createHighlighter } = await import("shiki");
const requestedLanguages = new Set(
  commits.flatMap((commit) => commit.sequence.map(({ step }) => resolveLanguage(step)))
);
const supportedLanguages = [...requestedLanguages].filter((language) => language in bundledLanguages);
const highlighter = await createHighlighter({
  themes: [THEME],
  langs: supportedLanguages
});

const renderedCommits = commits.map((commit) => renderCommit(commit, highlighter, bundledLanguages));

const html = renderDocument({
  title: stringValue(documentData.title, "コード変更比較表"),
  maxDepth,
  renderedCommits
});

await writeFile(outputPath, html, "utf8");
const tableCount = commits.reduce((total, commit) => total + commit.sequence.length, 0);
console.log(`Generated ${path.resolve(outputPath)} (${commits.length} commits, ${tableCount} tables, depth ${maxDepth + 1})`);

function normalizeCommits(data) {
  if (data.commits === undefined) {
    return [{
      hash: "commit-1",
      message: stringValue(data.title, "変更内容"),
      author: "",
      committedAt: "",
      steps: data.steps,
      location: "steps"
    }];
  }

  assertArray(data.commits, "commits");
  if (data.commits.length === 0) {
    throw new Error("commits must contain at least one commit");
  }

  return data.commits.map((commit, index) => {
    const location = `commits[${index}]`;
    assertObject(commit, location);
    return {
      hash: stringValue(commit.hash, `commit-${index + 1}`),
      message: stringValue(commit.message, `コミット ${index + 1}`),
      author: optionalString(commit.author),
      committedAt: optionalString(commit.committedAt),
      steps: commit.steps,
      location: `${location}.steps`
    };
  });
}

function flattenExecution(rootSteps, rootLocation = "steps") {
  assertArray(rootSteps, rootLocation);
  const result = [];
  const tasks = [{
    kind: "flow",
    steps: rootSteps,
    depth: 0,
    location: rootLocation,
    activeTracks: [],
    entry: { kind: "root" }
  }];

  while (tasks.length > 0) {
    const task = tasks.pop();

    if (task.kind === "step") {
      result.push({
        step: task.step,
        depth: task.depth,
        activeTracks: task.activeTracks,
        entry: task.entry,
        connectFromPrevious: task.connectFromPrevious
      });
      continue;
    }

    if (task.depth >= MAX_LEVELS) {
      throw new Error(`${summarizeLocation(task.location)}: nesting level ${task.depth + 1} exceeds ${MAX_LEVELS}`);
    }

    assertArray(task.steps, task.location);
    const orderedTasks = [];

    task.steps.forEach((step, stepIndex) => {
      const stepLocation = `${task.location}[${stepIndex}]`;
      assertObject(step, stepLocation);
      orderedTasks.push({
        kind: "step",
        step,
        depth: task.depth,
        activeTracks: task.activeTracks,
        entry: stepIndex === 0 ? task.entry : { kind: "step" },
        connectFromPrevious: task.depth !== 0 || stepIndex === 0 || step.connectFromPrevious !== false
      });

      const calls = step.calls ?? [];
      assertArray(calls, `${stepLocation}.calls`);
      calls.forEach((call, callIndex) => {
        const callLocation = `${stepLocation}.calls[${callIndex}]`;
        assertObject(call, callLocation);
        const nextStepContinuesRootFlow = stepIndex < task.steps.length - 1
          && (task.depth !== 0 || task.steps[stepIndex + 1]?.connectFromPrevious !== false);
        const hasLaterParentWork = callIndex < calls.length - 1 || nextStepContinuesRootFlow;
        const childTracks = hasLaterParentWork
          ? [...task.activeTracks, task.depth]
          : task.activeTracks;
        orderedTasks.push({
          kind: "flow",
          steps: call.steps,
          depth: task.depth + 1,
          location: `${callLocation}.steps`,
          activeTracks: childTracks,
          entry: { kind: "call", parentDepth: task.depth }
        });
      });
    });

    for (let index = orderedTasks.length - 1; index >= 0; index -= 1) {
      tasks.push(orderedTasks[index]);
    }
  }

  return annotateDescendantRanges(result);
}

function annotateDescendantRanges(sequence) {
  const openItems = [];

  sequence.forEach((item, index) => {
    while (openItems.length > 0 && openItems[openItems.length - 1].depth >= item.depth) {
      const completed = openItems.pop();
      sequence[completed.index].descendantEndIndex = index - 1;
    }
    item.flowIndex = index;
    item.descendantEndIndex = index;
    openItems.push({ index, depth: item.depth });
  });

  while (openItems.length > 0) {
    const completed = openItems.pop();
    sequence[completed.index].descendantEndIndex = sequence.length - 1;
  }

  return sequence;
}

function buildDepthFixture(levels) {
  if (!Number.isInteger(levels) || levels < 1) {
    throw new Error("Self-test depth must be a positive integer");
  }

  const root = { steps: [] };
  let currentFlow = root;

  for (let currentLevel = 1; currentLevel <= levels; currentLevel += 1) {
    const step = { calls: [] };
    currentFlow.steps.push(step);
    if (currentLevel < levels) {
      const call = { steps: [] };
      step.calls.push(call);
      currentFlow = call;
    }
  }

  return root;
}

function summarizeLocation(location) {
  const maximumLength = 180;
  if (location.length <= maximumLength) {
    return location;
  }
  return `${location.slice(0, 80)}…${location.slice(-(maximumLength - 81))}`;
}

function renderCommit(commit, highlighterInstance, languages) {
  const tabId = `commit-tab-${commit.index}`;
  const panelId = `commit-panel-${commit.index}`;
  const selected = commit.index === 0;
  const renderedRows = commit.sequence.map((item, index) => {
    const previous = index === 0 ? null : commit.sequence[index - 1];
    const connector = previous
      ? (item.connectFromPrevious ? renderConnector(previous, item) : renderDisconnectedGap())
      : "";
    return `<div class="flow-item" data-flow-index="${item.flowIndex}">${connector}${renderStep(item, commit.index, highlighterInstance, languages)}</div>`;
  }).join("\n");
  const metadata = [
    commit.author ? `<span>作成者: ${escapeHtml(commit.author)}</span>` : "",
    commit.committedAt ? `<time datetime="${escapeHtml(commit.committedAt)}">${escapeHtml(commit.committedAt)}</time>` : ""
  ].filter(Boolean).join("");

  const tab = `<button class="commit-tab" id="${tabId}" type="button" role="tab" aria-selected="${selected}" aria-controls="${panelId}" tabindex="${selected ? 0 : -1}"><span class="commit-tab-hash">${escapeHtml(commit.hash)}</span><span class="commit-tab-message">${escapeHtml(commit.message)}</span></button>`;
  const panel = `<section class="commit-panel" id="${panelId}" role="tabpanel" aria-labelledby="${tabId}" data-max-depth="${commit.maxDepth}"${selected ? "" : " hidden"}>
    <header class="commit-summary"><code>${escapeHtml(commit.hash)}</code><span class="commit-summary-message">${escapeHtml(commit.message)}</span>${metadata ? `<span class="commit-metadata">${metadata}</span>` : ""}</header>
${renderedRows || "    <p class=\"empty-commit\">このコミットに表示する変更はありません。</p>"}
  </section>`;
  return { tab, panel };
}

function renderStep(item, commitIndex, highlighterInstance, languages) {
  const { step, depth, activeTracks, entry } = item;
  const language = resolveLanguage(step);
  const beforeSource = normalizeCode(stringValue(step.beforeCode, ""));
  const afterSource = normalizeCode(stringValue(step.afterCode, ""));
  const lineStates = classifyDiffLines(beforeSource, afterSource);
  const beforeHtml = highlightCode(beforeSource, language, highlighterInstance, languages, lineStates.before);
  const afterHtml = highlightCode(afterSource, language, highlighterInstance, languages, lineStates.after);
  const screenOffset = depth * INDENT_PX;
  const printOffset = depth * PRINT_INDENT_MM;
  const filePath = escapeHtml(stringValue(step.filePath, "{ファイルパス}"));
  const startLine = escapeHtml(stringValue(step.startLine, "{開始行}"));
  const endLine = escapeHtml(stringValue(step.endLine, "{終了行}"));
  const hasDescendants = item.descendantEndIndex > item.flowIndex;
  const collapseButton = hasDescendants
    ? `<button class="nest-toggle" type="button" aria-expanded="true" aria-label="呼び出し先を閉じる" title="呼び出し先を閉じる" data-flow-start="${item.flowIndex + 1}" data-flow-end="${item.descendantEndIndex}"><svg class="nest-toggle-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg></button>`
    : '<span class="nest-toggle-placeholder" aria-hidden="true"></span>';

  const tracks = renderTracks(activeTracks, "row-track");
  const entryBranch = entry.kind === "call"
    ? `${activeTracks.includes(entry.parentDepth) ? "" : `<span class="entry-stem" style="${renderTrackStyle(entry.parentDepth)}"></span>`}<span class="entry-branch" style="${renderBranchStyle(entry.parentDepth, depth)}"></span>`
    : "";

  return `<section class="flow-row" data-depth="${depth}" style="--screen-offset:${screenOffset}px;--print-offset:${printOffset}mm">
  <div class="row-connectors" aria-hidden="true">${tracks}${entryBranch}</div>
  <div class="review-unit">
    <div class="source-header" id="flow-${commitIndex}-${item.flowIndex}">${collapseButton}<p class="source-location">${filePath}:${startLine}-${endLine}</p></div>
    <div class="comparison">
    <section class="column">
      <h2 class="column-title">変更前</h2>
      <div class="editor">${beforeHtml}</div>
    </section>
    <section class="column">
      <h2 class="column-title">変更後</h2>
      <div class="editor">${afterHtml}</div>
    </section>
    <section class="column">
      <h2 class="column-title">解説</h2>
      <div class="details">
        <section class="detail"><h3 class="detail-title">概説</h3><p class="detail-body">${formatProse(step.overview, "{変更内容を1～2文で記載}")}</p></section>
        <section class="detail"><h3 class="detail-title">変更理由</h3><p class="detail-body">${formatProse(step.reason, "{なぜ変更したか}")}</p></section>
        <section class="detail"><h3 class="detail-title">処理仕様</h3><p class="detail-body">${formatProse(step.specification, "{変更後どう動くか}")}</p></section>
      </div>
    </section>
    <section class="column">
      <h2 class="column-title">備考</h2>
      <div class="remarks"><p class="remarks-body">${formatProse(step.remarks, "{補足事項があれば記載}")}</p></div>
    </section>
    </div>
  </div>
</section>`;
}

function renderConnector(previous, current) {
  const levels = new Set([...previous.activeTracks, ...current.activeTracks]);
  const isCallEntry = current.entry.kind === "call";
  const targetDepth = isCallEntry ? current.entry.parentDepth : current.depth;
  levels.add(targetDepth);

  const tracks = [...levels]
    .sort((left, right) => left - right)
    .map((level) => `<span class="connector-track" style="${renderTrackStyle(level)}"></span>`)
    .join("");

  return `<div class="flow-connector" aria-hidden="true">${tracks}</div>`;
}

function renderDisconnectedGap() {
  return '<div class="flow-connector flow-connector--disconnected" aria-hidden="true"></div>';
}

function renderTracks(levels, className) {
  return levels
    .map((level) => `<span class="${className}" style="${renderTrackStyle(level)}"></span>`)
    .join("");
}

function renderTrackStyle(level) {
  const screenTrack = level * INDENT_PX + INDENT_PX / 2;
  const printTrack = level * PRINT_INDENT_MM + PRINT_INDENT_MM / 2;
  return `--screen-track:${screenTrack}px;--print-track:${printTrack}mm`;
}

function renderBranchStyle(parentDepth, childDepth) {
  const screenLeft = parentDepth * INDENT_PX + INDENT_PX / 2;
  const screenWidth = childDepth * INDENT_PX - screenLeft;
  const printLeft = parentDepth * PRINT_INDENT_MM + PRINT_INDENT_MM / 2;
  const printWidth = childDepth * PRINT_INDENT_MM - printLeft;
  return `--screen-branch-left:${screenLeft}px;--screen-branch-width:${screenWidth}px;--print-branch-left:${printLeft}mm;--print-branch-width:${printWidth}mm`;
}

function highlightCode(source, language, highlighterInstance, languages, lineStates) {
  if (!(language in languages)) {
    const lines = splitCodeLines(source)
      .map((line, index) => `<span class="line diff-line${diffStateClass(lineStates[index])}">${escapeHtml(line)}</span>`)
      .join("");
    return `<pre class="shiki plain"><code>${lines}</code></pre>`;
  }

  const highlighted = highlighterInstance.codeToHtml(source, { lang: language, theme: THEME })
    .replace(/\s+tabindex="0"/, "");
  let lineIndex = 0;
  const decorated = highlighted.replace(/<span class="line">/g, () => {
    const stateClass = diffStateClass(lineStates[lineIndex]);
    lineIndex += 1;
    return `<span class="line diff-line${stateClass}">`;
  });
  return decorated.replace(/<\/span>\n(?=<span class="line diff-line)/g, "</span>");
}

function classifyDiffLines(beforeSource, afterSource) {
  const before = [];
  const after = [];
  const changes = diffArrays(splitCodeLines(beforeSource), splitCodeLines(afterSource));

  changes.forEach((change) => {
    if (change.removed) {
      before.push(...change.value.map(() => "removed"));
      return;
    }
    if (change.added) {
      after.push(...change.value.map(() => "added"));
      return;
    }
    before.push(...change.value.map(() => "unchanged"));
    after.push(...change.value.map(() => "unchanged"));
  });

  return { before, after };
}

function diffStateClass(state) {
  if (state === "removed") return " diff-line--removed";
  if (state === "added") return " diff-line--added";
  return "";
}

function normalizeCode(value) {
  return String(value).replace(/\r\n?/g, "\n").replace(/\n$/, "");
}

function splitCodeLines(source) {
  return source.split("\n");
}

function resolveLanguage(step) {
  if (typeof step.language === "string" && step.language.trim()) {
    return step.language.trim().toLowerCase();
  }

  const extension = path.extname(stringValue(step.filePath, "")).slice(1).toLowerCase();
  const aliases = {
    htm: "html",
    js: "javascript",
    jsx: "jsx",
    kt: "kotlin",
    kts: "kotlin",
    py: "python",
    rb: "ruby",
    rs: "rust",
    sh: "bash",
    ts: "typescript",
    tsx: "tsx",
    yml: "yaml"
  };
  return aliases[extension] ?? (extension || "text");
}

function renderDocument({ title, maxDepth, renderedCommits }) {
  const screenOverhang = maxDepth * INDENT_PX;
  const printOverhang = maxDepth * PRINT_INDENT_MM;
  const renderedTabs = renderedCommits.map(({ tab }) => tab).join("\n");
  const renderedPanels = renderedCommits.map(({ panel }) => panel).join("\n");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="code-change-flow-template-version" content="${TEMPLATE_VERSION}">
  <title>${escapeHtml(title)}</title>
  <style>
    :root{color-scheme:light;--line:#a8a8a8;--paper:#fff;--ink:#242424}
    *{box-sizing:border-box}
    html{background:#f2f3f5}
    body{margin:0;color:var(--ink);background:var(--paper);font-family:"Yu Gothic","YuGothic","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;font-size:14px;line-height:1.55}
    main{--call-indent:${INDENT_PX}px;--track-inset:32px;--source-height:22px;--flow-overhang:${screenOverhang}px;--table-width:2460px;width:calc(var(--table-width) + var(--flow-overhang));margin:32px auto 48px}
    .commit-tabs{position:sticky;z-index:20;top:0;left:10px;width:min(var(--table-width),calc(100vw - 20px));margin:0 0 14px;overflow-x:auto;border:1px solid var(--line);background:#fff}
    .commit-tab-list{display:flex;width:max-content;min-width:100%}
    .commit-tab{display:flex;flex:0 0 auto;align-items:center;gap:8px;max-width:360px;height:40px;padding:0 14px;border:0;border-right:1px solid #c9c9c9;border-bottom:3px solid transparent;background:#f2f2f2;color:var(--ink);font:inherit;white-space:nowrap;cursor:pointer}
    .commit-tab:last-child{border-right:0}
    .commit-tab:hover{background:#e9eaec}
    .commit-tab[aria-selected="true"]{border-bottom-color:#57606a;background:#fff}
    .commit-tab:focus-visible{position:relative;z-index:1;outline:2px solid #0969da;outline-offset:-2px}
    .commit-tab-hash,.commit-summary code{font-family:Consolas,"BIZ UDゴシック","MS Gothic",monospace;font-size:12px}
    .commit-tab-hash{color:#57606a}
    .commit-tab-message{overflow:hidden;text-overflow:ellipsis}
    .commit-panel[hidden]{display:none}
    .commit-summary{display:flex;align-items:center;gap:12px;width:var(--table-width);min-height:34px;margin:0 0 10px;padding:5px 8px;border:1px solid #c9c9c9;background:#fafafa;font-size:12px}
    .commit-summary-message{font-size:13px}
    .commit-metadata{display:flex;gap:12px;margin-left:auto;color:#57606a}
    .empty-commit{width:var(--table-width);margin:0;padding:16px;border:1px solid var(--line)}
    .flow-item[hidden]{display:none}
    .flow-row{position:relative;width:100%;break-inside:avoid;page-break-inside:avoid}
    .review-unit{position:relative;z-index:1;width:var(--table-width);margin-left:var(--screen-offset);background:var(--paper)}
    .source-header{display:flex;align-items:center;gap:3px;height:var(--source-height);overflow:hidden}
    .source-location{min-width:0;margin:0;overflow:hidden;font-size:12px;line-height:1.5;white-space:nowrap;text-overflow:ellipsis}
    .nest-toggle,.nest-toggle-placeholder{flex:none;width:18px;height:18px}
    .nest-toggle{display:inline-grid;place-items:center;padding:0;border:0;border-radius:2px;background:transparent;color:#57606a;cursor:pointer}
    .nest-toggle:hover{background:#ededed;color:var(--ink)}
    .nest-toggle:focus-visible{outline:2px solid #0969da;outline-offset:1px}
    .nest-toggle-icon{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
    .nest-toggle[aria-expanded="false"] .nest-toggle-icon{transform:rotate(-90deg)}
    .comparison{display:grid;grid-template-columns:2fr 2fr 1fr 1fr;align-items:stretch;border-top:1px solid var(--line);border-left:1px solid var(--line)}
    .column{display:grid;grid-template-rows:26px auto;align-content:start;min-width:0;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
    .column-title{margin:0;padding:2px 8px;border-bottom:1px solid var(--line);background:#f2f2f2;font-size:14px;font-weight:400;line-height:21px;text-align:center}
    .editor{align-self:start;min-width:0;overflow:hidden;background:#fff}
    .editor .shiki{margin:0;padding:10px 12px;overflow:auto;background:#fff!important;font-family:Consolas,"BIZ UDゴシック","MS Gothic",monospace;font-size:13px;line-height:1.5;white-space:pre}
    .editor .shiki code{display:block;width:max-content;min-width:100%}
    .editor .shiki .diff-line{position:relative;display:block;min-height:1.5em;padding:0 12px 0 30px}
    .editor .shiki .diff-line::before{position:absolute;top:0;left:0;width:24px;color:#6e7781;text-align:center;content:" ";user-select:none}
    .editor .shiki .diff-line--removed{background:#ffebe9}
    .editor .shiki .diff-line--removed::before{color:#cf222e;content:"-"}
    .editor .shiki .diff-line--added{background:#dafbe1}
    .editor .shiki .diff-line--added::before{color:#1a7f37;content:"+"}
    .details{display:grid;grid-template-rows:auto auto auto;align-content:start;min-height:0}
    .detail{padding:4px 5px;overflow:visible;border-bottom:1px solid #c9c9c9}
    .detail:last-child{max-height:536px;overflow-y:auto;border-bottom:0;scrollbar-gutter:stable}
    .detail-title{margin:0 0 1px;font-size:12px;font-weight:400;line-height:1.4}
    .detail-body{min-height:28px;margin:0;padding-left:24px;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
    .remarks{align-self:start;padding:6px 8px}
    .remarks-body{margin:0;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
    .row-connectors{position:absolute;z-index:0;inset:0;pointer-events:none}
    .row-track,.entry-stem,.connector-track{position:absolute;left:var(--screen-track);width:0;border-left:1px solid var(--line)}
    .row-track{top:0;bottom:0}
    .entry-stem{top:0;height:var(--source-height)}
    .entry-branch{position:absolute;top:var(--source-height);left:var(--screen-branch-left);width:var(--screen-branch-width);border-top:1px solid var(--line)}
    .flow-connector{position:relative;width:100%;height:20px;pointer-events:none}
    .connector-track{top:0;bottom:0}
    @media(max-width:820px){main{margin:20px 10px 48px}}
    @media print{
      @page{size:A4 landscape;margin:10mm}
      html,body{background:#fff}
      main{--call-indent:${PRINT_INDENT_MM}mm;--track-inset:6mm;--source-height:5mm;--flow-overhang:${printOverhang}mm;--table-width:260mm;width:calc(var(--table-width) + var(--flow-overhang));margin:0}
      .commit-tabs{display:none}
      .commit-panel[hidden]{display:block!important}
      .flow-item[hidden]{display:block!important}
      .commit-panel+.commit-panel{break-before:page}
      .nest-toggle,.nest-toggle-placeholder{display:none}
      .review-unit{margin-left:var(--print-offset)}
      .column{grid-template-rows:7mm auto}
      .detail:last-child{max-height:none;overflow:visible;scrollbar-gutter:auto}
      .flow-connector{height:5mm}
      .row-track,.entry-stem,.connector-track{left:var(--print-track)}
      .entry-branch{left:var(--print-branch-left);width:var(--print-branch-width)}
    }
  </style>
</head>
<body>
  <main id="review-report" data-template-version="${TEMPLATE_VERSION}" data-max-depth="${maxDepth}">
    <nav class="commit-tabs" aria-label="コミット一覧">
      <div class="commit-tab-list" role="tablist" aria-label="表示するコミット">
${renderedTabs}
      </div>
    </nav>
${renderedPanels}
  </main>
  <script>
    (() => {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      const panels = [...document.querySelectorAll('[role="tabpanel"]')];
      const keepTabVisible = (tab) => {
        const tabViewport = tab.closest('.commit-tabs');
        if (!tabViewport) return;
        const tabLeft = tab.offsetLeft;
        const tabRight = tabLeft + tab.offsetWidth;
        const visibleLeft = tabViewport.scrollLeft;
        const visibleRight = visibleLeft + tabViewport.clientWidth;
        if (tabLeft < visibleLeft) {
          tabViewport.scrollLeft = tabLeft;
        } else if (tabRight > visibleRight) {
          tabViewport.scrollLeft = Math.max(0, tabRight - tabViewport.clientWidth);
        }
      };
      const activate = (tab, moveFocus) => {
        const panelId = tab.getAttribute('aria-controls');
        tabs.forEach((item) => {
          const active = item === tab;
          item.setAttribute('aria-selected', String(active));
          item.tabIndex = active ? 0 : -1;
        });
        panels.forEach((panel) => { panel.hidden = panel.id !== panelId; });
        if (moveFocus) {
          tab.focus({ preventScroll: true });
          keepTabVisible(tab);
        }
      };
      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activate(tab, false));
        tab.addEventListener('keydown', (event) => {
          let targetIndex = null;
          if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabs.length;
          if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabs.length) % tabs.length;
          if (event.key === 'Home') targetIndex = 0;
          if (event.key === 'End') targetIndex = tabs.length - 1;
          if (targetIndex === null) return;
          event.preventDefault();
          activate(tabs[targetIndex], true);
        });
      });

      const updateNestedVisibility = (panel) => {
        const collapsedRanges = [...panel.querySelectorAll('.nest-toggle[aria-expanded="false"]')]
          .map((button) => ({
            start: Number(button.dataset.flowStart),
            end: Number(button.dataset.flowEnd)
          }))
          .sort((left, right) => left.start - right.start);
        const mergedRanges = [];
        collapsedRanges.forEach((range) => {
          const previous = mergedRanges[mergedRanges.length - 1];
          if (previous && range.start <= previous.end + 1) {
            previous.end = Math.max(previous.end, range.end);
          } else {
            mergedRanges.push({ ...range });
          }
        });
        let rangeIndex = 0;
        panel.querySelectorAll('.flow-item').forEach((item) => {
          const itemIndex = Number(item.dataset.flowIndex);
          while (rangeIndex < mergedRanges.length && mergedRanges[rangeIndex].end < itemIndex) {
            rangeIndex += 1;
          }
          const range = mergedRanges[rangeIndex];
          item.hidden = Boolean(range && itemIndex >= range.start && itemIndex <= range.end);
        });
      };

      document.querySelectorAll('.nest-toggle').forEach((button) => {
        button.addEventListener('click', () => {
          const expanded = button.getAttribute('aria-expanded') === 'true';
          button.setAttribute('aria-expanded', String(!expanded));
          const label = expanded ? '呼び出し先を開く' : '呼び出し先を閉じる';
          button.setAttribute('aria-label', label);
          button.title = label;
          updateNestedVisibility(button.closest('.commit-panel'));
        });
      });
    })();
  </script>
</body>
</html>`;
}

function stringValue(value, fallback) {
  if (value === undefined || value === null || value === "") return String(fallback);
  return String(value);
}

function optionalString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function formatProse(value, fallback) {
  return escapeHtml(stringValue(value, fallback)).replace(/。[ \t]*(?=\S)/g, "。<br>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function assertArray(value, location) {
  if (!Array.isArray(value)) throw new Error(`${location} must be an array`);
}

function assertObject(value, location) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${location} must be an object`);
  }
}
