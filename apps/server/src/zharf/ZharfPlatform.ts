/**
 * platform.zharf.ai as Zharf Code uses it: the device sign-in that yields an API key, and the
 * model list the Zharf agents offer. The platform's own docs: docs/zharf-code.md in zharf-platform.
 */
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

const ZHARF_PLATFORM_URL = "https://platform.zharf.ai";

/** The platform to use: ZHARF_CODE_PLATFORM_URL (a local platform, in development) or production. */
export const platformUrl = (environment: NodeJS.ProcessEnv): string =>
  (environment.ZHARF_CODE_PLATFORM_URL?.trim() || ZHARF_PLATFORM_URL).replace(/\/+$/, "");

export class ZharfPlatformError extends Schema.TaggedError<ZharfPlatformError>()(
  "ZharfPlatformError",
  {
    /** Safe to show: the platform's own message, or ours. Never key material. */
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

const DeviceStart = Schema.Struct({
  device_code: Schema.String,
  user_code: Schema.String,
  verification_uri: Schema.String,
  verification_uri_complete: Schema.optional(Schema.String),
  interval: Schema.Number,
  expires_in: Schema.Number,
});
export type DeviceStart = typeof DeviceStart.Type;

const PlatformFailure = Schema.Struct({
  error: Schema.optional(
    Schema.Union([Schema.String, Schema.Struct({ message: Schema.optional(Schema.String) })]),
  ),
  message: Schema.optional(Schema.String),
});

const DeviceToken = Schema.Struct({ api_key: Schema.String });

const failureDetail = (response: HttpClientResponse.HttpClientResponse, fallback: string) =>
  HttpClientResponse.schemaBodyJson(PlatformFailure)(response).pipe(
    Effect.map((body) =>
      typeof body.error === "object"
        ? (body.error.message ?? body.message ?? fallback)
        : (body.message ?? fallback),
    ),
    Effect.orElseSucceed(() => fallback),
  );

const unreachable = (cause: unknown) =>
  new ZharfPlatformError({
    detail: "Could not reach platform.zharf.ai. Check the connection and try again.",
    cause,
  });

/** Starts a device sign-in. The user approves it at `verification_uri_complete` in a browser. */
export const startDevice = Effect.fn("ZharfPlatform.startDevice")(function* (
  baseUrl: string,
  clientName: string,
) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client
    .execute(
      HttpClientRequest.post(`${baseUrl}/api/cli/device`).pipe(
        HttpClientRequest.bodyJsonUnsafe({ client_name: clientName, client: "zharf-code" }),
      ),
    )
    .pipe(Effect.timeout("20 seconds"), Effect.mapError(unreachable));
  if (response.status === 429) {
    return yield* new ZharfPlatformError({
      detail: "Too many sign-in attempts from this network. Wait a while and try again.",
    });
  }
  if (response.status < 200 || response.status >= 300) {
    return yield* new ZharfPlatformError({
      detail: yield* failureDetail(
        response,
        `The platform refused the sign-in (${response.status}).`,
      ),
    });
  }
  return yield* HttpClientResponse.schemaBodyJson(DeviceStart)(response).pipe(
    Effect.mapError(
      (cause) =>
        new ZharfPlatformError({ detail: "The platform sent an unexpected reply.", cause }),
    ),
  );
});

/**
 * Polls until the user approves or refuses the sign-in, then returns the new API key.
 * The platform answers 428 while it waits, 403 when refused and 410 when expired or used.
 */
export const awaitDeviceKey = Effect.fn("ZharfPlatform.awaitDeviceKey")(function* (
  baseUrl: string,
  device: DeviceStart,
) {
  const client = yield* HttpClient.HttpClient;
  const interval = Duration.seconds(Math.max(1, device.interval));
  while (true) {
    yield* Effect.sleep(interval);
    const response = yield* client
      .execute(
        HttpClientRequest.post(`${baseUrl}/api/cli/token`).pipe(
          HttpClientRequest.bodyJsonUnsafe({ device_code: device.device_code }),
        ),
      )
      .pipe(
        Effect.timeout("20 seconds"),
        // A dropped request while waiting is retried on the next tick.
        Effect.orElseSucceed(() => undefined),
      );
    if (response === undefined || response.status === 428 || response.status >= 500) continue;
    if (response.status === 403) {
      return yield* new ZharfPlatformError({ detail: "The sign-in was refused on the platform." });
    }
    if (response.status === 410) {
      return yield* new ZharfPlatformError({
        detail: "The sign-in code expired or was already used. Sign in again.",
      });
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* new ZharfPlatformError({
        detail: yield* failureDetail(
          response,
          `The platform refused the sign-in (${response.status}).`,
        ),
      });
    }
    const body = yield* HttpClientResponse.schemaBodyJson(DeviceToken)(response).pipe(
      Effect.mapError(
        (cause) =>
          new ZharfPlatformError({ detail: "The platform sent an unexpected reply.", cause }),
      ),
    );
    return body.api_key;
  }
});

const PlatformModel = Schema.Struct({
  id: Schema.String,
  name: Schema.optional(Schema.String),
  owned_by: Schema.optional(Schema.String),
  output_modalities: Schema.optional(Schema.Array(Schema.String)),
  supported_parameters: Schema.optional(Schema.Array(Schema.String)),
});
const PlatformModels = Schema.Struct({ data: Schema.Array(PlatformModel) });
export type PlatformModel = typeof PlatformModel.Type;

/** A model an agent can code with: it answers in text and calls tools. */
const isCodingModel = (model: PlatformModel): boolean =>
  model.output_modalities?.length === 1 &&
  model.output_modalities[0] === "text" &&
  (model.supported_parameters?.includes("tools") ?? false);

/** The platform's coding models, in the platform's order. The list is public. */
export const codingModels = Effect.fn("ZharfPlatform.codingModels")(function* (baseUrl: string) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client
    .execute(HttpClientRequest.get(`${baseUrl}/v1/models`))
    .pipe(Effect.timeout("30 seconds"), Effect.mapError(unreachable));
  const body = yield* HttpClientResponse.filterStatusOk(response).pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(PlatformModels)),
    Effect.mapError(
      (cause) => new ZharfPlatformError({ detail: "Could not read the platform's models.", cause }),
    ),
  );
  return body.data.filter(isCodingModel);
});

const Balance = Schema.Struct({
  currency: Schema.String,
  /** What the key can spend now, as a decimal string of ZHARF. */
  available: Schema.String,
  /** The account's whole balance; null for a key with a spending limit. */
  balance: Schema.NullOr(Schema.String),
  key: Schema.Struct({ spent: Schema.String, spend_limit: Schema.NullOr(Schema.String) }),
});
export type ZharfBalance = typeof Balance.Type;

/** What the key may still spend (GET /v1/balance), or null when the platform no longer knows it. */
export const balance = Effect.fn("ZharfPlatform.balance")(function* (baseUrl: string, key: string) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client
    .execute(
      HttpClientRequest.get(`${baseUrl}/v1/balance`).pipe(HttpClientRequest.bearerToken(key)),
    )
    .pipe(Effect.timeout("20 seconds"), Effect.mapError(unreachable));
  // 401: unknown or revoked key; 403: a suspended account. Both need a new sign-in or support.
  if (response.status === 401 || response.status === 403) return null;
  return yield* HttpClientResponse.filterStatusOk(response).pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Balance)),
    Effect.mapError(
      (cause) => new ZharfPlatformError({ detail: "Could not read the Zharf balance.", cause }),
    ),
  );
});
