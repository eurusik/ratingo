---
id: user-media-transition-side-effects
paths:
  - 'apps/api/src/modules/{user-media,user-actions}/**'
triggers:
  - '\bsetState\b'
  - '\.set\(\{[^}]*\bstate\s*:'
  - '\bSET\s+state\b'
  - '@OnEvent\('
  - '\b(?:bulkTransition\w*|unsaveItem|saveItem|subscribe|unsubscribe)\('
  - '\.delete\(schema\.(?:userMediaState|userSubscriptions|savedItems)'
  - '\bCAUGHT_UP\b|\bFOR_LATER\b|\bCONSIDERING\b'
severity_cap: major
---

## What to verify

A viewer's state for a title (watching, caught up, completed, planned, dropped) moves only because of something the viewer did or something that really changed for them. Every transition must also leave the saved lists and the reminders consistent with the new state, and must not destroy data the viewer wrote.

## Evidence required

Quote the statement or listener that changes state, lists or subscriptions. Say which event or input triggers it, which users it reaches, and the exact inconsistent outcome (a viewer moved back without cause, a title in two lists, a reminder left on or silently removed).

## Report only when

- An event handler or bulk statement changes state for many viewers, and its condition does not check that the cause applies to each viewer. Example: a sync reports an episode as new on every run, so a bulk move fires although nothing new has aired.
- A transition into or out of a state does not add or remove the matching saved-list entries, so a title shows in a list that contradicts its state.
- Reminders created automatically are not tied to the action that created them, so removing the plan leaves the bell on, or turning a reminder off by hand is undone by a later event.
- Deleting or overwriting a rating, review, note or manually set reminder happens as a side effect of a state change.
- The same transition can run twice from retried events and double the effect.

## Do not report

- Guarded bulk updates that restrict rows by current state and by a per-viewer condition in the same WHERE clause.
- State changes made directly by the viewer through an endpoint.
- Event listeners that only log or emit metrics.

## Real bug example

After every tracked-show sync, a listener moved all caught-up viewers of the show back to watching, because the sync always reported the latest aired episode as new. The bulk update only filtered on state. The fix added a condition that the viewer has an unwatched regular episode aired by the sync time, and finishing aired episodes now removes the title from the for-later and considering lists.

## Looks risky but fine

The bulk update from caught up to watching has the state filter plus an EXISTS check for an aired episode the viewer has no progress row for, using the injected clock time. It touches only viewers who really have something new to watch.
