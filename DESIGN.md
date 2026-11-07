# Chores Design Direction

## Design Read

Reading this as: a household utility PWA for UK homes, using a Zune HD-inspired language. Black field, humanist typography, large left-aligned headings, one warm accent, flat planes, and lateral motion.

Dial: **ENERGY 2 / RHYTHM 2 / MOTION 2**

The product is not a Zune clone. It borrows four traits:

- Dark-first presentation.
- Large, quiet typography with strong hierarchy.
- One orange accent used for state.
- Purposeful horizontal movement.

The product identity is **Chores**.

## Core Principles

- Chores are the focal point. Progress is secondary.
- Urgent information gets weight. Ordinary information stays quiet.
- The interface is typographic, not boxy.
- Every screen has one focal point.
- Every interactive element works or is removed.
- Every data view has loading, empty, and error states.
- Every theme works.
- Motion has a purpose and respects reduced motion.
- No invented numbers, people, or claims.

## Palette

Light:

- Background: `#FFFFFF`
- Foreground: `#080808`
- Surface: `#F6F6F4`
- Border: `#D8D8D4`
- Secondary text: `#656560`
- Accent: `#C2410C`
- Accent foreground: `#FFFFFF`
- Destructive: `#C81E1E`
- Success: `#15803D`

Dark:

- Background: `#050505`
- Foreground: `#FAFAF8`
- Surface: `#111111`
- Border: `#2A2A28`
- Secondary text: `#A8A8A2`
- Accent: `#FF5A1F`
- Accent foreground: `#080808`
- Destructive: `#F87171`
- Success: `#4ADE80`

The accent is limited to:

- Active navigation marker.
- Focus ring.
- Progress bar fill.
- Current streak number.
- Current day marker.
- Pinned note label.
- Selected theme mode.

It is not used for primary buttons, headings, backgrounds, or decorative lines.

## Typography

Typeface: **Source Sans 3**.

Reason: Zune HD used a humanist interface typeface close to Segoe UI. Source Sans 3 has a similar humanist skeleton, strong small-size readability, and variable weights. It is less of a default AI choice than Inter.

Scale:

- Display: 40px, weight 600, tracking `-0.025em`, line-height 1.05
- Page title: 32px, weight 600, tracking `-0.02em`, line-height 1.15
- Section title: 20px, weight 600, line-height 1.25
- Row title: 16px, weight 600
- Body: 16px, weight 400, line-height 1.5
- Small body: 14px, weight 400, line-height 1.45
- Label: 13px, weight 600
- Metadata: 12px, weight 500
- Numeric data: tabular figures, weight 600

Rules:

- Use sentence case labels.
- Do not use wide-tracked uppercase labels.
- Do not use monospace.
- Use tabular figures for XP, streaks, dates, counts, and money.
- Use large left-aligned headings, never centered page titles.

## Shape

- Cards, inputs, and buttons: 4px radius.
- Dialogs and mobile sheets: 6px radius.
- No pills.
- No shadows.
- No gradients.
- No glow.
- No background patterns.
- No emoji.

## Surface Hierarchy

**Quiet section**

- No outer box.
- Section title.
- 1px divider under the heading when useful.
- Used for today's chores, progress, schedule, notes, bills, shopping groups, and settings sections.

**Row**

- 1px border.
- 4px radius.
- 12px padding.
- Minimum 44px action height.
- Used for chores, events, notes, bills, rooms, and suggestions.

**Urgent panel**

- 2px foreground border.
- Used only for the bins alert and dialogs.

This removes the mismatch where the progress widget had a heavy outline while today's chores did not.

## Motion

Tokens:

