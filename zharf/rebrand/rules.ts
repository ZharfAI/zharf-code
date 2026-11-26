// Upstream's TRADEMARK.md: a fork ships its own name, icons and domains. Each rule is idempotent
// (its output never matches again). Order: addresses and identities, then names, then bare "T3".
// Identifiers other programs or stored data depend on are kept; zharf/README.md lists them.

export interface Rule {
  readonly id: string;
  readonly find: RegExp;
  /** A replacement string, or a function given the match, its offset and the whole text. */
  readonly replace:
    | string
    | ((match: string, offset: number, text: string, path: string) => string);
  /** Only files whose repo-relative path matches. */
  readonly only?: RegExp;
  /** Never files whose repo-relative path matches. */
  readonly not?: RegExp;
}

const TEST_FILE =
  /\.(test|integration|spec)\.[cm]?[jt]sx?$|(^|\/)(test|tests|__tests__|fixtures)\//;
const CATALOG = /\/i18n\/translations\/[^/]+\.json$|^docs\//;

export const BRAND = {
  name: "Zharf Code",
  company: "ZharfAI",
  connect: "Zharf Connect",
  appId: "ai.zharf.code",
  wmClass: "ai.zharf.ZharfCode",
  scheme: "zharfcode",
  devScheme: "zharfcode-dev",
  command: "zharf-code",
  homeDir: ".zharf-code",
  site: "https://platform.zharf.ai/code",
  repo: "ZharfAI/zharf-code",
} as const;

const SITE_HOST_PATH = "platform.zharf.ai/code";

