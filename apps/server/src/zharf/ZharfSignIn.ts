/**
 * "Sign in with Zharf": one platform sign-in shared by the Zharf agents (ZharfAgents.ts).
 *
 * The sign-in ends by saving the key into both agents' settings, which makes the registry build
 * them again. So the sign-in flows live here, for the server's lifetime, and each agent built
 * again is handed the same flow: what the app shows of the sign-in survives the rebuild.
 */
import {
  ProviderSetupError,
  type ProviderInstanceId,
  type ServerProvider,
  type ServerProviderUsageLimits,
  type ServerProviderUsageWindow,
} from "@t3tools/contracts";
import type { ProviderAuthController } from "@t3tools/provider-core/server/auth";
import type { ProviderDriver, ProviderInstance } from "@t3tools/provider-core/server/driver";
import * as ProviderAuthFlow from "@t3tools/provider-core/server/providerAuthFlow";
import type { ProviderAuthFlowContext } from "@t3tools/provider-core/server/providerAuthFlow";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as NodeOS from "node:os";
import * as NodeUtil from "node:util";
import { HttpClient } from "effect/http";

import * as ServerConfig from "../config.ts";
import * as Settings from "../serverSettings.ts";
import { ZHARF_AGENTS, zharfAgent, zharfInstance } from "./ZharfAgents.ts";
import * as ZharfPlatform from "./ZharfPlatform.ts";

export class ZharfSignIn extends Context.Service<
  ZharfSignIn,
  {
    /** The shared sign-in, as the auth controller of one Zharf agent. */
    readonly auth: (instanceId: ProviderInstanceId) => ProviderAuthController | undefined;
    readonly platform: string;
  }
>()("t3/zharf/ZharfSignIn") {}

const SIGN_IN_METHOD = {
  id: "zharf",
  name: "Sign in with Zharf",
  description:
    "Approve the sign-in at platform.zharf.ai. The agents' work is paid from your Zharf balance.",
  type: "agent" as const,
};

/** The device name the key is listed under on the platform: "Zharf Code · <computer>". */
const computerName = () =>
  NodeOS.hostname()
    .replace(/\.local$/, "")
    .slice(0, 60) || "computer";

/** The agents added once, so one the user removed is not added again. */
const SeededAgents = Schema.fromJsonString(Schema.Struct({ seeded: Schema.Array(Schema.String) }));
const readSeeded = Schema.decodeUnknownEffect(SeededAgents);
const writeSeeded = Schema.encodeEffect(SeededAgents);

/** Where each agent keeps its own config and login, apart from the user's own agents. */
const agentHomes = Effect.fn("ZharfSignIn.agentHomes")(function* () {
  const { baseDir } = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  return (folder: string) => path.join(baseDir, "agents", folder);
});

/**
 * Adds the Zharf agents to the settings on first start, and brings saved ones up to date. An
 * agent the user removed stays removed: the agents seeded once are listed in the state folder.
 */
export const seedZharfAgents = Effect.fn("ZharfSignIn.seedZharfAgents")(function* () {
  const settings = yield* Settings.ServerSettingsService;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { stateDir } = yield* ServerConfig.ServerConfig;
  const platform = ZharfPlatform.platformUrl(yield* HostProcess.Environment);
  const homeOf = yield* agentHomes();
  const markerPath = path.join(stateDir, "zharf-agents.json");
  const seeded = yield* fileSystem.readFileString(markerPath).pipe(
    Effect.flatMap(readSeeded),
    Effect.map((marker) => new Set<string>(marker.seeded)),
    Effect.orElseSucceed(() => new Set<string>()),
  );
  const seededBefore = seeded.size;
  const current = (yield* settings.getSettings).providerInstances;
  for (const agent of ZHARF_AGENTS) {
    const existing = current[agent.instanceId];
    if (existing === undefined && seeded.has(agent.instanceId)) continue;
    seeded.add(agent.instanceId);
    const next = zharfInstance({ agent, existing, platform, homePath: homeOf(agent.homeFolder) });
    if (existing !== undefined && NodeUtil.isDeepStrictEqual(existing, next)) continue;
    yield* fileSystem.makeDirectory(homeOf(agent.homeFolder), { recursive: true });
    yield* settings.updateProviderInstance({
      operation: "upsert",
      instanceId: agent.instanceId,
      instance: next,
    });
  }
  if (seeded.size !== seededBefore) {
    const text = yield* writeSeeded({ seeded: [...seeded] });
    yield* fileSystem.writeFileString(markerPath, `${text}\n`);
  }
});

