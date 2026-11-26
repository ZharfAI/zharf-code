# zharf/: how Zharf Code is kept apart from upstream

Zharf Code follows T3 Code's releases. Everything that makes it Zharf Code lives in this folder
or in a small number of commits on `main`, so a new upstream release merges in with few
conflicts.

## Branches

- **`upstream-rebranded`**: each commit is one upstream release tag, rebranded by
  `rebrand/rebrand.ts` and never edited by hand. Its parents are the previous rebranded commit
  and the upstream tag, so the history stays connected to T3 Code's.
- **`main`**: `upstream-rebranded` plus the fork's own commits (the Zharf sign-in and agents,
  update and download addresses, release workflows, telemetry off). Releases are cut from here.

To take a new upstream release:

```bash
git fetch upstream --tags
zharf/rebrand/sync-upstream.sh v0.1.13     # writes upstream-rebranded
git merge upstream-rebranded               # into main; fix conflicts, run the checks
```

## The rebrand

`node zharf/rebrand/rebrand.ts --root <tree>` turns an upstream tree into Zharf Code in place:

1. **`rules.ts`**: text rules for names, addresses, app ids, the `zharf-code` command and the
   `~/.zharf-code` folder. Identifiers that other programs or stored data depend on are kept on
   purpose; the comment at the top of the file lists them.
2. **`delete.txt`**: upstream files the fork does not ship (T3's deploy and store workflows, its
   AUR packages).
3. **`overrides/`**: files copied over upstream's (icons, the wordmark component, README).
   To change the mark: edit `brand/mark.svg`, run `node zharf/brand/make-overrides.ts`, rebrand
   a tree, run `node scripts/export-brand-icons.ts` in it (needs Icon Composer, from Xcode),
   copy the PNG/ICO files it changed into `overrides/`, then run
   `zharf/brand/make-macos-icons.sh <tree>` for the three macOS icons.
4. **`sections/`**: Markdown sections replaced by heading (for example the download section of
   `docs/user/install.md`), so the rest of the page keeps following upstream.
5. **Translations**: the General Translation catalogs are keyed by a hash of the English text, so
   every changed English string gets a new key; each translation is moved to it.
6. **`gate.ts`**: fails if any T3 name, domain or identity is left outside the allowed
   identifiers. Run it on build output too: `node zharf/rebrand/gate.ts <dir>`.

It is idempotent: running it on a rebranded tree changes nothing.

## Brand

- Name: Zharf Code. Command: `zharf-code`. App id: `ai.zharf.code`. URL scheme: `zharfcode://`.
- Home folder: `~/.zharf-code`. Worktree branches: `zharf/<hex>`.
- Site and downloads: <https://platform.zharf.ai/code>.
- The mark is the ZharfAI mark from the ZharfAI stationery kit (`brand/mark.svg`).
