import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderInstanceConfig,
  type ServerProvider,
} from "@t3tools/contracts";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import type { ProviderDriver, ProviderInstance } from "@t3tools/provider-core/server/driver";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { it as effectIt } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { HttpClient, HttpClientResponse } from "effect/http";
import { describe, expect } from "vite-plus/test";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ServerConfig from "../config.ts";
import * as SqlitePersistence from "../persistence/Sqlite.ts";
import * as ManagedPolicy from "../policy/ManagedPolicy.ts";
import * as ServerSettingsModule from "../serverSettings.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import { ZHARF_CLAUDE_INSTANCE_ID, ZHARF_CODEX_INSTANCE_ID } from "./ZharfAgents.ts";
import * as ZharfSignIn from "./ZharfSignIn.ts";

const PLATFORM = "http://platform.test";
const KEY = "zk-test-key";

const MODELS = [
  {
    id: "claude-opus-5.5",
    name: "Claude Opus 5.5",
    owned_by: "Anthropic",
    output_modalities: ["text"],
    supported_parameters: ["tools"],
  },
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    owned_by: "OpenAI",
    output_modalities: ["text"],
    supported_parameters: ["tools"],
  },
  {
    id: "glm-5.1",
    name: "GLM 5.1",
    owned_by: "Z.ai",
    output_modalities: ["text"],
    supported_parameters: ["tools"],
  },
  {
    id: "flux-pro",
    name: "FLUX Pro",
    owned_by: "Black Forest Labs",
    output_modalities: ["image"],
    supported_parameters: [],
  },
  {
    id: "plain-chat",
    owned_by: "Acme",
    output_modalities: ["text"],
    supported_parameters: ["temperature"],
  },
];

/** The platform's sign-in and model list: the key is handed out on the second poll. */
const fakePlatform = (requests: Array<string>, models: Array<unknown> = [...MODELS]) => {
  let polls = 0;
  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        const path = new URL(request.url).pathname;
        requests.push(`${request.method} ${path}`);
        const reply = (status: number, body: unknown) =>
          HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify(body), {
              status,
              headers: { "content-type": "application/json" },
            }),
          );
        if (path === "/api/cli/device") {
          return reply(200, {
            device_code: "device-1",
            user_code: "ABCD-EFGH",
            verification_uri: `${PLATFORM}/cli`,
            verification_uri_complete: `${PLATFORM}/cli?code=ABCD-EFGH`,
            interval: 1,
            expires_in: 600,
          });
        }
        if (path === "/api/cli/token") {
          polls += 1;
          return polls < 2
            ? reply(428, { error: { code: "authorization_pending" } })
            : reply(200, { api_key: KEY });
        }
        if (path === "/v1/models") return reply(200, { data: models });
        return reply(404, {});
      }),
    ),
  );
};

const environment = Layer.succeed(HostProcess.Environment, {
  ...process.env,
  ZHARF_CODE_PLATFORM_URL: PLATFORM,
});

const baseLayer = (instances: Record<string, ProviderInstanceConfig> = {}) =>
  Layer.mergeAll(
    ServerConfig.layerTest(process.cwd(), { prefix: "zharf-sign-in-" }),
    ServerSettingsService.layerTest({ providerInstances: instances }),
    environment,
  ).pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));

const instances = Effect.gen(function* () {
  const settings = yield* ServerSettingsService;
  return (yield* settings.getSettings).providerInstances;
});

const variable = (instance: ProviderInstanceConfig | undefined, name: string) =>
  instance?.environment?.find((entry) => entry.name === name);

const modelSlugs = (instance: ProviderInstanceConfig | undefined) =>
  (
    (instance?.config as { customModels?: ReadonlyArray<string | { slug: string }> } | undefined)
      ?.customModels ?? []
  ).map((model) => (typeof model === "string" ? model : model.slug));