export const RULES: readonly Rule[] = [
  // ── Repository and web addresses ─────────────────────────────────────────────────────────
  // Lowercase stays lowercase: code compares repositories case-insensitively by lowercasing them.
  {
    id: "repo",
    find: /pingdotgg\/t3code/gi,
    replace: (match) => (match === match.toLowerCase() ? BRAND.repo.toLowerCase() : BRAND.repo),
  },
  {
    id: "repo-pair",
    find: /\bowner(["']?:\s*)(["'])pingdotgg\2(,\s*["']?repo["']?:\s*)(["'])t3code\4/g,
    replace: "owner$1$2zharfai$2$3$4zharf-code$4",
  },
  { id: "mcp-app-name", find: /\bT3%20Code\b/g, replace: "Zharf%20Code" },
  // The hosted web app needs an origin of its own (code compares URL origins), so it gets a
  // subdomain; it only matters once Zharf Connect is deployed.
  {
    id: "hosted-app",
    find: /\b(?:nightly\.|latest\.|preview\.)?app\.t3\.codes\b/g,
    replace: "code.zharf.ai",
  },
  { id: "relay", find: /\brelay\.t3\.codes\b/g, replace: "relay.zharf.ai" },
  { id: "clerk", find: /\bclerk\.t3\.codes\b/g, replace: "accounts.zharf.ai" },
  { id: "ingest", find: /\bingest\.t3\.codes\b/g, replace: "ingest.zharf.ai" },
  { id: "email", find: /\b([a-z0-9._+-]+)@t3\.(?:codes|tools)\b/g, replace: "$1@zharf.ai" },
  { id: "site", find: /(https?:\/\/)?(?<![\w.-])t3\.codes\b/g, replace: `$1${SITE_HOST_PATH}` },

  // ── App identity ─────────────────────────────────────────────────────────────────────────
  { id: "app-id", find: /\bcom\.t3tools\.t3code\b/g, replace: BRAND.appId },
  { id: "app-id-regex", find: /\bcom\\\.t3tools\\\.t3code\b/g, replace: "ai\\.zharf\\.code" },
  { id: "wm-class", find: /\bcom\.t3tools\.T3Code\b/g, replace: BRAND.wmClass },
  { id: "app-group", find: /\bgroup\.com\.t3tools\./g, replace: "group.ai.zharf." },
  { id: "policy-registry", find: /T3Tools(\\+)T3Code/g, replace: "ZharfAI$1ZharfCode" },
  { id: "policy-folder", find: /(?<=[/\\])T3Code(?=[/\\])/g, replace: "ZharfCode" },
  { id: "policy-etc", find: /\/etc\/t3code\b/g, replace: "/etc/zharf-code" },
  { id: "scheme-url", find: /\bt3code(-dev|-preview)?:\/\//g, replace: `${BRAND.scheme}$1://` },
  // URL.protocol comparisons: "t3code:" (not localStorage keys, which go on after the colon)
  {
    id: "scheme-protocol",
    find: /(?<=["'`])t3code(-dev|-preview)?(?=:["'`])/g,
    replace: `${BRAND.scheme}$1`,
  },
  {
    id: "scheme-const",
    find: /(?<=["'])t3code(-dev)?(?=["'])/g,
    replace: `${BRAND.scheme}$1`,
    only: /(ElectronProtocol\.ts|electron-launcher\.mjs|httpCors\.ts|DesktopEnvironment\.ts|build-desktop-artifact(\.test)?\.ts)$/,
  },
  {
    id: "profile-dir",
    find: /(?<=["'])t3code-(v2|dev)(?=["'])/g,
    replace: "zharf-code-$1",
  },
  {
    id: "linux-executable",
    find: /(?<=executableName: ["'])t3code(?=["'])/g,
    replace: BRAND.command,
  },
  { id: "desktop-file", find: /\bt3code\.desktop\b/g, replace: `${BRAND.command}.desktop` },
  { id: "service-unit", find: /\bt3code(?=\.service\b)/g, replace: BRAND.command },
  { id: "dbus-name", find: /\bcom\.t3tools\.(KdeCapture|SnapShot)\b/g, replace: "ai.zharf.$1" },
  { id: "dbus-path", find: /\/com\/t3tools\/(KdeCapture|SnapShot)\b/g, replace: "/ai/zharf/$1" },
  { id: "metainfo-developer", find: /(?<=<developer id=")com\.t3tools(?=")/g, replace: "ai.zharf" },
  { id: "pod-homepage", find: /\bhttps:\/\/t3tools\.com\b/g, replace: "https://zharf.ai" },
  { id: "pod-author", find: /\bhello@t3tools\.com\b/g, replace: "security@zharf.ai" },
  {
    id: "git-identity",
    find: /\bt3code@users\.noreply\.github\.com\b/g,
    replace: "zharf-code@users.noreply.github.com",
  },
  { id: "systemd-slice", find: /\bapp-t3code\b/g, replace: "app-zharf-code" },
  { id: "policy-templates", find: /\bt3code\.(admx|adml)\b/g, replace: "zharf-code.$1" },
  {
    id: "policy-admx-ns",
    find: /\bT3Tools\.Policies\.T3Code\b/g,
    replace: "ZharfAI.Policies.ZharfCode",
  },
  { id: "policy-admx-prefix", find: /(?<=<target prefix=")t3code(?=")/g, replace: "zharfcode" },
  {
    id: "linux-metainfo",
    find: /(?<=<(?:binary|icon type="stock")>)t3code(?=<)/g,
    replace: BRAND.command,
  },
  // The name people give our MCP server in other agents ("hermes mcp add t3code …")
  {
    id: "mcp-server-name",
    find: /^.*\bmcp(?:\b|_servers).*$/gm,
    replace: (line) => line.replace(/(?<![\w./@#:-])t3code(?![\w/@#:-]|\.\w)/g, BRAND.command),
  },
  // Sample shell prompts in the appearance previews
  {
    id: "preview-prompt",
    find: /(?<=\[1;36m|[\s>"'`])t3code(?![\w/@#:-])/g,
    replace: BRAND.command,
    only: /(SettingsFontPreviews|AppearancePreviews)\.tsx$/,
  },
  // Folders, services and names that would collide with an official T3 Code on the same machine.
  // The legacy-profile paths in DesktopUserData/DesktopLegacyLocalStorage then point at Zharf
  // folders that never existed, so nothing is ever copied from a T3 Code profile.
  {
    id: "path-segment",
    find: /(?<=\bjoin\([^()]*?)(["'])t3code\1/g,
    replace: `"${BRAND.command}"`,
  },
  {
    id: "legacy-profile",
    find: /(?<=V1_PROFILE_NAMES = \[[^\]]*)"t3code"/g,
    replace: `"${BRAND.command}"`,
  },
  { id: "boot-service", find: /(?<=BOOT_SERVICE_NAME = ")t3code(?=")/g, replace: BRAND.command },
  { id: "term-program", find: /(?<=TERM_PROGRAM(?: =|:) ")t3code(?=")/g, replace: BRAND.command },
  {
    id: "package-name",
    find: /(?<=^\s*name: ")t3code(?=",)/gm,
    replace: BRAND.command,
    only: /build-desktop-artifact\.ts$/,
  },
  {
    id: "home-dir",
    find: /(?<=^|[~/"'`\\\s]|\$HOME\/|%USERPROFILE%\\)\.t3(?![\w.-])/gm,
    replace: BRAND.homeDir,
  },

  // ── The command: `t3` becomes `zharf-code` ───────────────────────────────────────────────
  // Worktree branches: "t3/<hex>" becomes "zharf/<hex>"
  {
    id: "branch-tests",
    find: /(?<![\w./@#$-])([tT])3(?=["'`/]|-[Ff][Ii][Xx])/g,
    replace: (match) => (match === "t3" ? "zharf" : "Zharf"),
    only: /GitVcsDriverCore\.test\.ts$/,
  },
  { id: "branch-prefix", find: /(?<=WORKTREE_BRANCH_PREFIX = ")t3(?=")/g, replace: "zharf" },
  {
    id: "branch-example",
    find: /^.*t3\/(?:add-search|<hex>).*$/gm,
    replace: (line) => line.replace(/(?<![\w./@#\\-])t3(?=[\s/])/g, "zharf"),
  },
  { id: "branch-regex", find: /(?<=\^)t3(?=\\\/)/g, replace: "zharf", only: TEST_FILE },
  {
    id: "branch-literal",
    find: /(?<=["'`])t3\/(?=[\w.-]+["'`])/g,
    replace: "zharf/",
    only: TEST_FILE,
  },
  { id: "branch-default", find: /(?<=[`"'])t3\/(?=[`"'])/g, replace: "zharf/" },
  // The package.json bin entry and the code that reads or writes it
  { id: "cli-bin-key", find: /(?<=\{ )t3(?=: Schema\.String \})/g, replace: `"${BRAND.command}"` },
  { id: "cli-bin-write", find: /(?<=\bbin: \{ )t3(?=:)/g, replace: `"${BRAND.command}"` },
  {
    id: "cli-bin-object",
    find: /(?<=\{\s*)t3(?=:\s*["'`]\.\/bin\/)/g,
    replace: `"${BRAND.command}"`,
  },
  { id: "cli-bin-read", find: /\.bin\.t3\b/g, replace: `.bin["${BRAND.command}"]` },
  // npm, npx and bun caches of the published launcher: …/node_modules/t3/dist, …/cache/t3/bin
  // A home folder named after the command, in the runtime layout: …/t3/runtime/versions/…
  { id: "cli-home-dir", find: /(?<=\/)t3(?=\/runtime\/)/g, replace: BRAND.command },
  { id: "cli-package-dir", find: /(?<=\/)t3(?=\/(?:dist|bin)\/)/g, replace: BRAND.command },
  {
    id: "cli-npm",
    find: /(?<=registry\.npmjs\.org\/|node_modules\\?\/)t3(?=\\?\/)/g,
    replace: BRAND.command,
  },
  { id: "cli-ext", find: /(?<![\w.@#-])t3(?=\\?\.(?:cmd|exe|ps1|mjs)\b)/g, replace: BRAND.command },
  {
    id: "cli-at",
    find: /(?<![\w./@#-])t3@(?=[\d$<{v]|latest|next|nightly)/g,
    replace: `${BRAND.command}@`,
  },
  // Archive names: "t3-${version}-…", "t3-$version-win32-$arch", "t3-<version>-…"
  {
    id: "cli-archive",
    find: /(?<=["'`/ *]|\\[nrt])t3-(?=\$\{|\$[A-Za-z_]|<ver|v?\d)/g,
    replace: `${BRAND.command}-`,
  },
  { id: "cli-escaped", find: /(?<=\\[nrt])t3(?= [a-z])/g, replace: BRAND.command }, // printf '\nt3 install: …'
  // A path ending in the command: ${bin_dir}/t3, bin/t3, $1/t3
  {
    id: "cli-path",
    find: /(?<=[/\\])t3(?=["'`\s;:)\]%]|\$\/|\\[nrt]|$)/gm,
    replace: BRAND.command,
    not: /\.[ch]$/,
  },
  // The word itself, in prose, messages and command lines; not code named t3
  {
    id: "cli-word",
    find: /(?<![\w$./@#\\-])t3(?![\w#/@.[-]|\\(?![`'"])|\\?\.[A-Za-z])/g, // not regexes: t3[-_ ]?code
    replace: (match, offset, text, path) => {
      const before = text.slice(Math.max(0, offset - 12), offset);
      const after = text.slice(offset + match.length, offset + match.length + 6);
      // The server's workspace package stays "t3": Effect derives its service keys ("t3/…")
      // from it. Only the command people type is renamed.
      if (path === "apps/server/package.json" && /"name":\s*"$/.test(before)) return match;
      if (/--filter\s+$|affected\.includes\("$/.test(before)) return match;
      if (/^\s*(?:=[^=>]|!==|===|\?\?)/.test(after)) return match; // t3 = …, t3 !== …
      if (/(?:const|let|var|return|[{,([:=?])\s*$/.test(before) && /^\s*[,;})\]:]/.test(after)) {
        return match; // { t3, app }, return t3;, (t3), [t3]: …, projectId: t3 }
      }
      if (/^\s*:\s*[A-Za-z]/.test(after) && !/["'`]$/.test(before)) return match; // { t3: Schema }
      return BRAND.command;
    },
    not: /\.(c|h|cc|swift|kt|rs)$/,
  },

  // ── Names people read ────────────────────────────────────────────────────────────────────
  // \s+ keeps a name that JSX or Markdown wrapped across lines ("…through T3\n  Connect.")
  { id: "name", find: /\bT3(\s+)Code\b/g, replace: "Zharf$1Code" },
  { id: "name-hyphen", find: /\bT3-Code\b/g, replace: "Zharf-Code" },
  { id: "connect", find: /\bT3(\s+)Connect\b/g, replace: "Zharf$1Connect" },
  { id: "connect-hyphen", find: /\bT3-Connect\b/g, replace: "Zharf-Connect" },
  { id: "company", find: /\bT3(\s+)Tools\b(?!, Inc\.)/g, replace: BRAND.company },
  // "T3-thread", "T3-owned", Swedish "T3-tråd"
  { id: "compound-lower", find: /(?<![\w$@/.+=-])T3-(?=[a-zà-ÿ])/g, replace: "Zharf Code-" },
  // German "T3-Thread" in catalogs and docs, but not the T3-Mode-Limit or T3-Sender headers
  {
    id: "compound-upper",
    find: /(?<![\w$@/.+=-])T3-(?=[A-ZÀ-Þ][a-zà-ÿ])(?!Mode-Limit|Sender)/g,
    replace: "Zharf-Code-",
    only: CATALOG,
  },
  { id: "non-brand", find: /\bnon-T3\b/g, replace: "non-Zharf Code" },
  // "the T3 server", "T3's browser"; not T3.workflow(…), T3_FOO, T3Wordmark, T3-INSIGHT, T3 Chat
  {
    id: "bare",
    // not the `T3: {…}` global, nor `T3${name}Stream`-style generated identifiers
    find: /(?<![\w$@/.+=\\-])T3(?![\w$-]|\.[A-Za-z_]| Chat\b|:\s*[{[(])/g,
    replace: BRAND.name,
    not: /\.e2e\.[cm]?[jt]sx?$|^scripts\/scenarios\//, // scenarios type their fixture as T3
  },
];

/** Files and folders the rules never touch. */
export const SKIP: readonly RegExp[] = [
  /^LICENSE$/, // MIT: the copyright line stays
  /^third-party-licenses/,
  /^patches\//, // patches must keep matching the dependency they patch
  /^pnpm-lock\.yaml$/,
  /^zharf\//, // this tool
  /^\.repos\//,
  /^\.github\//, // replaced by the fork's own workflows
  /^apps\/marketing\//, // T3's own site and legal pages: replaced, not rebranded
  /^oxlint-plugin-t3code\//,
  /(^|\/)deps\/[^/]+\.tgz$/,
  /(^|\/)deps\/README\.md$/, // which of T3's dependency forks a tarball was built from: facts
  /^evals\//, // upstream's agent evaluation harness, not shipped
];

/** Files renamed after the rules run. */
export const RENAMES: readonly (readonly [from: string, to: string])[] = [
  ["scripts/npm-launcher/t3.mjs", "scripts/npm-launcher/zharf-code.mjs"],
  [
    "apps/desktop/resources/linux/com.t3tools.t3code.metainfo.xml",
    "apps/desktop/resources/linux/ai.zharf.code.metainfo.xml",
  ],
];

export function applyRules(path: string, text: string): string {
  let out = text;
  for (const rule of RULES) {
    if (rule.only && !rule.only.test(path)) continue;
    if (rule.not && rule.not.test(path)) continue;
    const { replace } = rule;
    out =
      typeof replace === "string"
        ? out.replace(rule.find, replace)
        : out.replace(rule.find, (match: string, ...rest: unknown[]) => {
            // String.replace passes groups, then offset, then the whole string (then named groups)
            const tail = typeof rest.at(-1) === "object" ? rest.slice(0, -1) : rest;
            return replace(match, tail.at(-2) as number, tail.at(-1) as string, path);
          });
  }
  return out;
}
