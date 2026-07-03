# Data Dictionary

Generated from `prisma/schema.prisma` by `npm run dictionary`. Do not
edit this file directly — edit the doc comments in the schema instead
and regenerate.

## Models

### Account

A linked OAuth/email provider identity for a User. Currently unused (email magic-link auth doesn't need it) but required by the Prisma adapter's schema contract.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| userId | `String` | — |
| type | `String` | — |
| provider | `String` | — |
| providerAccountId | `String` | — |
| refresh_token | `String?` | — |
| access_token | `String?` | — |
| expires_at | `Int?` | — |
| token_type | `String?` | — |
| scope | `String?` | — |
| id_token | `String?` | — |
| session_state | `String?` | — |
| user | `User` | — |

### Session

An authenticated browser session (created after a magic-link sign-in).

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| sessionToken | `String` | — |
| userId | `String` | — |
| expires | `DateTime` | — |
| user | `User` | — |

### VerificationToken

A one-time magic-link token sent to an email address.

| Field | Type | Description |
|---|---|---|
| identifier | `String` | — |
| token | `String` | — |
| expires | `DateTime` | — |

### User

A club member. Holds one or more Roles (see UserRole) and, if they play, a self-reported skill level.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| name | `String` | — |
| email | `String` | — |
| emailVerified | `DateTime?` | — |
| image | `String?` | — |
| phone | `String?` | Optional contact number, shown to trainers/organiser only. |
| locale | `Locale` | UI language; Dutch by default. |
| skillLevel | `Int?` | Self-reported playing level, 1 (beginner) to 9 (advanced). Set when the player first submits a Preference; the organiser can correct it. |
| createdAt | `DateTime` | — |
| accounts | `Account[]` | — |
| sessions | `Session[]` | — |
| roles | `UserRole[]` | — |
| preferences | `Preference[]` | — |
| preferredByPreferences | `Preference[]` | Preferences from other players that named this user as a preferred training partner. |
| assignments | `Assignment[]` | — |
| payments | `Payment[]` | — |
| updatesAuthored | `Update[]` | — |
| notifications | `Notification[]` | — |
| trainerAvailability | `TrainerAvailability[]` | — |
| trainingSessionsTrained | `TrainingSession[]` | — |

### UserRole

Grants one Role to one User, optionally scoped to a single Training Period (used for trainers who only help out for one season).

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| userId | `String` | — |
| role | `Role` | — |
| periodId | `String?` | — |
| user | `User` | — |
| period | `TrainingPeriod?` | — |

### TrainingPeriod

A season definition: when it runs, on which weekdays, and at what price. TrainingSessions are generated from this pattern; see generateSessions() in src/lib/training-periods.ts.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| name | `String` | Short label shown to members, e.g. "Spring 2027". |
| startDate | `DateTime` | — |
| endDate | `DateTime` | — |
| weekdays | `Weekday[]` | Weekdays this period trains on, e.g. [MONDAY, TUESDAY]. |
| startTime | `String` | — |
| endTime | `String` | — |
| priceCents | `Int` | Price a player owes for the whole period, in the smallest currency unit (cents) to avoid floating-point rounding issues. |
| currency | `String` | — |
| preferenceDeadline | `DateTime` | Deadline for players to submit/edit Preferences for this period. |
| status | `PeriodStatus` | — |
| createdAt | `DateTime` | — |
| roles | `UserRole[]` | — |
| sessions | `TrainingSession[]` | — |
| preferences | `Preference[]` | — |
| payments | `Payment[]` | — |
| updates | `Update[]` | — |
| trainerAvailability | `TrainerAvailability[]` | — |

### TrainingSession

One concrete calendar occurrence generated from a TrainingPeriod, e.g. "Monday 5 Jan 2027, 18:00-22:00". Can be individually cancelled or moved without affecting the rest of the period.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| periodId | `String` | — |
| date | `DateTime` | — |
| startTime | `String` | — |
| endTime | `String` | — |
| status | `TrainingSessionStatus` | — |
| period | `TrainingPeriod` | — |
| trainers | `User[]` | — |
| slots | `Slot[]` | — |
| updates | `Update[]` | — |

### Slot

A bookable sub-unit of a TrainingSession: a specific court, time range and capacity (e.g. "Court 1, 18:00-19:30, max 4"). Sessions usually have several Slots so players of different levels aren't all on one court.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| trainingSessionId | `String` | — |
| court | `String` | Court name/number, e.g. "Court 1". |
| startTime | `String` | — |
| endTime | `String` | — |
| capacity | `Int` | — |
| minSkill | `Int?` | Optional skill band this slot is intended for. |
| maxSkill | `Int?` | — |
| trainingSession | `TrainingSession` | — |
| assignments | `Assignment[]` | — |

### Preference

A player's stated preference for a Training Period: which day(s) work, who they'd like to train with, and their skill level. Editable until the period's preferenceDeadline.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| userId | `String` | — |
| periodId | `String` | — |
| preferredWeekdays | `Weekday[]` | Weekdays the player is available for, drawn from the period's weekdays. |
| skillLevel | `Int` | Skill level at time of submission (1-9); copied onto User.skillLevel. |
| notes | `String?` | — |
| submittedAt | `DateTime` | — |
| updatedAt | `DateTime` | — |
| user | `User` | — |
| period | `TrainingPeriod` | — |
| preferredPartners | `User[]` | — |

### Assignment

Links a Player to a Slot. Created by the organiser during the assignment step (SPECS.md §4.3); never created automatically.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| slotId | `String` | — |
| userId | `String` | — |
| assignedById | `String` | — |
| assignedAt | `DateTime` | — |
| slot | `Slot` | — |
| user | `User` | — |

### Payment

What a player owes (and has paid) for a Training Period. Created once per assigned player when the organiser publishes assignments.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| userId | `String` | — |
| periodId | `String` | — |
| amountCents | `Int` | — |
| currency | `String` | — |
| status | `PaymentStatus` | — |
| providerReference | `String?` | Payment provider's reference for this transaction (e.g. Mollie payment id), used to reconcile webhook callbacks. Null until checkout starts. |
| paidAt | `DateTime?` | — |
| createdAt | `DateTime` | — |
| user | `User` | — |
| period | `TrainingPeriod` | — |

### Update

A message posted by a trainer or organiser about either one TrainingSession (trainingSessionId set) or an entire TrainingPeriod (periodId set), e.g. "cancelled - rain". Generates Notifications for every affected player.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| authorId | `String` | — |
| trainingSessionId | `String?` | — |
| periodId | `String?` | — |
| body | `String` | — |
| createdAt | `DateTime` | — |
| author | `User` | — |
| trainingSession | `TrainingSession?` | — |
| period | `TrainingPeriod?` | — |
| notifications | `Notification[]` | — |

### Notification

One delivery of an Update to one User, over one channel. Read state is only tracked for the in-app channel.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| userId | `String` | — |
| updateId | `String` | — |
| channel | `NotificationChannel` | — |
| sentAt | `DateTime` | — |
| readAt | `DateTime?` | — |
| user | `User` | — |
| update | `Update` | — |

### TrainerAvailability

A trainer's stated availability for a Training Period, set independently of any specific session assignment.

| Field | Type | Description |
|---|---|---|
| id | `String` | — |
| userId | `String` | — |
| periodId | `String` | — |
| availableWeekdays | `Weekday[]` | — |
| user | `User` | — |
| period | `TrainingPeriod` | — |

## Enums

### Weekday

A day of the week, used for recurring schedules and preferences.

| Value | Description |
|---|---|
| MONDAY | — |
| TUESDAY | — |
| WEDNESDAY | — |
| THURSDAY | — |
| FRIDAY | — |
| SATURDAY | — |
| SUNDAY | — |

### Role

A role a member can hold in the club. A single User can hold more than one (e.g. someone who both plays and trains).

| Value | Description |
|---|---|
| ORGANISER | — |
| TRAINER | — |
| PLAYER | — |

### Locale

UI language preference. Dutch is the club's default.

| Value | Description |
|---|---|
| NL | — |
| EN | — |

### PeriodStatus

Lifecycle of a Training Period, from being drafted by the organiser to fully wrapped up.

| Value | Description |
|---|---|
| DRAFT | Being configured by the organiser; not visible to players yet. |
| OPEN | Visible to players; preferences can be submitted until the deadline. |
| ASSIGNING | Preference deadline has passed; organiser is assigning players to slots. |
| PUBLISHED | Assignments are published; players see their slot and can pay. |
| ARCHIVED | The period has ended and is kept for historical reference only. |

### TrainingSessionStatus

Status of one concrete TrainingSession (a single calendar date).

| Value | Description |
|---|---|
| SCHEDULED | — |
| CANCELLED | — |
| MOVED | Moved to a different date/time/court; details in the linked Update. |

### PaymentStatus

Status of a Payment owed by a player for a Training Period.

| Value | Description |
|---|---|
| PENDING | — |
| PAID | — |
| FAILED | — |
| REFUNDED | — |

### NotificationChannel

Delivery channel for a Notification.

| Value | Description |
|---|---|
| IN_APP | — |
| EMAIL | — |
