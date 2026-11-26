// The brand gate: no T3 name, domain or identity may be left, except identifiers kept on purpose
// (KEEP) and known work still to do (PENDING). Runs on source (`rebrand.ts` does) and on build output:
//   node zharf/rebrand/gate.ts <dir> [--strict]     (--strict also fails on every pending one)
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const SUSPECT =
  /T3|t3\.(?:codes|tools)|t3tools|pingdotgg|t3code|(?<![\w.$-])t3(?![\w.-])|ARK85ZXQ4Z|6787819824|t3-code-remote|d763fcb8-[0-9a-f-]+/g;

/** Kept for good: stored data, wire formats and code identifiers that are not branding. */
const KEEP: readonly RegExp[] = [
  /@t3tools\//, // private workspace package scope
  /\bt3code\/[\w./-]+/, // lint rule names and repo-relative paths in fixtures
  /oxlint-plugin-t3code/,
  /\b_*T3CODE_\w*/, // environment variables and build constants
  /\bt3-thread:\/\//, // stored thread links
  /["'`]t3code:[\w:.-]+/, // localStorage keys
  /\bt3\.json\b|\bt3ProjectFile\b|\bt3-json\b/, // the project file teams already commit
  /\bT3\.[a-z]\w*/, // the workflow script API (T3.workflow, T3.wait…)
  /\bT3(?=:\s*[{[(])/, // the T3 global that workflow scripts call
  /\bT3-(?:Mode-Limit|Sender|INSIGHT)\b/, // header and marker names
  /\bT3\.[A-Z]\w*|\bT3-[A-Z][a-zA-Z]*(?:-[A-Z][a-zA-Z]*)+/, // PowerShell type, header and trailer names
  /\bT3[A-Z_]\w*|\b\w+T3\w*|\bt3[A-Z]\w*|\bt3_\w+/, // code identifiers
  /\bt3-code\b/, // theme id, MCP server name other agents call, Claude entrypoint
  /\bt3\[[^\]]*\]\??code\b|\bt3_code\b|\|t3code\)/, // patterns that recognize that MCP server name
  /\bt3code_desktop\b|\bt3code-(?:test|server|web|preview|annotation|recording|peer|git|review|desktop|dev-root)\b/, // trace and in-app names
  /\bcom\.t3tools\.(?!t3code\b)[a-z]/, // Kotlin/Gradle package names (internal)
  /\bt3code\b(?=["'`]?\s*(?:as const)?[,;)\]}])/, // attribution and client-name values
  /["'`]t3\/[A-Za-z][\w-]*(?:\/[\w/-]*)?["'`]?/, // Effect service tags ("t3/orchestration-v2/…")
  /\/\.well-known\/t3\/|\brefs\/t3\/|\burn:t3:/, // wire paths, hidden checkpoint refs, URN
  /\bt3-[a-z][\w-]*/, // native module folders (t3-terminal, t3-highlights…)
  /\bt3code[.:-][\w.-]+|\bt3code(?=:\s)|Symbol\.for\("t3code\./, // storage keys, temp prefixes
  /\bt3code[A-Z_]\w*|["'`]t3code["'`]|\/__t3code\/|t3code-\$\{|com\.example\.t3code/, // identifiers
  /\bt3code(?=[-/[(])/, // legacy branch prefixes still recognized
  /\.t3code\b|\b__t3code\w*/, // manifest fields, globals
  /\bt3#\w+|"name":\s*"t3"|--filter\s+t3\b|affected\.includes\("t3"\)/, // the server's workspace package name
  /(?:const|let|var|return|[{,(])\s*t3\b|\bt3(?=\s*(?:[:,})]|!==|===|=[^=]))|[{,]t3:/, // code named t3
];

/** Known work, allowed by default; `--strict` fails on each. */
const PENDING: readonly (readonly [RegExp, string])[] = [
  [/\bT3 Chat\b|\bt3\.chat\b|\bt3-chat\b|\bT3Chat\w*|\bt3Chat\w*/, "T3 Chat linking UI: remove"],
];

/** Never scanned: legal text, third-party code, tests and dev-only tools. */
const SKIP: readonly RegExp[] = [
  /^LICENSE$/,
  /^third-party-licenses/,
  /^patches\//,
  /^pnpm-lock\.yaml$/,
  /^\.repos\//,
  /^oxlint-plugin-t3code\//,
  /(^|\/)deps\/[^/]+\.tgz$/,
  /(^|\/)deps\/README\.md$/, // provenance of T3's dependency forks
  /^(README|TRADEMARK|SECURITY)\.md$/, // the fork's own, with the required attribution to T3 Code
  /\.(test|integration|spec|e2e)\.[cm]?[jt]sx?$/, // tests never ship; the rules still run on them
  /(^|\/)(test|tests|__tests__|fixtures|__fixtures__|integration)\//,
  /\.(c|h)$/, // vendored C sources
  /\.rs$/, // native helpers: window classes and test data
  /^infra\/task-cache\//, // upstream's CI cache service
  /^evals\//, // upstream's agent evaluation harness
  /^scripts\/scenarios\//, // UI scenario harness (its fixture is typed T3)
  /^scripts\/(server-|client-)?metrics/, // dev metrics reports
  /\.tsbuildinfo$/, // TypeScript build caches
];

/** Areas not rebranded yet: skipped by default, scanned as pending by `--strict`. */
const PENDING_AREAS: readonly (readonly [RegExp, string])[] = [
  [/^apps\/marketing\//, "T3's website: replace with Zharf Code's download page"],
  [/^\.github\//, "T3's CI workflows: replace with the fork's release workflows"],
  [/^apps\/mobile\/|^scripts\/mobile-/, "phone apps: own bundle ids, Apple team, Expo project"],
  [/^infra\/relay\//, "relay: deploy Zharf Connect"],
  [
    /^apps\/web\/public\/\.well-known\//,
    "universal-link files: Zharf's Apple team and app certificates",
  ],
];

const SKIP_DIRS = new Set([".git", "node_modules", ".vite-plus", ".turbo", "zharf"]);
/** Comment lines may name internal identifiers; only lowercase matches are excused there. */
const COMMENT_LINE = /^\s*(?:\/\/|\/?\*|#|<!--)/;

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly match: string;
  readonly text: string;
  /** Set when the finding is known work (PENDING), with the reason. */
  readonly todo?: string;
}

function covers(re: RegExp, line: string, index: number, length: number): boolean {
  const global = new RegExp(re.source, "g");
  for (let m = global.exec(line); m; m = global.exec(line)) {
    if (m.index <= index && index + length <= m.index + m[0].length) return true;
    if (m[0].length === 0) global.lastIndex++;
  }
  return false;
}

export function scanText(file: string, text: string, area?: string): Finding[] {
  const findings: Finding[] = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(SUSPECT)) {
      const index = m.index ?? 0;
      if (COMMENT_LINE.test(line) && /^t3(?:code)?$/.test(m[0])) continue;
      if (KEEP.some((re) => covers(re, line, index, m[0].length))) continue;
      const todo = area ?? PENDING.find(([re]) => covers(re, line, index, m[0].length))?.[1];
      findings.push({ file, line: i + 1, match: m[0], text: line.trim().slice(0, 160), todo });
    }
  });
  return findings;
}

export function isText(buffer: Buffer): boolean {
  return buffer.length < 8 * 1024 * 1024 && !buffer.subarray(0, 8000).includes(0);
}

function* walk(root: string, dir = ""): Generator<string> {
  for (const entry of NodeFS.readdirSync(NodePath.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(root, rel);
    } else if (entry.isFile()) {
      yield rel;
    }
  }
}

/** Findings in `root`. Areas in PENDING_AREAS are scanned only when `strict`. */
export function scanTree(root: string, files?: Iterable<string>, strict = false): Finding[] {
  const findings: Finding[] = [];
  for (const file of files ?? walk(root)) {
    if (SKIP.some((re) => re.test(file))) continue;
    const area = PENDING_AREAS.find(([re]) => re.test(file))?.[1];
    if (area && !strict) continue;
    const full = NodePath.join(root, file);
    const stat = NodeFS.lstatSync(full, { throwIfNoEntry: false });
    if (!stat?.isFile()) continue;
    const buffer = NodeFS.readFileSync(full);
    if (!isText(buffer)) continue;
    findings.push(...scanText(file, buffer.toString("utf8"), area));
  }
  return findings;
}

/** Whether the findings fail the gate: any non-PENDING finding, or any at all when `strict`. */
export function fails(findings: readonly Finding[], strict = false): boolean {
  return findings.some((f) => strict || f.todo === undefined);
}

export function report(findings: readonly Finding[], limit = 80): string {
  const open = findings.filter((f) => f.todo === undefined);
  const todo = findings.filter((f) => f.todo !== undefined);
  const out: string[] = [`${open.length} brand finding(s)`];
  const byMatch = new Map<string, Finding[]>();
  for (const f of open) byMatch.set(f.match, [...(byMatch.get(f.match) ?? []), f]);
  const groups = [...byMatch.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [match, list] of groups) {
    out.push(`  ${JSON.stringify(match)} ×${list.length}`);
    for (const f of list.slice(0, Math.max(1, Math.floor(limit / groups.length)))) {
      out.push(`    ${f.file}:${f.line}  ${f.text}`);
    }
  }
  if (todo.length > 0) {
    const byReason = new Map<string, number>();
    for (const f of todo) byReason.set(f.todo!, (byReason.get(f.todo!) ?? 0) + 1);
    out.push(`${todo.length} known pending finding(s):`);
    for (const [reason, count] of byReason) out.push(`  ${count}× ${reason}`);
  }
  return out.join("\n");
}

if (import.meta.main) {
  const strict = process.argv.includes("--strict");
  const root = NodePath.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? ".");
  const findings = scanTree(root, undefined, strict);
  console.log(report(findings, Number(process.env.GATE_LIMIT ?? 80)));
  process.exitCode = fails(findings, strict) ? 1 : 0;
}
