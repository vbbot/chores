# Meals and Private Health Implementation Plan

> **For agentic workers:** Use subagent-driven-development. Tasks are file-disjoint. The main session owns foundation, integration, navigation, dashboard, and final verification.

**Goal:** Add shared meal ideas, a weekly meal plan, a local recipe catalogue with nutrition, shopping-list integration, and a private per-user health diary to the existing household app.

**Architecture:** Firestore stores household meal state and private health entries. A volume-mounted SQLite FTS5 database stores the read-only recipe catalogue. Existing Next.js route handlers, Zod validation, TanStack Query, and server modules are extended; no AI or external runtime recipe API.

**Tech Stack:** Next.js 14, React 18, TypeScript, Firestore Admin, TanStack Query, Tailwind, Zod, better-sqlite3, FTS5, Playwright.

**Spec:** This conversation's final stack and SQLite search design.

## Global Constraints

- UK English in UI copy.
- No AI, vector DB, or external runtime recipe API.
- Health entries private to the authenticated user.
- Health entries excluded from household export.
- All meal routes use `requireUserHousehold`.
- All health routes use the authenticated user only.
- Recipe URL import blocks private, loopback, link-local, and metadata addresses.
- No recipe data baked into the Docker image.
- Existing visual language and 44px targets.
- New navigation destinations merge into saved orders.
- No destructive writes without confirmation.
- SQLite absence must not crash the app; search returns an empty result.

## File ownership

Main:
- `packages/domain/src/food.ts`, `health.ts`, `validation.ts`, `types.ts`, `index.ts`
- `packages/food-data/**`
- `packages/server/src/recipes.ts`, `meals.ts`, `health.ts`, `nutrition.ts`, `shopping.ts`, `index.ts`
- `apps/web/src/app/api/v1/recipes/**`, `meals/**`, `health/**`
- `apps/web/src/lib/query-keys.ts`, `types.ts`
- `apps/web/src/app/(app)/meals/page.tsx` shell
- `apps/web/src/app/(app)/dashboard/page.tsx`
- `apps/web/src/components/navigation`/nav config (meals, health)
- `DESIGN.md`, `PRODUCT.md`
- E2E fixture/spec updates

Subagent A:
- `apps/web/src/components/meals/meal-ideas.tsx`
- `apps/web/src/components/meals/meal-plan.tsx`
- `apps/web/src/components/meals/add-to-shopping-dialog.tsx`

Subagent B:
- `apps/web/src/components/meals/recipe-browser.tsx`
- `apps/web/src/components/meals/recipe-import-dialog.tsx`
- `apps/web/src/app/(app)/meals/recipes/[id]/page.tsx`

Subagent C:
- `apps/web/src/app/(app)/health/page.tsx`
- `apps/web/src/components/health/*`

## Tasks

### Task 1: Foundation

- Domain recipe, meal, health types and Zod schemas.
- SQLite schema, search, importer stubs, common nutrition.
- Server modules and API routes.
- Nav and query keys.
- Build, typecheck, unit tests.

### Task 2: Meal ideas and plan UI

- Shared ideas board with votes.
- Week plan grid.
- Add-to-shopping confirmation dialog.
- API integration and empty/loading/error states.

### Task 3: Recipe browser and import

- Catalogue search with filters.
- Recipe detail route.
- URL import dialog with review.
- Nutrition display with confidence.

### Task 4: Private health diary

- Consent gate.
- Check-in form.
- Timeline, edit, delete.
- Personal export/delete.

### Task 5: Integration

- Meals page shell.
- Dashboard tonight card.
- Navigation.
- Search query key and deep links.

### Task 6: Verification

- Unit tests for search, ingredient scaling, nutrition.
- E2E for ideas, plan, shopping, health privacy.
- `tsc`, `npm test`, `npm run build`, `npm run e2e`.
