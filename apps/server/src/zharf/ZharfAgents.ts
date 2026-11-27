/**
 * The Zharf agents: upstream's Claude Code and Codex drivers, as two instances that send every
 * request to platform.zharf.ai. Why each setting is needed: zharf/README.md, "The Zharf agents".
 */
import {
  type CustomModelSetting,
  ProviderDriverKind,
  type ProviderInstanceConfig,
  ProviderInstanceId,
  type ProviderInstanceEnvironmentVariable,
} from "@t3tools/contracts";

import type { PlatformModel } from "./ZharfPlatform.ts";

export const ZHARF_CLAUDE_INSTANCE_ID = ProviderInstanceId.make("zharfClaude");
export const ZHARF_CODEX_INSTANCE_ID = ProviderInstanceId.make("zharfCodex");

interface ZharfAgent {
  readonly instanceId: ProviderInstanceId;
  readonly driver: ProviderDriverKind;
  readonly displayName: string;
  /** The variable the agent reads the platform key from. */
  readonly keyVariable: string;
  /** Its folder under the Zharf Code home, kept apart from the user's own agent logins. */
  readonly homeFolder: string;
  /** Models of this vendor are already in the agent's own list. */
  readonly ownVendor: string;
  readonly environment: (platform: string) => ReadonlyArray<readonly [string, string]>;
  readonly config: (platform: string, homePath: string) => Record<string, unknown>;
}

const toml = (value: string) => JSON.stringify(value);

export const ZHARF_AGENTS: ReadonlyArray<ZharfAgent> = [
  {
    instanceId: ZHARF_CLAUDE_INSTANCE_ID,
    driver: ProviderDriverKind.make("claudeAgent"),
    displayName: "Claude Code (Zharf)",
    keyVariable: "ANTHROPIC_AUTH_TOKEN",
    homeFolder: "claude",
    ownVendor: "Anthropic",
    environment: (platform) => [
      ["ANTHROPIC_BASE_URL", `${platform}/anthropic`],
      // Blank, so an Anthropic key or login in the user's shell is never sent to the platform.
      ["ANTHROPIC_API_KEY", ""],
      ["CLAUDE_CODE_OAUTH_TOKEN", ""],
      ["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1"],
    ],
    config: (_platform, homePath) => ({ homePath }),
  },
  {
    instanceId: ZHARF_CODEX_INSTANCE_ID,
    driver: ProviderDriverKind.make("codex"),
    displayName: "Codex (Zharf)",
    keyVariable: "ZHARF_API_KEY",
    homeFolder: "codex",
    ownVendor: "OpenAI",
    environment: () => [],
    config: (platform, homePath) => ({
      setupMode: "existing",
      homePath,
      launchArgs: [
        `-c model_provider=${toml("zharf")}`,
        `-c model_providers.zharf.name=${toml("Zharf")}`,
        `-c model_providers.zharf.base_url=${toml(`${platform}/v1`)}`,
        `-c model_providers.zharf.env_key=${toml("ZHARF_API_KEY")}`,
        `-c model_providers.zharf.wire_api=${toml("responses")}`,
      ].join(" "),
    }),
  },
];

export const zharfAgent = (instanceId: ProviderInstanceId): ZharfAgent | undefined =>
  ZHARF_AGENTS.find((agent) => agent.instanceId === instanceId);

/** The platform's coding models this agent does not already list, as custom models. */
const agentModels = (
  agent: ZharfAgent,
  models: ReadonlyArray<PlatformModel>,
): ReadonlyArray<CustomModelSetting> =>
  models
    .filter((model) => model.owned_by !== agent.ownVendor)
    .map((model) => (model.name ? { slug: model.id, name: model.name } : model.id));

const plain = (name: string, value: string): ProviderInstanceEnvironmentVariable => ({
  name,
  value,
  sensitive: false,
});

/** The key's variable as stored: the key itself, kept secret, or blank when signed out. */
const keyVariable = (agent: ZharfAgent, key: string | undefined) =>
  key === undefined
    ? plain(agent.keyVariable, "")
    : { name: agent.keyVariable, value: key, sensitive: true };

/**
 * The instance as Zharf Code wants it, on top of what is saved. The settings that point the agent
 * at the platform are set again each time, so a key is never saved beside an old address and a
 * new release can correct them. The key follows sign-in. The user's name for the agent, whether
 * it is on, variables they added and other settings are kept.
 */
export const zharfInstance = (input: {
  readonly agent: ZharfAgent;
  readonly existing: ProviderInstanceConfig | undefined;
  readonly platform: string;
  readonly homePath: string;
  /** undefined leaves the key as saved; null signs out. */
  readonly key?: string | null;
  /** undefined leaves the saved models alone. */
  readonly models?: ReadonlyArray<PlatformModel>;
}): ProviderInstanceConfig => {
  const { agent, existing } = input;
  const ours = new Map(agent.environment(input.platform));
  const environment: Array<ProviderInstanceEnvironmentVariable> = [];
  for (const variable of existing?.environment ?? []) {
    const value = ours.get(variable.name);
    if (value !== undefined) {
      environment.push(plain(variable.name, value));
      ours.delete(variable.name);
    } else if (variable.name !== agent.keyVariable || input.key === undefined) {
      environment.push(variable);
    }
  }
  for (const [name, value] of ours) environment.push(plain(name, value));
  if (!environment.some((variable) => variable.name === agent.keyVariable)) {
    environment.push(keyVariable(agent, input.key ?? undefined));
  }
  const config: Record<string, unknown> = {
    ...(existing?.config as Record<string, unknown> | undefined),
    ...agent.config(input.platform, input.homePath),
  };
  if (input.models !== undefined) config.customModels = agentModels(agent, input.models);
  return {
    displayName: agent.displayName,
    ...existing,
    driver: agent.driver,
    environment,
    config,
  };
};