describe("seedZharfAgents", () => {
  effectIt.effect("adds both agents pointed at the platform, with no key", () =>
    Effect.gen(function* () {
      yield* ZharfSignIn.seedZharfAgents();
      const seeded = yield* instances;
      const claude = seeded[ZHARF_CLAUDE_INSTANCE_ID];
      const codex = seeded[ZHARF_CODEX_INSTANCE_ID];
      expect(claude?.driver).toBe("claudeAgent");
      expect(variable(claude, "ANTHROPIC_BASE_URL")?.value).toBe(`${PLATFORM}/anthropic`);
      expect(variable(claude, "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC")?.value).toBe("1");
      // A key or login in the user's shell must never reach the platform.
      expect(variable(claude, "ANTHROPIC_API_KEY")?.value).toBe("");
      expect(variable(claude, "ANTHROPIC_AUTH_TOKEN")).toEqual({
        name: "ANTHROPIC_AUTH_TOKEN",
        value: "",
        sensitive: false,
      });
      expect(codex?.driver).toBe("codex");
      expect((codex?.config as { setupMode?: string } | undefined)?.setupMode).toBe("existing");
      expect((codex?.config as { launchArgs?: string } | undefined)?.launchArgs).toContain(
        `model_providers.zharf.base_url="${PLATFORM}/v1"`,
      );
      expect(variable(codex, "ZHARF_API_KEY")?.value).toBe("");
    }).pipe(Effect.provide(baseLayer())),
  );

  effectIt.effect(
    "keeps the user's own changes, resets the platform settings, keeps a removed agent removed",
    () =>
      Effect.gen(function* () {
        const settings = yield* ServerSettingsService;
        yield* ZharfSignIn.seedZharfAgents();
        const claude = (yield* instances)[ZHARF_CLAUDE_INSTANCE_ID]!;
        yield* settings.updateProviderInstance({
          operation: "upsert",
          instanceId: ZHARF_CLAUDE_INSTANCE_ID,
          instance: {
            ...claude,
            displayName: "My Zharf",
            enabled: false,
            environment: [
              ...(claude.environment ?? []).map((entry) =>
                entry.name === "ANTHROPIC_BASE_URL"
                  ? { ...entry, value: "http://proxy.test" }
                  : entry,
              ),
              { name: "MY_VAR", value: "1", sensitive: false },
            ],
          },
        });
        yield* settings.updateProviderInstance({
          operation: "remove",
          instanceId: ZHARF_CODEX_INSTANCE_ID,
        });

        yield* ZharfSignIn.seedZharfAgents();

        const after = yield* instances;
        expect(after[ZHARF_CODEX_INSTANCE_ID]).toBeUndefined();
        const kept = after[ZHARF_CLAUDE_INSTANCE_ID];
        expect(kept?.displayName).toBe("My Zharf");
        expect(kept?.enabled).toBe(false);
        expect(variable(kept, "ANTHROPIC_BASE_URL")?.value).toBe(`${PLATFORM}/anthropic`);
        expect(variable(kept, "MY_VAR")?.value).toBe("1");
      }).pipe(Effect.provide(baseLayer())),
  );
});