- Fast: 120ms
- Base: 180ms
- Slow: 240ms
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`

Motion inventory:

- Page enter: 6px upward movement plus fade, 180ms.
- Mobile tab indicator: 220ms slide.
- Navigation editor dialog: 160ms fade and scale from 0.98.
- Dialog: 160ms fade and scale from 0.98.
- Progress fill: 240ms width transition.
- Theme change: 160ms colour transition.
- Buttons and links: 120ms colour and opacity change.

Rules:

- No looping animations.
- No pulsing.
- No floating.
- No parallax.
- `prefers-reduced-motion: reduce` disables all non-trivial motion.

## Instant Navigation

Every tab is a client page with server data. A full-page loading panel must not flash on every tab change.

Implementation:

- TanStack Query cache in the authenticated app.
- Query keys per domain.
- `staleTime`: 30 seconds.
- `gcTime`: 10 minutes.
- Cached data renders immediately on remount.
- Full-page loading only appears when no cached data exists.
- Background refresh keeps current content visible.
- Mutations invalidate only related queries.
- Primary data is prefetched on nav hover, focus, and after app load.
- Logout clears the query cache.

## Shell

### Header

- Left on desktop: `Chores` wordmark.
- Left on mobile: `Chores` wordmark, except Settings shows `<- Settings` as a back control.
- Back uses browser history, then falls back to Dashboard.
- Right: user name on desktop, theme icon, settings cog.
- The settings cog is a shortcut. Settings is also a fixed navigation destination.
- The header is a utility bar, not primary navigation.
- Sign out lives in Settings only.
- Theme icon shows the action: moon in light mode, sun in dark mode.
- Settings icon is a gear, visually distinct from the theme icon.
- Icon buttons are 44px minimum with accessible names and titles.
- Header height: 60px.
- Header border: 1px.
- Header is sticky on scroll.

### Desktop Navigation

- Docked left rail, 224px, always visible and independently scrollable.
- Icon plus text label for every item. Never icon-only and never hover-only.
- All ten destination items appear in the user's saved order.
- Settings is fixed at the bottom of the rail, separated by a rule and always last.
- `Customize navigation` sits in the rail footer above Settings.
- The rail is sticky below the 60px header.

Active item:

- Foreground text.
- Semibold.
- 2px accent marker on the left edge.
- No filled black block.

### Mobile Navigation

Bottom tabs, in order:

- The first four destinations from the user's saved order.
- `All`, always fifth and fixed.

Tab treatment:

- Icon above a text label, 56px minimum height, safe-area padding.
- Accent underline.
- Semibold text.
- The underline slides between the five equal tab cells.
- Exactly one tab carries `aria-current="page"`.

The All page (`/all`) is a real route, not a popup. It groups every destination into `Daily`, `Household`, `Personal`, and `Account`. Each row has an icon, label, and one-line description. The All tab stays active on the All page, on Settings, and on any destination outside the first four.

Settings on mobile:

- Secondary surface, still owned by the All tab.
- Header becomes `<- Settings`.
- Back uses browser history, then falls back to Dashboard.
- Settings section tabs stay horizontal and local to the page.

There is no More sheet. No destination can disappear from navigation.

### Navigation Customization

- One saved order per user, shared by desktop and mobile.
- Stored as `users/{uid}.navigation_order`: an array of stable destination ids.
- Default order: `dashboard, chores, bins, shopping, meals, bills, calendar, notes, progress, health`.
- The first four saved items become the mobile bottom tabs. The rest remain in All.
- New destinations merge into an existing saved order in default order; unknown ids are dropped and duplicates removed.
- Editor entry points: `Customize navigation` in the desktop rail footer, and `Edit navigation` in the All page header.
- Reorder with pointer drag plus accessible `Move up` and `Move down` controls.
- A labelled divider after the fourth item marks `Bottom bar` and `More in All`.
- Settings and All are fixed, shown in the editor, and not reorderable.
- `Reset to default`, `Cancel`, and `Save` are always available. Changes persist only on Save.
- The mobile bottom bar always has four primary destinations plus All. It never has fewer.

### Meals

- Destination: `/meals`, grouped under Daily.
- Three tabs: Ideas, Plan, Recipes.
- Ideas are shared household suggestions with votes and the suggester's name.
- Plan is a Monday-to-Sunday grid with breakfast, lunch, dinner, and snack slots.
- A planned meal can link a catalogue or household recipe; free-text meals are allowed but cannot add ingredients to shopping.
- Recipe search uses the local SQLite FTS5 catalogue. Household recipes are merged into results.
- Recipe detail shows ingredients, method, tags, source attribution, and per-serving nutrition with a confidence label.
- `Add to shopping` scales ingredients to planned servings, merges matching unchecked items, and confirms before writing.
- Nutrition is an estimate, never a medical claim. Missing matches are shown honestly.

### Private Health Diary

- Destination: `/health`, grouped under Personal.
- Private to the signed-in user. Never shown to the household, admins, or the All index.
- Consent gate before the first entry.
- Entry fields: date, time, symptoms, severity, duration, energy, notes.
- Timeline supports edit and delete.
- Export and delete-all are always available.
- No diagnosis, causation, or treatment language.
- Excluded from household export.

## Screen Flow

### Login and Register

- Large left-aligned wordmark area on desktop.
- Form panel uses a 2px border.
- Theme icon in the top right.
- ALTCHA widget uses the same border, radius, surface, and accent success state.
- Inline errors above the submit button.
- No fake trust marks.

### Setup

- Three-step rail with accent progress.
- Current step title at page-title size.
- Step content transitions with a 160ms fade and 4px horizontal movement.
- Rooms are selectable rows.
- Setup remains idempotent.

### Dashboard

Order:

1. Date line in accent.
2. `Today at home` page title.
3. Bins alert when collection is tomorrow. 2px border.
4. Today's chores. Quiet section, 1px rows.
5. Progress. Quiet section matching chores.

The four quick-link cards are removed because the navigation already covers those destinations.

Bins alert:

- `Put the bins out tonight`.
- 1px bin rows.
- `Mark bins out`.
- After completion: `Bins out by Sam at 19:42`.
- No repeated `Out` badges. Plain text.

Today's chores:

- Section heading plus `View all chores`.
- Groups: `Your chores`, `Up for grabs`, `Other household chores`.
- Owner shows only on the other-household group.
- 1px rows.
- Overdue uses destructive border and text.
- Completion feedback shows XP and streak.

Progress section:

- No outer border.
- 1px top divider.
- Personal level row with accent progress track.
- Household level row.
- Current best streak.
- `View progress` text link.

### Chores

Four sections:

1. Due now.
2. One-off tasks scheduled for a future date.
3. Suggested for your home.
4. Schedule.

`Recurring templates` is renamed to `Schedule` with the explanation:

> The recurring rules that create due chores.

Two create actions:

- `Add task` creates a one-off task with a due date.
- `Add chore` creates a recurring chore.

Due rows show:

- Name.
- Due label.
- Room.
- `One-off` when applicable.
- Owner as `You`, a name, or `Anyone`.
- `Mark done`, `Skip`, and `Assign`.
- `Edit` for one-off tasks.

Member filter appears when the household has more than one person:

- `All`
- `Mine`
- `Up for grabs`

#### Assignment modes

Every chore chooses one mode:

| Mode | Behaviour |
|---|---|
| Auto-balanced | Next occurrence goes to the member with the lowest rolling load. |
| Anyone | No owner. Anyone can claim it. |
| One person | The same member gets every occurrence. |
| Takes turns | Members rotate in a chosen order. |

Auto-balanced load:

```
open assigned minutes
+ minutes completed by the member in the last seven days
```

Ties break on fewer open chores, then longest time since assignment.

Assignment stays soft. Anyone can complete any chore. XP goes to the completer. Assignment never awards XP.

One-off tasks:

- Use the same assignment modes.
- Leave the Schedule after completion.
- Keep completed history.
- Can be edited or deleted while pending.

Schedule rows show:

- Name.
- Room.
- Frequency.
- Assignment mode, or `Always [Name]` for fixed ownership.
- Next due date.
- Current on-time streak.
- `Edit` action.

Edit dialog:

- Same fields as create.
- Title changes to `Edit recurring chore` or `Edit one-off task`.
- Assignment mode selector.
- Fixed owner selector, or a rotation member checklist.
- Active checkbox pauses a recurring rule.
- Delete removes pending occurrences and keeps completed history.
- Frequency changes recalculate the next due date.

Recurrence advances from the scheduled due date, not the completion date. Missed occurrences are skipped so the cadence does not drift and no backlog builds.

Suggestions:

- Maximum three.
- One per room where possible.
- 1px rows.
- Reason line.
- `Add chore` pre-fills the create dialog.
- `Not now` dismisses for 30 days.
- No AI badge, sparkle icon, or chat box.

#### Composer

- The add/edit dialog is split into `What`, `When`, and `Who`.
- End date and reminder controls sit under `More options`.
- Save and Cancel stay in a sticky footer.
- Unassigned rows offer a direct `Claim`.
- Auto-balance shows the next likely member and their current weekly load.
- Priority is not shown because it does not affect ordering or visibility.

#### Scheduling

Recurring chores support:

- Start date.
- Weekly weekdays, including multiple days.
- Fortnightly parity.
- Monthly day of month, or first to fourth or last weekday.
- Quarterly and yearly patterns.
- Optional end date.
- Optional due time.

Due time changes on-time rules:

- With a due time, completion after that time is late.
- Without a due time, completion by the end of the due date is on time.

Editing a series changes future occurrences only. Completed history stays. Undo restores the latest closed occurrence and removes the next one.

#### Reminders

Household defaults:

- Daily brief time.
- Bin reminder time.
- Bill lead days and reminder time.
- Calendar lead minutes.
- Quiet hours.

Each member can override the timing and disable each reminder type. Per-item overrides exist on chores, bin schedules, bills, and calendar events.

The daily brief combines:

- Chores due today and overdue.
- Bins due tonight.
- Bills due within the lead window.
- Today's calendar events.

A 15-minute cron runs the reminder engine. Delivery records are keyed by entity, occurrence, and member, so retries do not duplicate a reminder.

### Bins

- Explains that bins go out the evening before.
- Next collection date is prominent.
- Schedule rows are quiet.
- Each schedule has `Edit`, `Change next collection`, and `Delete`.
- Edit allows day, frequency, colour, start date, and reminder time.
- Delete confirms first and removes that schedule's exceptions.
- Scheduled changes use 1px rows.
- Dashboard owns the tonight completion action.

### Shopping

- Add form uses the same 1px border as the list rows.
- Unchecked items are grouped under `To get`.
- Checked items are grouped under `In the basket`.
- Both group headings use the same type size. `In the basket` uses secondary text.
- Rows use 1px borders.
- Items can be edited.
- `Clear basket` removes all checked items.
- Remove has a 44px target.

### Bills

- Groups: `Overdue`, `Due today`, `Next 7 days`, `Later`, `No date`.
- Sort ascending within each group.
- Overdue rows show `X days overdue` in destructive text.
- Summary states the total due today through the next seven days.
- Quiet sections with 1px rows.
- Amount stays in a fixed right column with tabular figures at every breakpoint.
- Mark paid is a secondary button.
- Edit is available for amount, provider, frequency, due date, payment method, reference, notes, and reminder timing.
- Delete is a text action with confirmation.

### Calendar

- Events grouped by date.
- Today's date label uses accent.
- Event rows use 1px borders.
- No fake month grid until the data justifies it.
- Upcoming events are shown by default. Past events sit behind a disclosure.
- Add and edit event use one dialog.
- Supports end time, all-day, assigned member, and reminder lead minutes.
- All-day events use a date-only control and hide the end time.
- Creating an event notifies the other household members.
- If the event is assigned to one person, only that person is notified.
- Events also produce a reminder before they start.

### Notes

- Pinned notes first.
- `Pinned` is small accent text, not a pill.
- Each note shows who added it, the creation date and time, and the last updated date and time when edited.
- Note content is plain text, not a bordered field.
- Add and edit share one dialog.
- Copy content action.
- Delete confirmation.

### Progress

Sections:

1. Personal level, large number, accent progress bar.
2. Household level, same treatment.
3. This week table: member, chores, bins, XP.
4. Workload balance table: member, minutes done in the last seven days, open minutes and count, overdue count.
5. Unassigned summary: chores and estimated minutes up for grabs.
6. Seven-day completion strip.
7. On-time streaks.

Uses quiet sections with 1px dividers. No 2px card grid. Workload balance is informational, never a leaderboard or fairness score.

### Notification centre

- Bell in the header with an unread count in its accessible name.
- Lists chore, bin, bill, calendar, assignment, and test notifications.
- Selecting a notification marks it read and opens its screen.
- Mark all read is available.

### Search and export

- Search opens from the header.
- Searches chores, notes, bills, calendar events, and shopping items.
- Results link to the matched item and highlight it on arrival.
- Settings exports household data as a JSON file.

### Settings

Reached from the header cog.

Sections separated by 1px rules:

- Appearance
- Household
- Reminder defaults
- Rooms
- Members
- Calendar feeds
- Personal reminders
- Device notifications
- Account and sign out

Household controls:

- Rotate the invite code.
- Export household data.
- Remove members as an admin, or leave the household.

Per-member controls:

- Enable or disable each reminder type.
- Override reminder times.
- Respect quiet hours.
- Send a test notification to the current device.

Delivery:

- Daily 07:00 digest names only the member's due and overdue chores.
- Unassigned due chores appear once as `Up for grabs`.
- Manual assignment sends one immediate notification to the new owner.
- Automatic assignment does not send a notification; the digest covers it.

Appearance:

- Auto, Light, Dark.
- Active option uses accent border and surface.
- Auto follows the device theme.
- Appearance comes first.
- Settings use a sticky horizontal tab strip, never a second sidebar. Mobile tabs scroll horizontally and open the selected section.
- Reminder defaults and personal overrides share one table. One save action covers both.
- Account shows the signed-in email and role before sign out.

## Components

Buttons:

- Primary: foreground fill, background text.
- Secondary: background surface, 1px foreground border.
- Danger: destructive fill.
- Minimum 44px.
- No arrows.
- No pills.

Inputs:

- 1px border.
- 4px radius.
- 2px accent focus ring.
- Visible label.
- 16px text on mobile.

Progress bars:

- 2px border track.
- Accent fill.
- 8px height.
- Animated width.
- `role="progressbar"`.

Rows:

- 1px border.
- 4px radius.
- 12px padding.
- 44px actions.

Dialogs:

- Render into a portal on `document.body`.
- Fixed overlay covers the viewport.
- Panel caps at 90vh and scrolls inside.
- Escape closes and focus returns to the opener.
- The page-enter animation must not leave a transform on the route container, because that would break fixed positioning.
- Destructive actions use the shared confirmation dialog, not the browser-native confirm.

Empty states:

- Explain the cause.
- One next action.
- No illustration.
- 1px solid border. No dashed border.

Loading states:

- Cached data appears immediately.
- First load uses a short static skeleton or loading line.
- No pulsing.

Error states:

- Inline alert.
- Keep existing content.
- Offer retry.

## Content Rules

- UK English throughout.
- No em dashes in UI text.
- No invented statistics.
- No fake testimonials or names.
- No decorative emoji.
- No AI marketing language.
- No `recurring template` in user-facing copy. Use `schedule` and `recurring chore`.
- No `real time` claim unless the data is live.

## Accessibility

- All text meets WCAG AA contrast.
- All interactive elements are reachable by keyboard.
- Visible accent focus ring.
- Dialog focus trap and Escape close.
- 44px tap targets.
- Proper table markup.
- Progress bars expose values.
- Status messages use `aria-live`.
- Theme toggle has an accessible action label.
- Motion respects `prefers-reduced-motion`.

## What This App Does Not Have

- No gradients.
- No glassmorphism.
- No shadows.
- No glow.
- No background patterns.
- No decorative icons.
- No endless animations.
- No emoji.
- No badge pills.
- No stat cards with fake deltas.
- No leaderboard.
- No coins or shop.
- No confetti.
- No AI badge.
