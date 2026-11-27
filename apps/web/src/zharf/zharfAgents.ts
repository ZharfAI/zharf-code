import type { ExecutionEnvironmentPlatformOs, ServerProvider } from "@t3tools/contracts";

/**
 * The Zharf agents: Claude Code and Codex instances that run on platform.zharf.ai and sign in
 * with a Zharf account (apps/server/src/zharf/ZharfAgents.ts holds the same two ids). They never
 * use the agent's own login command or Codex's ChatGPT setup.
 */
const ZHARF_INSTANCE_IDS: ReadonlySet<string> = new Set(["zharfClaude", "zharfCodex"]);

export const isZharfAgent = (provider: Pick<ServerProvider, "instanceId">): boolean =>
  ZHARF_INSTANCE_IDS.has(provider.instanceId);

/**
 * How a Zharf agent is installed where OpenAI's and Anthropic's download hosts do not answer.
 * Codex: OpenAI's own installer from the platform's mirror of Codex releases (Apache-2.0).
 * Claude Code may not be redistributed, so it comes from its official npm package.
 */
const INSTALL_COMMANDS: Readonly<Record<string, { windows: string; posix: string }>> = {
  zharfCodex: {
    windows: "irm https://platform.zharf.ai/code/agents/codex/install.ps1 | iex",
    posix: "curl -fsSL https://platform.zharf.ai/code/agents/codex/install.sh | sh",
  },
  zharfClaude: {
    windows: "npm install -g @anthropic-ai/claude-code",
    posix: "npm install -g @anthropic-ai/claude-code",
  },
};

export function zharfAgentInstallCommand(
  provider: Pick<ServerProvider, "instanceId">,
  platform: ExecutionEnvironmentPlatformOs,
): string | undefined {
  const commands = INSTALL_COMMANDS[provider.instanceId];
  if (commands === undefined) return undefined;
  return platform === "windows" ? commands.windows : commands.posix;
}
