#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readlink,
  realpath,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const STATE_SCHEMA_VERSION = 1;
const PLAN_SCHEMA_VERSION = 1;
const EVIDENCE_SCHEMA_VERSION = 1;
const FINAL_REVIEW_SCHEMA_VERSION = 1;
const MODE = "commit-parallel-independent-verification";
const DEFAULT_MAX_WORKER_ATTEMPTS = 3;
const DEFAULT_MAX_CORRECTION_ROUNDS = 2;
const MAX_LIMIT = 20;
const LOCK_TIMEOUT_MS = 30_000;
const LOCK_POLL_MS = 40;
const LOCK_HEARTBEAT_MS = 1_000;
const LOCK_LEASE_MS = 10_000;
const LOCK_RECOVERY_GRACE_MS = 2_000;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const GIT_OBJECT_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const DISPLAY_COMMIT_PATTERN = /^[0-9a-f]{7,64}$/i;
const VALID_SOURCE_KINDS = new Set(["commit", "working-tree"]);
const VALID_ROLES = new Set(["investigator", "verifier", "correction"]);
const FINAL_REVIEW_CHECKS = [
  "commitTabs",
  "diffColors",
  "connectionLines",
  "independentFlows",
  "nestedToggle",
  "textWrapping",
  "explanationPrompt"
];
const SCRIPT_PATH = fileURLToPath(import.meta.url);

await main();

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.length === 1 && args[0] === "--self-test") {
      await runSelfTest();
      return;
    }
    const [command, ...rest] = args;
    switch (command) {
      case "init":
        requireArgCount(command, rest, 2, 2);
        await initializeRun(resolve(rest[0]), resolve(rest[1]));
        break;
      case "status":
        requireArgCount(command, rest, 1, 1);
        await printStatus(resolve(rest[0]));
        break;
      case "start-task":
        requireArgCount(command, rest, 4, 4);
        await mutateState(resolve(rest[0]), (state) => startTask(
          state,
          rest[1],
          normalizeRole(rest[2]),
          rest[3]
        ));
        break;
      case "finish-task":
        requireArgCount(command, rest, 3, 5);
        await mutateState(resolve(rest[0]), (state) => finishTask(
          state,
          rest[1],
          rest[2],
          rest[3],
          rest[4]
        ));
        break;
      case "recover-task":
        requireArgCount(command, rest, 3, 3);
        await mutateState(resolve(rest[0]), (state) => recoverTask(state, rest[1], rest[2]));
        break;
      case "recover-running":
        requireArgCount(command, rest, 2, 2);
        await mutateState(resolve(rest[0]), (state) => recoverRunning(state, rest[1]));
        break;
      case "block":
        requireArgCount(command, rest, 2, 2);
        await mutateState(resolve(rest[0]), (state) => addManualBlocker(state, rest[1]));
        break;
      case "resume":
        requireArgCount(command, rest, 2, 6);
        await mutateState(resolve(rest[0]), (state) => resumeRun(state, rest.slice(1)));
        break;
      case "invalidate-task":
        requireArgCount(command, rest, 5, 5);
        await mutateState(resolve(rest[0]), (state) => invalidateTask(
          state,
          rest[1],
          normalizeRole(rest[2]),
          rest[3],
          rest[4]
        ));
        break;
      case "mark-integrated":
        requireArgCount(command, rest, 1, 2);
        await mutateState(resolve(rest[0]), (state) => markIntegrated(
          state,
          resolveOptionalPath(rest[1])
        ));
        break;
      case "reset-integration":
        requireArgCount(command, rest, 2, 2);
        await mutateState(resolve(rest[0]), (state) => resetIntegration(state, rest[1]));
        break;
      case "assert-ready":
        requireArgCount(command, rest, 1, 3);
        await inspectLockedState(resolve(rest[0]), (state) => assertReady(
          state,
          resolveOptionalPath(rest[1]),
          resolveOptionalPath(rest[2])
        ));
        break;
      case "mark-publishing":
        requireArgCount(command, rest, 2, 3);
        await mutateState(resolve(rest[0]), (state) => markPublishing(
          state,
          ...(rest.length === 2
            ? [undefined, resolve(rest[1])]
            : [resolve(rest[1]), resolve(rest[2])])
        ));
        break;
      case "mark-generated":
        requireArgCount(command, rest, 1, 3);
        await mutateState(resolve(rest[0]), (state) => markGenerated(
          state,
          resolveOptionalPath(rest[1]),
          resolveOptionalPath(rest[2])
        ));
        break;
      case "mark-completed":
        requireArgCount(command, rest, 2, 4);
        await mutateState(resolve(rest[0]), (state) => markCompleted(
          state,
          ...(rest.length === 2
            ? [undefined, undefined, resolve(rest[1])]
            : rest.length === 3
              ? [resolve(rest[1]), undefined, resolve(rest[2])]
              : [resolve(rest[1]), resolve(rest[2]), resolve(rest[3])])
        ));
        break;
      case "assert-completed":
        requireArgCount(command, rest, 1, 4);
        await inspectLockedState(resolve(rest[0]), (state) => assertCompleted(
          state,
          resolveOptionalPath(rest[1]),
          resolveOptionalPath(rest[2]),
          resolveOptionalPath(rest[3])
        ));
        break;
      case "snapshot-working-tree":
        requireArgCount(command, rest, 2, 2);
        console.log(await computeWorkingTreeSnapshot(resolve(rest[0]), rest[1]));
        break;
      default:
        throw new Error(usage());
    }
  } catch (error) {
    console.error(`Run-state command failed: ${error.message}`);
    process.exitCode = 1;
  }
}

function usage() {
  return [
    "Usage:",
    "  node manage-run-state.mjs init <comparison-plan.json> <run-state.json>",
    "  node manage-run-state.mjs status <run-state.json>",
    "  node manage-run-state.mjs start-task <state> <commit> <role> <task-id>",
    "  node manage-run-state.mjs finish-task <state> <task-id> <outcome> [artifact.json] [reason]",
    "  node manage-run-state.mjs recover-task <state> <task-id> <reason>",
    "  node manage-run-state.mjs recover-running <state> <reason>",
    "  node manage-run-state.mjs block <state> <reason>",
    "  node manage-run-state.mjs resume <state> <reason> [--max-worker-attempts N] [--max-correction-rounds N]",
    "  node manage-run-state.mjs invalidate-task <state> <commit> <role> <task-id> <reason>",
    "  node manage-run-state.mjs mark-integrated <state> [review-data.json]",
    "  node manage-run-state.mjs reset-integration <state> <reason>",
    "  node manage-run-state.mjs assert-ready <state> [review-data.json] [output.html]",
    "  node manage-run-state.mjs mark-publishing <state> [review-data.json] <candidate.html>",
    "  node manage-run-state.mjs mark-generated <state> [review-data.json] [output.html]",
    "  node manage-run-state.mjs mark-completed <state> [review-data.json] [output.html] <final-review.json>",
    "  node manage-run-state.mjs assert-completed <state> [review-data.json] [output.html] [final-review.json]",
    "  node manage-run-state.mjs snapshot-working-tree <repository> <comparison-base>",
    "  node manage-run-state.mjs --self-test"
  ].join("\n");
}

function requireArgCount(command, args, minimum, maximum) {
  if (args.length < minimum || args.length > maximum) {
    throw new Error(`${command}: expected ${minimum === maximum ? minimum : `${minimum}-${maximum}`} argument(s)\n${usage()}`);
  }
}

function resolveOptionalPath(value) {
  return value === undefined ? undefined : resolve(value);
}

async function initializeRun(planPath, statePath) {
  await withStateLock(statePath, async (lease) => {
    if (await pathExists(statePath)) {
      throw new Error(`state already exists: ${statePath}; use status/resume instead of reinitializing`);
    }
    const rawPlan = await readJson(planPath, "comparison plan");
    const plan = await normalizeAndValidatePlan(rawPlan, planPath, statePath);
    const now = timestamp();
    const state = {
      schemaVersion: STATE_SCHEMA_VERSION,
      mode: MODE,
      runId: randomUUID(),
      runStatus: "running",
      phase: "investigation",
      createdAt: now,
      updatedAt: now,
      planPath,
      planSha256: sha256Canonical(rawPlan),
      stateIntegritySha256: null,
      repositoryPath: plan.repositoryPath,
      reviewDataPath: plan.reviewDataPath,
      outputPath: plan.outputPath,
      workerCapacity: plan.workerCapacity,
      maxWorkerAttempts: plan.maxWorkerAttempts,
      maxCorrectionRounds: plan.maxCorrectionRounds,
      requestedCommitOrder: plan.requestedCommitOrder,
      commits: plan.commits.map((entry) => ({
        ...entry,
        attempts: [],
        integrated: false,
        integratedReviewUnitSha256: null
      })),
      blockers: [],
      integration: {
        status: "pending",
        reviewDataSha256: null,
        completedAt: null
      },
      publication: {
        status: "pending",
        candidatePath: null,
        candidateSha256: null,
        outputSha256: null,
        generatedAt: null
      },
      finalReview: {
        status: "pending",
        reviewerTaskId: null,
        artifactPath: null,
        artifactSha256: null,
        completedAt: null
      },
      events: [{
        sequence: 1,
        at: now,
        type: "initialized",
        detail: `comparison plan ${sha256Canonical(rawPlan)}`
      }]
    };
    sealState(state);
    validateStateShape(state);
    await lease.assertOwned();
    await writeJsonAtomic(statePath, state);
    console.log(`Run state initialized: ${statePath}`);
  });
}

async function normalizeAndValidatePlan(raw, planPath, statePath) {
  assertObject(raw, "comparison plan");
  const schemaVersion = raw.schemaVersion ?? raw.version;
  requireExact(schemaVersion, PLAN_SCHEMA_VERSION, "comparison plan.schemaVersion");
  const repositoryPath = await requireGitRoot(resolveFrom(dirname(planPath), raw.repositoryPath));
  const reviewDataPath = resolveFrom(dirname(planPath), requireNonEmptyString(raw.reviewDataPath, "comparison plan.reviewDataPath"));
  const outputPath = resolveFrom(dirname(planPath), requireNonEmptyString(raw.outputPath, "comparison plan.outputPath"));
  if (resolve(statePath) === reviewDataPath || resolve(statePath) === outputPath || reviewDataPath === outputPath) {
    throw new Error("state, review-data, and output paths must be distinct");
  }
  const workerCapacity = requireIntegerRange(raw.workerCapacity, 1, MAX_LIMIT, "comparison plan.workerCapacity");
  const maxWorkerAttempts = requireIntegerRange(
    raw.maxWorkerAttempts ?? DEFAULT_MAX_WORKER_ATTEMPTS,
    1,
    MAX_LIMIT,
    "comparison plan.maxWorkerAttempts"
  );
  const maxCorrectionRounds = requireIntegerRange(
    raw.maxCorrectionRounds ?? DEFAULT_MAX_CORRECTION_ROUNDS,
    0,
    MAX_LIMIT,
    "comparison plan.maxCorrectionRounds"
  );
  assertArray(raw.requestedCommitOrder, "comparison plan.requestedCommitOrder");
  assertArray(raw.commits, "comparison plan.commits");
  if (raw.commits.length === 0) {
    throw new Error("comparison plan.commits must contain at least one source");
  }
  if (raw.requestedCommitOrder.length !== raw.commits.length) {
    throw new Error("comparison plan.requestedCommitOrder and commits must have the same length");
  }
  if (raw.commits.length > 1 && workerCapacity < 2) {
    throw new Error("workerCapacity must be at least 2 when more than one commit is requested");
  }
  const requestedCommitOrder = raw.requestedCommitOrder.map((value, index) => (
    requireNonEmptyString(value, `comparison plan.requestedCommitOrder[${index}]`)
  ));
  assertUnique(requestedCommitOrder, "comparison plan.requestedCommitOrder");
  const commits = [];
  for (let index = 0; index < raw.commits.length; index += 1) {
    const location = `comparison plan.commits[${index}]`;
    const item = raw.commits[index];
    assertObject(item, location);
    const commitHash = requireNonEmptyString(item.commitHash ?? item.hash, `${location}.commitHash`);
    if (commitHash !== requestedCommitOrder[index]) {
      throw new Error(`${location}.commitHash must equal requestedCommitOrder[${index}]`);
    }
    const sourceKind = requireNonEmptyString(item.sourceKind, `${location}.sourceKind`);
    if (!VALID_SOURCE_KINDS.has(sourceKind)) {
      throw new Error(`${location}.sourceKind must be "commit" or "working-tree"`);
    }
    const comparisonBase = requireGitObject(item.comparisonBase, `${location}.comparisonBase`).toLowerCase();
    let targetRef;
    let initialSnapshotSha256;
    if (sourceKind === "commit") {
      if (!DISPLAY_COMMIT_PATTERN.test(commitHash)) {
        throw new Error(`${location}.commitHash must be a hexadecimal ID with at least 7 characters`);
      }
      targetRef = requireGitObject(item.targetRef, `${location}.targetRef`).toLowerCase();
      if (!targetRef.startsWith(commitHash.toLowerCase())) {
        throw new Error(`${location}.targetRef must start with display commit ID ${commitHash}`);
      }
      await validateCommitAndBase(repositoryPath, targetRef, comparisonBase, location);
      if (item.initialSnapshotSha256 !== undefined) {
        throw new Error(`${location}: commit sources must not include initialSnapshotSha256`);
      }
    } else {
      requireExact(commitHash, "working-tree", `${location}.commitHash`);
      requireExact(item.targetRef, "WORKING_TREE", `${location}.targetRef`);
      targetRef = "WORKING_TREE";
      const head = await resolveCommit(repositoryPath, "HEAD");
      if (head !== comparisonBase) {
        throw new Error(`${location}.comparisonBase must equal the repository HEAD ${head}`);
      }
      initialSnapshotSha256 = requireSha256(item.initialSnapshotSha256, `${location}.initialSnapshotSha256`).toLowerCase();
      const actualSnapshot = await computeWorkingTreeSnapshot(repositoryPath, comparisonBase);
      if (actualSnapshot !== initialSnapshotSha256) {
        throw new Error(`${location}.initialSnapshotSha256 does not match the current working tree (${actualSnapshot})`);
      }
      for (const protectedPath of [reviewDataPath, outputPath, resolve(statePath), resolve(planPath)]) {
        if (isPathInside(repositoryPath, protectedPath)) {
          throw new Error(`working-tree runs require plan, state, review-data, and output paths outside the repository: ${protectedPath}`);
        }
      }
    }
    commits.push({
      commitHash,
      sourceKind,
      targetRef,
      comparisonBase,
      ...(initialSnapshotSha256 ? { initialSnapshotSha256 } : {}),
      investigationBatch: Math.floor(index / workerCapacity) + 1
    });
  }
  const workingTrees = commits.filter((entry) => entry.sourceKind === "working-tree");
  if (workingTrees.length > 1) {
    throw new Error("a comparison plan may contain at most one working-tree source");
  }
  return {
    repositoryPath,
    reviewDataPath,
    outputPath,
    workerCapacity,
    maxWorkerAttempts,
    maxCorrectionRounds,
    requestedCommitOrder,
    commits
  };
}

