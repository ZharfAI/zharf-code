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
/** Tests whose T3 strings are sample data, not the product's names: a username or tenant, a
 *  search query, a project, a repository or clone folder to parse. The repository, name and
 *  command rules leave them alone, so input and expectation stay the same word. */
const SAMPLE_DATA = new RegExp(
  [
    /^apps\/server\/src\/feedback\/scrubFeedback\.test\.ts$/, // "t3", a two-letter username
    /^apps\/server\/src\/sourceControl\/SourceControlRepositoryService\.test\.ts$/, // clone folder
    /^apps\/web\/src\/components\/CommandPalette\.logic\.test\.ts$/, // "t3" finds project t3code
    /^packages\/client-runtime\/src\/operations\/projects\.test\.ts$/, // clone folder from a URL
    /^packages\/client-runtime\/src\/state\/filesystem\.test\.ts$/, // "t3" completes t3code
    /^packages\/shared\/src\/observability\.test\.ts$/, // x-tenant=t3
    /^packages\/shared\/src\/paletteSearch\.test\.ts$/, // queries against T3 titles and projects
    /^packages\/source-control-bitbucket\/src\/server\/BitbucketApi\.test\.ts$/, // a fork's name
    /^packages\/source-control-github\/src\/server\/GitHubAppSignIn\.test\.ts$/, // account login
  ]
    .map((re) => re.source)
    .join("|"),
);

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

/** A GitHub heading anchor as the renamed heading spells it: "T3 Code" and "T3 Connect" become
 *  "zharf-code" and "zharf-connect", the `t3` command "zharf-code"; "T3 Chat" stays. */
function brandAnchor(anchor: string): string {
  return anchor
    .replace(/(?<![a-z0-9])t3-(?=(?:code|connect)(?![a-z0-9]))/g, "zharf-")
    .replace(/(?<![a-z0-9])t3(?=-command(?![a-z0-9]))/g, BRAND.command);
}

