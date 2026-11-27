# zharf/: how Zharf Code is kept apart from upstream

Zharf Code follows T3 Code's releases. Everything that makes it Zharf Code lives in this folder
or in a small number of commits on `main`, so a new upstream release merges in with few
conflicts.

## Branches, versions and tags

- **`upstream-rebranded`**: each commit is one upstream tag, rebranded by `rebrand/rebrand.ts`
  and never edited by hand. Its parents are the previous rebranded commit and the upstream tag,
  so the history stays connected to T3 Code's.
- **`main`**: `upstream-rebranded` plus the fork's own commits (the Zharf sign-in and agents,
  update and download addresses, release workflows, analytics off). Releases are cut from here.
- **Versions** are the upstream version they are built on plus `-zharf.N`: `0.1.12-zharf.1`,
  tagged `v0.1.12-zharf.1`. Feature checks that compare versions keep meaning what upstream
  meant, and the desktop updater accepts the prerelease suffix.
- **Never push upstream's tags to origin.** Zharf Code's release workflow runs on `v*-zharf.*`
  tags; `sync-upstream.sh` fetches the one tag it needs without the others.

To take a new upstream release, from `main` with a clean work tree:

```bash
git fetch upstream main
zharf/rebrand/sync-upstream.sh v0.1.13     # installs, rebrands, checks, writes upstream-rebranded
git merge upstream-rebranded               # fix conflicts, then run the tests
```

To try a tag without touching `upstream-rebranded`: `SYNC_BRANCH=try/<tag> zharf/rebrand/sync-upstream.sh <tag>`.

## The rebrand

`node zharf/rebrand/rebrand.ts --root <tree>` turns an upstream tree into Zharf Code in place:

1. **`rules.ts`**: text rules for names, addresses, app ids, the `zharf-code` command, the
   `~/.zharf-code` folder and machine-wide names (services, scheduled tasks, locks) that would
   collide with an official T3 Code installed on the same computer. Identifiers that other
   programs or stored data depend on are kept: storage keys, `T3CODE_*` variables, the `t3.json`
   project file, the `t3-code` MCP server name, `t3-thread://` links, internal package scopes.
2. **`delete.txt`**: upstream files the fork does not ship (T3's deploy and store workflows, its
   AUR packages).
3. **`overrides/`**: files copied over upstream's (icons, the wordmark component, README).
   To change the mark: edit `brand/mark.svg`, run `node zharf/brand/make-overrides.ts`, rebrand
   a tree, run `node scripts/export-brand-icons.ts` in it (needs Icon Composer, from Xcode),
   copy the PNG/ICO files it changed into `overrides/`, then run
   `zharf/brand/make-macos-icons.sh <tree>` for the three macOS icons.
4. **`sections/`**: Markdown sections replaced by heading (for example the download section of
   `docs/user/install.md`), so the rest of the page keeps following upstream.
5. **Formatting**: every changed file is formatted, so a longer name never makes a later
   hand-written commit reflow a whole file.
6. **Translations**: the General Translation catalogs are keyed by a hash of the English text, so
   every changed English string gets a new key; each translation is moved to it.
7. **`gate.ts`**: fails if any T3 name, domain or identity is left, apart from the identifiers in
   `KEEP` and known work in `PENDING`. `--strict` fails on the pending list too (T3's website and CI,
   the phone apps, the relay, the T3 Chat UI). Run it on build output as well:
   `node zharf/rebrand/gate.ts <dir> [--strict]`.

It is idempotent: running it on a rebranded tree changes nothing.

## The Zharf agents

Zharf Code adds no driver of its own. "Sign in with Zharf" saves a platform key, and the app
keeps provider instances of upstream's own drivers pointed at platform.zharf.ai. Checked live on
2026-11-27 (Claude Code 2.1.332, Codex 0.169, through the app server):

- **Claude Code** (`claudeAgent`): `ANTHROPIC_BASE_URL=https://platform.zharf.ai/anthropic`,
  `ANTHROPIC_AUTH_TOKEN=<key>`, `ANTHROPIC_API_KEY=""`, its own `homePath`, and
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`: without it each turn also calls
  api.anthropic.com, which is blocked from Iran.
- **Codex** (`codex`, `setupMode: "existing"`, its own `homePath`): `ZHARF_API_KEY=<key>` and
  launch arguments `-c model_provider="zharf" -c model_providers.zharf.{name,base_url,env_key,
  wire_api="responses"}`. A turn then contacts only platform.zharf.ai.
- **Models**: neither agent lists the platform's models by itself (Claude Code's gateway
  discovery did not, Codex lists its own catalogue), and the app refuses a model the instance
  does not advertise. So the platform's coding models (text out, tool calls) are written into
  each instance's `customModels`; DeepSeek, GLM and GPT models then run in both agents.

**Sign in with Zharf** (`apps/server/src/zharf/`, hooked in from `builtInDrivers.ts`,
`ProviderInstanceRegistryHydration.ts` and the welcome page):

- On first start the server adds the two agents, `zharfClaude` and `zharfCodex`, with the
  variables above and a blank key, so a key or login in the user's shell never reaches the
  platform. One the user removes is not added again (`userdata/zharf-agents.json`).
- Their sign-in is the platform's device flow (`client: "zharf-code"`). The key is saved as a
  secret variable in both agents (secret store, not `settings.json`), with the platform's coding
  models; the model list is refreshed in the background at each start.
- Saving the key rebuilds the agents, so the sign-in lives for the server's lifetime and each
  rebuilt agent gets the same one.
- `ZHARF_CODE_PLATFORM_URL` points a development build at another platform;
  `ZHARF_CODE_AGENTS=off` leaves the agents out (the server's tests set it, since upstream's
  tests expect only upstream's agents).

## Brand

- Name: Zharf Code. Command: `zharf-code`. App id: `ai.zharf.code`. URL scheme: `zharfcode://`.
- Home folder: `~/.zharf-code`. Worktree branches: `zharf/<hex>`.
- Site, downloads and updates: <https://platform.zharf.ai/code>.
- Legal pages: <https://zharf.ai/privacy>, <https://zharf.ai/terms>. Contact: security@zharf.ai.
- The mark is the ZharfAI mark from the ZharfAI stationery kit (`brand/mark.svg`).
