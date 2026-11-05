# Chores Design Direction

## Design Read

Reading this as: household utility app for couples/housemates, with a monochrome utility-first language, dial ENERGY 1 / RHYTHM 2 / MOTION 1.

## Dials

- ENERGY 1: Calm, functional, stays out of the way. This is a tool you open while holding a bin bag.
- RHYTHM 2: Consistent base with deliberate breaks. Dashboard varies from list views.
- MOTION 1: Hover states only. No scroll animations, no floating elements.

## Palette

- Background: #FFFFFF (light), #0A0A0A (dark)
- Surface: #FAFAFA (light), #141414 (dark)
- Border: #E5E5E5 (light), #262626 (dark)
- Text primary: #0A0A0A (light), #FAFAFA (dark)
- Text secondary: #737373
- Accent: #0A0A0A (light), #FAFAFA (dark). The accent IS the text color. No colour accent.
- Destructive: #DC2626 (red, for overdue/errors only)
- Success: #16A34A (green, for completed states only)

Reason: a household app has no brand colour to push. Black and white puts content first. Red and green carry meaning (overdue, done), not decoration.

## Typography

- Font: Inter. Reason: it is the most readable screen font at small sizes, and this app will be read on phones in kitchens. No monospace, no display font.
- Headings: semibold, sentence case
- Body: regular, 16px base
- Labels: medium, 14px

## Identity Motif

- Heavy black borders (2px) on primary cards and interactive containers. This gives the app a stamp/print quality that separates it from soft-shadow AI defaults.
- No rounded pills. Small radius (6px) on cards and inputs. Buttons are 8px radius.

## Focal Point

- Dashboard: today's tasks and tonight's bins. Everything else defers.
- Each screen: the actionable list is the page. No stat cards, no charts, no decoration.

## What This App Does NOT Have

- No gradients
- No glassmorphism
- No shadows (borders do the separation work)
- No glow
- No background patterns
- No decorative icons
- No animations beyond hover states
- No emoji in UI
- No badge pills
- No stat cards with fake deltas

## Progress and Streaks

- Chores stay the focal point. XP and streaks are secondary.
- Personal and household progress use bordered rows, not four stat cards.
- Progress bars are a 2px bordered track with a solid fill. No gradient fill.
- No confetti, glow, pulsing streak flames, coins, shops, or badge grid.
- Streaks use plain text: `3 on time in a row`.
- The seven-day strip uses filled and empty bordered cells, not a chart.
- Suggestions are labelled as suggestions. No AI badge or sparkle icon.

## Bin Preparation

- The bins card appears on the day before collection.
- The action is `Mark bins out`, not a reminder with no completion.
- The card shows who marked them out and when.
- The iCal feed includes a previous-day preparation event and the collection-day event.
