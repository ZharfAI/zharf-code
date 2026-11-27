# FAQ

## What is Zharf Code?

A desktop and web app for coding agents. It runs the agents you already use (Claude Code, Codex,
Cursor, Grok Build, OpenCode, Google Antigravity, Kiro, Pi, Muse Code, fx) on your computer, a
server or a VPS, and gives them one interface. It is ZharfAI's build of
[T3 Code](https://github.com/pingdotgg/t3code), an open-source project by T3 Tools; it is not
made, endorsed or supported by T3 Tools. [Install](./install.md)

## Is Zharf Code a harness?

No. A harness is what turns a model into an agent: it gives the model tools, runs them and hands
the results back. Claude Code is an interface plus a harness (the Anthropic Agent SDK); Codex is
the Codex app plus the Codex App Server. Zharf Code uses those harnesses and does not work
without one. [Provider setup](./install.md#providers)

## What are the Zharf agents?

Claude Code and Codex, set up to run on [platform.zharf.ai](https://platform.zharf.ai) models
instead of a subscription. Sign in with your Zharf account once and both are ready, with the
platform's coding models (DeepSeek, GLM, Qwen, GPT, Claude and more) in their model lists. Their
work is paid from your Zharf balance, in ژرف. They answer on Iran's national network too.

## Can I use my own Claude or Codex subscription?

Yes. The Zharf agents sit next to your own; nothing about your subscription changes. Each agent
is a separate entry under **Settings → Providers**, and each thread uses the one you pick.

## How much does Zharf Code cost?

The app is free and open source (MIT). With your own subscriptions you pay your provider as you
already do. With the Zharf agents you pay for what they use, from your Zharf balance.

## Can I fork or redistribute Zharf Code?

The source code is MIT-licensed. The licence does not cover the Zharf Code and ZharfAI names and
logos, nor T3 Code's: a fork must use its own branding. See [TRADEMARK.md](../../TRADEMARK.md).

## Will I get banned for using my subscription?

Zharf Code runs the official Claude Code and Codex programs with your own login, the way their
makers ship them; it does not copy or share your credentials. We cannot speak for Anthropic,
OpenAI or anyone else: read and follow each provider's terms for your plan.

## Can I add several accounts for one provider?

Yes, as separate providers: [Codex](./providers-codex.md#use-multiple-accounts) ·
[Claude](./providers-claude.md#separate-accounts-or-configurations). Switching a thread between
them is up to you. Providers may limit or ban accounts that are used to get around their usage
limits, so check their terms before using several accounts for one person. When a subscription
reaches its limit, the Zharf agents are a way to keep working, paid per use.

## Can I use an API key or OpenRouter instead of a subscription?

Yes. Add another provider in Settings and give it its own key and endpoint; your subscription
setup stays untouched. The Zharf agents are this, already set up for platform.zharf.ai.
[OpenRouter](./providers-claude.md#openrouter) · [Provider instances](./install.md#providers)

## Where do my code and prompts go?

To the model provider of the agent you use: Anthropic or OpenAI with your own subscription,
platform.zharf.ai with the Zharf agents, and so on. Zharf Code itself sends no usage analytics.
[Product usage data](./telemetry.md)

## How do I use Zharf Code remotely?

Your agents run wherever Zharf Code runs. Run `zharf-code up` on that machine, then connect from
your other devices over your local network or [Tailscale](./remote-access.md). Zharf Connect,
the hosted way to connect from anywhere, is not available yet. [Remote access](./remote-access.md)

## Is there a phone app?

Not yet. The Zharf Code phone apps are planned.

## Worktrees are eating my disk. How do I clean them up?

Open **Settings → Worktrees → Cleanup** and turn on automatic worktree cleanup. You can also run
it now from there. [Storage cleanup](./project-settings.md#storage-cleanup)

## Is there voice input?

On macOS 26 or later, the desktop app can use Apple Speech under **On this Mac**. Elsewhere,
dictation needs an environment that offers it. The transcript goes into your draft for review.
[Voice input](./voice-input.md)

## Does it work on Windows, Mac, and Linux?

Yes: the desktop app on all three, and the `zharf-code` command everywhere except Intel Macs,
where the desktop app is the way to run it. On Windows, agents can also run inside WSL.
[Install](./install.md)

## Why is my provider not showing up?

Almost always, its program is not installed or not on the `PATH` of the machine that runs Zharf
Code. Sign in on that machine first, like `codex login` or `claude auth login`. Still missing?
Point **Binary path** at it in the provider's settings. [Provider setup](./install.md#providers)
