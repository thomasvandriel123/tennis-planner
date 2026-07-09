# Tennis Club Training Planner — Specification

Status: draft v1 · Owner: club organiser · Last updated: 2026-07-06

## 1. Purpose

A small, focused web app that lets a local tennis club run its training
seasons without spreadsheets and email chains. It does four things well:

1. The **organiser** defines a training period (dates, weekdays, times, price).
2. **Players** state their preferences (day, partners, skill level) for that period.
3. The **organiser** reviews those preferences and assigns players to concrete
   training slots.
4. Everyone stays in sync: players pay online, and **trainers**/the organiser
   post updates (e.g. cancellations) that reach the right people immediately.

Non-goals for **v1** (see [§13 Out of scope](#13-out-of-scope-v1)): automatic
matchmaking, multi-club support, in-app chat. Note these are v1 non-goals,
not permanent exclusions — [§15 Competitive feature set](#15-competitive-feature-set--reaching-parity-with-planmysport)
puts several of them (and attendance tracking, extra lesson types, broader
payments) on a prioritised roadmap to stay competitive with PLANMYSPORT.

Design principles, in priority order:
- **Clarity over cleverness.** Every screen should be understandable without
  a tutorial. Prefer plain tables and lists over dashboards with too many
  widgets.
- **Do less, but do it reliably.** A small feature set, tested well, beats a
  large one that's flaky.
- **Boring, maintainable code.** Popular, well-documented tools; minimal
  custom infrastructure; a codebase a single volunteer developer can keep
  running for years.
- **Tennis, subtly.** Court-line motifs, a tennis-ball accent color, a
  net-shaped divider — never at the cost of legibility.

## 2. Users & Roles

A person is a single `User` account that can hold one or more **roles** in
the club:

| Role | Can do |
|---|---|
| **Organiser** | Create/edit training periods & pricing; invite players & trainers; view all preferences; assign players to slots; view payment status; post/edit updates; manage trainers. |
| **Trainer** | Set their own availability; view rosters for their assigned sessions; post updates about a session (cancel, reschedule, note). |
| **Player** | Manage profile & skill level; submit preferences per training period; view their assigned slot(s); pay online; receive updates. |

A user can be both a player and a trainer (common at small clubs). The
organiser role is granted by an existing organiser — it is not
self-service.

**Membership model (v1):** closed/invite-based. The organiser invites
people by email; they follow a link to set a password (or use a magic
link — see [§9](#9-authentication--security)) and land with the role(s)
they were invited as. This avoids building open registration + approval
workflows and keeps the member list authoritative.

## 3. Domain Glossary

| Term | Meaning |
|---|---|
| **Training Period** | A season definition: start date, end date, a weekly recurrence (e.g. "every Monday & Tuesday, 18:00–22:00"), and a price. |
| **Session** | One concrete calendar occurrence generated from a Training Period (e.g. "Monday 5 Jan 2027, 18:00–22:00"). Can be individually cancelled or edited (e.g. rained out) without affecting the rest of the period. |
| **Slot** | A bookable sub-unit of a Session: a specific court + time range + max player count (e.g. "Court 1, 18:00–19:30, max 4"). A Session usually has multiple Slots so players of different levels aren't all on one court. |
| **Preference** | A player's input for a Training Period: preferred day(s), preferred training partners, self-reported skill level (1–9), free-text notes. |
| **Assignment** | The link between a Player and a Slot, created by the organiser. |
| **Update** | A message posted against a Session or Period by a trainer/organiser (e.g. "cancelled — rain"), which generates notifications. |

## 4. User Flows

### 4.1 Organiser: set up a training period
1. Create a Training Period: name, start/end date, weekday(s) + time range,
   price, currency.
2. App generates the Session list (one per matching weekday in range).
   Organiser can cancel/adjust individual sessions later (holidays, etc.).
3. Organiser opens the period for player preferences (sets a submission
   deadline).
4. Organiser invites trainers and assigns them to sessions or the whole period.

### 4.2 Player: submit preferences & get assigned
1. Player opens the open Training Period and submits preferences: which
   day(s) work, up to N preferred training partners (searched from existing
   members), skill level.
2. Preferences are editable until the deadline.
3. After the deadline, the organiser reviews an overview table (see 4.3)
   and manually assigns each player to a Slot.
4. Once assignments are published, the player sees their Slot(s) on their
   dashboard and gets a notification.
5. Player pays online for the period; dashboard shows payment status.
6. Player receives Update notifications for their sessions (cancellations,
   court changes, notes).

### 4.3 Organiser: assign players to slots
This is the core "hard" screen — it must stay simple even as data grows:
- A table of all players who submitted preferences for the period: name,
  skill level, preferred day(s), preferred partners, current assignment
  (if any).
- Sortable/filterable by day and skill level.
- For each Session, the organiser defines Slots (court, time, capacity),
  then assigns players to a Slot via a simple picker.
- The app flags obvious conflicts inline (slot over capacity, player
  assigned to two overlapping slots) — it does **not** attempt to
  auto-solve them. The organiser decides.
- Assignments can be saved as a draft and published later (players are
  only notified on publish).

### 4.4 Trainer: post a training update
1. Trainer opens their upcoming session.
2. Posts an update (free text) and optionally changes session status
   (Scheduled / Cancelled / Moved).
3. All players assigned to that session (and the organiser) get a
   notification (in-app + email).

### 4.5 Payment
1. Once assignments for a period are published, the app creates one
   Payment record per assigned player for the period's price.
2. Player pays via a hosted checkout (Mollie — see [§8](#8-technical-architecture)).
3. A webhook confirms payment and updates status; player and organiser see
   it reflected immediately.
4. Organiser dashboard shows a paid/unpaid overview per period, with a
   one-click reminder email for unpaid players.

## 5. Data Model

```mermaid
erDiagram
    USER ||--o{ USER_ROLE : has
    USER ||--o{ PREFERENCE : submits
    USER ||--o{ ASSIGNMENT : "is assigned via"
    USER ||--o{ PAYMENT : owes
    USER ||--o{ UPDATE : authors
    USER ||--o{ TRAINER_AVAILABILITY : sets

    TRAINING_PERIOD ||--o{ SESSION : generates
    TRAINING_PERIOD ||--o{ PREFERENCE : "collects for"
    TRAINING_PERIOD ||--o{ PAYMENT : "priced by"

    SESSION ||--o{ SLOT : contains
    SESSION ||--o{ UPDATE : "has"
    SESSION }o--o{ USER : "trained by (trainer)"

    SLOT ||--o{ ASSIGNMENT : fills

    PREFERENCE }o--o{ USER : "prefers partner"
```

Core entities (fields are indicative, not final):

- **User** — id, name, email, phone, locale (nl/en), skill_level (self
  reported, organiser can override), created_at.
- **UserRole** — user_id, role (organiser/trainer/player), period_id
  (nullable — trainer roles can be period-scoped).
- **TrainingPeriod** — id, name, start_date, end_date, weekday_pattern
  (e.g. `["MON","TUE"]`), start_time, end_time, price, currency,
  preference_deadline, status (draft/open/assigning/published/archived).
- **Session** — id, period_id, date, start_time, end_time, status
  (scheduled/cancelled/moved), location/court note.
- **Slot** — id, session_id, court, start_time, end_time, capacity,
  min_skill, max_skill (optional band).
- **Preference** — id, user_id, period_id, preferred_weekdays[],
  preferred_partner_user_ids[], skill_level, notes, submitted_at.
- **Assignment** — id, slot_id, user_id, assigned_by, assigned_at.
- **Payment** — id, user_id, period_id, amount, currency, status
  (pending/paid/failed/refunded), provider_reference, paid_at.
- **Update** — id, session_id (nullable → period-wide), author_id, body,
  created_at.
- **Notification** — id, user_id, update_id, channel (in_app/email),
  read_at, sent_at.
- **TrainerAvailability** — id, user_id, period_id, available_weekdays[].

### Semantic layer / data dictionary

Every table and column is documented directly in the Prisma schema using
`///` doc comments. A small script (`scripts/generate-data-dictionary.ts`)
renders those comments into `docs/data-dictionary.md` so there is always
one human-readable source of truth for "what does this field mean,"
generated from the schema rather than hand-maintained in two places. This
keeps the semantic layer honest without building a separate metadata
system.

## 6. Screens (indicative)

| Screen | Roles | Purpose |
|---|---|---|
| Dashboard | all | "What's next for me" — upcoming session(s), payment status, recent updates. |
| Training Period setup | organiser | Create/edit a period, its schedule and price. |
| Preferences form | player | Submit/edit preferences for an open period. |
| Assignment board | organiser | The preference table + slot assignment UI (§4.3). |
| Session detail | all (scoped) | Roster, court, time, updates for one session. |
| Payments overview | organiser | Paid/unpaid table per period, send reminders. |
| My payments | player | Personal payment history & status. |
| Members | organiser | List of players/trainers, roles, invite new members. |

Every screen must work well at both a ~375px mobile width and a desktop
width — no feature is desktop-only. Tables collapse to stacked cards on
mobile rather than requiring horizontal scrolling.

## 7. Non-Functional Requirements

- **Clarity & intuitiveness.** No screen should require documentation to
  use. Prefer explicit labels over icons-only controls.
- **Reliability.** Automated tests cover every core flow (§4). CI must
  pass before merge. No known bugs ship — a bug report is a P0 until
  triaged.
- **Performance.** Pages interactive in <2s on a typical mobile
  connection; assignment board stays responsive with a full season's
  worth of players (hundreds, not thousands).
- **Accessibility.** WCAG 2.1 AA: keyboard navigable, sufficient color
  contrast, form labels, focus states.
- **Internationalisation.** UI text in Dutch and English via a single
  translation-key system; Dutch is the default locale, per-user
  switchable.
- **Security & privacy.** See §9.
- **Maintainability.** TypeScript everywhere, one linter/formatter
  config, no framework-hopping. A new contributor should be able to read
  the folder structure and understand where things live without a guide.

## 8. Technical Architecture

Recommendation, optimised for "boring and maintainable" over novelty:

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One codebase for frontend + backend (server actions/route handlers), huge documentation base, easy to host, easy for future maintainers to pick up. |
| Styling | **Tailwind CSS** | Utility classes keep styling co-located with markup — no separate CSS files to keep in sync. Small custom theme for the tennis accent (court-green, ball-yellow, subtle line-motif dividers). |
| Database | **PostgreSQL** | Relational data (periods → sessions → slots → assignments) maps cleanly to relations; mature, well-understood, cheap managed hosting (Neon/Supabase). |
| ORM | **Prisma** | Type-safe queries, migrations as code, schema doubles as the semantic layer (§5). |
| Auth | **Email magic link** (via NextAuth/Auth.js) | No passwords to hash, reset, or leak — smaller attack surface for a volunteer-run club app. Role checks in middleware/server actions. |
| Payments | **Mollie** | iDEAL support (dominant payment method for Dutch/Belgian clubs) alongside cards; hosted checkout means card data never touches our servers. |
| Email | **Resend** (or comparable transactional provider) | Preference/assignment/update notifications and magic links. |
| i18n | **next-intl** | Type-safe translation keys, NL default / EN toggle. |
| Testing | **Vitest** (unit) + **Playwright** (end-to-end for the flows in §4) | Confidence in the flows that matter without a heavy test pyramid. |
| Hosting | **Vercel** (app) + managed Postgres | Zero-ops deploys, good fit for Next.js, generous free tier for a small club's traffic. |

Folder structure keeps domain logic out of UI components (`/lib` for
business logic and data access, `/app` for routes/UI, `/prisma` for
schema+migrations, `/docs` for this spec and the generated data
dictionary) so the "what" and the "how it's shown" don't get tangled.

## 9. Authentication & Security

- Magic-link auth (no stored passwords); short-lived, single-use tokens.
- Role-based access control enforced server-side on every request — the
  UI hiding a button is never the only guard.
- All traffic over HTTPS; secrets in environment variables, never in code
  or the repo.
- Input validation with a schema library (Zod) at every server boundary.
- Rate limiting on auth and payment-sensitive endpoints.
- Payment data is handled entirely by Mollie's hosted checkout; the app
  only stores a provider reference and status, never card/bank details.
- GDPR-aligned: data minimisation (only what's needed to run trainings),
  a documented data retention period for past seasons, and a way for a
  member to request export/deletion of their data.
- Dependency updates and a basic security review are part of the release
  checklist, not an afterthought.

## 10. Notifications

- Two channels for v1: **in-app** (a notification list on the
  dashboard) and **email**. No SMS — keeps the notification system
  small and reliable. **Push** is deferred but planned: once a branded
  installable PWA/app exists (§15.9), push becomes the channel for
  time-critical cancellations (§15.5), matching what competitors offer.
- Triggers: assignment published, payment received/reminder, session
  update posted (cancellation/change/note).
- Communication is **broadcast, not chat**: organiser/trainer → affected
  players. No 1:1 messaging in v1 — it would add significant moderation
  and privacy surface for little benefit over a phone call/WhatsApp for
  edge cases.

## 11. MVP Scope

In:
- One training period at a time is fully supported (multiple periods can
  exist, e.g. spring/summer, but no overlap-handling complexity beyond
  what the data model already allows).
- Organiser: create period, invite members, review preferences, manually
  assign slots, publish, track payments.
- Player: submit preferences, view assignment, pay, receive updates.
- Trainer: view roster, post updates.
- NL/EN UI.

## 12. Nice-to-haves (post-MVP, not v1)

- Calendar export (.ics) of a player's assigned sessions.
- Automatic assignment suggestions (algorithmic first pass that the
  organiser then adjusts) once the manual flow is proven.
- Waitlists when a slot is full.

> Competitive parity items (extra lesson types, attendance, make-ups,
> broader payments, trainer payroll, mailings, branding) are catalogued and
> prioritised separately in [§15](#15-competitive-feature-set--reaching-parity-with-planmysport).
> Note that **attendance tracking**, previously listed here and in §13, is
> promoted to a P1 competitive requirement in §15.3.

## 13. Out of scope (v1)

Still out of scope for the first shipped version — but several of these are
now on the competitive roadmap (§15) rather than permanently excluded; the
tag in parentheses points to where each is reconsidered.

- Multi-club / multi-tenant support (a prerequisite for full white-label,
  §15.9 P3).
- In-app chat / direct messaging (a lightweight group thread is a P3 option
  in §15.8; full moderated chat stays out).
- Automatic (unassisted) assignment algorithm.
- SMS notifications (push, not SMS, is the planned third channel — §10, §15.5).
- Native mobile apps — the web app must work well on mobile browsers; a
  branded installable **PWA** (§15.9) is the intended "own app" path before
  any native build.

The following, previously out of scope, are **promoted onto the roadmap** by
§15 and are no longer permanent exclusions:

- Attendance/absence tracking → P1 (§15.3).
- Extra lesson types, punch cards, make-ups, trainer payroll, and bulk
  mailings → P1–P3 (§15.1, §15.4, §15.6–15.8).

## 14. Proposed feature: user/admin sign-in and admin-led training-period planning

> In the current product vocabulary, the requested "admin" corresponds to the existing organiser role. The implementation should keep that role model and expose the admin workflow through the organiser/admin experience.

### 14.1 Goal

The app should support two distinct authentication paths:
- a regular member login for players and trainers, and
- an admin login for the club organiser/admin.

The admin uses the app to create a training period, collect preferences, and later turn that draft into the final published plan.

### 14.2 Functional requirements

#### Authentication and access
- The app must support a clear distinction between a regular user account and an admin account.
- Admin-only screens and actions are protected server-side and cannot be reached by a regular user.
- Admins can invite or create member accounts and assign role(s) as needed.

#### Create a training period
- The admin can create a new training period from a form.
- The form must capture:
  - a period name,
  - the start date and end date,
  - the recurring weekdays (for example Monday and Tuesday),
  - the start and end time,
  - the submission deadline for preferences,
  - the period price and pricing model,
  - the proposed trainer assignment(s) for each recurring session.
- The app must generate one training session for each matching weekday within the selected date range.
- The admin can enter a pricing model that supports a period-based amount and common group-size examples such as:
  - €300 for a 4-person group, or
  - €600 per person for a 2-person group.
- The admin can assign one or more trainers to each proposed session or to the recurring pattern as a whole.
- These trainer assignments are treated as proposed planning input during the preference-collection phase and are not yet considered the final published roster.

#### Collect preferences
- While the period is open, users can view the period and submit their preferences.
- The system should present the proposed schedule and trainer plan to users so they can indicate their preferences in context.
- The admin can review submissions and adjust the proposed trainer assignments before the deadline.

#### Final planning after the deadline
- After the preference deadline passes, the admin must be able to lock the period for final planning.
- The admin can review all submitted preferences and then create the final published plan.
- Final planning must include:
  - the confirmed session schedule,
  - the confirmed trainer assignments,
  - the final price/participant breakdown used for the period.
- Once the final plan is published, users can see their assigned sessions and the app can send notifications.

### 14.3 Acceptance criteria
- An admin can create a new training period from a single form without using spreadsheets or manual follow-up.
- The app generates all recurring sessions from the entered date range and weekdays.
- The admin can save a proposed trainer roster for the period before the preference deadline.
- Regular users can submit preferences for an open period.
- The admin can transition the period from preference collection to final planning after the deadline.
- The final plan is clearly distinguishable from the initial proposed plan.

### 14.4 Data model notes
- The existing TrainingPeriod model should store recurrence, deadline, pricing, and status information.
- The existing TrainingSession model should support both proposed and confirmed trainer assignments.
- The existing Preference model remains the source of truth for players' stated preferences.

## 15. Competitive feature set — reaching parity with PLANMYSPORT

PLANMYSPORT is the established incumbent for Dutch/Belgian tennis and padel
schools (25 years, all-in-one). It wins on **breadth**: multiple lesson
types, full financial administration, trainer payroll, and white-label
branding. We intend to win, and keep winning, on **clarity and
reliability** (§1). This section catalogues the capabilities we need to be
a credible alternative, maps each onto our existing Session/Slot/Payment
core, and tags it with a parity priority:

- **P1 — table stakes.** A tennis school evaluating us will reject the
  product without this.
- **P2 — expected soon.** Needed to displace an incumbent; can follow the
  first paid deployment rather than block v1.
- **P3 — strategic / long game.** Real differentiators or heavy builds;
  deliberate bets, not near-term.

**Design guardrail.** Adopting these must not turn the assignment board or
dashboards into the widget-soup we explicitly avoid (§1). Where a
PLANMYSPORT feature exists mainly to serve very large, multi-trainer
commercial schools, we scope a deliberately smaller version and say so.
Several items below revise earlier non-goals (§13); those revisions are
called out where they occur.

### 15.1 Lesson types beyond the season series (P1–P2)

Today the app models exactly one thing: a **series** — a recurring group
season with preference-based assignment (§3, §4). PLANMYSPORT sells four
lesson types. We add the other three so they share the same
Session/Slot/Payment plumbing rather than becoming separate products:

- **Series lessons (P1 — exists).** Our current flow. Add **carry-over of
  groups**: seed a new period's proposed groups from the previous season's
  assignments so the organiser edits rather than rebuilds.
- **Loose / individual lessons (P2).** A trainer creates ad-hoc lessons for
  1–5 named students from the app; can schedule up to five occurrences in
  one action; each generates an instant invoice payable by iDEAL.
- **Free / bookable lessons (P2).** The organiser and trainers publish
  bookable slots (private or small-group). Students self-book, see which
  trainer they'll get, and pay per booking or draw from a punch card
  (§15.6). A **gap-minimising rule** keeps a trainer's booked slots
  contiguous so no idle hours open up between lessons.
- **Clinics (P2).** One-off themed sessions with open enrolment and
  per-head payment.

*Data-model impact:* a `lesson_type` discriminator on the period/Session; a
new `Booking` entity for self-service reservations; a `PunchCard`
(strippenkaart) balance (§15.6).

### 15.2 Enrolment on-ramps (P1)

Reduce the friction of getting members into a period:

- **Group carry-over** from the previous season as a starting point (§15.1).
- **Desired-partner collection** — already captured on `Preference`; surface
  it in the group-forming view so partners land together.
- **Invitation mailings** with a one-click enrol link straight into an open
  period.
- **Trainer one-click enrol** from the roster/app on a member's behalf.
- **Membership + delivery checks:** confirm a registrant is a member, and
  confirm assignment emails were actually delivered (bounce/receipt status
  from the transactional provider), surfaced to the organiser.

### 15.3 Attendance & absence (P1) — supersedes a §13 non-goal

This revises the earlier "no attendance tracking" non-goal; it is now table
stakes.

- Students and trainers self-report absence for a specific session.
- A trainer marks the whole group present in one tap, then edits exceptions.
- Per-group and per-season attendance overviews for the organiser.

*Data-model impact:* an `Attendance` record per (Session/Booking, User).

### 15.4 Make-ups & substitutions — inhalen / invallen (P2)

The features that let a season feel fair when life happens:

- A student who misses a session can book a **make-up** in another group,
  or draw the value back via a punch card.
- A student can **fill an open spot** in another group for a single session.
- Configurable per club: fully self-service, or trainer-approval required.

### 15.5 Cancellation & substitute trainers (P1 for push; extends §4.4)

- Postpone or cancel a session with automatic **email + push** to affected
  players (push is new — see §10).
- A trainer reporting absence names a **substitute trainer** inline; the
  roster and trainer-hours ledger (§15.7) follow the substitution.

### 15.6 Payments & accounts receivable (P1 core, P2 breadth)

Current spec: one Payment per player per published period via Mollie (§4.5).
Extend, mostly by using more of what Mollie already offers plus two new
prepaid models:

- **Methods:** iDEAL (have), cards, **Wero**, **SEPA direct debit
  (incasso)**, and bank transfer — all via Mollie's hosted checkout.
- **Punch cards (strippenkaarten):** prepaid 5- or 10-lesson bundles,
  decremented on booking (§15.1) or attendance (§15.3).
- **Subscriptions:** recurring seasonal billing for members who renew.
- **Dunning:** automated reminders and a debtor overview (extends the
  paid/unpaid overview in §4.5).
- **Per-trainer invoicing (VOF / ZZP):** one shared club administration, but
  each self-employed trainer invoices **their own** hours under their own
  details — the capability PLANMYSPORT leans on for multi-trainer schools,
  and a genuine adoption blocker for them if we lack it.

### 15.7 Trainer management & remuneration (P2–P3)

- **Worked-hours ledger** per trainer, adjusted for the cancellations and
  substitutions in §15.4–15.5.
- **Per-lesson-type rates** (series / loose / free / clinic).
- **Cost/revenue per trainer** and a weekly close.
- **Court-rent basis:** count of lessons given feeds the court-hire the club
  owes.

*Data-model impact:* `TrainerRate`, `WorkedHours`/timesheet, and an
`Invoice` entity (distinct from the member-facing `Payment`).

### 15.8 Communication (P2)

- **Newsletter / bulk-mailing** system, segmented by period, group, or role,
  layered on top of the transactional email we already send (§8).
- Reconsider §10's strict "broadcast, not chat" stance: PLANMYSPORT's pitch
  is that its in-app chat replaces WhatsApp. A **lightweight trainer↔group
  thread** is a defensible P3 option; full moderated 1:1 chat stays out of
  scope unless real demand appears.

### 15.9 Branding / white-label (P2–P3)

PLANMYSPORT's headline is "your identity first." Our staged answer:

- **P2 — cheap identity wins:** club name, logo, accent colour, and a
  **custom sender domain** so notification email comes from the club's own
  address, not a supplier's.
- **P3 — full white-label:** the web app under the club's own domain and
  name; a club-branded installable **PWA** covers most of the "own app"
  value without native builds. Native iOS/Android apps stay a deliberate P3
  bet (§13).

### 15.10 Tournaments, competitions & events (P3)

Out of near-term scope but on the competitive map: draws and schedules for
club tournaments and ladders, and general event sign-ups. These reuse the
same enrol → pay → notify plumbing (Session/Booking/Payment/Notification)
rather than a new subsystem.

### 15.11 Parity summary

| Capability | PLANMYSPORT | Us today | Target |
|---|---|---|---|
| Series/group season with assignment | ✓ | ✓ | P1 (have) |
| Group carry-over between seasons | ✓ | ✗ | P1 |
| Desired-partner grouping | ✓ | partial (`Preference`) | P1 |
| Invitation mailing + one-click enrol | ✓ | ✗ | P1 |
| Loose / individual lessons | ✓ | ✗ | P2 |
| Free / bookable lessons (+ gap rule) | ✓ | ✗ | P2 |
| Clinics | ✓ | ✗ | P2 |
| Attendance & absence | ✓ | ✗ (was non-goal) | P1 |
| Make-ups & substitutions | ✓ | ✗ | P2 |
| Substitute trainers + push on cancel | ✓ | partial (email only) | P1 |
| iDEAL / cards / Wero / direct debit | ✓ | partial (iDEAL) | P1 |
| Punch cards (strippenkaarten) | ✓ | ✗ | P2 |
| Subscriptions & dunning | ✓ | partial (reminders) | P2 |
| Per-trainer (VOF/ZZP) invoicing | ✓ | ✗ | P2 |
| Trainer hours / rates / payroll | ✓ | ✗ | P2–P3 |
| Newsletters / bulk mailing | ✓ | ✗ | P2 |
| In-app chat | ✓ | ✗ (non-goal) | P3 (light) |
| White-label branding / own app | ✓ | ✗ | P2–P3 |
| Tournaments / competitions / events | ✓ | ✗ | P3 |

**Sequencing.** Ship the P1 row first — it is the shortest path to a school
being willing to switch — then the P2 breadth (extra lesson types, punch
cards, per-trainer invoicing, mailings) once a first club is live and paying,
then the P3 strategic bets as demand justifies. Nothing here dilutes the
core principle: each capability lands as a plain, self-explanatory screen or
it does not land.

## 16. Open Questions

- Exact skill-level definition (1–9): is this club-defined (e.g. Dutch
  tennis "speelsterkte" classes) or a custom scale? Needs a short
  glossary shown next to the input.
- Refund policy when a session is cancelled — partial refund, credit
  toward next period, or none? Affects the Payment state machine.
- Does the organiser need to see trainer availability before assigning
  trainers to sessions, or is that handled outside the app for v1?
- **Competitive scope (§15):** which of the P1 items does the pilot club
  actually need on day one vs. what merely sounds nice? The parity list is a
  target, not a commitment to build all of it.
- **Punch cards & make-ups (§15.4, §15.6):** what is the refund/value model
  — does an unused strip expire, roll over, or refund? Ties into the refund
  question above.
- **Per-trainer invoicing (§15.6):** do the pilot club's trainers actually
  operate as separate VOF/ZZP entities, or is one club administration
  enough? This is the difference between a P2 and a much larger accounting
  build.
- **White-label (§15.9):** is a branded PWA sufficient for "own app," or do
  target clubs specifically ask for native App Store / Play Store presence?

---
*This document is the starting point for implementation. Sections 5
(data model) and 8 (architecture) should be treated as the first draft
of the Prisma schema and project scaffold, respectively.*