/** Writes the key (null: signs out) and, when given, the models into every Zharf agent. */
const save = Effect.fn("ZharfSignIn.save")(function* (
  key: string | null | undefined,
  models?: ReadonlyArray<ZharfPlatform.PlatformModel>,
) {
  const settings = yield* Settings.ServerSettingsService;
  const platform = ZharfPlatform.platformUrl(yield* HostProcess.Environment);
  const homeOf = yield* agentHomes();
  const current = (yield* settings.getSettings).providerInstances;
  for (const agent of ZHARF_AGENTS) {
    const existing = current[agent.instanceId];
    // A removed agent is not brought back by a sign-in through the other one.
    if (existing === undefined) continue;
    const next = zharfInstance({
      agent,
      existing,
      platform,
      homePath: homeOf(agent.homeFolder),
      ...(key !== undefined ? { key } : {}),
      ...(models !== undefined ? { models } : {}),
    });
    if (NodeUtil.isDeepStrictEqual(existing, next)) continue;
    yield* settings.updateProviderInstance({
      operation: "upsert",
      instanceId: agent.instanceId,
      instance: next,
    });
  }
});

/** Saves the platform's current coding models into the agents; nothing when unchanged. */
export const refreshZharfModels = Effect.fn("ZharfSignIn.refreshZharfModels")(function* () {
  const platform = ZharfPlatform.platformUrl(yield* HostProcess.Environment);
  yield* save(undefined, yield* ZharfPlatform.codingModels(platform));
});

/**
 * At server start: adds or updates the Zharf agents, then refreshes their models in the
 * background. ZHARF_CODE_AGENTS=off leaves them out, as the server's own tests do: they expect
 * only upstream's agents.
 */
export const startZharfAgents = Effect.fn("ZharfSignIn.startZharfAgents")(function* () {
  if ((yield* Config.String("ZHARF_CODE_AGENTS").pipe(Config.withDefault(""))) === "off") return;
  yield* seedZharfAgents();
  yield* refreshZharfModels().pipe(
    Effect.catchCause((cause) => Effect.logInfo("Zharf models not refreshed", cause)),
    Effect.forkScoped,
  );
});

