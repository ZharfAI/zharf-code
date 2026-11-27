import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { describe, expect } from "vite-plus/test";

import * as ZharfReleases from "./ZharfReleases.ts";

const BASE = "http://platform.test/code/releases";

/** A release index for 0.1.12-zharf.1, and its checksums; everything else is missing. */
const platform = (requests: Array<string>) =>
  HttpClient.make((request) =>
    Effect.sync(() => {
      requests.push(request.url);
      const reply = (status: number, body = "") =>
        HttpClientResponse.fromWeb(request, new Response(body, { status }));
      if (request.url === `${BASE}/manifest.json`) {
        return reply(200, JSON.stringify({ version: "0.1.12-zharf.1", files: {} }));
      }
      if (request.url === `${BASE}/v0.1.12-zharf.1/SHA256SUMS`) return reply(200, "abc  file\n");
      return reply(404);
    }),
  );

const lookup = (spec: string, requests: Array<string> = []) =>
  ZharfReleases.make(BASE).pipe(
    Effect.flatMap((service) => service.get({ spec })),
    Effect.provideService(HttpClient.HttpClient, platform(requests)),
  );

describe("ZharfReleases", () => {
  it.effect("reads the latest release from the platform's index, never npm", () =>
    Effect.gen(function* () {
      const requests: Array<string> = [];
      expect(yield* lookup("latest", requests)).toEqual({ version: "0.1.12-zharf.1" });
      expect(requests).toEqual([`${BASE}/manifest.json`]);
    }),
  );

  it.effect("finds an exact version by its published checksums", () =>
    Effect.gen(function* () {
      expect(yield* lookup("0.1.12-zharf.1")).toEqual({ version: "0.1.12-zharf.1" });
      expect(yield* lookup("0.1.12-zharf.9")).toBeNull();
    }),
  );

  it.effect("has no nightly track", () =>
    Effect.gen(function* () {
      const requests: Array<string> = [];
      expect(yield* lookup("nightly", requests)).toBeNull();
      expect(requests).toEqual([]);
    }),
  );
});