async function requireGitRoot(path) {
  const requested = await realpath(path).catch((error) => {
    throw new Error(`cannot resolve repositoryPath ${path}: ${error.message}`);
  });
  const root = (await git(requested, ["rev-parse", "--show-toplevel"])).trim();
  const actual = await realpath(root);
  if (actual !== requested) {
    throw new Error(`repositoryPath must be the exact Git worktree root ${actual}, not ${requested}`);
  }
  return actual;
}

async function validateCommitAndBase(repositoryPath, targetRef, comparisonBase, location) {
  const target = await resolveCommit(repositoryPath, targetRef);
  if (target !== targetRef) {
    throw new Error(`${location}.targetRef does not resolve to itself (${target})`);
  }
  const parentsText = (await git(repositoryPath, ["show", "-s", "--format=%P", targetRef])).trim();
  const parents = parentsText === "" ? [] : parentsText.split(/\s+/).map((value) => value.toLowerCase());
  if (parents.length === 0) {
    const emptyTree = await gitEmptyTree(repositoryPath);
    if (comparisonBase !== emptyTree) {
      throw new Error(`${location}.comparisonBase must be Git's empty tree ${emptyTree} for a root commit`);
    }
    return;
  }
  const resolvedBase = await resolveCommit(repositoryPath, comparisonBase).catch(() => null);
  if (resolvedBase === null || resolvedBase !== comparisonBase || !parents.includes(comparisonBase)) {
    throw new Error(`${location}.comparisonBase must be one of targetRef's actual parents: ${parents.join(", ")}`);
  }
}

async function resolveCommit(repositoryPath, ref) {
  return (await git(repositoryPath, ["rev-parse", "--verify", `${ref}^{commit}`])).trim().toLowerCase();
}

async function gitEmptyTree(repositoryPath) {
  return (await git(repositoryPath, ["hash-object", "-t", "tree", "--stdin"], { input: "" })).trim().toLowerCase();
}

async function computeWorkingTreeSnapshot(repositoryPath, comparisonBase) {
  const root = await requireGitRoot(repositoryPath);
  const base = requireGitObject(comparisonBase, "comparison-base").toLowerCase();
  const head = await resolveCommit(root, "HEAD");
  if (base !== head) {
    throw new Error(`comparison-base must equal HEAD ${head}`);
  }
  const [statusBuffer, worktreeDiff, indexDiff] = await Promise.all([
    git(root, ["status", "--porcelain=v2", "-z", "--untracked-files=all"], { encoding: null }),
    git(root, ["diff", "--binary", "--full-index", base, "--"], { encoding: null }),
    git(root, ["diff", "--cached", "--binary", "--full-index", base, "--"], { encoding: null })
  ]);
  const untracked = parseUntrackedPaths(statusBuffer);
  const hash = createHash("sha256");
  hash.update("code-change-flow-report-working-tree-v1\0", "utf8");
  updateLengthPrefixed(hash, Buffer.from(base, "utf8"));
  updateLengthPrefixed(hash, statusBuffer);
  updateLengthPrefixed(hash, worktreeDiff);
  updateLengthPrefixed(hash, indexDiff);
  for (const relativePath of untracked.sort(compareUtf8)) {
    validateRepositoryRelativePath(relativePath, "untracked path");
    const fullPath = resolve(root, relativePath);
    if (!isPathInside(root, fullPath)) {
      throw new Error(`untracked path escapes repository: ${relativePath}`);
    }
    const info = await lstat(fullPath);
    updateLengthPrefixed(hash, Buffer.from(relativePath, "utf8"));
    if (info.isSymbolicLink()) {
      updateLengthPrefixed(hash, Buffer.from("symlink", "utf8"));
      updateLengthPrefixed(hash, Buffer.from(await readlink(fullPath), "utf8"));
    } else if (info.isFile()) {
      updateLengthPrefixed(hash, Buffer.from("file", "utf8"));
      updateLengthPrefixed(hash, await readFile(fullPath));
    } else {
      updateLengthPrefixed(hash, Buffer.from(`other:${info.mode}`, "utf8"));
    }
  }
  return hash.digest("hex");
}

function parseUntrackedPaths(statusBuffer) {
  return statusBuffer
    .toString("utf8")
    .split("\0")
    .filter((entry) => entry.startsWith("? "))
    .map((entry) => entry.slice(2));
}