describe("Sign in with Zharf", () => {
  const owner = "client-session";

  effectIt.live("signs both agents in with one device sign-in, then out again", () => {
    const requests: Array<string> = [];
    return Effect.gen(function* () {
      yield* ZharfSignIn.seedZharfAgents();
      const signIn = yield* ZharfSignIn.ZharfSignIn;
      const auth = signIn.auth(ZHARF_CLAUDE_INSTANCE_ID)!;
      expect(auth.credentialBinding).toEqual({ owner: "zharf-code", key: `zharf:${PLATFORM}` });

      const states = auth.subscribe(owner);
      yield* auth.start(owner);
      const waiting = yield* states.pipe(
        Stream.filter((state) => state.phase === "waiting"),
        Stream.runHead,
        Effect.timeout("10 seconds"),
      );
      expect(Option.getOrThrow(waiting).interaction).toMatchObject({
        type: "deviceCode",
        url: `${PLATFORM}/cli?code=ABCD-EFGH`,
        userCode: "ABCD-EFGH",
      });
      const done = yield* states.pipe(
        Stream.filter((state) => state.phase === "succeeded" || state.phase === "failed"),
        Stream.runHead,
        Effect.timeout("10 seconds"),
      );
      expect(Option.getOrThrow(done).phase).toBe("succeeded");

      const signedIn = yield* instances;
      for (const [id, name] of [
        [ZHARF_CLAUDE_INSTANCE_ID, "ANTHROPIC_AUTH_TOKEN"],
        [ZHARF_CODEX_INSTANCE_ID, "ZHARF_API_KEY"],
      ] as const) {
        expect(variable(signedIn[id], name)).toMatchObject({ value: KEY, sensitive: true });
        expect(variable(signedIn[id], name)).not.toBeUndefined();
      }
      // Coding models only, without the ones the agent already lists itself.
      expect(modelSlugs(signedIn[ZHARF_CLAUDE_INSTANCE_ID])).toEqual(["gpt-6-astra", "glm-5.1"]);
      expect(modelSlugs(signedIn[ZHARF_CODEX_INSTANCE_ID])).toEqual(["claude-opus-5.5", "glm-5.1"]);
      expect(requests.filter((request) => request === "POST /api/cli/device")).toHaveLength(1);

      yield* auth.logout(Effect.void);
      const signedOut = yield* instances;
      expect(variable(signedOut[ZHARF_CLAUDE_INSTANCE_ID], "ANTHROPIC_AUTH_TOKEN")).toEqual({
        name: "ANTHROPIC_AUTH_TOKEN",
        value: "",
        sensitive: false,
      });
      expect(variable(signedOut[ZHARF_CODEX_INSTANCE_ID], "ZHARF_API_KEY")?.value).toBe("");
    }).pipe(
      Effect.provide(
        ZharfSignIn.layer.pipe(
          Layer.provideMerge(baseLayer()),
          Layer.provide(fakePlatform(requests)),
        ),
      ),
      Effect.scoped,
    );
  });
});

describe("the key on disk", () => {
  // The settings service upstream uses: secrets go to the secret store, not settings.json.
  const fileSettings = ServerSettingsModule.layer.pipe(
    Layer.provide(ServerSecretStore.layer),
    Layer.provide(ManagedPolicy.layerTest()),
    Layer.provideMerge(Layer.fresh(SqlitePersistence.layerMemory)),
    Layer.provideMerge(
      Layer.fresh(ServerConfig.layerTest(process.cwd(), { prefix: "zharf-sign-in-disk-" })),
    ),
    Layer.provideMerge(environment),
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)),
  );

  const models: Array<unknown> = [...MODELS];
  effectIt.live("is kept in the secret store, never sent to a client, and survives a restart", () =>
    Effect.gen(function* () {
      const settings = yield* ServerSettingsService;
      yield* settings.start;
      yield* settings.ready;
      yield* ZharfSignIn.seedZharfAgents();
      const auth = (yield* ZharfSignIn.ZharfSignIn).auth(ZHARF_CODEX_INSTANCE_ID)!;
      const states = auth.subscribe("client");
      yield* auth.start("client");
      const done = yield* states.pipe(
        Stream.filter((state) => state.phase === "succeeded" || state.phase === "failed"),
        Stream.runHead,
        Effect.timeout("10 seconds"),
      );
      expect(Option.getOrThrow(done).phase).toBe("succeeded");

      const current = yield* settings.getSettings;
      expect(
        variable(current.providerInstances[ZHARF_CODEX_INSTANCE_ID], "ZHARF_API_KEY")?.value,
      ).toBe(KEY);
      const { settingsPath } = yield* ServerConfig.ServerConfig;
      const onDisk = yield* (yield* FileSystem.FileSystem).readFileString(settingsPath);
      expect(onDisk).toContain("ZHARF_API_KEY");
      expect(onDisk).not.toContain(KEY);
      const forClient = JSON.stringify(
        ServerSettingsModule.redactServerSettingsForClient(current, { secretReferences: true }),
      );
      expect(forClient).not.toContain(KEY);

      // A restart with the key saved: the agents are seeded again and the new model list saved.
      models.push({
        id: "kimi-k3",
        name: "Kimi K3",
        owned_by: "Moonshot",
        output_modalities: ["text"],
        supported_parameters: ["tools"],
      });
      yield* ZharfSignIn.seedZharfAgents();
      yield* ZharfSignIn.refreshZharfModels();
      const restarted = yield* settings.getSettings;
      expect(modelSlugs(restarted.providerInstances[ZHARF_CODEX_INSTANCE_ID])).toContain("kimi-k3");
      expect(
        variable(restarted.providerInstances[ZHARF_CODEX_INSTANCE_ID], "ZHARF_API_KEY"),
      ).toMatchObject({
        value: KEY,
        sensitive: true,
      });
      expect(
        variable(restarted.providerInstances[ZHARF_CLAUDE_INSTANCE_ID], "ANTHROPIC_AUTH_TOKEN")
          ?.value,
      ).toBe(KEY);
      expect(yield* (yield* FileSystem.FileSystem).readFileString(settingsPath)).not.toContain(KEY);
      expect(
        JSON.stringify(
          ServerSettingsModule.redactServerSettingsForClient(restarted, { secretReferences: true }),
        ),
      ).not.toContain(KEY);
    }).pipe(
      Effect.provide(
        ZharfSignIn.layer.pipe(
          Layer.provideMerge(fileSettings),
          Layer.provideMerge(fakePlatform([], models)),
        ),
      ),
      Effect.scoped,
    ),
  );
});

