# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

UK couples and housemates running a shared home. They need one calm place to coordinate chores, bin collections, shopping, bills, shared notes, and the household calendar without turning the home into a competition.

## Product Purpose

Chores brings the recurring work of a shared UK home into one PWA. It exists so household members can see what needs doing, agree who is responsible, and keep bins, bills, shopping, notes, and events from falling through the cracks.

Success means the house runs with less nagging and less mental load. Everyone can see the real workload, and the next action is always obvious.

## Positioning

A calm household operating system with fair, visible distribution. It combines UK-specific household operations with workload balancing that does not become a leaderboard, score, or public social product.

The product mechanism a neighbouring app could not truthfully copy:

- Shared responsibility is visible through workload balance, not competitive points.
- UK bin schedules and bill rhythms are first-class, not generic tasks.
- Every module feeds one household brief instead of separate silos.

## Operating Context

- Shared homes in the UK, usually two or more adults.
- Mobile-first use, with a desktop layout for planning.
- Recurring chores, one-off tasks, bin nights, bills, shopping, shared notes, calendar events, and a household brief.
- Reminder times, due times, and weekday routines matter.
- Household members may have different schedules and may not be in the app at the same time.
- The app is used as an installed PWA and through a normal browser.

## Capabilities and Constraints

Confirmed capabilities:

- Chores with recurring schedules, one-off tasks, assignment modes, due times, reminders, history, and undo.
- Workload balancing by estimated effort.
- Bin schedules, collection changes, and evening-before reminders.
- Household bills, shopping lists, shared notes, and calendar events.
- A combined daily brief and a notification centre.
- Personal and household XP, levels, and on-time streaks.

Confirmed constraints:

- PWA only today. The repository must stay ready for future native apps.
- Firebase Auth and Firestore.
- Firebase Cloud Messaging for push.
- ALTCHA on login and registration.
- Docker and Unraid deployment behind a user-managed Cloudflare Tunnel.
- UK English throughout.
- No ads, no public social features, no leaderboard.
- No invented statistics, testimonials, people, or claims.
- No decorative emoji.
- WCAG AA target, keyboard access, visible focus, 44px tap targets, and reduced-motion support.

## Brand Commitments

- Product name: Chores.
- Voice: calm, direct, plain UK English.
- Fairness is shown as workload, never as a competitive score.
- The product does not fabricate household activity, people, or results.

## Evidence on Hand

- Working Next.js PWA in `apps/web`.
- Shared domain logic and tests in `packages/domain`.
- Server, Firebase, and job code in `packages/server`.
- Current design system in `DESIGN.md`.
- Desktop and mobile Playwright journeys in `apps/web/e2e`.
- No user research, testimonials, case studies, press, benchmarks, or customer logos. Future work must not invent them.

## Product Principles

1. The shared household is the product. Chores are the focal point; progress is secondary.
2. Make fairness visible without making it a competition.
3. Respect the real UK home: bin nights, bills, routines, and the way people actually share work.
4. Every feature must work for a real household. Remove anything that only exists as decoration or theatre.
5. Keep the next action obvious, especially on a phone.

## Accessibility & Inclusion

- Target WCAG AA contrast.
- Full keyboard access and visible focus.
- Minimum 44px tap targets.
- Motion respects `prefers-reduced-motion`.
- Every data view must have loading, empty, and error states.
