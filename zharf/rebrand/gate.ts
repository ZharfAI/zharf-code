// The brand gate: after the rebrand, no T3 name, domain or identity may be left except the
// identifiers listed in ALLOWED. Run on source (`rebrand.ts` does) and on build output
// (`node zharf/rebrand/gate.ts <dir>`), so a bundle or app-update.yml can't carry T3's name.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const SUSPECT = /T3|t3\.(?:codes|tools)|t3tools|pingdotgg|t3code|(?<![\w.$-])t3(?![\w.-])/g;

/** Matches that are identifiers, stored formats or factual references, not branding. */
export const ALLOWED: readonly RegExp[] = [
  /@t3tools\//, // private workspace package scope
  /\bt3code\/[\w./-]+/, // lint rule names and repo-relative paths in fixtures
  /oxlint-plugin-t3code/,
  /\b_*T3CODE_\w*/, // environment variables and build constants
  /\bt3-thread:\/\//, // stored thread links
  /["'`]t3code:[\w:.-]+/, // localStorage keys
  /\bt3\.json\b|\bt3ProjectFile\b|\bt3-json\b/, // the project file teams already commit
  /\bT3\.[a-z]\w*/, // the workflow script API (T3.workflow, T3.wait…)
  /\bT3-(?:Mode-Limit|Sender|INSIGHT)\b/, // header and marker names
  /\bT3 Chat\b|\bt3\.chat\b|\bt3-chat\b|\bT3Chat\w*|\bt3Chat\w*/, // another T3 product; UI off
  /\bT3[A-Z_]\w*|\b\w+T3\w*|\bt3[A-Z]\w*|\bt3_\w+/, // code identifiers
  /\bt3-code\b/, // theme id, MCP server name, Claude entrypoint
  /\bt3code_desktop\b|\bt3code-(?:test|server|web|preview|annotation|recording|peer|git|review|pr|desktop|dev-root)\b/,
  /\bcom\.t3tools\.(?!t3code\b)[a-z]/, // Kotlin/Gradle package names (internal)
  /\bt3code\b(?=["'`]?\s*(?:as const)?[,;)\]}])/, // attribution and client-name values
  /["'`]t3\/[A-Za-z][\w-]*\/[\w/-]*/, // Effect service tags ("t3/orchestration-v2/…")
  /\/\.well-known\/t3\/|\brefs\/t3\/|\burn:t3:/, // wire paths, hidden checkpoint refs, URN
  /\bt3-[a-z][\w-]*/, // native module folders (t3-terminal, t3-highlights…)
  /\bt3code[.:-][\w.-]+|\bt3code(?=:\s)|Symbol\.for\("t3code\./, // storage keys, temp prefixes, workspace names
  /\bt3code[A-Z_]\w*|["'`]t3code["'`]|\/__t3code\/|t3code-\$\{|com\.example\.t3code/, // identifiers, attribution
  /\bt3code(?=[-/[(])/, // legacy branch and unit-name prefixes in patterns
  /\.t3code\b|\b__t3code\w*|["'`]t3\/[A-Za-z]\w*["'`]/, // manifest fields, globals, one-part service tags
  /\bT3\.[A-Z]\w*|\bT3-[A-Z][a-zA-Z]*(?:-[A-Z][a-zA-Z]*)+/, // PowerShell type, header and trailer names
  /\bt3#\w+|"name":\s*"t3"|--filter\s+t3\b|affected\.includes\("t3"\)/, // the server's workspace package name
  /\bT3(?=:\s*[{[(])/, // the T3 global that workflow scripts call
  /(?:const|let|var|return|[{,(])\s*t3\b|\bt3(?=\s*(?:[:,})]|!==|===|=[^=]))|[{,]t3:/, // code named t3
];

/** Comment lines may name internal identifiers; only lowercase matches are excused there. */
const COMMENT_LINE = /^\s*(?:\/\/|\/?\*|#|<!--)/;

const SKIP_DIRS = new Set([".git", "node_modules", ".vite-plus", ".turbo", "zharf"]);
const SKIP_PATH = [
  /^LICENSE$/,
  /^third-party-licenses/,
  /^patches\//,
  /^pnpm-lock\.yaml$/,
  /^\.repos\//,
  /^oxlint-plugin-t3code\//,
  /(^|\/)deps\/[^/]+\.tgz$/,
  /^apps\/marketing\//, // replaced in a later step
  /^\.github\//, // replaced by the fork's own workflows
  /^(README|TRADEMARK|SECURITY)\.md$/, // the fork's own, with the required attribution to T3 Code
  // Tests and fixtures never ship; the rules still run on them so assertions match the source.
  /\.(test|integration|spec|e2e)\.[cm]?[jt]sx?$/,
  /\.(c|h)$/, // vendored C sources

  /(^|\/)(test|tests|__tests__|fixtures|__fixtures__|integration)\//,
  /^infra\/task-cache\//, // upstream's CI cache service, not part of the product
  /^evals\//, // upstream's agent evaluation harness, not shipped
  /^scripts\/scenarios\//, // UI scenario harness (its fixture is typed T3)
  /^scripts\/(server-|client-)?metrics/, // dev metrics reports ("node/T3/agent processes")
  /(^|\/)deps\/README\.md$/, // provenance of T3's dependency forks
  /\.rs$/, // native helpers: window classes and test data
  // Milestone 3 (mobile apps, relay): their store, Expo and relay identities are set there.
  /^apps\/mobile\//,
  /^infra\/relay\//,
  /^scripts\/mobile-/,
];

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly match: string;
  readonly text: string;
}

function isAllowed(line: string, index: number, match: string): boolean {
  for (const allowed of ALLOWED) {
    const re = new RegExp(allowed.source, "g");
    for (let m = re.exec(line); m; m = re.exec(line)) {
      if (m.index <= index && index + match.length <= m.index + m[0].length) return true;
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return false;
}

export function scanText(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(SUSPECT)) {
      if (COMMENT_LINE.test(line) && /^t3(?:code)?$/.test(m[0])) continue;
      if (!isAllowed(line, m.index ?? 0, m[0])) {
        findings.push({ file, line: i + 1, match: m[0], text: line.trim().slice(0, 160) });
      }
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

export function scanTree(root: string, files?: Iterable<string>): Finding[] {
  const findings: Finding[] = [];
  for (const file of files ?? walk(root)) {
    if (SKIP_PATH.some((re) => re.test(file))) continue;
    const full = NodePath.join(root, file);
    const stat = NodeFS.lstatSync(full, { throwIfNoEntry: false });
    if (!stat?.isFile()) continue;
    const buffer = NodeFS.readFileSync(full);
    if (!isText(buffer)) continue;
    findings.push(...scanText(file, buffer.toString("utf8")));
  }
  return findings;
}

export function report(findings: readonly Finding[], limit = 80): string {
  const byMatch = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = f.match;
    byMatch.set(key, [...(byMatch.get(key) ?? []), f]);
  }
  const out: string[] = [`${findings.length} brand finding(s)`];
  const groups = [...byMatch.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [match, list] of groups) {
    out.push(`  ${JSON.stringify(match)} ×${list.length}`);
    for (const f of list.slice(0, Math.max(1, Math.floor(limit / groups.length)))) {
      out.push(`    ${f.file}:${f.line}  ${f.text}`);
    }
  }
  return out.join("\n");
}

if (import.meta.main) {
  const root = NodePath.resolve(process.argv[2] ?? ".");
  const findings = scanTree(root);
  console.log(report(findings, Number(process.env.GATE_LIMIT ?? 80)));
  process.exitCode = findings.length > 0 ? 1 : 0;
}
