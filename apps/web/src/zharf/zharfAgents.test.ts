import { describe, expect, it } from "vite-plus/test";

import { isZharfAgent, zharfAgentInstallCommand } from "./zharfAgents";

describe("Zharf agents", () => {
  it("installs Codex from the platform's mirror", () => {
    expect(zharfAgentInstallCommand({ instanceId: "zharfCodex" } as never, "darwin")).toBe(
      "curl -fsSL https://platform.zharf.ai/code/agents/codex/install.sh | sh",
    );
    expect(zharfAgentInstallCommand({ instanceId: "zharfCodex" } as never, "windows")).toBe(
      "irm https://platform.zharf.ai/code/agents/codex/install.ps1 | iex",
    );
  });

  it("installs Claude Code from its official npm package", () => {
    expect(zharfAgentInstallCommand({ instanceId: "zharfClaude" } as never, "linux")).toBe(
      "npm install -g @anthropic-ai/claude-code",
    );
  });

  it("leaves other agents to upstream's installers", () => {
    expect(zharfAgentInstallCommand({ instanceId: "codex" } as never, "darwin")).toBeUndefined();
    expect(isZharfAgent({ instanceId: "codex" } as never)).toBe(false);
    expect(isZharfAgent({ instanceId: "zharfClaude" } as never)).toBe(true);
  });
});