function updateLengthPrefixed(hash, buffer) {
  hash.update(Buffer.from(`${buffer.length}:`, "utf8"));
  hash.update(buffer);
  hash.update(Buffer.from("\0", "utf8"));
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

async function git(repositoryPath, args, options = {}) {
  const encoding = options.encoding === null ? null : "utf8";
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("git", ["-C", repositoryPath, ...args], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => rejectPromise(new Error(`git ${args[0]} failed: ${error.message}`)));
    child.on("close", (code) => {
      const output = Buffer.concat(stdout);
      const errorText = Buffer.concat(stderr).toString("utf8").trim();
      if (code !== 0) {
        rejectPromise(new Error(`git ${args.join(" ")} failed${errorText ? `: ${errorText}` : ` with exit code ${code}`}`));
        return;
      }
      resolvePromise(encoding === null ? output : output.toString(encoding));
    });
    if (options.input !== undefined) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

async function printStatus(statePath) {
  await inspectLockedState(statePath, async (state) => {
    await refreshAndValidateExternalInputs(state, { requireReport: false });
    console.log(JSON.stringify(statusSummary(state), null, 2));
  });
}

function statusSummary(state) {
  return {
    runId: state.runId,
    runStatus: state.runStatus,
    phase: state.phase,
    completed: state.runStatus === "completed",
    commits: state.commits.map((entry) => ({
      commitHash: entry.commitHash,
      nextAction: nextActionForCommit(state, entry),
      activeAttempts: entry.attempts.filter((attempt) => !attempt.invalidatedAt).map((attempt) => ({
        taskId: attempt.taskId,
        role: attempt.role,
        status: attempt.status,
        outcome: attempt.outcome ?? null,
        batch: attempt.batch
      }))
    })),
    openBlockers: state.blockers.filter((blocker) => blocker.resolvedAt === null),
    integration: state.integration.status,
    publication: state.publication.status,
    finalReview: state.finalReview.status,
    updatedAt: state.updatedAt
  };
}

function nextActionForCommit(state, entry) {
  const running = activeAttempts(entry).find((attempt) => attempt.status === "running");
  if (running) return `finish-or-recover:${running.taskId}`;
  const revision = currentRevisionAttempt(entry);
  if (!revision) return "start-investigator";
  const verifier = latestVerifierForRevision(entry, revision);
  if (!verifier) return "start-verifier";
  if (verifier.outcome === "passed") return "verified";
  if (verifier.outcome === "issues") {
    return completedCorrectionCount(entry) >= state.maxCorrectionRounds
      ? "blocked-correction-limit"
      : "start-correction";
  }
  return "start-verifier";
}

async function mutateState(statePath, callback, options = {}) {
  return withStateLock(statePath, async (lease) => {
    const state = await readState(statePath);
    const result = await callback(state);
    state.updatedAt = timestamp();
    sealState(state);
    validateStateShape(state);
    await lease.assertOwned();
    await writeJsonAtomic(statePath, state);
    if (!options.quiet && typeof result === "string" && result !== "") console.log(result);
    return result;
  });
}

async function inspectLockedState(statePath, callback) {
  return withStateLock(statePath, async () => callback(await readState(statePath)));
}

async function readState(statePath) {
  const state = await readJson(statePath, "run state");
  validateStateShape(state);
  await validateStatePlanBinding(state, statePath);
  return state;
}

async function validateStatePlanBinding(state, statePath) {
  const planPath = resolve(requireNonEmptyString(state.planPath, "run state.planPath"));
  const rawPlan = await readJson(planPath, "comparison plan");
  requireExact(sha256Canonical(rawPlan), state.planSha256, "comparison plan SHA-256");
  const plan = await normalizeAndValidatePlan(rawPlan, planPath, statePath);
  requireExact(plan.repositoryPath, state.repositoryPath, "run state.repositoryPath");
  requireExact(plan.reviewDataPath, state.reviewDataPath, "run state.reviewDataPath");
  requireExact(plan.outputPath, state.outputPath, "run state.outputPath");
  requireExact(plan.workerCapacity, state.workerCapacity, "run state.workerCapacity");
  if (state.maxWorkerAttempts < plan.maxWorkerAttempts) {
    throw new Error("run state.maxWorkerAttempts cannot be lower than the comparison plan");
  }
  if (state.maxCorrectionRounds < plan.maxCorrectionRounds) {
    throw new Error("run state.maxCorrectionRounds cannot be lower than the comparison plan");
  }
  assertExactArray(state.requestedCommitOrder, plan.requestedCommitOrder, "run state.requestedCommitOrder");
  if (state.commits.length !== plan.commits.length) {
    throw new Error("run state.commits length does not match comparison plan");
  }
  for (let index = 0; index < plan.commits.length; index += 1) {
    const expected = plan.commits[index];
    const actual = state.commits[index];
    for (const field of ["commitHash", "sourceKind", "targetRef", "comparisonBase", "investigationBatch"]) {
      requireExact(actual[field], expected[field], `run state.commits[${index}].${field}`);
    }
    if (expected.sourceKind === "working-tree") {
      requireExact(
        actual.initialSnapshotSha256,
        expected.initialSnapshotSha256,
        `run state.commits[${index}].initialSnapshotSha256`
      );
    }
  }
}

async function withStateLock(statePath, callback) {
  await mkdir(dirname(statePath), { recursive: true });
  const lockPath = `${statePath}.lock`;
  const ownerPath = join(lockPath, "owner.json");
  const start = Date.now();
  const token = randomUUID();
  while (true) {
    try {
      await mkdir(lockPath);
      await writeFile(
        ownerPath,
        JSON.stringify({
          pid: process.pid,
          token,
          createdAt: timestamp(),
          heartbeatIntervalMs: LOCK_HEARTBEAT_MS,
          leaseMs: LOCK_LEASE_MS
        }),
        { flag: "wx" }
      );
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (await mayRecoverStaleLock(lockPath)) {
        continue;
      }
      if (Date.now() - start >= LOCK_TIMEOUT_MS) {
        throw new Error(`timed out waiting for run-state lock ${lockPath}`);
      }
      await delay(LOCK_POLL_MS);
    }
  }
  let heartbeatFailure = null;
  let heartbeatWork = Promise.resolve();
  const heartbeat = () => {
    heartbeatWork = heartbeatWork.then(async () => {
      if (heartbeatFailure !== null) return;
      try {
        const now = new Date();
        await utimes(ownerPath, now, now);
      } catch (error) {
        heartbeatFailure = new Error(`run-state lock heartbeat failed: ${error.message}`);
      }
    });
  };
  const heartbeatTimer = setInterval(heartbeat, LOCK_HEARTBEAT_MS);
  heartbeatTimer.unref();
  const lease = {
    assertOwned: async () => {
      await heartbeatWork;
      if (heartbeatFailure !== null) throw heartbeatFailure;
      if (await pathExists(join(lockPath, "recovery"))) {
        throw new Error("run-state lock lease is being recovered; retry the command");
      }
      const owner = await readJson(ownerPath, "lock owner").catch(() => null);
      if (owner?.token !== token) {
        throw new Error("run-state lock ownership changed before state write; retry the command");
      }
      const now = new Date();
      await utimes(ownerPath, now, now);
    }
  };
  try {
    return await callback(lease);
  } finally {
    clearInterval(heartbeatTimer);
    await heartbeatWork.catch(() => {});
    const owner = await readJson(ownerPath, "lock owner").catch(() => null);
    if (owner?.token === token) {
      await rm(lockPath, { recursive: true, force: true });
    }
  }
}

async function mayRecoverStaleLock(lockPath) {
  const ownerPath = join(lockPath, "owner.json");
  const recoveryPath = join(lockPath, "recovery");
  const ownerInfo = await stat(ownerPath).catch(() => null);
  const lockInfo = ownerInfo ?? await stat(lockPath).catch(() => null);
  if (lockInfo === null || Date.now() - lockInfo.mtimeMs < LOCK_LEASE_MS) return false;
  try {
    await mkdir(recoveryPath);
  } catch (error) {
    if (error.code === "ENOENT") return true;
    if (error.code !== "EEXIST") throw error;
    const recoveryInfo = await stat(recoveryPath).catch(() => null);
    if (recoveryInfo && Date.now() - recoveryInfo.mtimeMs >= LOCK_LEASE_MS) {
      await rm(recoveryPath, { recursive: true, force: true });
    }
    return false;
  }
  const observedMtime = ownerInfo?.mtimeMs ?? null;
  await delay(LOCK_RECOVERY_GRACE_MS);
  const refreshedOwner = await stat(ownerPath).catch(() => null);
  if (observedMtime !== null && refreshedOwner !== null && refreshedOwner.mtimeMs > observedMtime) {
    await rm(recoveryPath, { recursive: true, force: true });
    return false;
  }
  await rm(lockPath, { recursive: true, force: true });
  return true;
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = join(dirname(path), `.${basename(path)}.tmp.${process.pid}.${randomUUID()}`);
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, path);
    const directoryHandle = await open(dirname(path), "r").catch(() => null);
    if (directoryHandle) {
      await directoryHandle.sync().catch(() => {});
      await directoryHandle.close();
    }
  } finally {
    if (handle) await handle.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

function validateStateShape(state) {
  assertObject(state, "run state");
  requireExact(state.schemaVersion, STATE_SCHEMA_VERSION, "run state.schemaVersion");
  requireExact(state.mode, MODE, "run state.mode");
  requireNonEmptyString(state.runId, "run state.runId");
  requireNonEmptyString(state.runStatus, "run state.runStatus");
  requireNonEmptyString(state.phase, "run state.phase");
  requireNonEmptyString(state.repositoryPath, "run state.repositoryPath");
  requireNonEmptyString(state.reviewDataPath, "run state.reviewDataPath");
  requireNonEmptyString(state.outputPath, "run state.outputPath");
  requireSha256(state.planSha256, "run state.planSha256");
  requireSha256(state.stateIntegritySha256, "run state.stateIntegritySha256");
  requireExact(state.stateIntegritySha256, calculateStateIntegrity(state), "run state integrity SHA-256");
  requireIntegerRange(state.workerCapacity, 1, MAX_LIMIT, "run state.workerCapacity");
  requireIntegerRange(state.maxWorkerAttempts, 1, MAX_LIMIT, "run state.maxWorkerAttempts");
  requireIntegerRange(state.maxCorrectionRounds, 0, MAX_LIMIT, "run state.maxCorrectionRounds");
  assertArray(state.requestedCommitOrder, "run state.requestedCommitOrder");
  assertArray(state.commits, "run state.commits");
  assertArray(state.blockers, "run state.blockers");
  assertArray(state.events, "run state.events");
  assertObject(state.integration, "run state.integration");
  assertObject(state.publication, "run state.publication");
  assertObject(state.finalReview, "run state.finalReview");
  if (state.commits.length !== state.requestedCommitOrder.length) {
    throw new Error("run state commits/order length mismatch");
  }
  const taskIds = new Set();
  state.commits.forEach((entry, index) => {
    assertObject(entry, `run state.commits[${index}]`);
    requireExact(entry.commitHash, state.requestedCommitOrder[index], `run state.commits[${index}].commitHash`);
    assertArray(entry.attempts, `run state.commits[${index}].attempts`);
    entry.attempts.forEach((attempt, attemptIndex) => {
      assertObject(attempt, `run state.commits[${index}].attempts[${attemptIndex}]`);
      requireNonEmptyString(attempt.taskId, `attempt ${attemptIndex}.taskId`);
      if (taskIds.has(attempt.taskId)) throw new Error(`duplicate taskId in run state: ${attempt.taskId}`);
      taskIds.add(attempt.taskId);
      if (!VALID_ROLES.has(attempt.role)) throw new Error(`invalid task role in run state: ${attempt.role}`);
      requireIntegerRange(attempt.batch, 1, Number.MAX_SAFE_INTEGER, `attempt ${attempt.taskId}.batch`);
    });
  });
}

function calculateStateIntegrity(state) {
  const { stateIntegritySha256: _ignored, ...payload } = state;
  return sha256Canonical(payload);
}

function sealState(state) {
  state.stateIntegritySha256 = calculateStateIntegrity(state);
}

async function startTask(state, commitHash, role, taskId) {
  ensureMutablePipeline(state, "start a task");
  requireNonEmptyString(taskId, "task-id");
  if (allAttempts(state).some((attempt) => attempt.taskId === taskId)) {
    throw new Error(`task-id has already been used and cannot be reused: ${taskId}`);
  }
  const entry = findCommit(state, commitHash);
  if (activeAttempts(entry).some((attempt) => attempt.status === "running")) {
    throw new Error(`commit ${commitHash} already has a running task`);
  }
  const runningCount = runningAttempts(state).length;
  if (runningCount >= state.workerCapacity) {
    throw new Error(`worker capacity ${state.workerCapacity} is already full`);
  }
  assertTaskMayStart(state, entry, role);
  const batch = selectBatch(state, entry, role);
  const now = timestamp();
  entry.attempts.push({
    taskId,
    role,
    batch,
    status: "running",
    outcome: null,
    startedAt: now,
    finishedAt: null,
    artifactPath: null,
    artifactSha256: null,
    reviewUnitSha256: null,
    inputReviewUnitSha256: currentRevisionAttempt(entry)?.reviewUnitSha256 ?? null,
    issueCount: null,
    reason: null,
    invalidatedAt: null,
    invalidationReason: null
  });
  recordEvent(state, "task-started", `${commitHash} ${role} ${taskId} batch ${batch}`);
  refreshRunStatus(state);
  return `Task started: ${taskId} (${commitHash}, ${role}, batch ${batch})`;
}

function assertTaskMayStart(state, entry, role) {
  const revision = currentRevisionAttempt(entry);
  if (role === "investigator") {
    if (revision) throw new Error(`commit ${entry.commitHash} already has a completed investigation revision`);
    if (workerFailureCount(entry, role) >= state.maxWorkerAttempts) {
      throw new Error(`investigator retry limit reached for ${entry.commitHash}`);
    }
    const priorBatchesIncomplete = state.commits.some((candidate) => (
      candidate.investigationBatch < entry.investigationBatch
      && !hasSuccessfulInvestigation(candidate)
    ));
    if (priorBatchesIncomplete) {
      throw new Error(`investigation batch ${entry.investigationBatch} cannot start before earlier batches complete`);
    }
    return;
  }
  if (!revision) throw new Error(`${role} requires a completed investigation revision for ${entry.commitHash}`);
  const latestVerifier = latestVerifierForRevision(entry, revision);
  if (role === "verifier") {
    if (latestVerifier?.outcome === "passed") {
      throw new Error(`current revision for ${entry.commitHash} is already verified`);
    }
    if (latestVerifier?.outcome === "issues") {
      throw new Error(`current revision for ${entry.commitHash} has unresolved issues; run correction first`);
    }
    if (workerFailureCountForRevision(entry, role, revision.reviewUnitSha256) >= state.maxWorkerAttempts) {
      throw new Error(`verifier retry limit reached for ${entry.commitHash}`);
    }
    return;
  }
  if (!latestVerifier || latestVerifier.outcome !== "issues") {
    throw new Error(`correction requires a failed verification with recorded issues for ${entry.commitHash}`);
  }
  if (completedCorrectionCount(entry) >= state.maxCorrectionRounds) {
    throw new Error(`correction limit ${state.maxCorrectionRounds} reached for ${entry.commitHash}`);
  }
  if (workerFailureCountForRevision(entry, role, revision.reviewUnitSha256) >= state.maxWorkerAttempts) {
    throw new Error(`correction worker retry limit reached for ${entry.commitHash}`);
  }
}

function selectBatch(state, entry, role) {
  if (role === "investigator") return entry.investigationBatch;
  const sameRoleRunning = runningAttempts(state).filter((item) => item.attempt.role === role);
  const ownPrevious = activeAttempts(entry)
    .filter((attempt) => attempt.role === role)
    .reduce((maximum, attempt) => Math.max(maximum, attempt.batch), 0);
  if (sameRoleRunning.length > 0) {
    const candidate = sameRoleRunning[0].attempt.batch;
    if (candidate > ownPrevious && sameRoleRunning.filter((item) => item.attempt.batch === candidate).length < state.workerCapacity) {
      return candidate;
    }
  }
  const globalMaximum = allAttempts(state)
    .filter((attempt) => attempt.role === role)
    .reduce((maximum, attempt) => Math.max(maximum, attempt.batch), 0);
  return Math.max(globalMaximum + 1, ownPrevious + 1, 1);
}

async function finishTask(state, taskId, rawOutcome, artifactOrReason, explicitReason) {
  ensureTaskSettlementAllowed(state, "finish a task");
  const { entry, attempt } = findAttempt(state, taskId);
  if (attempt.status !== "running") {
    throw new Error(`task ${taskId} is not running (status ${attempt.status})`);
  }
  const finish = classifyFinish(attempt.role, rawOutcome, artifactOrReason, explicitReason);
  if (finish.kind === "evidence") {
    const evidence = await loadAndValidateEvidence(state, entry, attempt, finish.artifactPath, finish.outcome);
    if (attempt.role === "investigator") {
      assertInvestigationBatchStarted(state, entry.investigationBatch);
    }
    attempt.status = "completed";
    attempt.outcome = finish.outcome;
    attempt.finishedAt = timestamp();
    attempt.artifactPath = evidence.path;
    attempt.artifactSha256 = evidence.sha256;
    attempt.reviewUnitSha256 = evidence.reviewUnitSha256;
    attempt.issueCount = evidence.issueCount;
    recordEvent(state, "task-finished", `${entry.commitHash} ${attempt.role} ${taskId} ${finish.outcome}`);
    if (attempt.role === "verifier" && finish.outcome === "issues") {
      if (completedCorrectionCount(entry) >= state.maxCorrectionRounds) {
        addLimitBlocker(
          state,
          "correction-limit",
          entry.commitHash,
          attempt.role,
          `verification issues remain after ${completedCorrectionCount(entry)} correction round(s)`
        );
      }
    }
  } else {
    attempt.status = finish.outcome === "interrupted" ? "interrupted" : "failed";
    attempt.outcome = finish.outcome;
    attempt.finishedAt = timestamp();
    attempt.reason = requireNonEmptyString(finish.reason, "failure reason");
    recordEvent(state, "task-failed", `${entry.commitHash} ${attempt.role} ${taskId}: ${attempt.reason}`);
    const failureCount = attempt.role === "investigator"
      ? workerFailureCount(entry, attempt.role)
      : workerFailureCountForRevision(entry, attempt.role, attempt.inputReviewUnitSha256);
    if (failureCount >= state.maxWorkerAttempts) {
      addLimitBlocker(
        state,
        "worker-attempt-limit",
        entry.commitHash,
        attempt.role,
        `${attempt.role} failed or was interrupted ${failureCount} time(s)`
      );
    }
  }
  refreshRunStatus(state);
  return `Task finished: ${taskId} (${attempt.outcome})`;
}

function classifyFinish(role, rawOutcome, artifactOrReason, explicitReason) {
  const outcome = requireNonEmptyString(rawOutcome, "outcome").toLowerCase();
  if (role !== "verifier" && outcome === "completed") {
    return { kind: "evidence", outcome: "completed", artifactPath: requireNonEmptyString(artifactOrReason, "artifact path") };
  }
  if (role === "verifier" && outcome === "passed") {
    return { kind: "evidence", outcome: "passed", artifactPath: requireNonEmptyString(artifactOrReason, "artifact path") };
  }
  if (role === "verifier" && ["issues", "verification-failed", "failed-verification"].includes(outcome)) {
    return { kind: "evidence", outcome: "issues", artifactPath: requireNonEmptyString(artifactOrReason, "artifact path") };
  }
  if (role === "verifier" && outcome === "failed" && artifactOrReason && extname(artifactOrReason).toLowerCase() === ".json") {
    return { kind: "evidence", outcome: "issues", artifactPath: artifactOrReason };
  }
  if (["failed", "worker-failed", "error", "interrupted"].includes(outcome)) {
    return {
      kind: "worker-failure",
      outcome: outcome === "interrupted" ? "interrupted" : "worker-failed",
      reason: explicitReason ?? artifactOrReason
    };
  }
  throw new Error(`outcome ${JSON.stringify(rawOutcome)} is invalid for role ${role}`);
}

async function loadAndValidateEvidence(state, entry, attempt, rawPath, expectedOutcome) {
  const path = resolve(rawPath);
  await assertRegularContainedJson(path, dirname(state.reviewDataPath), "evidence artifact");
  const source = await readFile(path);
  const artifact = parseJson(source.toString("utf8"), `evidence artifact ${path}`);
  assertObject(artifact, "evidence artifact");
  requireExact(artifact.schemaVersion, EVIDENCE_SCHEMA_VERSION, "evidence artifact.schemaVersion");
  requireExact(artifact.taskId, attempt.taskId, "evidence artifact.taskId");
  requireExact(artifact.commitHash, entry.commitHash, "evidence artifact.commitHash");
  requireExact(artifact.sourceKind, entry.sourceKind, "evidence artifact.sourceKind");
  requireExact(artifact.targetRef, entry.targetRef, "evidence artifact.targetRef");
  requireExact(artifact.comparisonBase.toLowerCase(), entry.comparisonBase, "evidence artifact.comparisonBase");
  if (entry.sourceKind === "working-tree") {
    requireExact(
      requireSha256(artifact.snapshotSha256, "evidence artifact.snapshotSha256").toLowerCase(),
      entry.initialSnapshotSha256,
      "evidence artifact.snapshotSha256"
    );
  }
  let reviewUnitSha256;
  let issueCount = 0;
  if (attempt.role === "investigator" || attempt.role === "correction") {
    requireExact(artifact.role, "investigator", "evidence artifact.role");
    requireExact(artifact.status, "completed", "evidence artifact.status");
    reviewUnitSha256 = requireSha256(artifact.reviewUnitSha256, "evidence artifact.reviewUnitSha256").toLowerCase();
    if (attempt.role === "correction") {
      const priorRevision = currentRevisionAttempt(entry, attempt);
      const failedVerifier = latestVerifierForRevision(entry, priorRevision, attempt);
      const linkedTaskIds = [
        artifact.supersedesTaskId,
        artifact.correctsTaskId,
        artifact.correctionOfTaskId
      ].filter((value) => typeof value === "string");
      if (!linkedTaskIds.includes(priorRevision.taskId) && !linkedTaskIds.includes(failedVerifier?.taskId)) {
        throw new Error("correction evidence must link to the prior investigation or failed verifier via supersedesTaskId, correctsTaskId, or correctionOfTaskId");
      }
      if (reviewUnitSha256 === priorRevision.reviewUnitSha256) {
        throw new Error("correction evidence must have a changed reviewUnitSha256");
      }
    }
  } else {
    requireExact(artifact.role, "verifier", "evidence artifact.role");
    requireExact(artifact.freshContext, true, "evidence artifact.freshContext");
    const artifactStatus = expectedOutcome === "passed" ? "passed" : "failed";
    requireExact(artifact.status, artifactStatus, "evidence artifact.status");
    issueCount = requireIntegerRange(artifact.issueCount, 0, Number.MAX_SAFE_INTEGER, "evidence artifact.issueCount");
    assertArray(artifact.issues, "evidence artifact.issues");
    if (artifact.issues.length !== issueCount) {
      throw new Error("evidence artifact.issues length must equal issueCount");
    }
    artifact.issues.forEach((issue, index) => {
      assertObject(issue, `evidence artifact.issues[${index}]`);
      requireNonEmptyString(issue.stepId, `evidence artifact.issues[${index}].stepId`);
      requireNonEmptyString(issue.evidence, `evidence artifact.issues[${index}].evidence`);
      requireNonEmptyString(issue.requiredCorrection, `evidence artifact.issues[${index}].requiredCorrection`);
    });
    if ((expectedOutcome === "passed") !== (issueCount === 0)) {
      throw new Error(expectedOutcome === "passed"
        ? "passed verifier evidence must have issueCount 0"
        : "failed verifier evidence must have at least one issue");
    }
    reviewUnitSha256 = requireSha256(
      artifact.verifiedReviewUnitSha256,
      "evidence artifact.verifiedReviewUnitSha256"
    ).toLowerCase();
    const revision = currentRevisionAttempt(entry, attempt);
    if (!revision) throw new Error("verifier evidence has no current investigation revision");
    await assertAttemptArtifactUnchanged(revision);
    if (reviewUnitSha256 !== revision.reviewUnitSha256 || attempt.inputReviewUnitSha256 !== revision.reviewUnitSha256) {
      throw new Error("verifier evidence digest does not match the current investigation revision");
    }
  }
  return {
    path,
    sha256: sha256Buffer(source),
    reviewUnitSha256,
    issueCount
  };
}

async function assertRegularContainedJson(path, allowedDirectory, label) {
  if (extname(path).toLowerCase() !== ".json") throw new Error(`${label} must be a .json file`);
  const allowed = await realpath(allowedDirectory).catch(async (error) => {
    if (error.code !== "ENOENT") throw error;
    await mkdir(allowedDirectory, { recursive: true });
    return realpath(allowedDirectory);
  });
  const info = await lstat(path).catch((error) => {
    throw new Error(`${label} cannot be read: ${error.message}`);
  });
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be an existing regular file, not a symlink`);
  const actual = await realpath(path);
  if (!isPathInside(allowed, actual)) throw new Error(`${label} must stay inside ${allowedDirectory}`);
}

function assertInvestigationBatchStarted(state, batch) {
  const members = state.commits.filter((entry) => entry.investigationBatch === batch);
  const missing = members.filter((entry) => !entry.attempts.some((attempt) => attempt.role === "investigator"));
  if (missing.length > 0) {
    throw new Error(`investigation batch ${batch} cannot finish before all members start: ${missing.map((entry) => entry.commitHash).join(", ")}`);
  }
}

async function recoverTask(state, taskId, reason) {
  ensureTaskSettlementAllowed(state, "recover a task");
  const { entry, attempt } = findAttempt(state, taskId);
  if (attempt.status !== "running") throw new Error(`task ${taskId} is not running`);
  attempt.status = "interrupted";
  attempt.outcome = "interrupted";
  attempt.finishedAt = timestamp();
  attempt.reason = requireNonEmptyString(reason, "recovery reason");
  recordEvent(state, "task-recovered", `${entry.commitHash} ${attempt.role} ${taskId}: ${reason}`);
  const count = attempt.role === "investigator"
    ? workerFailureCount(entry, attempt.role)
    : workerFailureCountForRevision(entry, attempt.role, attempt.inputReviewUnitSha256);
  if (count >= state.maxWorkerAttempts) {
    addLimitBlocker(state, "worker-attempt-limit", entry.commitHash, attempt.role, `${attempt.role} interrupted ${count} time(s)`);
  }
  refreshRunStatus(state);
  return `Task recovered: ${taskId}; retry remains ${Math.max(0, state.maxWorkerAttempts - count)}`;
}

async function recoverRunning(state, reason) {
  ensureTaskSettlementAllowed(state, "recover running tasks");
  const running = runningAttempts(state);
  if (running.length === 0) throw new Error("there are no running tasks to recover");
  requireNonEmptyString(reason, "recovery reason");
  for (const item of running) {
    item.attempt.status = "interrupted";
    item.attempt.outcome = "interrupted";
    item.attempt.finishedAt = timestamp();
    item.attempt.reason = reason;
    const count = item.attempt.role === "investigator"
      ? workerFailureCount(item.entry, item.attempt.role)
      : workerFailureCountForRevision(item.entry, item.attempt.role, item.attempt.inputReviewUnitSha256);
    if (count >= state.maxWorkerAttempts) {
      addLimitBlocker(state, "worker-attempt-limit", item.entry.commitHash, item.attempt.role, `${item.attempt.role} interrupted ${count} time(s)`);
    }
  }
  recordEvent(state, "running-tasks-recovered", `${running.length} task(s): ${reason}`);
  refreshRunStatus(state);
  return `Recovered ${running.length} running task(s); this command records the coordinator's confirmation that every listed task was no longer executing`;
}

async function addManualBlocker(state, reason) {
  if (state.runStatus === "completed") throw new Error("completed runs must be reset before adding a blocker");
  requireNonEmptyString(reason, "block reason");
  addBlocker(state, "manual", null, null, reason);
  refreshRunStatus(state);
  return `Run blocked: ${reason}`;
}

function resumeRun(state, args) {
  if (state.runStatus !== "blocked") throw new Error(`resume requires blocked state, found ${state.runStatus}`);
  if (runningAttempts(state).length > 0) {
    throw new Error("finish or recover every running task before resolving blockers");
  }
  const { reason, maxWorkerAttempts, maxCorrectionRounds } = parseResumeArguments(args);
  const proposedWorker = maxWorkerAttempts ?? state.maxWorkerAttempts;
  const proposedCorrections = maxCorrectionRounds ?? state.maxCorrectionRounds;
  if (proposedWorker < state.maxWorkerAttempts || proposedCorrections < state.maxCorrectionRounds) {
    throw new Error("resume limits may only stay the same or increase");
  }
  requireIntegerRange(proposedWorker, 1, MAX_LIMIT, "maxWorkerAttempts");
  requireIntegerRange(proposedCorrections, 0, MAX_LIMIT, "maxCorrectionRounds");
  for (const blocker of openBlockers(state)) {
    if (blocker.type === "worker-attempt-limit") {
      const entry = findCommit(state, blocker.commitHash);
      const observed = blocker.role === "investigator"
        ? workerFailureCount(entry, blocker.role)
        : maximumWorkerFailureCount(entry, blocker.role);
      if (proposedWorker <= observed) {
        throw new Error(`maxWorkerAttempts must be greater than observed failure count ${observed} for ${blocker.commitHash}/${blocker.role}`);
      }
    }
    if (blocker.type === "correction-limit") {
      const observed = completedCorrectionCount(findCommit(state, blocker.commitHash));
      if (proposedCorrections <= observed) {
        throw new Error(`maxCorrectionRounds must be greater than completed correction count ${observed} for ${blocker.commitHash}`);
      }
    }
  }
  state.maxWorkerAttempts = proposedWorker;
  state.maxCorrectionRounds = proposedCorrections;
  const now = timestamp();
  for (const blocker of openBlockers(state)) {
    blocker.resolvedAt = now;
    blocker.resolution = reason;
  }
  recordEvent(state, "resumed", `${reason}; worker=${proposedWorker}, corrections=${proposedCorrections}`);
  refreshRunStatus(state);
  return `Run resumed: worker attempts ${proposedWorker}, correction rounds ${proposedCorrections}`;
}

function parseResumeArguments(args) {
  const reason = requireNonEmptyString(args[0], "resume reason");
  let maxWorkerAttempts;
  let maxCorrectionRounds;
  for (let index = 1; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (value === undefined) throw new Error(`missing value for resume option ${option}`);
    const parsed = Number(value);
    if (option === "--max-worker-attempts") maxWorkerAttempts = parsed;
    else if (option === "--max-correction-rounds") maxCorrectionRounds = parsed;
    else throw new Error(`unknown resume option ${option}`);
  }
  return { reason, maxWorkerAttempts, maxCorrectionRounds };
}

function invalidateTask(state, commitHash, role, taskId, reason) {
  if (runningAttempts(state).length > 0) {
    throw new Error("recover or finish every running task before invalidating an attempt");
  }
  requireNonEmptyString(reason, "invalidation reason");
  const entry = findCommit(state, commitHash);
  const index = entry.attempts.findIndex((attempt) => attempt.taskId === taskId && attempt.role === role);
  if (index < 0) throw new Error(`cannot find ${role} task ${taskId} for ${commitHash}`);
  const selected = entry.attempts[index];
  if (selected.invalidatedAt) throw new Error(`task ${taskId} is already invalidated`);
  if (selected.status === "running") throw new Error(`task ${taskId} is still running`);
  const now = timestamp();
  for (let current = index; current < entry.attempts.length; current += 1) {
    const attempt = entry.attempts[current];
    if (!attempt.invalidatedAt) {
      attempt.invalidatedAt = now;
      attempt.invalidationReason = current === index ? reason : `downstream of invalidated task ${taskId}`;
    }
  }
  clearIntegrationAndPublication(state);
  resolveDerivedLimitBlockers(state, commitHash);
  recordEvent(state, "task-invalidated", `${commitHash} ${role} ${taskId}: ${reason}`);
  refreshRunStatus(state);
  return `Task invalidated: ${taskId}; downstream attempts require fresh execution`;
}

function addLimitBlocker(state, type, commitHash, role, reason) {
  if (openBlockers(state).some((blocker) => blocker.type === type && blocker.commitHash === commitHash && blocker.role === role)) return;
  addBlocker(state, type, commitHash, role, reason);
}

function addBlocker(state, type, commitHash, role, reason) {
  state.blockers.push({
    id: randomUUID(),
    type,
    commitHash,
    role,
    reason,
    createdAt: timestamp(),
    resolvedAt: null,
    resolution: null
  });
  recordEvent(state, "blocked", `${type}: ${reason}`);
}

function resolveDerivedLimitBlockers(state, commitHash) {
  const now = timestamp();
  for (const blocker of openBlockers(state).filter((item) => item.commitHash === commitHash && item.type !== "manual")) {
    blocker.resolvedAt = now;
    blocker.resolution = "invalidated dependent attempt";
  }
}

function ensureMutablePipeline(state, action) {
  if (state.runStatus === "blocked") throw new Error(`cannot ${action} while run is blocked; use resume after resolving the blocker`);
  if (["ready-for-generation", "publishing", "awaiting-final-review", "completed"].includes(state.runStatus)) {
    throw new Error(`cannot ${action} after integration; use reset-integration first`);
  }
}

function ensureTaskSettlementAllowed(state, action) {
  if (["ready-for-generation", "publishing", "awaiting-final-review", "completed"].includes(state.runStatus)) {
    throw new Error(`cannot ${action} after integration; use reset-integration first`);
  }
}

function refreshRunStatus(state) {
  if (openBlockers(state).length > 0) {
    state.runStatus = "blocked";
    state.phase = "blocked";
    return;
  }
  if (state.finalReview.status === "completed") {
    state.runStatus = "completed";
    state.phase = "completed";
    return;
  }
  if (state.publication.status === "generated") {
    state.runStatus = "awaiting-final-review";
    state.phase = "final-review";
    return;
  }
  if (state.publication.status === "publishing") {
    state.runStatus = "publishing";
    state.phase = "publication";
    return;
  }
  if (state.integration.status === "completed") {
    state.runStatus = "ready-for-generation";
    state.phase = "generation";
    return;
  }
  state.runStatus = "running";
  if (state.commits.every((entry) => currentRevisionAttempt(entry))) {
    state.phase = "verification";
  } else {
    state.phase = "investigation";
  }
}

function activeAttempts(entry) {
  return entry.attempts.filter((attempt) => !attempt.invalidatedAt);
}

function allAttempts(state) {
  return state.commits.flatMap((entry) => entry.attempts);
}

function runningAttempts(state) {
  return state.commits.flatMap((entry) => activeAttempts(entry)
    .filter((attempt) => attempt.status === "running")
    .map((attempt) => ({ entry, attempt })));
}

function currentRevisionAttempt(entry, beforeAttempt) {
  const limit = beforeAttempt ? entry.attempts.indexOf(beforeAttempt) : entry.attempts.length;
  return entry.attempts
    .slice(0, limit < 0 ? entry.attempts.length : limit)
    .filter((attempt) => !attempt.invalidatedAt && ["investigator", "correction"].includes(attempt.role) && attempt.outcome === "completed")
    .at(-1) ?? null;
}

function latestVerifierForRevision(entry, revision, beforeAttempt) {
  if (!revision) return null;
  const limit = beforeAttempt ? entry.attempts.indexOf(beforeAttempt) : entry.attempts.length;
  return entry.attempts
    .slice(0, limit < 0 ? entry.attempts.length : limit)
    .filter((attempt) => (
      !attempt.invalidatedAt
      && attempt.role === "verifier"
      && attempt.inputReviewUnitSha256 === revision.reviewUnitSha256
      && attempt.status !== "running"
    ))
    .at(-1) ?? null;
}

function hasSuccessfulInvestigation(entry) {
  return activeAttempts(entry).some((attempt) => attempt.role === "investigator" && attempt.outcome === "completed");
}

function completedCorrectionCount(entry) {
  return activeAttempts(entry).filter((attempt) => attempt.role === "correction" && attempt.outcome === "completed").length;
}

function workerFailureCount(entry, role) {
  return activeAttempts(entry).filter((attempt) => attempt.role === role && ["worker-failed", "interrupted"].includes(attempt.outcome)).length;
}

function workerFailureCountForRevision(entry, role, digest) {
  return activeAttempts(entry).filter((attempt) => (
    attempt.role === role
    && attempt.inputReviewUnitSha256 === digest
    && ["worker-failed", "interrupted"].includes(attempt.outcome)
  )).length;
}

function maximumWorkerFailureCount(entry, role) {
  const counts = new Map();
  for (const attempt of activeAttempts(entry).filter((item) => item.role === role && ["worker-failed", "interrupted"].includes(item.outcome))) {
    const key = attempt.inputReviewUnitSha256 ?? "initial";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

function findCommit(state, commitHash) {
  const entry = state.commits.find((item) => item.commitHash === commitHash);
  if (!entry) throw new Error(`unknown commit ${commitHash}`);
  return entry;
}

function findAttempt(state, taskId) {
  for (const entry of state.commits) {
    const attempt = entry.attempts.find((item) => item.taskId === taskId);
    if (attempt) return { entry, attempt };
  }
  throw new Error(`unknown task ${taskId}`);
}

function openBlockers(state) {
  return state.blockers.filter((blocker) => blocker.resolvedAt === null);
}

function normalizeRole(value) {
  const normalized = requireNonEmptyString(value, "role").toLowerCase();
  const aliases = {
    investigation: "investigator",
    investigate: "investigator",
    verification: "verifier",
    verify: "verifier",
    corrector: "correction",
    corrective: "correction"
  };
  const role = aliases[normalized] ?? normalized;
  if (!VALID_ROLES.has(role)) throw new Error(`role must be investigator, verifier, or correction; found ${value}`);
  return role;
}

async function markIntegrated(state, reportPathOverride) {
  if (state.runStatus === "completed") throw new Error("completed run must be reset before reintegration");
  if (state.runStatus === "blocked") throw new Error("blocked run cannot be integrated");
  if (state.integration.status === "completed") throw new Error("run is already integrated");
  await assertAllWorkCompleted(state);
  const reportPath = requireConfiguredPath(reportPathOverride, state.reviewDataPath, "review-data");
  const validation = await validateReportAndRepository(state, reportPath, true);
  state.integration = {
    status: "completed",
    reviewDataSha256: validation.reportSha256,
    completedAt: timestamp()
  };
  state.commits.forEach((entry, index) => {
    entry.integrated = true;
    entry.integratedReviewUnitSha256 = validation.reviewUnitDigests[index];
  });
  state.publication = {
    status: "pending",
    candidatePath: null,
    candidateSha256: null,
    outputSha256: null,
    generatedAt: null
  };
  state.finalReview = {
    status: "pending",
    reviewerTaskId: null,
    artifactPath: null,
    artifactSha256: null,
    completedAt: null
  };
  recordEvent(state, "integrated", `review-data ${validation.reportSha256}`);
  refreshRunStatus(state);
  return `Integration marked complete: ${validation.reviewUnitDigests.length} source(s), ${validation.codeLocationCount} code location(s)`;
}

function resetIntegration(state, reason) {
  if (runningAttempts(state).length > 0) throw new Error("recover or finish every running task before resetting integration");
  requireNonEmptyString(reason, "reset reason");
  if (state.integration.status !== "completed" && !["publishing", "generated"].includes(state.publication.status) && state.finalReview.status !== "completed") {
    throw new Error("there is no integrated or published result to reset");
  }
  clearIntegrationAndPublication(state);
  recordEvent(state, "integration-reset", reason);
  refreshRunStatus(state);
  return "Integration and publication state reset; verified task history was preserved";
}

function clearIntegrationAndPublication(state) {
  state.integration = {
    status: "pending",
    reviewDataSha256: null,
    completedAt: null
  };
  for (const entry of state.commits) {
    entry.integrated = false;
    entry.integratedReviewUnitSha256 = null;
  }
  state.publication = {
    status: "pending",
    candidatePath: null,
    candidateSha256: null,
    outputSha256: null,
    generatedAt: null
  };
  state.finalReview = {
    status: "pending",
    reviewerTaskId: null,
    artifactPath: null,
    artifactSha256: null,
    completedAt: null
  };
}

async function assertReady(state, reportPathOverride, outputPathOverride, options = {}) {
  if (state.runStatus !== "ready-for-generation" || state.integration.status !== "completed") {
    throw new Error(`run is not ready for generation (status ${state.runStatus})`);
  }
  await assertAllWorkCompleted(state);
  const reportPath = requireConfiguredPath(reportPathOverride, state.reviewDataPath, "review-data");
  requireConfiguredPath(outputPathOverride, state.outputPath, "output HTML");
  const validation = await validateReportAndRepository(state, reportPath, true);
  requireExact(validation.reportSha256, state.integration.reviewDataSha256, "integrated review-data SHA-256");
  validation.reviewUnitDigests.forEach((digest, index) => {
    requireExact(digest, state.commits[index].integratedReviewUnitSha256, `integrated digest for ${state.commits[index].commitHash}`);
  });
  if (!options.quiet) {
    console.log(
      `Repository integrity passed: ${validation.reviewUnitDigests.length} source(s), `
      + `${validation.codeLocationCount} code location(s)`
    );
    console.log(`Completion readiness passed: ${validation.reviewUnitDigests.length} source(s), ${validation.codeLocationCount} code location(s)`);
  }
  return validation;
}

async function markPublishing(state, reportPathOverride, candidatePath, options = {}) {
  const reportPath = requireConfiguredPath(reportPathOverride, state.reviewDataPath, "review-data");
  await assertReady(state, reportPath, undefined, options);
  if (state.publication.status !== "pending") {
    throw new Error(`publication must be pending, found ${state.publication.status}`);
  }
  const candidate = resolve(requireNonEmptyString(candidatePath, "candidate HTML path"));
  if (candidate === state.outputPath) {
    throw new Error("candidate HTML must be a temporary path distinct from the configured output path");
  }
  const html = await validateHtml(candidate, state);
  if (!options.skipGeneratedReportValidator) {
    await runGeneratedReportValidator(reportPath, candidate);
  }
  state.publication = {
    status: "publishing",
    candidatePath: candidate,
    candidateSha256: html.sha256,
    outputSha256: null,
    generatedAt: null
  };
  recordEvent(state, "publishing", `candidate ${candidate} ${html.sha256}`);
  refreshRunStatus(state);
  return `Publication authorized for verified candidate: ${html.sha256}`;
}

async function markGenerated(state, reportPathOverride, outputPathOverride) {
  if (state.runStatus !== "publishing" || state.publication.status !== "publishing") {
    throw new Error(`mark-generated requires publishing state, found ${state.runStatus}`);
  }
  const reportPath = requireConfiguredPath(reportPathOverride, state.reviewDataPath, "review-data");
  const outputPath = requireConfiguredPath(outputPathOverride, state.outputPath, "output HTML");
  const validation = await validateReportAndRepository(state, reportPath, true);
  requireExact(validation.reportSha256, state.integration.reviewDataSha256, "integrated review-data SHA-256");
  const html = await validateHtml(outputPath, state);
  requireExact(html.sha256, state.publication.candidateSha256, "published output SHA-256");
  state.publication.status = "generated";
  state.publication.outputSha256 = html.sha256;
  state.publication.generatedAt = timestamp();
  recordEvent(state, "generated", `output ${outputPath} ${html.sha256}`);
  refreshRunStatus(state);
  return `HTML generated and awaiting final review: ${html.sha256}`;
}

async function markCompleted(state, reportPathOverride, outputPathOverride, finalReviewPath) {
  if (state.runStatus !== "awaiting-final-review" || state.publication.status !== "generated") {
    throw new Error(`mark-completed requires awaiting-final-review state, found ${state.runStatus}`);
  }
  const validation = await validateCompletedInputs(
    state,
    reportPathOverride,
    outputPathOverride,
    resolve(requireNonEmptyString(finalReviewPath, "final-review path")),
    false
  );
  state.finalReview = {
    status: "completed",
    reviewerTaskId: validation.reviewerTaskId,
    artifactPath: validation.finalReviewPath,
    artifactSha256: validation.finalReviewSha256,
    completedAt: timestamp()
  };
  recordEvent(state, "completed", `final-review ${validation.finalReviewSha256}`);
  refreshRunStatus(state);
  console.log(`Completion gate passed: ${state.commits.length} source(s), output ${state.publication.outputSha256}`);
  return "Run marked completed";
}

async function assertCompleted(state, reportPathOverride, outputPathOverride, finalReviewPathOverride) {
  if (state.runStatus !== "completed" || state.finalReview.status !== "completed") {
    throw new Error(`run is not completed (status ${state.runStatus})`);
  }
  const finalReviewPath = requireConfiguredPath(
    finalReviewPathOverride,
    state.finalReview.artifactPath,
    "final-review"
  );
  const validation = await validateCompletedInputs(
    state,
    reportPathOverride,
    outputPathOverride,
    finalReviewPath,
    true
  );
  requireExact(validation.finalReviewSha256, state.finalReview.artifactSha256, "final-review artifact SHA-256");
  requireExact(validation.reviewerTaskId, state.finalReview.reviewerTaskId, "final-review reviewerTaskId");
  console.log(`Run completion revalidated: ${state.commits.length} source(s), output ${state.publication.outputSha256}`);
  return validation;
}

async function validateCompletedInputs(state, reportPathOverride, outputPathOverride, finalReviewPath, requireStoredReview) {
  await assertAllWorkCompleted(state);
  const reportPath = requireConfiguredPath(reportPathOverride, state.reviewDataPath, "review-data");
  const outputPath = requireConfiguredPath(outputPathOverride, state.outputPath, "output HTML");
  const report = await validateReportAndRepository(state, reportPath, true);
  requireExact(report.reportSha256, state.integration.reviewDataSha256, "integrated review-data SHA-256");
  const html = await validateHtml(outputPath, state);
  requireExact(html.sha256, state.publication.outputSha256, "generated output SHA-256");
  const final = await validateFinalReview(
    finalReviewPath,
    report.reportSha256,
    html.sha256,
    dirname(state.reviewDataPath)
  );
  if (requireStoredReview && state.finalReview.artifactPath !== final.path) {
    throw new Error(`final-review path changed after completion: expected ${state.finalReview.artifactPath}, found ${final.path}`);
  }
  return {
    reportSha256: report.reportSha256,
    outputSha256: html.sha256,
    finalReviewPath: final.path,
    finalReviewSha256: final.sha256,
    reviewerTaskId: final.reviewerTaskId
  };
}

async function assertAllWorkCompleted(state) {
  if (openBlockers(state).length > 0) throw new Error("completion gate rejected open blockers");
  if (runningAttempts(state).length > 0) throw new Error("completion gate rejected running tasks");
  for (const entry of state.commits) {
    const revision = currentRevisionAttempt(entry);
    if (!revision) throw new Error(`completion gate rejected missing investigation for ${entry.commitHash}`);
    const verifier = latestVerifierForRevision(entry, revision);
    if (!verifier || verifier.outcome !== "passed" || verifier.issueCount !== 0) {
      throw new Error(`completion gate rejected unverified revision for ${entry.commitHash}`);
    }
    if (completedCorrectionCount(entry) > state.maxCorrectionRounds) {
      throw new Error(`completion gate rejected correction limit overrun for ${entry.commitHash}`);
    }
    for (const attempt of activeAttempts(entry).filter((item) => item.artifactPath)) {
      await assertAttemptArtifactUnchanged(attempt);
    }
  }
  assertInvestigationOverlap(state);
  await validateRepositoryIntegrity(state);
}

function assertInvestigationOverlap(state) {
  const batches = new Map();
  for (const entry of state.commits) {
    if (!batches.has(entry.investigationBatch)) batches.set(entry.investigationBatch, []);
    const first = activeAttempts(entry).find((attempt) => attempt.role === "investigator");
    if (!first || !first.startedAt || !first.finishedAt) {
      throw new Error(`investigation timing evidence is incomplete for ${entry.commitHash}`);
    }
    batches.get(entry.investigationBatch).push({ entry, attempt: first });
  }
  for (const [batch, members] of batches) {
    if (members.length < 2) continue;
    const latestStart = Math.max(...members.map(({ attempt }) => Date.parse(attempt.startedAt)));
    const earliestFinish = Math.min(...members.map(({ attempt }) => Date.parse(attempt.finishedAt)));
    if (!Number.isFinite(latestStart) || !Number.isFinite(earliestFinish) || latestStart > earliestFinish) {
      throw new Error(`investigation batch ${batch} has no actual execution overlap`);
    }
  }
}

async function assertAttemptArtifactUnchanged(attempt) {
  const path = requireNonEmptyString(attempt.artifactPath, `artifact path for ${attempt.taskId}`);
  const source = await readFile(path).catch((error) => {
    throw new Error(`evidence artifact for ${attempt.taskId} cannot be read: ${error.message}`);
  });
  const current = sha256Buffer(source);
  if (current !== attempt.artifactSha256) {
    throw new Error(`evidence artifact SHA-256 changed after ${attempt.taskId}: expected ${attempt.artifactSha256}, found ${current}`);
  }
}

async function validateReportAndRepository(state, reportPath, runExternalValidators) {
  const source = await readFile(reportPath).catch((error) => {
    throw new Error(`review-data cannot be read: ${error.message}`);
  });
  const report = parseJson(source.toString("utf8"), `review-data ${reportPath}`);
  const reviewUnitDigests = await validateReportLink(state, report, reportPath);
  const codeLocationCount = await validateRepositoryIntegrity(state, report);
  if (runExternalValidators) await runInputValidators(reportPath);
  return { report, reportSha256: sha256Buffer(source), reviewUnitDigests, codeLocationCount };
}

async function validateReportLink(state, report, reportPath) {
  assertObject(report, "review-data");
  assertArray(report.commits, "review-data.commits");
  assertObject(report.orchestration, "review-data.orchestration");
  const orchestration = report.orchestration;
  requireExact(orchestration.version, 1, "review-data.orchestration.version");
  requireExact(orchestration.mode, MODE, "review-data.orchestration.mode");
  requireExact(orchestration.workerCapacity, state.workerCapacity, "review-data.orchestration.workerCapacity");
  requireExact(orchestration.maxCorrectionRounds, state.maxCorrectionRounds, "review-data.orchestration.maxCorrectionRounds");
  assertArray(orchestration.requestedCommitOrder, "review-data.orchestration.requestedCommitOrder");
  assertExactArray(orchestration.requestedCommitOrder, state.requestedCommitOrder, "review-data requested commit order");
  assertArray(orchestration.commits, "review-data.orchestration.commits");
  if (report.commits.length !== state.commits.length || orchestration.commits.length !== state.commits.length) {
    throw new Error("review-data commit count does not match comparison plan");
  }
  const digests = [];
  for (let index = 0; index < state.commits.length; index += 1) {
    const stateEntry = state.commits[index];
    const commit = report.commits[index];
    const manifest = orchestration.commits[index];
    assertObject(commit, `review-data.commits[${index}]`);
    assertObject(manifest, `review-data.orchestration.commits[${index}]`);
    requireExact(commit.hash, stateEntry.commitHash, `review-data.commits[${index}].hash`);
    requireExact(manifest.commitHash, stateEntry.commitHash, `orchestration commit ${index}.commitHash`);
    requireExact(manifest.sourceKind, stateEntry.sourceKind, `orchestration commit ${index}.sourceKind`);
    requireExact(manifest.targetRef, stateEntry.targetRef, `orchestration commit ${index}.targetRef`);
    requireExact(manifest.comparisonBase.toLowerCase(), stateEntry.comparisonBase, `orchestration commit ${index}.comparisonBase`);
    if (stateEntry.sourceKind === "working-tree") {
      requireExact(manifest.initialSnapshotSha256, stateEntry.initialSnapshotSha256, `orchestration commit ${index}.initialSnapshotSha256`);
      requireExact(manifest.finalSnapshotSha256, stateEntry.initialSnapshotSha256, `orchestration commit ${index}.finalSnapshotSha256`);
    }
    const sourceDescriptor = {
      sourceKind: stateEntry.sourceKind,
      targetRef: stateEntry.targetRef,
      comparisonBase: stateEntry.comparisonBase,
      ...(stateEntry.sourceKind === "working-tree" ? { snapshotSha256: stateEntry.initialSnapshotSha256 } : {})
    };
    const digest = digestReviewUnit(commit, sourceDescriptor);
    digests.push(digest);
    const revision = currentRevisionAttempt(stateEntry);
    requireExact(digest, revision.reviewUnitSha256, `review unit digest for ${stateEntry.commitHash}`);
    assertObject(manifest.investigation, `orchestration ${stateEntry.commitHash}.investigation`);
    requireExact(manifest.investigation.taskId, revision.taskId, `orchestration ${stateEntry.commitHash}.investigation.taskId`);
    requireExact(manifest.investigation.batch, stateEntry.investigationBatch, `orchestration ${stateEntry.commitHash}.investigation.batch`);
    requireExact(manifest.investigation.status, "completed", `orchestration ${stateEntry.commitHash}.investigation.status`);
    requireExact(manifest.investigation.reviewUnitSha256, digest, `orchestration ${stateEntry.commitHash}.investigation.reviewUnitSha256`);
    assertManifestArtifactPath(manifest.investigation.artifactPath, revision.artifactPath, reportPath, `${stateEntry.commitHash} investigation`);
    const verifierAttempts = activeAttempts(stateEntry).filter((attempt) => attempt.role === "verifier" && attempt.artifactPath);
    assertArray(manifest.verificationAttempts, `orchestration ${stateEntry.commitHash}.verificationAttempts`);
    if (manifest.verificationAttempts.length !== verifierAttempts.length) {
      throw new Error(`verification attempt count mismatch for ${stateEntry.commitHash}`);
    }
    for (let attemptIndex = 0; attemptIndex < verifierAttempts.length; attemptIndex += 1) {
      const expected = verifierAttempts[attemptIndex];
      const actual = manifest.verificationAttempts[attemptIndex];
      assertObject(actual, `orchestration ${stateEntry.commitHash}.verificationAttempts[${attemptIndex}]`);
      requireExact(actual.taskId, expected.taskId, `verification taskId ${stateEntry.commitHash}/${attemptIndex}`);
      requireExact(actual.batch, expected.batch, `verification batch ${stateEntry.commitHash}/${attemptIndex}`);
      requireExact(actual.status, expected.outcome === "issues" ? "failed" : "passed", `verification status ${stateEntry.commitHash}/${attemptIndex}`);
      requireExact(actual.freshContext, true, `verification freshContext ${stateEntry.commitHash}/${attemptIndex}`);
      requireExact(actual.issueCount, expected.issueCount, `verification issueCount ${stateEntry.commitHash}/${attemptIndex}`);
      requireExact(actual.verifiedReviewUnitSha256, expected.reviewUnitSha256, `verification digest ${stateEntry.commitHash}/${attemptIndex}`);
      assertManifestArtifactPath(actual.artifactPath, expected.artifactPath, reportPath, `${stateEntry.commitHash} verifier ${attemptIndex}`);
    }
    requireExact(manifest.correctionRounds, completedCorrectionCount(stateEntry), `orchestration ${stateEntry.commitHash}.correctionRounds`);
    requireExact(manifest.unresolvedIssues, 0, `orchestration ${stateEntry.commitHash}.unresolvedIssues`);
  }
  return digests;
}

function assertManifestArtifactPath(manifestPath, statePath, reportPath, label) {
  const value = requireNonEmptyString(manifestPath, `${label} artifactPath`);
  if (isAbsolute(value)) throw new Error(`${label} artifactPath must be relative to review-data`);
  const actual = resolve(dirname(reportPath), value);
  if (actual !== resolve(statePath)) throw new Error(`${label} artifactPath does not match recorded state`);
}

function digestReviewUnit(commit, source) {
  const unit = {
    sourceKind: source.sourceKind,
    targetRef: source.targetRef,
    comparisonBase: source.comparisonBase,
    commit
  };
  if (source.sourceKind === "working-tree") unit.snapshotSha256 = source.snapshotSha256;
  return sha256Canonical(unit);
}

async function runInputValidators(reportPath) {
  const scriptDirectory = dirname(SCRIPT_PATH);
  for (const scriptName of [
    "verify-orchestration.mjs",
    "validate-review-data.mjs",
    "verify-caller-coverage.mjs",
    "verify-continuation-structure.mjs"
  ]) {
    await runProcess(process.execPath, [join(scriptDirectory, scriptName), reportPath], { quiet: true });
  }
}

async function runGeneratedReportValidator(reportPath, htmlPath) {
  await runProcess(
    process.execPath,
    [join(dirname(SCRIPT_PATH), "verify-generated-report.mjs"), reportPath, htmlPath],
    { quiet: true }
  );
}

async function validateRepositoryIntegrity(state, report) {
  const root = await requireGitRoot(state.repositoryPath);
  requireExact(root, state.repositoryPath, "repository worktree root");
  let codeLocationCount = 0;
  for (let index = 0; index < state.commits.length; index += 1) {
    const entry = state.commits[index];
    if (entry.sourceKind === "commit") {
      await validateCommitAndBase(root, entry.targetRef, entry.comparisonBase, `run state commit ${entry.commitHash}`);
      if (report) {
        const subject = (await git(root, ["show", "-s", "--format=%s", entry.targetRef])).trim();
        requireExact(report.commits[index].message, subject, `review-data.commits[${index}].message`);
      }
    } else {
      const head = await resolveCommit(root, "HEAD");
      requireExact(head, entry.comparisonBase, `working-tree comparisonBase for ${entry.commitHash}`);
      const snapshot = await computeWorkingTreeSnapshot(root, entry.comparisonBase);
      requireExact(snapshot, entry.initialSnapshotSha256, `working-tree snapshot for ${entry.commitHash}`);
    }
    if (report) {
      codeLocationCount += await validateCodeLocationsForCommit(root, entry, report.commits[index]);
    }
  }
  return codeLocationCount;
}

async function validateCodeLocationsForCommit(repositoryPath, entry, commit) {
  const steps = collectSteps(commit.steps, `commit ${entry.commitHash}.steps`);
  const renameMap = entry.sourceKind === "commit"
    ? await loadRenameMap(repositoryPath, entry.comparisonBase, entry.targetRef)
    : new Map();
  const cache = new Map();
  for (const record of steps) {
    const { step, location } = record;
    const path = requireRepositoryPath(step.filePath, `${location}.filePath`);
    const startLine = requireIntegerRange(step.startLine, 1, Number.MAX_SAFE_INTEGER, `${location}.startLine`);
    const endLine = requireIntegerRange(step.endLine, startLine, Number.MAX_SAFE_INTEGER, `${location}.endLine`);
    const beforeCode = requireString(step.beforeCode, `${location}.beforeCode`);
    const afterCode = requireString(step.afterCode, `${location}.afterCode`);
    const displayed = afterCode !== "" ? afterCode : beforeCode;
    if (displayed === "") throw new Error(`${location}: beforeCode and afterCode cannot both be empty`);
    if (countCodeLines(displayed) !== endLine - startLine + 1) {
      throw new Error(`${location}: line range does not match displayed code line count`);
    }
    if (beforeCode !== "") {
      const beforePath = await findBeforePath(repositoryPath, entry, path, renameMap, cache);
      const beforeSource = await readSourceAtRef(repositoryPath, entry.comparisonBase, beforePath, cache);
      if (afterCode === "") {
        const actual = sliceLines(beforeSource, startLine, endLine, `${entry.comparisonBase}:${beforePath}`);
        if (normalizeNewlines(actual) !== normalizeCodeSnippet(beforeCode)) {
          throw new Error(`${location}.beforeCode does not match ${entry.comparisonBase}:${beforePath}:${startLine}-${endLine}`);
        }
      } else if (!containsWholeLineSnippet(beforeSource, beforeCode)) {
        throw new Error(`${location}.beforeCode does not exist as consecutive full lines in ${entry.comparisonBase}:${beforePath}`);
      }
    }
    if (afterCode !== "") {
      const actual = entry.sourceKind === "working-tree"
        ? await workingTreeSlice(repositoryPath, path, startLine, endLine, cache)
        : await sourceSlice(repositoryPath, entry.targetRef, path, startLine, endLine, cache);
      if (normalizeNewlines(actual) !== normalizeCodeSnippet(afterCode)) {
        throw new Error(`${location}.afterCode does not match ${entry.targetRef}:${path}:${startLine}-${endLine}`);
      }
    }
  }
  return steps.length;
}

function collectSteps(rootSteps, location) {
  assertArray(rootSteps, location);
  const result = [];
  const pending = [{ steps: rootSteps, location }];
  while (pending.length > 0) {
    const current = pending.pop();
    current.steps.forEach((step, index) => {
      const stepLocation = `${current.location}[${index}]`;
      assertObject(step, stepLocation);
      result.push({ step, location: stepLocation });
      assertArray(step.calls, `${stepLocation}.calls`);
      for (let callIndex = step.calls.length - 1; callIndex >= 0; callIndex -= 1) {
        const call = step.calls[callIndex];
        assertObject(call, `${stepLocation}.calls[${callIndex}]`);
        assertArray(call.steps, `${stepLocation}.calls[${callIndex}].steps`);
        pending.push({ steps: call.steps, location: `${stepLocation}.calls[${callIndex}].steps` });
      }
    });
  }
  return result;
}

async function loadRenameMap(repositoryPath, base, target) {
  const buffer = await git(repositoryPath, ["diff", "--name-status", "-M", "-z", base, target, "--"], { encoding: null });
  const tokens = buffer.toString("utf8").split("\0").filter((token) => token !== "");
  const result = new Map();
  for (let index = 0; index < tokens.length;) {
    const statusToken = tokens[index++];
    if (/^[RC]\d+$/.test(statusToken)) {
      const oldPath = tokens[index++];
      const newPath = tokens[index++];
      if (oldPath && newPath) result.set(newPath, oldPath);
    } else {
      index += 1;
    }
  }
  return result;
}

async function findBeforePath(repositoryPath, entry, path, renameMap, cache) {
  if (await sourceExists(repositoryPath, entry.comparisonBase, path, cache)) return path;
  const oldPath = renameMap.get(path);
  if (oldPath && await sourceExists(repositoryPath, entry.comparisonBase, oldPath, cache)) return oldPath;
  throw new Error(`beforeCode path does not exist in comparison base: ${path}`);
}

async function sourceExists(repositoryPath, ref, path, cache) {
  try {
    await readSourceAtRef(repositoryPath, ref, path, cache);
    return true;
  } catch {
    return false;
  }
}

async function sourceSlice(repositoryPath, ref, path, startLine, endLine, cache) {
  const source = await readSourceAtRef(repositoryPath, ref, path, cache);
  return sliceLines(source, startLine, endLine, `${ref}:${path}`);
}

async function readSourceAtRef(repositoryPath, ref, path, cache) {
  const key = `git:${ref}:${path}`;
  if (cache.has(key)) return cache.get(key);
  const source = await git(repositoryPath, ["show", `${ref}:${path}`]);
  cache.set(key, source);
  return source;
}

async function workingTreeSlice(repositoryPath, path, startLine, endLine, cache) {
  const key = `worktree:${path}`;
  let source = cache.get(key);
  if (source === undefined) {
    const fullPath = resolve(repositoryPath, path);
    if (!isPathInside(repositoryPath, fullPath)) throw new Error(`working-tree path escapes repository: ${path}`);
    const info = await lstat(fullPath).catch((error) => {
      throw new Error(`cannot read working-tree path ${path}: ${error.message}`);
    });
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`working-tree code path must be a regular file: ${path}`);
    source = await readFile(fullPath, "utf8");
    cache.set(key, source);
  }
  return sliceLines(source, startLine, endLine, path);
}

function sliceLines(source, startLine, endLine, label) {
  const lines = normalizeNewlines(source).split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (endLine > lines.length) throw new Error(`${label} has ${lines.length} lines, cannot read ${startLine}-${endLine}`);
  return lines.slice(startLine - 1, endLine).join("\n");
}

function countCodeLines(code) {
  return normalizeCodeSnippet(code).split("\n").length;
}

function normalizeCodeSnippet(code) {
  return normalizeNewlines(code).replace(/\n$/, "");
}

function normalizeNewlines(value) {
  return String(value).replace(/\r\n?/g, "\n");
}

function containsWholeLineSnippet(source, snippet) {
  const haystack = `\n${normalizeCodeSnippet(source)}\n`;
  const needle = `\n${normalizeCodeSnippet(snippet)}\n`;
  return haystack.includes(needle);
}

function requireRepositoryPath(value, location) {
  const path = requireNonEmptyString(value, location).replaceAll("\\", "/");
  validateRepositoryRelativePath(path, location);
  return path;
}

function validateRepositoryRelativePath(path, location) {
  if (isAbsolute(path) || path === ".." || path.startsWith("../") || path.includes("/../") || path.includes("\0")) {
    throw new Error(`${location} must be a safe repository-relative path`);
  }
}

async function validateHtml(path, state) {
  const info = await lstat(path).catch((error) => {
    throw new Error(`HTML cannot be read: ${error.message}`);
  });
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("HTML must be an existing regular file, not a symlink");
  const source = await readFile(path);
  if (source.length < 100) throw new Error("HTML is unexpectedly small");
  const text = source.toString("utf8");
  if (!/<html(?:\s|>)/i.test(text) || !/<\/html>/i.test(text)) throw new Error("HTML document root is missing");
  if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=|<(?:img|iframe)\b[^>]*\bsrc\s*=\s*["']https?:|url\(\s*["']?https?:/i.test(text)) {
    throw new Error("HTML contains an external runtime dependency");
  }
  for (const commitHash of state.requestedCommitOrder) {
    if (!text.includes(commitHash)) throw new Error(`HTML does not contain commit label ${commitHash}`);
  }
  return { path, sha256: sha256Buffer(source), size: source.length };
}

async function validateFinalReview(path, reportSha256, outputSha256, allowedDirectory) {
  await assertRegularContainedJson(path, allowedDirectory, "final-review artifact");
  const source = await readFile(path);
  const review = parseJson(source.toString("utf8"), `final-review ${path}`);
  assertObject(review, "final-review");
  requireExact(review.schemaVersion, FINAL_REVIEW_SCHEMA_VERSION, "final-review.schemaVersion");
  const reviewerTaskId = requireNonEmptyString(review.reviewerTaskId, "final-review.reviewerTaskId");
  requireExact(review.status, "passed", "final-review.status");
  requireExact(
    requireSha256(review.reviewDataSha256, "final-review.reviewDataSha256").toLowerCase(),
    reportSha256,
    "final-review.reviewDataSha256"
  );
  requireExact(
    requireSha256(review.outputSha256, "final-review.outputSha256").toLowerCase(),
    outputSha256,
    "final-review.outputSha256"
  );
  assertObject(review.checks, "final-review.checks");
  for (const check of FINAL_REVIEW_CHECKS) {
    requireExact(review.checks[check], true, `final-review.checks.${check}`);
  }
  return { path: resolve(path), sha256: sha256Buffer(source), reviewerTaskId, review };
}

async function refreshAndValidateExternalInputs(state, options = {}) {
  await validateRepositoryIntegrity(state);
  for (const attempt of allAttempts(state).filter((item) => !item.invalidatedAt && item.artifactPath)) {
    await assertAttemptArtifactUnchanged(attempt);
  }
  if (options.requireReport || state.integration.status === "completed") {
    await validateReportAndRepository(state, state.reviewDataPath, true);
  }
  if (state.publication.status === "generated" || state.finalReview.status === "completed") {
    await validateHtml(state.outputPath, state);
  }
}

function requireConfiguredPath(override, configured, label) {
  const expected = resolve(requireNonEmptyString(configured, `configured ${label} path`));
  if (override !== undefined && resolve(override) !== expected) {
    throw new Error(`${label} path must equal configured path ${expected}`);
  }
  return expected;
}

function recordEvent(state, type, detail) {
  state.events.push({
    sequence: state.events.length + 1,
    at: timestamp(),
    type,
    detail
  });
}

function timestamp() {
  return new Date().toISOString();
}

function resolveFrom(base, value) {
  const path = requireNonEmptyString(value, "path");
  return isAbsolute(path) ? resolve(path) : resolve(base, path);
}

function isPathInside(parent, candidate) {
  const result = relative(resolve(parent), resolve(candidate));
  return result === "" || (!result.startsWith(`..${sep}`) && result !== ".." && !isAbsolute(result));
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(path, label) {
  const source = await readFile(path, "utf8").catch((error) => {
    throw new Error(`${label} cannot be read from ${path}: ${error.message}`);
  });
  return parseJson(source, `${label} ${path}`);
}

function parseJson(source, label) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Canonical(value) {
  return sha256Buffer(Buffer.from(JSON.stringify(sortKeysRecursively(value)), "utf8"));
}

function sortKeysRecursively(value) {
  if (Array.isArray(value)) return value.map(sortKeysRecursively);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeysRecursively(value[key])]));
  }
  return value;
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function assertObject(value, location) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${location} must be an object`);
  }
}

function assertArray(value, location) {
  if (!Array.isArray(value)) throw new Error(`${location} must be an array`);
}

function requireNonEmptyString(value, location) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${location} must be a non-empty string`);
  }
  return value;
}

