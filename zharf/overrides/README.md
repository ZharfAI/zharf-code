<p align="center">
  <a href="https://platform.zharf.ai/code">
    <img src="./assets/prod/logo.svg" width="80" height="80" alt="Zharf Code" />
  </a>
</p>

<h1 align="center">Zharf Code</h1>

<p align="center">Run Claude Code, Codex, OpenCode and more on every model of <a href="https://platform.zharf.ai">platform.zharf.ai</a>, from one app.</p>

<p align="center">
  <a href="https://platform.zharf.ai/code"><strong>Download</strong></a> ·
  <a href="./docs/README.md">Docs</a> ·
  <a href="#راهنمای-فارسی">فارسی</a>
</p>

Zharf Code runs the coding agents on your machine and gives them one interface: threads, diffs,
worktrees, terminals, and a button to commit, push and open a pull request. Sign in to Zharf once
and Claude Code, Codex and OpenCode run on the platform's models, paid in ژرف from your Zharf
balance. Your own Claude or ChatGPT subscription works too, side by side.

> **Status:** the first release is being prepared. Until it is out, build from source
> ([development runbook](./docs/operations/00_development.md)).

## What you get

- **One sign-in, every model.** Sign in with Zharf and pick GPT-5, Claude, Gemini 3, DeepSeek V4,
  Qwen 3.5, GLM-5, Kimi K2 and more in the model picker, priced in ژرف.
- **Your subscriptions too.** Add a Claude Code or Codex login, Cursor, OpenCode, or any
  [ACP](./docs/user/providers-acp.md) agent.
- **Desktop and web.** macOS, Windows and Linux apps, and a `zharf-code` command that serves the
  same app to your browser.
- **Remote ready.** Run agents on another machine and connect over your network or Tailscale.
- **Git built in.** Each thread can work in its own worktree.

## Install

Downloads will be served from [platform.zharf.ai/code](https://platform.zharf.ai/code), which
also works on Iran's national network.

```bash
curl -fsSL https://platform.zharf.ai/code/install.sh | sh        # macOS, Linux
```

```powershell
irm https://platform.zharf.ai/code/install.ps1 | iex             # Windows
```

## Where it comes from

Zharf Code is an unofficial fork based on the [T3 Code](https://github.com/pingdotgg/t3code)
source code. It is not affiliated with, endorsed by, or maintained by T3 Tools, Inc. The fork
follows T3 Code's releases; [zharf/README.md](./zharf/README.md) explains how the rebrand and the
Zharf additions are kept apart from upstream code.

## License

The source code is under the [MIT License](./LICENSE), as upstream. The ZharfAI name and mark are
ZharfAI's; see [TRADEMARK.md](./TRADEMARK.md). Report security problems to security@zharf.ai
([SECURITY.md](./SECURITY.md)).

---

<div dir="rtl">

## راهنمای فارسی

Zharf Code برنامه‌ای برای کار با عامل‌های برنامه‌نویسی مثل Claude Code و Codex و OpenCode است، روی مک، ویندوز و لینوکس. یک بار وارد حساب ژرف می‌شوید و از آن به بعد این عامل‌ها با مدل‌های [پلتفرم ژرف](https://platform.zharf.ai) کار می‌کنند. هزینه‌ی هر درخواست هم از اعتبار ژرف حسابتان کم می‌شود. اگر اشتراک Claude یا ChatGPT دارید، می‌توانید آن را هم کنار حساب ژرف اضافه کنید.

نسخه‌ی اول هنوز منتشر نشده است. بعد از انتشار، فایل‌های نصب از [platform.zharf.ai/code](https://platform.zharf.ai/code) دانلود می‌شوند که روی شبکه‌ی ملی هم در دسترس است.

Zharf Code از کد منبع T3 Code ساخته شده است، ولی محصول شرکت T3 Tools نیست و آن شرکت در ساخت و پشتیبانی آن نقشی ندارد.

</div>
