// Rebrands an upstream T3 Code tree into Zharf Code in place; zharf/README.md has the steps.
//   node zharf/rebrand/rebrand.ts [--root DIR] [--no-gate] [--no-i18n]
// Idempotent: on an already rebranded tree it changes nothing.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { applyRules, RENAMES, SKIP } from "./rules.ts";
import { isText, report, scanTree } from "./gate.ts";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const root = NodePath.resolve(option("--root") ?? ".");
const toolDir = NodePath.dirname(NodePath.dirname(new URL(import.meta.url).pathname));
const overridesDir = NodePath.join(toolDir, "overrides");

function gitFiles(dir: string): string[] {
  const out = NodeChildProcess.execFileSync(
    "git",
    ["-C", dir, "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  return out.toString("utf8").split("\0").filter(Boolean);
}

function listTree(dir: string, prefix = ""): string[] {
  if (!NodeFS.existsSync(dir)) return [];
  return NodeFS.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listTree(NodePath.join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}
const overridden = new Set(listTree(overridesDir));

// ── 1. text rules ─────────────────────────────────────────────────────────────────────────
let changed = 0;
const files = gitFiles(root);
for (const file of files) {
  if (SKIP.some((re) => re.test(file)) || overridden.has(file)) continue;
  const full = NodePath.join(root, file);
  let stat: NodeFS.Stats;
  try {
    stat = NodeFS.lstatSync(full);
  } catch {
    continue;
  }
  if (!stat.isFile()) continue;
  const buffer = NodeFS.readFileSync(full);
  if (!isText(buffer)) continue;
  const text = buffer.toString("utf8");
  const next = applyRules(file, text);
  if (next !== text) {
    NodeFS.writeFileSync(full, next);
    changed++;
  }
}
console.log(`rules: ${changed} file(s) changed`);

// ── 2. renames and overrides ──────────────────────────────────────────────────────────────
for (const [from, to] of RENAMES) {
  const src = NodePath.join(root, from);
  if (NodeFS.existsSync(src)) {
    NodeFS.mkdirSync(NodePath.dirname(NodePath.join(root, to)), { recursive: true });
    NodeFS.renameSync(src, NodePath.join(root, to));
    console.log(`renamed ${from} -> ${to}`);
  }
}

function copyTree(from: string, to: string): number {
  if (!NodeFS.existsSync(from)) return 0;
  let count = 0;
  for (const entry of NodeFS.readdirSync(from, { withFileTypes: true })) {
    const src = NodePath.join(from, entry.name);
    const dst = NodePath.join(to, entry.name);
    if (entry.isDirectory()) {
      NodeFS.mkdirSync(dst, { recursive: true });
      count += copyTree(src, dst);
    } else if (entry.name !== ".DS_Store") {
      const next = NodeFS.readFileSync(src);
      if (!NodeFS.existsSync(dst) || !NodeFS.readFileSync(dst).equals(next)) {
        NodeFS.writeFileSync(dst, next);
        count++;
      }
    }
  }
  return count;
}
// Upstream files the fork does not ship (T3's release workflows, its AUR packages…). Removed
// before the overrides are copied, so an override can put the fork's own file in their place.
const deleteList = NodePath.join(toolDir, "rebrand", "delete.txt");
let deleted = 0;
if (NodeFS.existsSync(deleteList)) {
  for (const line of NodeFS.readFileSync(deleteList, "utf8").split("\n")) {
    const rel = line.replace(/#.*/, "").trim();
    if (!rel) continue;
    const target = NodePath.join(root, rel);
    if (NodeFS.existsSync(target) && !overridden.has(rel)) {
      NodeFS.rmSync(target, { recursive: true, force: true });
      deleted++;
    }
  }
}
console.log(`deleted: ${deleted} path(s)`);
console.log(`overrides: ${copyTree(overridesDir, root)} file(s) written`);

// Markdown sections: zharf/sections/<path>.md holds headings, each followed by the text that
// replaces that heading's own text (up to the next heading of any level) in <path>.
// A body of just "<!-- delete -->" removes the section. A heading that is missing upstream
// fails the run, so a restructured upstream page gets looked at instead of silently drifting.
const sectionsDir = NodePath.join(toolDir, "sections");
let sectionCount = 0;
for (const rel of listTree(sectionsDir)) {
  const target = NodePath.join(root, rel);
  if (!NodeFS.existsSync(target)) {
    console.error(`sections: ${rel} does not exist upstream`);
    process.exitCode = 1;
    continue;
  }
  const blocks = NodeFS.readFileSync(NodePath.join(sectionsDir, rel), "utf8").split(
    /^(?=#{1,6} )/m,
  );
  let doc = NodeFS.readFileSync(target, "utf8");
  for (const block of blocks) {
    const heading = /^(#{1,6}) (.+)$/m.exec(block);
    if (!heading || heading.index !== 0) continue;
    const lines = doc.split("\n");
    const start = lines.findIndex((line) => line === heading[0]);
    if (start < 0) {
      // Already applied by an earlier run (a deleted section, or one whose heading we renamed).
      if (doc.includes(block.trimEnd()) || block.includes("<!-- delete -->")) continue;
      console.error(`sections: ${rel} has no heading ${JSON.stringify(heading[0])}`);
      process.exitCode = 1;
      continue;
    }
    let inFence = false;
    let end = lines.findIndex((line, i) => {
      if (/^(```|~~~)/.test(line)) inFence = !inFence;
      return i > start && !inFence && /^#{1,6} /.test(line);
    });
    if (end < 0) end = lines.length;
    const body = block.slice(heading[0].length).trim();
    const replacement = body === "<!-- delete -->" ? [] : block.trimEnd().split("\n").concat("");
    const next = [...lines.slice(0, start), ...replacement, ...lines.slice(end)].join("\n");
    if (next !== doc) {
      doc = next;
      sectionCount++;
    }
  }
  NodeFS.writeFileSync(target, doc);
}
console.log(`sections: ${sectionCount} replaced`);

// ── 3. translation catalogs ───────────────────────────────────────────────────────────────
type Catalog = Record<string, unknown>;
const GENERATE: Record<string, readonly string[]> = {
  "apps/web": ["node_modules/gt/bin/main.js", "generate"],
  "apps/mobile": ["node_modules/gt/bin/main.js", "generate"],
  "apps/desktop": ["scripts/i18n-generate.mjs"],
};

function readJson(file: string): Catalog {
  return JSON.parse(NodeFS.readFileSync(file, "utf8"));
}

for (const [app, generateArgs] of flag("--no-i18n") ? [] : Object.entries(GENERATE)) {
  const appDir = NodePath.join(root, app);
  const configPath = NodePath.join(appDir, "gt.config.json");
  if (!NodeFS.existsSync(configPath)) continue;
  if (!NodeFS.existsSync(NodePath.join(appDir, "node_modules"))) {
    console.error(
      `i18n: ${app} has no ${generateArgs[0]} (run pnpm install); catalogs not re-keyed`,
    );
    process.exitCode = 1;
    continue;
  }
  const config = readJson(configPath) as {
    defaultLocale: string;
    locales: string[];
    files: { gt: { output: string } };
  };
  const catalogDir = NodePath.join(appDir, NodePath.dirname(config.files.gt.output));
  const enPath = NodePath.join(catalogDir, `${config.defaultLocale}.json`);
  const current = readJson(enPath); // old keys, texts already rebranded by step 1

  const tmp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "zharf-i18n-"));
  let generated: Catalog;
  try {
    const tmpConfig = NodePath.join(tmp, "gt.config.json");
    NodeFS.writeFileSync(
      tmpConfig,
      JSON.stringify({ ...config, locales: [], files: { gt: { output: `${tmp}/[locale].json` } } }),
    );
    const run = NodeChildProcess.spawnSync(
      process.execPath,
      [...generateArgs, "--config", tmpConfig],
      { cwd: appDir, encoding: "utf8" },
    );
    if (run.status !== 0) throw new Error(`${app}: gt generate failed\n${run.stdout}${run.stderr}`);
    generated = readJson(NodePath.join(tmp, `${config.defaultLocale}.json`));
  } finally {
    NodeFS.rmSync(tmp, { recursive: true, force: true });
  }

  // new key -> old key, matched by the (rebranded) English text
  const oldByText = new Map<string, string[]>();
  for (const [key, value] of Object.entries(current)) {
    const text = JSON.stringify(value);
    oldByText.set(text, [...(oldByText.get(text) ?? []), key]);
  }
  const oldKeyFor = new Map<string, string>();
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  for (const [newKey, value] of Object.entries(generated)) {
    if (Object.hasOwn(current, newKey)) {
      oldKeyFor.set(newKey, newKey);
      continue;
    }
    const candidates = (oldByText.get(JSON.stringify(value)) ?? []).filter(
      (key) => !Object.hasOwn(generated, key),
    );
    if (candidates.length === 1) oldKeyFor.set(newKey, candidates[0]!);
    else if (candidates.length === 0) unmatched.push(newKey);
    else {
      // Same English text under several contexts: any of them carries a usable translation.
      oldKeyFor.set(newKey, candidates.sort()[0]!);
      ambiguous.push(newKey);
    }
  }
  if (unmatched.length > 0) {
    console.error(`i18n: ${app}: ${unmatched.length} new English string(s) with no old entry:`);
    for (const key of unmatched.slice(0, 20))
      console.error(`  ${key} ${JSON.stringify(generated[key])}`);
    process.exitCode = 1;
  }
  const rekeyed = [...oldKeyFor].filter(([n, o]) => n !== o).length;

  NodeFS.writeFileSync(enPath, `${JSON.stringify(generated, null, 2)}\n`);
  for (const locale of config.locales) {
    const localePath = NodePath.join(catalogDir, `${locale}.json`);
    const old = readJson(localePath);
    const next: Catalog = {};
    for (const newKey of Object.keys(generated)) {
      const oldKey = oldKeyFor.get(newKey);
      if (oldKey !== undefined && Object.hasOwn(old, oldKey)) next[newKey] = old[oldKey];
    }
    NodeFS.writeFileSync(localePath, `${JSON.stringify(next, null, 2)}\n`);
  }
  console.log(
    `i18n: ${app}: ${rekeyed} key(s) moved${ambiguous.length ? `, ${ambiguous.length} shared-text` : ""}`,
  );
}

// ── 4. gate ───────────────────────────────────────────────────────────────────────────────
if (!flag("--no-gate")) {
  const findings = scanTree(root, gitFiles(root));
  console.log(report(findings, Number(process.env.GATE_LIMIT ?? 120)));
  if (findings.length > 0) process.exitCode = 1;
}
