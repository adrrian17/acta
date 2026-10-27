# TypeScript conventions

Oxlint already enforces most style rules (no `any`, `for...of`, no barrels, no import cycles, no floating promises). The rules below are the ones lint can't catch.

## Types

- Narrow with type guards or Zod parsing instead of `as` assertions.
- Name magic numbers and strings as constants.

## Modules

- No barrel files. The one exception is `packages/db/src/schema/index.ts`, the single Drizzle schema entry point.
- When two modules need each other, move the shared code into a third module that both import.

## Errors and logging

- Return early on error cases instead of nesting conditionals.
- In tRPC procedures, throw `TRPCError` with an explicit `code`.
- No `console.log` in committed code. Lint does **not** catch this (`no-console` is off).

## Boundaries

- Validate external input with Zod at the boundary: tRPC `.input()`, request bodies, env vars (via varlock).