function requireString(value, location) {
  if (typeof value !== "string") throw new Error(`${location} must be a string`);
  return value;
}

function requireIntegerRange(value, minimum, maximum, location) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${location} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function requireSha256(value, location) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`${location} must be a 64-character SHA-256 digest`);
  }
  return value;
}

function requireGitObject(value, location) {
  if (typeof value !== "string" || !GIT_OBJECT_PATTERN.test(value)) {
    throw new Error(`${location} must be a complete 40- or 64-character Git object ID`);
  }
  return value;
}

function requireExact(actual, expected, location) {
  if (actual !== expected) {
    throw new Error(`${location} must be ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
  return actual;
}

function assertUnique(values, location) {
  const seen = new Set();
  values.forEach((value, index) => {
    if (seen.has(value)) throw new Error(`${location}[${index}] duplicates ${JSON.stringify(value)}`);
    seen.add(value);
  });
}

function assertExactArray(actual, expected, location) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${location} must exactly match ${JSON.stringify(expected)}`);
  }
}

async function runProcess(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], cwd: options.cwd });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      const out = Buffer.concat(stdout).toString("utf8");
      const err = Buffer.concat(stderr).toString("utf8");
      if (code !== 0) {
        rejectPromise(new Error(`${basename(command)} ${args.join(" ")} failed (${code}): ${(err || out).trim()}`));
        return;
      }
      if (!options.quiet && out !== "") process.stdout.write(out);
      resolvePromise({ stdout: out, stderr: err });
    });
  });
}