export const RULES: readonly Rule[] = [
  // ── Repository and web addresses ─────────────────────────────────────────────────────────
  // Lowercase stays lowercase: code compares repositories case-insensitively by lowercasing them.
  {
    id: "repo",
    find: /pingdotgg\/t3code/gi,
    replace: (match) => (match === match.toLowerCase() ? BRAND.repo.toLowerCase() : BRAND.repo),
    not: SAMPLE_DATA,
  },
  {
    id: "repo-pair",
    find: /\bowner(["']?:\s*)(["'])pingdotgg\2(,\s*["']?(?:repo|name)["']?:\s*)(["'])t3code\4/g,
    replace: "owner$1$2zharfai$2$3$4zharf-code$4",
    not: SAMPLE_DATA,
  },
  // The same pair passed as two arguments: ids("pingdotgg", "t3code")
  {
    id: "repo-args",
    find: /(["'])pingdotgg\1(,\s*)(["'])t3code\3/g,
    replace: "$1zharfai$1$2$3zharf-code$3",
    not: SAMPLE_DATA,
  },
  { id: "mcp-app-name", find: /\bT3%20Code\b/g, replace: "Zharf%20Code" },
  // The hosted web app needs an origin of its own (code compares URL origins), so it gets a
  // subdomain; it only matters once Zharf Connect is deployed.
  {
    id: "hosted-app",
    find: /\b(?:nightly\.|latest\.|preview\.)?app\.t3\.codes\b/g,
    replace: "code.zharf.ai",
  },
  // T3's store listings: Zharf Code's phone apps are not published yet, so the download page.
  {
    id: "store-links",
    find: /https:\/\/(?:apps\.apple\.com\/[a-z]{2}\/app\/t3-code-remote-claude-more\/id6787819824|play\.google\.com\/store\/apps\/details\?id=com\.t3tools\.t3code)/g,
    replace: "https://platform.zharf.ai/code",
  },
  // The same legal pages platform.zharf.ai links to.
  {
    id: "legal-privacy",
    find: /(https?:\/\/)?(?<![\w.-])t3\.codes\/privacy-policy\b/g,
    replace: "https://zharf.ai/privacy",
  },
  {
    id: "legal-terms",
    find: /(https?:\/\/)?(?<![\w.-])t3\.codes\/terms-of-service\b/g,
    replace: "https://zharf.ai/terms",
  },
  // One download page for every platform, the phone apps included.
  {
    id: "download-page",
    find: /(https?:\/\/)?(?<![\w.-])t3\.codes\/(?:download|mobile)\b/g,
    replace: "$1platform.zharf.ai/code",
  },
  { id: "relay", find: /\brelay\.t3\.codes\b/g, replace: "relay.zharf.ai" },
  // Host names compare case-insensitively, so an upper-case spelling stays upper case.
  {
    id: "clerk",
    find: /\bclerk\.t3\.codes\b/gi,
    replace: (match) => (match === match.toUpperCase() ? "ACCOUNTS.ZHARF.AI" : "accounts.zharf.ai"),
  },
  { id: "ingest", find: /\bingest\.t3\.codes\b/g, replace: "ingest.zharf.ai" },
  {
    id: "email",
    find: /\b([a-z0-9._+-]+)@t3\.(?:codes|tools)\b/g,
    replace: (match) =>
      /^(noreply|bench)@/.test(match) ? match.replace(/@.*/, "@zharf.ai") : "security@zharf.ai",
  },
  { id: "site", find: /(https?:\/\/)?(?<![\w.-])t3\.codes\b/g, replace: `$1${SITE_HOST_PATH}` },
  // Heading anchors: the guides' headings are renamed, so links to them follow ("#the-t3-command"
  // is now "#the-zharf-code-command"). Markdown links, and the troubleshooting sections the app
  // links to as "More info". Not file names (t3-connect-troubleshooting.md) nor "T3 Chat".
  { id: "doc-anchor", find: /(?<=\]\([^)\s]*#)[a-z0-9-]+(?=\))/g, replace: brandAnchor },
  {
    id: "troubleshooting-anchor",
    find: /(?<=["'`])[a-z0-9-]*\bt3-(?:code|connect)\b[a-z0-9-]*(?=["'`])/g,
    replace: brandAnchor,
    only: /^packages\/(contracts\/src\/environmentHttp|client-runtime\/src\/connection\/diagnosis)(\.test)?\.ts$/,
  },

  // ── App identity ─────────────────────────────────────────────────────────────────────────
  { id: "app-id", find: /\bcom\.t3tools\.t3code\b/g, replace: BRAND.appId },
  { id: "app-id-regex", find: /\bcom\\\.t3tools\\\.t3code\b/g, replace: "ai\\.zharf\\.code" },
  { id: "wm-class", find: /\bcom\.t3tools\.T3Code\b/g, replace: BRAND.wmClass },
  { id: "app-group", find: /\bgroup\.com\.t3tools\./g, replace: "group.ai.zharf." },
  { id: "policy-registry", find: /T3Tools(\\+)T3Code/g, replace: "ZharfAI$1ZharfCode" },
  // A folder on disk, not a repository in a URL (github.com/T3Tools/T3Code/pull/123)
  {
    id: "policy-folder",
    find: /(?<=[/\\])(?<!:\/\/[^\s"'`]*)T3Code(?=[/\\])/g,
    replace: "ZharfCode",
  },
  { id: "policy-etc", find: /\/etc\/t3code\b/g, replace: "/etc/zharf-code" },
  {
    id: "scheme-regex",
    find: /(?<=[\^/])t3code(?=\((?:\?:)?[-\[\]a-z|+]+\)\??:)/g,
    replace: BRAND.scheme,
  },
  // A URL scheme matched by a regex literal: /^t3code-dev:\/\//
  {
    id: "scheme-regex-literal",
    find: /(?<=\^)t3code(-dev|-preview)?(?=:\\\/\\\/)/g,
    replace: `${BRAND.scheme}$1`,
  },
  { id: "scheme-default", find: /(?<=\bscheme = ")t3code(?=")/g, replace: BRAND.scheme },
  // The scheme an app registers or a handler is given: { scheme: "t3code-dev" } (the phone app's
  // Expo config, the desktop protocol and Linux URL handler)
  {
    id: "scheme-key",
    find: /(?<=\bscheme:\s*["'])t3code(-dev|-preview)?(?=["'])/g,
    replace: `${BRAND.scheme}$1`,
  },
  // …and allowed as a source in the protocol's Content-Security-Policy: "img-src 'self' t3code-dev:"
  {
    id: "scheme-csp",
    find: /(?<=-src 'self' )t3code(-dev|-preview)?(?=:\s)/g,
    replace: `${BRAND.scheme}$1`,
  },
  {
    id: "scheme-line",
    find: /^.*:\/\/.*$/gm,
    replace: (line) =>
      /\$\{[^}]*["'`]t3code(?:-dev)?["'`]/.test(line)
        ? line.replace(/(["'`])(?:t3code|zharf-code)(-dev)?\1/g, `$1${BRAND.scheme}$2$1`)
        : line,
  },
  { id: "scheme-upper", find: /\bT3CODE(?=:\/\/)/g, replace: "ZHARFCODE" },
  {
    id: "scheme-mime",
    find: /(?<=x-scheme-handler\/)t3code(-dev)?\b/g,
    replace: `${BRAND.scheme}$1`,
  },
  { id: "scheme-url", find: /\bt3code(-dev|-preview)?:\/\//g, replace: `${BRAND.scheme}$1://` },
  // URL.protocol comparisons: "t3code:" (not localStorage keys, which go on after the colon, nor
  // the "t3code:<tool>" MCP label prefix the tool presentation test lists)
  {
    id: "scheme-protocol",
    find: /(?<=["'`])t3code(-dev|-preview)?(?=:["'`])/g,
    replace: `${BRAND.scheme}$1`,
    not: /t3McpToolPresentation\.test\.ts$/,
  },
  {
    id: "scheme-const",
    find: /(?<=["'])t3code(-dev)?(?=["'])/g,
    replace: `${BRAND.scheme}$1`,
    only: /(ElectronProtocol(\.test)?\.ts|electron-launcher\.mjs|httpCors\.ts|DesktopEnvironment\.ts|build-desktop-artifact(\.test)?\.ts|providerAuthReturnUrl\.test\.ts)$/,
  },
  // The profile folders, and the legacy "t3code" folder whose Windows keys are copied
  {
    id: "profile-dir",
    find: /(?<=["'])t3code(-v2|-dev)?(?=["'])/g,
    replace: "zharf-code$1",
    only: /DesktopUserData(\.test)?\.ts$/,
  },
  {
    id: "profile-dir-path",
    find: /(?<=[/\\])t3code-(v2|dev)(?=["'`/\\]|$)/gm,
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
  // The name people give our MCP server in other agents ("hermes mcp add t3code …"); a line that
  // merely says "mcp" (a search query "trim mcp") is not one
  {
    id: "mcp-server-name",
    find: /^.*\bmcp(?:\s+(?:add|login|remove|get)\b|_servers).*$/gm,
    replace: (line) => line.replace(/(?<![\w./@#:-])t3code(?![\w/@#:-]|\.\w)/g, BRAND.command),
  },
  // The MCP server introduces itself as "Zharf Code" (McpServer name), and a provider that titles
  // a call with that name ("Zharf Code t3_thread_list") must still be read as our tool.
  {
    id: "mcp-display-name",
    find: /(?<=\{1,2\}\)\?)t3\[-_ \]\?code/g,
    replace: "(?:zharf[-_ ]?code|t3[-_ ]?code)",
    only: /^packages\/(shared\/src\/t3McpToolPresentation|provider-acp\/src\/server\/runtimeModel)\.ts$/,
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
  // join(dataHome, "t3code", …) and join(dataHome, "t3code/extension-backups")
  {
    id: "path-segment",
    find: /(?<=\bjoin\([^()]*?)(["'])t3code(?=\1|\/)/g,
    replace: `$1${BRAND.command}`,
    not: SAMPLE_DATA,
  },
  // The same folder under a Windows profile: join(…, "AppData", "Local", "t3code", …)
  {
    id: "local-app-data",
    find: /(?<=["']Local["'],\s*)(["'])t3code\1/g,
    replace: `$1${BRAND.command}$1`,
  },
  // The Windows boot service's task file, beside its systemd unit and launchd plist
  { id: "task-file", find: /\bt3code(?=-task\.xml\b)/g, replace: BRAND.command },
  // The CLI's compile cache under XDG_CACHE_HOME: …/cache/t3code/compile-cache
  { id: "compile-cache-dir", find: /(?<=\/)t3code(?=\/compile-cache\b)/g, replace: BRAND.command },
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
    id: "os-names",
    // The scheduled task t3code-${domain}-${user} is spelled out in tests: t3code-PC-theo
    find: /\bt3code(?=-\$\{domain\}|-<domain>|-PC-|-\$\{name\}-|-\$\{userKey\}|-provider-updates\b|-backend-recovery\b|\.mobileconfig\b|[-/]pr-)|(?<=startsWith\(")t3code(?=-")|(?<=\b90-)t3code(?=-protect\.conf)|(?<=\^)t3code(?=\[\/-\]pr-)/g,
    replace: BRAND.command,
  },
  // The control socket's folder, as its test spells it; the longer name needs a shorter sample
  // folder to stay under macOS's 103-byte socket limit
  {
    id: "control-socket-test",
    find: /\bt3code(?=-1000\b)|(?<="x"\.repeat\()56(?=\))/g,
    replace: (match) => (match === "56" ? "52" : BRAND.command),
    only: /^packages\/shared\/src\/desktopAppControl\.test\.ts$/,
  },
  { id: "log-tag", find: /\[t3code\]/g, replace: `[${BRAND.command}]` },
  // The DISPLAY ssh's askpass gets, and the test that reads it back (env.DISPLAY, "t3code")
  {
    id: "ssh-display",
    find: /(?<=DISPLAY(?::|,) ["'])t3code(?=["'])/g,
    replace: BRAND.command,
  },
  {
    id: "user-agent",
    find: /(?<=["']user-agent["']:\s*["'])t3code(?=["'])/gi,
    replace: BRAND.command,
  },
  // Not a host in a regex: /preview\.t3\.codes/
  {
    id: "home-dir",
    find: /(?<=^|[~/"'`\\\s]|\$HOME\/|%USERPROFILE%\\)\.t3(?![\w.-]|\\\.)/gm,
    replace: BRAND.homeDir,
    not: SAMPLE_DATA,
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
  // The flat form used when a "zharf" branch blocks nested refs: "zharf-<hex>", typed or in part
  // ("t3-abcd"); not ids that are only digits ("t3-0", Pi's request ids)
  {
    id: "branch-flat",
    find: /(?<![\w.@#$-])t3-(?=(?=\d*[a-f])[0-9a-f]{4,8}(?![\w-])|<hex>)/g,
    replace: "zharf-",
  },
  // …and the branch that blocks them: "a plain t3 branch", "a `t3` branch"
  { id: "branch-word", find: /(?<![\w./@#$-])t3(?=[`"']? branch\b)/g, replace: "zharf" },
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
  // Archive names: "t3-${version}-…", "t3-$version-win32-$arch", "t3-<version>-…", "t3-1.2.3-…";
  // not Pi's RPC request ids (`t3-${nextRequestId++}`, "t3-0"), which its replay testkit matches
  {
    id: "cli-archive",
    find: /(?<=["'`/ *]|\\[nrt])t3-(?=\$\{(?!nextRequestId\b)|\$[A-Za-z_]|<ver|v?\d+\.\d)/g,
    replace: `${BRAND.command}-`,
  },
  { id: "cli-escaped", find: /(?<=\\[nrt])t3(?= [a-z])/g, replace: BRAND.command }, // printf '\nt3 install: …'
  // The name in lower case, as people type it into a search ("t3 code"): not the command
  {
    id: "name-lower",
    find: /\bt3( +)code\b/g,
    replace: "zharf$1code",
    not: /\.(c|h|cc|swift|kt|rs)$/,
  },
  // A path ending in the command: ${bin_dir}/t3, bin/t3, $1/t3
  {
    id: "cli-path",
    find: /(?<=[/\\])t3(?=["'`\s;:)\]%]|\$\/|\\[nrt]|$)/gm,
    replace: BRAND.command,
    not: new RegExp(`\\.[ch]$|${SAMPLE_DATA.source}`),
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
      if (/--filter[\s=]+$|affected\.includes\("$/.test(before)) return match; // the package "t3"
      if (/^\s*(?:=[^=>]|!==|===|\?\?)/.test(after)) return match; // t3 = …, t3 !== …
      if (/(?:const|let|var|return|[{,([:=?])\s*$/.test(before) && /^\s*[,;})\]:]/.test(after)) {
        return match; // { t3, app }, return t3;, (t3), [t3]: …, projectId: t3 }
      }
      if (/^\s*:\s*[A-Za-z]/.test(after) && !/["'`]$/.test(before)) return match; // { t3: Schema }
      return BRAND.command;
    },
    not: new RegExp(`\\.(c|h|cc|swift|kt|rs)$|${SAMPLE_DATA.source}`),
  },

  // ── Names people read ────────────────────────────────────────────────────────────────────
  // \s+ keeps a name that JSX or Markdown wrapped across lines ("…through T3\n  Connect.")
  { id: "name", find: /\bT3(\s+)Code\b/g, replace: "Zharf$1Code", not: SAMPLE_DATA },
  { id: "name-plus", find: /\bT3\+Code\b/g, replace: "Zharf+Code" }, // a form-encoded body
  { id: "name-hyphen", find: /\bT3-Code\b/g, replace: "Zharf-Code" },
  { id: "connect", find: /\bT3(\s+)Connect\b/g, replace: "Zharf$1Connect", not: SAMPLE_DATA },
  { id: "connect-hyphen", find: /\bT3-Connect\b/g, replace: "Zharf-Connect" },
  { id: "company", find: /\bT3(\s+)Tools\b(?!, Inc\.)/g, replace: BRAND.company },
  // "T3-thread", "T3-owned", Swedish "T3-tråd"; not "T3-code.<tool>", the MCP server's name
  {
    id: "compound-lower",
    find: /(?<![\w$@/.+=-])T3-(?=[a-zà-ÿ])(?!code\b)/g,
    replace: "Zharf Code-",
  },
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
    // not the `T3: {…}` global, nor `T3${name}Stream`-style generated identifiers, nor the global
    // a workflow script destructures (`const { workflow } = T3;`) or a guide names as code (`T3`)
    find: /(?<![\w$@/.+=\\-])(?<!=\s+)(?!(?<=`)T3`)T3(?![\w$-]|\.[A-Za-z_]| Chat\b|:\s*[{[(])/g,
    replace: BRAND.name,
    not: /\.e2e\.[cm]?[jt]sx?$|^scripts\/scenarios\/|\.test\.[cm]?[jt]sx?$/, // scenarios type their fixture as T3
  },
  // Tests: also inside strings ("T3 server is running as root", "T3's browser"), so they expect
  // what the code now says; not a string that is only "T3" (monogram fixtures), nor one that
  // ends in T3 (sample names)
  {
    id: "bare-tests",
    find: /(?<![\w$@/.+=\\-])(?<!=\s+)T3(?![\w$-]|\.[A-Za-z_]| Chat\b|:\s*[{[(])/g,
    replace: (match, offset, text) => {
      const after = text.slice(offset + 2, offset + 4);
      if (/^["`]/.test(after) || (/^'/.test(after) && after !== "'s")) return match;
      return BRAND.name;
    },
    only: /\.test\.[cm]?[jt]sx?$/,
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
  // replaced by the fork's own workflows; not the triage playbook and the issue form it files
  // with, which `zharf-code triage` fetches from the repository at run time
  /^\.github\/(?!triage\/|ISSUE_TEMPLATE\/)/,
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
