# React and UI

Stack: React 19, TanStack Router (file-based, `apps/web/src/routes`), TanStack Query via tRPC, Tailwind v4, shadcn/ui in `packages/ui`. Not Next.js.

- Reach for `@acta/ui` components (Button, Input, Card, ...) before raw elements or new components.
- React 19: pass `ref` as a prop; don't use `forwardRef`.
- Use `<button>`, `<a>` and other semantic elements. A clickable `<div>` is wrong even with a `role`.
- Every form input needs a `<label>` (or the shadcn `Label`).
- Use plain `<img>` with `alt`, `width` and `height`. There is no image component.