async function runSelfTest() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "code-change-flow-run-state-"));
  let passed = 0;
  const check = async (name, callback) => {
    try {
      await callback();
      passed += 1;
    } catch (error) {
      throw new Error(`self-test ${JSON.stringify(name)} failed: ${error.message}`);
    }
  };
  const reject = async (name, callback, pattern) => check(name, async () => {
    try {
      await callback();
    } catch (error) {
      if (!pattern || pattern.test(error.message)) return;
      throw new Error(`wrong rejection: ${error.message}`);
    }
    throw new Error("operation unexpectedly succeeded");
  });

  try {
    const fakePlanPath = join(temporaryRoot, "fake-plan.json");
    await writeJsonAtomic(fakePlanPath, {
      schemaVersion: 1,
      repositoryPath: join(temporaryRoot, "not-git"),
      reviewDataPath: join(temporaryRoot, "fake-review.json"),
      outputPath: join(temporaryRoot, "fake.html"),
      workerCapacity: 1,
      requestedCommitOrder: ["abcdef0"],
      commits: [{
        commitHash: "abcdef0",
        sourceKind: "commit",
        targetRef: "a".repeat(40),
        comparisonBase: "b".repeat(40)
      }]
    });
    await mkdir(join(temporaryRoot, "not-git"));
    await reject("non-Git repository rejected", () => initializeRun(fakePlanPath, join(temporaryRoot, "fake-state.json")), /git .*failed|worktree|repository/i);

    const repositoryPath = join(temporaryRoot, "repository");
    await mkdir(repositoryPath);
    await runProcess("git", ["init", "-q", repositoryPath], { quiet: true });
    await runProcess("git", ["-C", repositoryPath, "config", "user.name", "Run State Test"], { quiet: true });
    await runProcess("git", ["-C", repositoryPath, "config", "user.email", "run-state@example.invalid"], { quiet: true });
    const codePath = join(repositoryPath, "Flow.txt");
    await writeFile(codePath, "zero\n");
    await runProcess("git", ["-C", repositoryPath, "add", "Flow.txt"], { quiet: true });
    await runProcess("git", ["-C", repositoryPath, "commit", "-q", "-m", "base"], { quiet: true });
    const base = await resolveCommit(repositoryPath, "HEAD");
    await writeFile(codePath, "one\n");
    await runProcess("git", ["-C", repositoryPath, "commit", "-qam", "change one"], { quiet: true });
    const first = await resolveCommit(repositoryPath, "HEAD");
    await writeFile(codePath, "two\n");
    await runProcess("git", ["-C", repositoryPath, "commit", "-qam", "change two"], { quiet: true });
    const second = await resolveCommit(repositoryPath, "HEAD");

    const dataDirectory = join(temporaryRoot, "data");
    await mkdir(dataDirectory);
    const reportPath = join(dataDirectory, "review.json");
    const outputPath = join(temporaryRoot, "report.html");
    const planPath = join(temporaryRoot, "plan.json");
    const statePath = join(temporaryRoot, "state.json");
    const hashes = [first.slice(0, 7), second.slice(0, 7)];
    const sources = [
      { commitHash: hashes[0], sourceKind: "commit", targetRef: first, comparisonBase: base },
      { commitHash: hashes[1], sourceKind: "commit", targetRef: second, comparisonBase: first }
    ];
    await writeJsonAtomic(planPath, {
      schemaVersion: 1,
      repositoryPath,
      reviewDataPath: reportPath,
      outputPath,
      workerCapacity: 2,
      maxWorkerAttempts: 3,
      maxCorrectionRounds: 2,
      requestedCommitOrder: hashes,
      commits: sources
    });
    await check("actual Git plan initialized", () => runCli(["init", planPath, statePath]));

    await check("expired lease is recovered after its owner process is killed", async () => {
      const lockPath = `${statePath}.lock`;
      const ownerPath = join(lockPath, "owner.json");
      const childSource = [
        "const fs = require('node:fs');",
        "const lockPath = process.argv[1];",
        "const ownerPath = lockPath + '/owner.json';",
        "fs.mkdirSync(lockPath);",
        "fs.writeFileSync(ownerPath, JSON.stringify({ pid: process.pid, token: 'killed-owner', createdAt: new Date().toISOString() }));",
        "console.log('ready');",
        "setInterval(() => { const now = new Date(); fs.utimesSync(ownerPath, now, now); }, 100);"
      ].join("");
      const ownerProcess = spawn(process.execPath, ["-e", childSource, lockPath], {
        stdio: ["ignore", "pipe", "pipe"]
      });
      await new Promise((resolvePromise, rejectPromise) => {
        let output = "";
        const timeout = setTimeout(() => rejectPromise(new Error("lock owner did not become ready")), 5_000);
        ownerProcess.stdout.on("data", (chunk) => {
          output += chunk.toString("utf8");
          if (output.includes("ready")) {
            clearTimeout(timeout);
            resolvePromise();
          }
        });
        ownerProcess.on("error", rejectPromise);
        ownerProcess.on("exit", (code) => {
          if (!output.includes("ready")) rejectPromise(new Error(`lock owner exited before ready (${code})`));
        });
      });
      ownerProcess.kill("SIGKILL");
      await new Promise((resolvePromise) => ownerProcess.once("close", resolvePromise));
      const owner = parseJson(await readFile(ownerPath, "utf8"), "killed lock owner");
      owner.pid = process.pid;
      await writeFile(ownerPath, JSON.stringify(owner));
      const expired = new Date(Date.now() - LOCK_LEASE_MS - 1_000);
      await utimes(ownerPath, expired, expired);
      await runCli(["status", statePath]);
      if (await pathExists(lockPath)) throw new Error("expired lock directory remained after recovery");
    });

    await check("locked parallel starts are preserved", async () => {
      await Promise.all([
        runCli(["start-task", statePath, hashes[0], "investigator", "/self/investigator-a"]),
        runCli(["start-task", statePath, hashes[1], "investigator", "/self/investigator-b"])
      ]);
      const state = await readState(statePath);
      if (runningAttempts(state).length !== 2) throw new Error("one parallel update was lost");
    });

    await check("targeted recovery preserves other running work", async () => {
      await runCli(["recover-task", statePath, "/self/investigator-a", "simulated worker loss"]);
      let state = await readState(statePath);
      if (runningAttempts(state).length !== 1 || runningAttempts(state)[0].attempt.taskId !== "/self/investigator-b") {
        throw new Error("targeted recovery changed the wrong task");
      }
      await runCli(["start-task", statePath, hashes[0], "investigator", "/self/investigator-a-retry"]);
    });

    const commits = [
      makeSelfTestCommit(hashes[0], "change one", "zero", "one", "flow-one"),
      makeSelfTestCommit(hashes[1], "change two", "one", "two", "flow-two")
    ];
    const digests = commits.map((commit, index) => digestReviewUnit(commit, {
      sourceKind: "commit",
      targetRef: sources[index].targetRef,
      comparisonBase: sources[index].comparisonBase
    }));
    const invPaths = [join(dataDirectory, "investigation-a.json"), join(dataDirectory, "investigation-b.json")];
    await writeJsonAtomic(invPaths[0], makeInvestigationEvidence("/self/investigator-a-retry", sources[0], digests[0]));
    await writeJsonAtomic(invPaths[1], makeInvestigationEvidence("/self/investigator-b", sources[1], digests[1]));
    const badEvidencePath = join(dataDirectory, "bad.json");
    await writeJsonAtomic(badEvidencePath, {});
    await reject(
      "invalid evidence cannot finish a task",
      () => runCli(["finish-task", statePath, "/self/investigator-a-retry", "completed", badEvidencePath]),
      /schemaVersion|must be/
    );
    await check("retry investigations finish with immediate evidence validation", async () => {
      await runCli(["finish-task", statePath, "/self/investigator-a-retry", "completed", invPaths[0]]);
      await runCli(["finish-task", statePath, "/self/investigator-b", "completed", invPaths[1]]);
    });

    await check("independent verifier tasks start in a shared batch", async () => {
      await Promise.all([
        runCli(["start-task", statePath, hashes[0], "verifier", "/self/verifier-a"]),
        runCli(["start-task", statePath, hashes[1], "verifier", "/self/verifier-b"])
      ]);
      const state = await readState(statePath);
      const batches = state.commits.map((entry) => activeAttempts(entry).find((attempt) => attempt.taskId.includes("verifier"))?.batch);
      if (batches[0] !== batches[1]) throw new Error(`verifier batches differ: ${batches}`);
    });
    const verifierPaths = [join(dataDirectory, "verification-a.json"), join(dataDirectory, "verification-b.json")];
    await writeJsonAtomic(verifierPaths[0], makeVerifierEvidence("/self/verifier-a", sources[0], digests[0]));
    await writeJsonAtomic(verifierPaths[1], makeVerifierEvidence("/self/verifier-b", sources[1], digests[1]));
    await check("verifier evidence is bound to current investigation digest", async () => {
      await runCli(["finish-task", statePath, "/self/verifier-a", "passed", verifierPaths[0]]);
      await runCli(["finish-task", statePath, "/self/verifier-b", "passed", verifierPaths[1]]);
    });

    let state = await readState(statePath);
    let report = buildSelfTestReport(state, commits);
    await writeJsonAtomic(reportPath, report);
    await check("actual code and orchestration integrate", () => runCli(["mark-integrated", statePath, reportPath]));
    await reject(
      "ready gate rejects an output path that differs from the plan",
      () => runCli(["assert-ready", statePath, reportPath, statePath]),
      /output HTML path/
    );
    await check("ready gate revalidates all inputs", () => runCli(["assert-ready", statePath, reportPath, outputPath]));

    const candidatePath = join(temporaryRoot, "candidate.html");
    await writeFile(candidatePath, selfTestHtml(hashes));
    await reject(
      "production publication gate runs the full HTML validator",
      () => runCli(["mark-publishing", statePath, reportPath, candidatePath]),
      /failed|テンプレート|メタ情報/
    );
    await check("candidate publication is gated", () => mutateState(
      statePath,
      (current) => markPublishing(
        current,
        reportPath,
        candidatePath,
        { skipGeneratedReportValidator: true, quiet: true }
      ),
      { quiet: true }
    ));
    await rename(candidatePath, outputPath);
    await check("generated output must match authorized candidate", () => runCli(["mark-generated", statePath, reportPath, outputPath]));
    const reportSha = sha256Buffer(await readFile(reportPath));
    const outputSha = sha256Buffer(await readFile(outputPath));
    const finalReviewPath = join(dataDirectory, "final-review.json");
    await writeJsonAtomic(finalReviewPath, makeFinalReview(reportSha, outputSha));
    await check("final review completes run", () => runCli(["mark-completed", statePath, reportPath, outputPath, finalReviewPath]));
    await check("completed state fully revalidates", () => runCli(["assert-completed", statePath]));

    const originalState = await readFile(statePath);
    const tamperedState = parseJson(originalState.toString("utf8"), "self-test state");
    tamperedState.events = [];
    tamperedState.commits[0].attempts[0].startedAt = "2000-01-01T00:00:00.000Z";
    await writeJsonAtomic(statePath, tamperedState);
    await reject("direct run-state tampering is rejected", () => runCli(["assert-completed", statePath]), /state integrity SHA-256/);
    await writeFile(statePath, originalState);

    const originalVerifier = await readFile(verifierPaths[0]);
    await writeFile(verifierPaths[0], Buffer.concat([originalVerifier, Buffer.from("\n")]));
    await reject("post-completion evidence tampering is rejected", () => runCli(["assert-completed", statePath]), /SHA-256 changed/);
    await writeFile(verifierPaths[0], originalVerifier);

    await check("completed run can reopen for targeted revalidation", async () => {
      await runCli(["reset-integration", statePath, "replace invalid final verifier"]);
      await runCli(["invalidate-task", statePath, hashes[0], "verifier", "/self/verifier-a", "evidence required replacement"]);
      await runCli(["start-task", statePath, hashes[0], "verifier", "/self/verifier-a-retry"]);
      const retryPath = join(dataDirectory, "verification-a-retry.json");
      await writeJsonAtomic(retryPath, makeVerifierEvidence("/self/verifier-a-retry", sources[0], digests[0]));
      await runCli(["finish-task", statePath, "/self/verifier-a-retry", "passed", retryPath]);
      state = await readState(statePath);
      report = buildSelfTestReport(state, commits);
      await writeJsonAtomic(reportPath, report);
      await runCli(["mark-integrated", statePath, reportPath]);
      const secondCandidate = join(temporaryRoot, "candidate-2.html");
      await writeFile(secondCandidate, selfTestHtml(hashes));
      await mutateState(
        statePath,
        (current) => markPublishing(
          current,
          reportPath,
          secondCandidate,
          { skipGeneratedReportValidator: true, quiet: true }
        ),
        { quiet: true }
      );
      await rename(secondCandidate, outputPath);
      await runCli(["mark-generated", statePath, reportPath, outputPath]);
      await writeJsonAtomic(finalReviewPath, makeFinalReview(
        sha256Buffer(await readFile(reportPath)),
        sha256Buffer(await readFile(outputPath))
      ));
      await runCli(["mark-completed", statePath, reportPath, outputPath, finalReviewPath]);
      await runCli(["assert-completed", statePath]);
    });

    const limitDirectory = join(temporaryRoot, "limit-data");
    await mkdir(limitDirectory);
    const limitPlanPath = join(temporaryRoot, "limit-plan.json");
    const limitStatePath = join(temporaryRoot, "limit-state.json");
    const limitReportPath = join(limitDirectory, "review.json");
    await writeJsonAtomic(limitPlanPath, {
      schemaVersion: 1,
      repositoryPath,
      reviewDataPath: limitReportPath,
      outputPath: join(temporaryRoot, "limit.html"),
      workerCapacity: 1,
      maxWorkerAttempts: 2,
      maxCorrectionRounds: 1,
      requestedCommitOrder: [hashes[0]],
      commits: [sources[0]]
    });
    await runCli(["init", limitPlanPath, limitStatePath]);
    await runCli(["start-task", limitStatePath, hashes[0], "investigator", "/limit/investigator"]);
    const limitInvestigationPath = join(limitDirectory, "investigation.json");
    await writeJsonAtomic(limitInvestigationPath, makeInvestigationEvidence(
      "/limit/investigator",
      sources[0],
      digests[0]
    ));
    await runCli(["finish-task", limitStatePath, "/limit/investigator", "completed", limitInvestigationPath]);
    await runCli(["start-task", limitStatePath, hashes[0], "verifier", "/limit/verifier-1"]);
    const firstIssuePath = join(limitDirectory, "verification-1.json");
    await writeJsonAtomic(firstIssuePath, makeIssueEvidence(
      "/limit/verifier-1",
      sources[0],
      digests[0]
    ));
    await runCli(["finish-task", limitStatePath, "/limit/verifier-1", "issues", firstIssuePath]);
    await runCli(["start-task", limitStatePath, hashes[0], "correction", "/limit/correction-1"]);
    const correctedDigest = "c".repeat(64);
    const correctionPath = join(limitDirectory, "correction-1.json");
    await writeJsonAtomic(correctionPath, makeCorrectionEvidence(
      "/limit/correction-1",
      "/limit/verifier-1",
      sources[0],
      correctedDigest
    ));
    await runCli(["finish-task", limitStatePath, "/limit/correction-1", "completed", correctionPath]);
    await runCli(["start-task", limitStatePath, hashes[0], "verifier", "/limit/verifier-2"]);
    const secondIssuePath = join(limitDirectory, "verification-2.json");
    await writeJsonAtomic(secondIssuePath, makeIssueEvidence(
      "/limit/verifier-2",
      sources[0],
      correctedDigest
    ));
    await check("configured correction limit blocks incomplete work", async () => {
      await runCli(["finish-task", limitStatePath, "/limit/verifier-2", "issues", secondIssuePath]);
      const blocked = await readState(limitStatePath);
      if (blocked.runStatus !== "blocked" || !openBlockers(blocked).some((item) => item.type === "correction-limit")) {
        throw new Error("correction limit did not create a persistent blocker");
      }
    });
    await reject(
      "resume rejects limits that leave a blocker unresolved",
      () => runCli(["resume", limitStatePath, "insufficient limit", "--max-worker-attempts", "3"]),
      /maxCorrectionRounds must be greater/
    );
    await check("resume with a sufficient correction limit continues the same run", async () => {
      await runCli(["resume", limitStatePath, "continue correction", "--max-correction-rounds", "2"]);
      const resumed = await readState(limitStatePath);
      if (resumed.runStatus !== "running" || nextActionForCommit(resumed, resumed.commits[0]) !== "start-correction") {
        throw new Error("run did not resume at the pending correction");
      }
    });

    const retryDirectory = join(temporaryRoot, "retry-data");
    await mkdir(retryDirectory);
    const retryPlanPath = join(temporaryRoot, "retry-plan.json");
    const retryStatePath = join(temporaryRoot, "retry-state.json");
    await writeJsonAtomic(retryPlanPath, {
      schemaVersion: 1,
      repositoryPath,
      reviewDataPath: join(retryDirectory, "review.json"),
      outputPath: join(temporaryRoot, "retry.html"),
      workerCapacity: 1,
      maxWorkerAttempts: 1,
      maxCorrectionRounds: 2,
      requestedCommitOrder: [hashes[0]],
      commits: [sources[0]]
    });
    await runCli(["init", retryPlanPath, retryStatePath]);
    await runCli(["start-task", retryStatePath, hashes[0], "investigator", "/retry/investigator-1"]);
    await runCli(["finish-task", retryStatePath, "/retry/investigator-1", "interrupted", "simulated loss"]);
    await check("worker retry limit resumes without losing completed history", async () => {
      let retryState = await readState(retryStatePath);
      if (retryState.runStatus !== "blocked") throw new Error("worker attempt limit did not block");
      await runCli(["resume", retryStatePath, "retry worker", "--max-worker-attempts", "2"]);
      retryState = await readState(retryStatePath);
      if (retryState.runStatus !== "running" || nextActionForCommit(retryState, retryState.commits[0]) !== "start-investigator") {
        throw new Error("worker retry did not return to the pending investigation");
      }
    });

    const settlementDirectory = join(temporaryRoot, "settlement-data");
    await mkdir(settlementDirectory);
    const settlementPlanPath = join(temporaryRoot, "settlement-plan.json");
    const settlementStatePath = join(temporaryRoot, "settlement-state.json");
    await writeJsonAtomic(settlementPlanPath, {
      schemaVersion: 1,
      repositoryPath,
      reviewDataPath: join(settlementDirectory, "review.json"),
      outputPath: join(temporaryRoot, "settlement.html"),
      workerCapacity: 2,
      maxWorkerAttempts: 1,
      maxCorrectionRounds: 2,
      requestedCommitOrder: hashes,
      commits: sources
    });
    await runCli(["init", settlementPlanPath, settlementStatePath]);
    await Promise.all([
      runCli(["start-task", settlementStatePath, hashes[0], "investigator", "/settlement/investigator-a"]),
      runCli(["start-task", settlementStatePath, hashes[1], "investigator", "/settlement/investigator-b"])
    ]);
    await runCli(["finish-task", settlementStatePath, "/settlement/investigator-a", "interrupted", "simulated retry exhaustion"]);
    await reject(
      "blocked run cannot resume while another task is still running",
      () => runCli(["resume", settlementStatePath, "premature resume", "--max-worker-attempts", "2"]),
      /finish or recover every running task/
    );
    const settlementEvidencePath = join(settlementDirectory, "investigation-b.json");
    await writeJsonAtomic(
      settlementEvidencePath,
      makeInvestigationEvidence("/settlement/investigator-b", sources[1], digests[1])
    );
    await check("already-running work can finish after another task blocks the run", async () => {
      await runCli(["finish-task", settlementStatePath, "/settlement/investigator-b", "completed", settlementEvidencePath]);
      let settlementState = await readState(settlementStatePath);
      if (runningAttempts(settlementState).length !== 0 || settlementState.runStatus !== "blocked") {
        throw new Error("blocked task settlement did not preserve the blocker and clear running work");
      }
      await runCli([
        "invalidate-task",
        settlementStatePath,
        hashes[0],
        "investigator",
        "/settlement/investigator-a",
        "retry cause corrected"
      ]);
      settlementState = await readState(settlementStatePath);
      if (settlementState.runStatus !== "running") throw new Error("invalidation did not reopen the pending investigation");
    });
    await runCli(["start-task", settlementStatePath, hashes[0], "investigator", "/settlement/investigator-a-retry"]);
    await runCli(["block", settlementStatePath, "simulated coordinator interruption"]);
    await check("already-running work can be recovered while the run is blocked", async () => {
      await runCli(["recover-task", settlementStatePath, "/settlement/investigator-a-retry", "worker is no longer executing"]);
      let settlementState = await readState(settlementStatePath);
      if (runningAttempts(settlementState).length !== 0 || settlementState.runStatus !== "blocked") {
        throw new Error("blocked recovery left a running task or cleared the blocker prematurely");
      }
      await runCli(["resume", settlementStatePath, "restart recovered worker", "--max-worker-attempts", "2"]);
      settlementState = await readState(settlementStatePath);
      if (settlementState.runStatus !== "running" || nextActionForCommit(settlementState, settlementState.commits[0]) !== "start-investigator") {
        throw new Error("blocked recovery did not return to the pending investigation");
      }
    });

    await check("working-tree snapshot changes with untracked content", async () => {
      const before = await computeWorkingTreeSnapshot(repositoryPath, second);
      await writeFile(join(repositoryPath, "untracked.txt"), "snapshot input\n");
      const after = await computeWorkingTreeSnapshot(repositoryPath, second);
      if (before === after) throw new Error("untracked content was not bound into snapshot");
    });

    console.log(
      `Run-state self-test passed: ${passed} cases `
      + "(Git binding, lease recovery, locked parallel updates, blocked-task settlement, targeted recovery, retry and correction limits, evidence validation, state integrity, actual code locations, atomic publication, tamper rejection, completion repair)"
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function makeSelfTestCommit(hash, message, beforeCode, afterCode, stepId) {
  return {
    hash,
    message,
    author: "Run State Test",
    committedAt: "2026-01-01T00:00:00Z",
    overview: `${message}により、入口で扱う値と利用者が確認する結果を一致させる。`,
    steps: [{
      id: stepId,
      flowTitle: `${message}の入口`,
      filePath: "Flow.txt",
      startLine: 1,
      endLine: 1,
      language: "text",
      beforeCode,
      afterCode,
      overview: "入口が処理対象の値を確定する。",
      reason: "処理結果として返す値を更新するため。",
      specification: {
        summary: "入力値を処理結果として確定する。",
        steps: ["入口が入力値を受け取る。", "確定した値を処理結果として返す。"]
      },
      remarks: "確認済みの問題はない。",
      calls: []
    }],
    callerCoverage: {
      version: 1,
      targets: [{
        id: `${stepId}-target`,
        displayName: `${message} entry`,
        analysisMode: "entry-point",
        changedStepIds: [stepId],
        evidence: [{
          kind: "manual",
          method: "git diff",
          scope: "Flow.txt",
          query: message,
          resultSummary: "変更箇所自体が入口であることを確認した。",
          callSiteIds: []
        }],
        callSites: [],
        entryStepId: stepId
      }]
    }
  };
}

function makeInvestigationEvidence(taskId, source, digest) {
  return {
    schemaVersion: 1,
    role: "investigator",
    taskId,
    commitHash: source.commitHash,
    sourceKind: source.sourceKind,
    targetRef: source.targetRef,
    comparisonBase: source.comparisonBase,
    status: "completed",
    reviewUnitSha256: digest
  };
}

function makeVerifierEvidence(taskId, source, digest) {
  return {
    schemaVersion: 1,
    role: "verifier",
    taskId,
    commitHash: source.commitHash,
    sourceKind: source.sourceKind,
    targetRef: source.targetRef,
    comparisonBase: source.comparisonBase,
    status: "passed",
    freshContext: true,
    issueCount: 0,
    issues: [],
    verifiedReviewUnitSha256: digest
  };
}

function makeIssueEvidence(taskId, source, digest) {
  return {
    ...makeVerifierEvidence(taskId, source, digest),
    status: "failed",
    issueCount: 1,
    issues: [{
      stepId: "flow-one",
      evidence: `${source.targetRef}:Flow.txt:1 contains an unresolved value`,
      requiredCorrection: "Update the review unit and submit it for fresh verification."
    }]
  };
}

function makeCorrectionEvidence(taskId, failedVerifierTaskId, source, digest) {
  return {
    ...makeInvestigationEvidence(taskId, source, digest),
    correctsTaskId: failedVerifierTaskId
  };
}

function buildSelfTestReport(state, commits) {
  return {
    title: "Run-state self-test",
    commits,
    orchestration: {
      version: 1,
      mode: MODE,
      workerCapacity: state.workerCapacity,
      maxCorrectionRounds: state.maxCorrectionRounds,
      requestedCommitOrder: state.requestedCommitOrder,
      commits: state.commits.map((entry) => {
        const revision = currentRevisionAttempt(entry);
        const verifierAttempts = activeAttempts(entry).filter((attempt) => attempt.role === "verifier" && attempt.artifactPath);
        return {
          commitHash: entry.commitHash,
          sourceKind: entry.sourceKind,
          targetRef: entry.targetRef,
          comparisonBase: entry.comparisonBase,
          investigation: {
            taskId: revision.taskId,
            batch: entry.investigationBatch,
            artifactPath: relative(dirname(state.reviewDataPath), revision.artifactPath),
            status: "completed",
            reviewUnitSha256: revision.reviewUnitSha256
          },
          verificationAttempts: verifierAttempts.map((attempt) => ({
            taskId: attempt.taskId,
            batch: attempt.batch,
            artifactPath: relative(dirname(state.reviewDataPath), attempt.artifactPath),
            status: attempt.outcome === "passed" ? "passed" : "failed",
            freshContext: true,
            issueCount: attempt.issueCount,
            verifiedReviewUnitSha256: attempt.reviewUnitSha256
          })),
          correctionRounds: completedCorrectionCount(entry),
          unresolvedIssues: 0
        };
      })
    }
  };
}

function selfTestHtml(hashes) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>body{font-family:sans-serif}.added{color:green}.removed{color:red}</style></head><body><main><h1>Review</h1>${hashes.map((hash) => `<section data-commit="${hash}"><h2>${hash}</h2><button>開閉</button><table><tr><td class="added">result</td></tr></table></section>`).join("")}</main><script>document.querySelectorAll('button').forEach((b)=>b.onclick=()=>{});</script></body></html>`;
}

function makeFinalReview(reviewDataSha256, outputSha256) {
  return {
    schemaVersion: 1,
    reviewerTaskId: "/self/final-review",
    status: "passed",
    reviewDataSha256,
    outputSha256,
    checks: Object.fromEntries(FINAL_REVIEW_CHECKS.map((check) => [check, true]))
  };
}

async function runCli(args) {
  const result = await runProcess(process.execPath, [SCRIPT_PATH, ...args], { quiet: true });
  return result.stdout;
}