const make = Effect.gen(function* () {
  const httpClient = yield* HttpClient.HttpClient;
  const environment = yield* HostProcess.Environment;
  const platform = ZharfPlatform.platformUrl(environment);
  const context = yield* Effect.context<
    Settings.ServerSettingsService | ServerConfig.ServerConfig | Path.Path
  >();
  const saveKey = (key: string | null, models?: ReadonlyArray<ZharfPlatform.PlatformModel>) =>
    save(key, models).pipe(
      Effect.provideContext(context),
      Effect.provideService(HostProcess.Environment, environment),
    );

  const isPlatformError = Schema.is(ZharfPlatform.ZharfPlatformError);
  const setupError = (instanceId: ProviderInstanceId, operation: string) => (error: unknown) =>
    new ProviderSetupError({
      instanceId,
      operation,
      detail: isPlatformError(error)
        ? error.detail
        : "Could not save the Zharf sign-in. Try again.",
    });

  const flows = new Map<ProviderInstanceId, ProviderAuthController>();
  for (const agent of ZHARF_AGENTS) {
    const controller = yield* ProviderAuthFlow.make({
      instanceId: agent.instanceId,
      // Both agents use the one key: signing in or out through one stops the other's sessions too.
      credentialBinding: { owner: "zharf-code", key: `zharf:${platform}` },
      methods: Effect.succeed([SIGN_IN_METHOD]),
      // The platform keeps a sign-in code for ten minutes.
      timeoutMs: 600_000,
      authenticate: Effect.fn("ZharfSignIn.authenticate")(
        function* (_methodId: string, context: ProviderAuthFlowContext) {
          const device = yield* ZharfPlatform.startDevice(platform, computerName());
          yield* context.setInteraction({
            type: "deviceCode",
            id: context.flowId,
            url: device.verification_uri_complete ?? device.verification_uri,
            userCode: device.user_code,
          });
          const key = yield* ZharfPlatform.awaitDeviceKey(platform, device);
          yield* context.verifying;
          // The models are public; a failure here leaves the saved list as it was.
          const models = yield* ZharfPlatform.codingModels(platform).pipe(
            Effect.orElseSucceed(() => undefined),
          );
          yield* saveKey(key, models);
        },
        Effect.provideService(HttpClient.HttpClient, httpClient),
        Effect.mapError(setupError(agent.instanceId, "authenticate")),
      ),
      logout: saveKey(null).pipe(Effect.mapError(setupError(agent.instanceId, "logout"))),
    });
    flows.set(agent.instanceId, controller);
  }

  return { auth: (instanceId) => flows.get(instanceId), platform } satisfies ZharfSignIn["Service"];
});

export const layer = Layer.effect(ZharfSignIn, make);

/** What the platform last said about the key: nothing yet (or unreachable), its balance, or no. */
type KeyState =
  | { readonly kind: "unread" }
  | {
      readonly kind: "balance";
      readonly balance: ZharfPlatform.ZharfBalance;
      readonly checkedAt: string;
    }
  | { readonly kind: "refused" };

const BALANCE_INTERVAL = "5 minutes";

/**
 * A Zharf agent's usage: pay per use from the balance. A bar only for a key's spending limit,
 * or for an empty balance, which the app then treats like a spent subscription.
 */
export const zharfUsageLimits = (
  balance: ZharfPlatform.ZharfBalance,
  checkedAt: string,
  platform: string,
): ServerProviderUsageLimits => {
  const available = Number(balance.available);
  const left = `${balance.available} ZHARF left`;
  const windows: Array<ServerProviderUsageWindow> = [];
  if (balance.key.spend_limit !== null) {
    const limit = Number(balance.key.spend_limit);
    const used = limit > 0 ? (Number(balance.key.spent) / limit) * 100 : 100;
    windows.push({
      id: "zharf-key-limit",
      kind: "other",
      label: `Key limit · ${left}`,
      usedPercent: available <= 0 ? 100 : Math.min(100, Math.max(0, used)),
    });
  } else if (available <= 0) {
    windows.push({
      id: "zharf-balance",
      kind: "other",
      label: "Zharf balance · empty",
      usedPercent: 100,
    });
  }
  return {
    checkedAt,
    windows,
    ...(windows.length === 0
      ? {
          unavailable: {
            reason: "unsupported" as const,
            message: `Pay per use from your Zharf balance: ${left}.`,
          },
        }
      : {}),
    externalUsage: { label: "Zharf wallet", url: `${platform}/wallet` },
  };
};

/**
 * What a Zharf agent reports. Signed in when it holds a key the platform has not refused,
 * whatever the agent's own login says; its usage is the key's balance.
 */
