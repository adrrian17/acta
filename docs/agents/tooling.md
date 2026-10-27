# Tooling

- Lint and format use Ultracite presets through Vite+ (Oxlint + Oxfmt). All config lives in `vite.config.ts` under `lint`, `fmt` and `staged`. Don't add `.oxlintrc`, `.eslintrc` or `.prettierrc` files.
- Lint rules run type-aware, but `typeCheck` is off, so type errors only show up through `pnpm check` / `pnpm check-types`.
- The pre-commit hook (`.vite-hooks/pre-commit`) runs `vp staged`, which runs `vp check --fix` on staged files. If the hook rewrites files, re-stage them.
- `packages/ui/src/components/**` is shadcn-generated and excluded from lint. Add or update components with `shadcn add`, not by hand-editing them into lint compliance.
- `.agents/skills/**` and `.claude/skills/**` are excluded from lint and format.
