import { AlchemyContext } from "alchemy/AlchemyContext";
import { Stage } from "alchemy/Stage";
import { Effect } from "effect";
import { expect, test, vi } from "vite-plus/test";

const boundary = vi.hoisted(() => {
  const bodies: Effect.Effect<unknown>[] = [];

  return {
    bodies,
    worker:
      vi.fn<(id: string, props: { name?: unknown; env?: object }) => void>(),
    website: vi.fn<(id: string, props: { name?: unknown }) => void>(),
  };
});

vi.mock("varlock/auto-load", () => ({}));

vi.mock("alchemy", () => ({
  Stack: vi.fn(
    (
      _name: string,
      _options: { providers: object; state: object },
      body: Effect.Effect<unknown>
    ) => {
      boundary.bodies.push(body);
    }
  ),
}));

vi.mock("@alchemy.run/cloudflare", () => ({
  D1: { Database: vi.fn(() => Effect.succeed({})) },
  Website: {
    Vite: vi.fn((id: string, props: { name?: unknown }) => {
      boundary.website(id, props);

      return Effect.succeed({ url: "https://web.example" });
    }),
  },
  providers: () => ({}),
  state: () => ({}),
  Worker: Object.assign(
    (
      id: string,
      props: { name?: unknown } | Effect.Effect<{ name?: unknown }>
    ) =>
      Effect.gen(function* worker() {
        const resolved = yield* Effect.isEffect(props)
          ? props
          : Effect.succeed(props);

        boundary.worker(id, resolved);

        return { url: { as: () => "https://server.example" } };
      }),
    { URL: Effect.succeed("https://server.example") }
  ),
}));

await import("./alchemy.run");

const runStack = async (stage: string, dev: boolean) => {
  boundary.website.mockClear();
  boundary.worker.mockClear();
  const [body] = boundary.bodies;

  if (!body) {
    throw new Error("The infrastructure stack was not registered");
  }

  await Effect.runPromise(
    body.pipe(
      Effect.provideService(Stage, stage),
      Effect.provideService(AlchemyContext, {
        dotAlchemy: ".alchemy",
        dev,
        adopt: false,
      })
    )
  );
};

const serverEnv = () => boundary.worker.mock.calls[0]?.[1].env;

test.each([
  ["preview", "preview"],
  ["prod", "prod"],
  ["local", "local"],
  ["live_adrrian17", "live-adrrian17"],
])(
  "the stack passes resolved Worker names for %s",
  async (stage, nameStage) => {
    await runStack(stage, false);

    const isProd = stage === "prod";

    expect(boundary.worker).toHaveBeenCalledExactlyOnceWith(
      "server",
      expect.objectContaining({
        name: `acta-server-${nameStage}`,
        domain: isProd ? "acta-api.adrianayala.mx" : undefined,
        workersDev: !isProd,
      })
    );
    expect(boundary.website).toHaveBeenCalledExactlyOnceWith(
      "web",
      expect.objectContaining({
        name: `acta-web-${nameStage}`,
        domain: isProd ? "acta.adrianayala.mx" : undefined,
        workersDev: !isProd,
      })
    );
  }
);

test("deployed stages never route GitHub sign-in to the emulator", async () => {
  await runStack("prod", false);

  expect(serverEnv()).not.toHaveProperty("GITHUB_EMULATOR_URL");
});

test("alchemy dev routes GitHub sign-in to the local emulator", async () => {
  await runStack("local", true);

  expect(serverEnv()).toHaveProperty(
    "GITHUB_EMULATOR_URL",
    "http://localhost:4000"
  );
});