const withZharfAuth =
  (signedIn: boolean, platform: string, state: KeyState) =>
  <S extends ServerProvider>(snapshot: S): S => {
    const { usageLimits: _agentLimits, ...rest } = snapshot;
    const setup = {
      canInstall: snapshot.setup?.canInstall ?? false,
      canAuthenticate: true,
      documentationUrl: `${platform}/code`,
    };
    if (!signedIn || state.kind === "refused") {
      return {
        ...rest,
        auth: { status: "unauthenticated", canLogout: false },
        ...(state.kind === "refused" && signedIn
          ? { message: "The platform no longer accepts this Zharf sign-in. Sign in again." }
          : {}),
        setup,
      } as S;
    }
    return {
      ...rest,
      auth: {
        ...snapshot.auth,
        status: "authenticated",
        type: "apiKey",
        label: "Zharf",
        endpoint: platform,
        canLogout: true,
      },
      ...(state.kind === "balance"
        ? { usageLimits: zharfUsageLimits(state.balance, state.checkedAt, platform) }
        : {}),
      setup,
    } as S;
  };

/**
 * Hands the Zharf agents the shared sign-in, and the sign-in and balance they report. Other
 * instances of the driver are left exactly as the driver made them.
 */
export const withZharfSignIn = <Config, R, UsageR>(
  driver: ProviderDriver<Config, R, UsageR>,
): ProviderDriver<Config, R | ZharfSignIn | HttpClient.HttpClient, UsageR> => ({
  ...driver,
  create: Effect.fn("withZharfSignIn.create")(function* (input) {
    const instance = yield* driver.create(input);
    const agent = zharfAgent(input.instanceId);
    if (agent === undefined) return instance;
    const signIn = yield* ZharfSignIn;
    const http = yield* HttpClient.HttpClient;
    const key =
      input.environment.find((variable) => variable.name === agent.keyVariable)?.value ?? "";
    const signedIn = key.length > 0;
    const state = yield* SubscriptionRef.make<KeyState>({ kind: "unread" });
    // An unreachable platform leaves what was last read: a network cut is not a sign-out.
    const check = ZharfPlatform.balance(signIn.platform, key).pipe(
      Effect.flatMap((balance) =>
        Effect.gen(function* () {
          const checkedAt = DateTime.formatIso(yield* DateTime.now);
          const next: KeyState =
            balance === null ? { kind: "refused" } : { kind: "balance", balance, checkedAt };
          yield* SubscriptionRef.set(state, next);
        }),
      ),
      Effect.provideService(HttpClient.HttpClient, http),
      Effect.catchCause((cause) => Effect.logDebug("Zharf balance not read", cause)),
    );
    if (signedIn) {
      yield* check.pipe(Effect.repeat(Schedule.spaced(BALANCE_INTERVAL)), Effect.forkScoped);
    }
    const patch = <S extends ServerProvider>(snapshot: S) =>
      SubscriptionRef.get(state).pipe(
        Effect.map((current) => withZharfAuth(signedIn, signIn.platform, current)(snapshot)),
      );
    const { snapshot } = instance;
    const auth = signIn.auth(input.instanceId);
    const patched: ProviderInstance = {
      ...instance,
      ...(auth ? { auth } : {}),
      snapshot: {
        ...snapshot,
        getSnapshot: snapshot.getSnapshot.pipe(Effect.flatMap(patch)),
        refresh: (signedIn ? check : Effect.void).pipe(
          Effect.andThen(snapshot.refresh),
          Effect.flatMap(patch),
        ),
        // A new balance is a change of the snapshot too; ends with the agent's own stream.
        streamChanges: snapshot.streamChanges.pipe(
          Stream.merge(
            SubscriptionRef.changes(state).pipe(
              Stream.drop(1),
              Stream.mapEffect(() => snapshot.getSnapshot),
            ),
            { haltStrategy: "left" },
          ),
          Stream.mapEffect(patch),
        ),
      },
      ...(instance.snapshotForCwd
        ? {
            snapshotForCwd: (cwd: string) =>
              instance.snapshotForCwd!(cwd).pipe(Effect.flatMap(patch)),
          }
        : {}),
    };
    return patched;
  }),
});