describe("withZharfSignIn", () => {
  const provider = {
    instanceId: ZHARF_CLAUDE_INSTANCE_ID,
    auth: { status: "unauthenticated" },
    setup: { canAuthenticate: false, canInstall: true },
  } as unknown as ServerProvider;
  const driver: ProviderDriver<unknown> = {
    driverKind: ProviderDriverKind.make("claudeAgent"),
    metadata: { displayName: "Claude" },
    configSchema: Schema.Unknown as never,
    defaultConfig: () => ({}),
    create: (input) =>
      Effect.succeed({
        instanceId: input.instanceId,
        snapshot: {
          getSnapshot: Effect.succeed({ ...provider, instanceId: input.instanceId }),
          refresh: Effect.succeed({ ...provider, instanceId: input.instanceId }),
          streamChanges: Stream.empty,
        },
      } as unknown as ProviderInstance),
  };
  const wrapped = ZharfSignIn.withZharfSignIn(driver);
  const create = (instanceId: ProviderInstanceId, key: string) =>
    wrapped.create({
      instanceId,
      displayName: undefined,
      enabled: true,
      config: {},
      environment: [{ name: "ANTHROPIC_AUTH_TOKEN", value: key, sensitive: key !== "" }],
    });
  const signInService = Layer.succeed(ZharfSignIn.ZharfSignIn, {
    auth: () => undefined,
    platform: PLATFORM,
  });

  effectIt.effect("reports a Zharf agent signed in once its key is set", () =>
    Effect.gen(function* () {
      const signedOut = yield* (yield* create(ZHARF_CLAUDE_INSTANCE_ID, "")).snapshot.getSnapshot;
      expect(signedOut.auth.status).toBe("unauthenticated");
      expect(signedOut.setup).toEqual({
        canAuthenticate: true,
        canInstall: true,
        documentationUrl: `${PLATFORM}/code`,
      });
      const signedIn = yield* (yield* create(ZHARF_CLAUDE_INSTANCE_ID, KEY)).snapshot.refresh;
      expect(signedIn.auth).toMatchObject({
        status: "authenticated",
        label: "Zharf",
        endpoint: PLATFORM,
      });
    }).pipe(Effect.provide(signInService), Effect.scoped),
  );

  effectIt.effect("leaves the driver's other instances alone", () =>
    Effect.gen(function* () {
      const other = yield* (yield* create(ProviderInstanceId.make("claudeAgent"), "")).snapshot
        .getSnapshot;
      expect(other.setup).toEqual({ canAuthenticate: false, canInstall: true });
    }).pipe(Effect.provide(signInService), Effect.scoped),
  );
});
