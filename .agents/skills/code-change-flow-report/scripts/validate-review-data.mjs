#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

const MAX_LEVELS = 10_000;
const [inputPath] = process.argv.slice(2);

if (!inputPath) {
  console.error("Usage: node validate-review-data.mjs <review-data.json>");
  process.exit(1);
}

let data;
try {
  data = JSON.parse(await readFile(inputPath, "utf8"));
} catch (error) {
  throw new Error(`JSONを読み込めません: ${error.message}`);
}

assertObject(data, "root");
const commits = data.commits ?? [{ hash: "working-tree", message: "変更内容", steps: data.steps }];
assertArray(commits, "commits");
if (commits.length === 0) fail("commits", "1件以上のコミットが必要です");

let totalSteps = 0;
let totalChanged = 0;
let totalContext = 0;
let maximumDepth = 0;

commits.forEach((commit, commitIndex) => {
  const commitLocation = `commits[${commitIndex}]`;
  assertObject(commit, commitLocation);
  requireText(commit.hash, `${commitLocation}.hash`);
  requireText(commit.message, `${commitLocation}.message`);
  assertArray(commit.steps, `${commitLocation}.steps`);
  if (commit.steps.length === 0) fail(`${commitLocation}.steps`, "1件以上のステップが必要です");

  let commitChanged = 0;
  let commitContext = 0;
  const pendingFlows = [{ steps: commit.steps, depth: 0, location: `${commitLocation}.steps` }];

  while (pendingFlows.length > 0) {
    const flow = pendingFlows.pop();
    if (flow.depth >= MAX_LEVELS) {
      fail(flow.location, `入れ子が上限の${MAX_LEVELS}段を超えています`);
    }

    flow.steps.forEach((step, stepIndex) => {
      const stepLocation = `${flow.location}[${stepIndex}]`;
      assertObject(step, stepLocation);
      requireText(step.filePath, `${stepLocation}.filePath`);
      requireLine(step.startLine, `${stepLocation}.startLine`);
      requireLine(step.endLine, `${stepLocation}.endLine`);
      if (step.endLine < step.startLine) {
        fail(`${stepLocation}.endLine`, "終了行は開始行以上にしてください");
      }
      requireText(step.language, `${stepLocation}.language`);
      requireString(step.beforeCode, `${stepLocation}.beforeCode`);
      requireString(step.afterCode, `${stepLocation}.afterCode`);
      if (step.beforeCode === "" && step.afterCode === "") {
        fail(stepLocation, "beforeCodeとafterCodeを両方とも空にはできません");
      }
      requireText(step.overview, `${stepLocation}.overview`);
      requireText(step.reason, `${stepLocation}.reason`);
      requireText(step.specification, `${stepLocation}.specification`);
      requireText(step.remarks, `${stepLocation}.remarks`);
      assertArray(step.calls, `${stepLocation}.calls`);

      const firstSpecificationSentence = step.specification.split("。")[0];
      if (/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\([^)]*\)/.test(firstSpecificationSentence)) {
        fail(`${stepLocation}.specification`, "最初の文ではメソッドの呼び出し順ではなく、処理が持つ意味を説明してください");
      }
      if (!step.specification.includes("例えば")) {
        fail(`${stepLocation}.specification`, "意味の説明後に「例えば」で具体的な入力と結果を示してください");
      }

      if (step.connectFromPrevious !== undefined) {
        if (typeof step.connectFromPrevious !== "boolean") {
          fail(`${stepLocation}.connectFromPrevious`, "trueまたはfalseを指定してください");
        }
        if (flow.depth !== 0) {
          fail(`${stepLocation}.connectFromPrevious`, "connectFromPreviousは1段目だけに指定できます");
        }
      }

      totalSteps += 1;
      maximumDepth = Math.max(maximumDepth, flow.depth + 1);
      if (step.beforeCode === step.afterCode) {
        if (step.reason !== "変更なし") {
          fail(`${stepLocation}.reason`, "未変更ステップでは「変更なし」だけを指定してください");
        }
        if (/変更されていない|変更されてません|変更はない|変更がない|変更なし|未変更/.test(step.overview)) {
          fail(`${stepLocation}.overview`, "未変更ステップの概説では変更有無を繰り返さず、処理の役割だけを説明してください");
        }
        commitContext += 1;
      } else {
        if (step.reason === "変更なし") {
          fail(`${stepLocation}.reason`, "変更ステップには実際の変更理由を指定してください");
        }
        commitChanged += 1;
      }

      step.calls.forEach((call, callIndex) => {
        const callLocation = `${stepLocation}.calls[${callIndex}]`;
        assertObject(call, callLocation);
        assertArray(call.steps, `${callLocation}.steps`);
        pendingFlows.push({ steps: call.steps, depth: flow.depth + 1, location: `${callLocation}.steps` });
      });
    });
  }

  if (commitChanged === 0) {
    fail(commitLocation, "変更コードを含むステップがありません");
  }
  if (commitContext === 0) {
    console.warn(`[確認] ${commit.hash}: 未変更コードのステップがありません。入口から終点まで追加すべき未変更処理がないか確認してください。`);
  }
  totalChanged += commitChanged;
  totalContext += commitContext;
});

console.log(`JSON validation passed: ${commits.length} commits, ${totalSteps} tables, ${totalChanged} changed, ${totalContext} unchanged, depth ${maximumDepth}`);

function fail(location, message) {
  throw new Error(`${location}: ${message}`);
}

function assertObject(value, location) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(location, "オブジェクトが必要です");
  }
}

function assertArray(value, location) {
  if (!Array.isArray(value)) fail(location, "配列が必要です");
}

function requireString(value, location) {
  if (typeof value !== "string") fail(location, "文字列が必要です");
}

function requireText(value, location) {
  requireString(value, location);
  if (value.trim() === "") fail(location, "空ではない文字列が必要です");
}

function requireLine(value, location) {
  if (!Number.isInteger(value) || value < 1) fail(location, "1以上の整数が必要です");
}
