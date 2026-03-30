# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Dev server with HMR (http://localhost:5173)
npm run build      # Production SSR build → /build
npm run start      # Serve production build
npm run typecheck  # Route type generation + tsc
```

## Architecture

**Stack**: React Router 7 (full-stack SSR framework) + React 19 + TypeScript 5 strict + Vite 7 + Tailwind CSS 4

**SSR is enabled by default** (`react-router.config.ts`). Each route module can export `loader`/`action` for server-side data fetching and mutations.

### Routing

Routes are configured declaratively in `app/routes.ts` (not file-system convention). Route modules export `meta()`, `loader()`, `action()`, and a default component. Route types are auto-generated into `.react-router/` via `react-router typegen` (runs as part of `typecheck`).

### Path Alias

`~/*` maps to `./app/*` (configured in tsconfig.json).

### Styling

Tailwind CSS 4 with Vite plugin — uses `@import "tailwindcss"` and `@theme` directive in `app/app.css`. Dark mode via `dark:` utilities.

### Deployment

Multi-stage Dockerfile included. Build outputs `build/client/` (static assets) and `build/server/` (SSR server).
