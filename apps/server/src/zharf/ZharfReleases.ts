/**
 * Which Zharf Code release a track or version names, read from platform.zharf.ai instead of npm:
 * Zharf Code is not on npm, and a package under its name there would be someone else's.
 * The Settings dialog that switches update tracks asks this (upstream's NpmRelease service).
 */
import {
  ServerNpmReleaseError,
  ServerNpmReleaseInput,
  type ServerNpmRelease,
} from "@t3tools/contracts";
import { ZHARF_RELEASES_URL } from "@t3tools/shared/cliRelease";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/http";

/** The index deploy/publish-code-release.sh writes next to the installers (zharf-platform). */
const ReleaseIndex = Schema.Struct({ version: Schema.String });
const decodeInput = Schema.decodeUnknownEffect(ServerNpmReleaseInput);

const unreachable = new ServerNpmReleaseError({
  reason: "platform.zharf.ai could not be reached.",
});

export const make = Effect.fn("ZharfReleases.make")(function* (baseUrl = ZHARF_RELEASES_URL) {
  const http = yield* HttpClient.HttpClient;
  const fetch = (path: string) =>
    http.get(`${baseUrl}/${path}`).pipe(
      Effect.timeout(Duration.seconds(15)),
      Effect.mapError(() => unreachable),
    );

  const get = Effect.fn("ZharfReleases.get")(function* (
    input: ServerNpmReleaseInput,
  ): Effect.fn.Return<ServerNpmRelease | null, ServerNpmReleaseError> {
    const { spec } = yield* decodeInput(input).pipe(
      Effect.mapError(
        () => new ServerNpmReleaseError({ reason: "Invalid release version or track." }),
      ),
    );
    // Zharf Code has one track so far.
    if (spec === "nightly") return null;
    if (spec === "latest") {
      const response = yield* fetch("manifest.json");
      if (response.status === 404) return null;
      const index = yield* HttpClientResponse.filterStatusOk(response).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(ReleaseIndex)),
        Effect.mapError(
          () => new ServerNpmReleaseError({ reason: "The release index could not be read." }),
        ),
      );
      return { version: index.version };
    }
    // An exact version is published when its checksums are.
    const response = yield* fetch(`v${spec}/SHA256SUMS`);
    if (response.status === 404) return null;
    if (response.status < 200 || response.status >= 300) return yield* unreachable;
    return { version: spec };
  });

  return { get };
});
