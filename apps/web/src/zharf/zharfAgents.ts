import type { ServerProvider } from "@t3tools/contracts";

/**
 * The Zharf agents: Claude Code and Codex instances that run on platform.zharf.ai and sign in
 * with a Zharf account (apps/server/src/zharf/ZharfAgents.ts holds the same two ids). They never
 * use the agent's own login command or Codex's ChatGPT setup.
 */
const ZHARF_INSTANCE_IDS: ReadonlySet<string> = new Set(["zharfClaude", "zharfCodex"]);

export const isZharfAgent = (provider: Pick<ServerProvider, "instanceId">): boolean =>
  ZHARF_INSTANCE_IDS.has(provider.instanceId);
