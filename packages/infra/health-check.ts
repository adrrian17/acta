import { setTimeout as sleep } from "node:timers/promises";

import { z } from "zod";

const healthResponse = z.object({
  result: z.object({ data: z.literal("OK") }),
});

interface HealthTarget {
  webOrigin: string;
  serverOrigin: string;
}

interface HealthOptions {
  attempts: number;
  delayMs: number;
  requestTimeoutMs: number;
}

const checkOnce = async (
  { webOrigin, serverOrigin }: HealthTarget,
  timeoutMs: number
) => {
  const [web, server] = await Promise.all([
    fetch(webOrigin, { signal: AbortSignal.timeout(timeoutMs) }),
    fetch(`${serverOrigin}/trpc/healthCheck`, {
      signal: AbortSignal.timeout(timeoutMs),
    }),
  ]);

  if (!web.ok) {
    throw new Error(`frontend ${webOrigin} answered HTTP ${web.status}`);
  }

  if (!server.ok) {
    throw new Error(`server healthCheck answered HTTP ${server.status}`);
  }

  const parsed = healthResponse.safeParse(await server.json());

  if (!parsed.success) {
    throw new Error("server healthCheck did not return result.data === 'OK'");
  }
};

/**
 * Passes when the frontend answers 2xx and the server's tRPC `healthCheck` returns `"OK"`,
 * proving both Workers are reachable and the server runs the deployed router.
 * It does not exercise D1 or auth.
 */
export const waitUntilHealthy = async (
  target: HealthTarget,
  { attempts, delayMs, requestTimeoutMs }: HealthOptions
) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // Sequential by design: each attempt must finish before the next starts.
      // oxlint-disable-next-line no-await-in-loop
      await checkOnce(target, requestTimeoutMs);

      return attempt;
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        // oxlint-disable-next-line no-await-in-loop
        await sleep(delayMs);
      }
    }
  }

  throw new Error(`unhealthy after ${attempts} attempts`, { cause: lastError });
};
