# API Design (REST + OpenAPI)

- Base path `/v1`. JSON only. The OpenAPI 3.1 document is generated from the Zod DTOs in
  `packages/shared` (nestjs-zod + @nestjs/swagger) and served at `/v1/openapi.json` (Swagger UI in
  dev only). The mobile client is generated from it (openapi-typescript + openapi-fetch).
- Auth header: `Authorization: Bearer <access JWT>` (15 min). Refresh tokens are opaque, rotate on
  every use, and are stored on the device in expo-secure-store.
- Planner **content** (tasks, events, habits…) has no per-entity CRUD endpoints. The device writes
  locally and goes through `/sync`. This is how offline editing works (architecture §5). The REST
  endpoints cover everything that **must** be online: identity, memberships, invites, admin.
- ⟨Qn⟩ marks behaviour that depends on [open-questions.md](open-questions.md).

## 1. Conventions

| Topic | Rule |
|---|---|
| Errors | RFC 9457 `application/problem+json`: `{type, title, status, code, detail, errors?[{path, message}]}`. `code` is stable (e.g. `AUTH_INVALID_CREDENTIALS`, `PLANNER_FORBIDDEN`, `OWNER_MUST_TRANSFER`) and the app maps it to a localised message. |
| Validation | 422 with `errors[]` from Zod. |
| Auth failures | 401 (missing/expired token), 403 (role not allowed), 404 for planners the caller isn't a member of (doesn't reveal that they exist). |
| Pagination | Cursor based: `?limit=&cursor=` → `{items, nextCursor}`. |
| Idempotency | Creates take a client-generated `id` (UUIDv7), so a retry returns the existing resource. Sync push is idempotent by design (clock comparison). |
| Rate limits | Redis-backed. Auth endpoints are strict per IP + email; others per user. 429 with `Retry-After`. |
| Dates | `date` = `YYYY-MM-DD`, `time` = `HH:mm` (wall-clock, 24h on the wire; display follows the device locale), timestamps = ISO 8601 UTC. |

## 2. Auth — `/v1/auth`

| Method & path | Body | Result | Notes |
|---|---|---|---|
| `POST /register` | `{email, password}` | `201 {tokens, user}` | Creates the personal planner; queues the verification email. ⟨Q10⟩ |
| `POST /login` | `{email, password}` | `200 {tokens, user, deletionCancelled}` | Cancels a pending account deletion. 403 `ACCOUNT_DISABLED`. |
| `POST /oauth/google` | `{idToken}` | `200 {tokens, user, created}` | Verifies the token with Google's JWKS. Links by email if the provider says it's verified. ⟨Q12⟩ |
| `POST /oauth/apple` | `{identityToken, fullName?}` | `200 {tokens, user, created}` | Same as Google, with Apple's keys. |
| `POST /refresh` | `{refreshToken}` | `200 {tokens}` | Rotates the token. Reusing an already-rotated token revokes its whole family. |
| `POST /logout` | `{refreshToken}` | `204` | Revokes this device's token family. |
| `POST /verify-email` | `{token}` | `204` | |
| `POST /verify-email/resend` | — (auth) | `202` | |
| `POST /password/forgot` | `{email}` | `202` | Always 202 (doesn't reveal whether an account exists). |
| `POST /password/reset` | `{token, newPassword}` | `204` | Revokes all refresh tokens. |

`tokens = {accessToken, accessTokenExpiresAt, refreshToken}`
`user = {id, email, emailVerified, displayName?, isAdmin, hasPassword, providers[]}`

## 3. Me — `/v1/me`

| Method & path | Body | Result | Notes |
|---|---|---|---|
| `GET /me` | — | `user` | |
| `PATCH /me` | `{displayName?}` | `user` | ⟨Q3⟩ |
| `POST /me/password` | `{currentPassword?, newPassword}` | `204` | `currentPassword` is required if the account has one. |
| `DELETE /me` | — | `202 {deletionScheduledFor}` | 30-day grace period. 409 `OWNER_MUST_TRANSFER` with the list of affected households. |

## 4. Planners — `/v1/planners`

| Method & path | Role | Body | Result |
|---|---|---|---|
| `GET /planners` | member | — | `[{id, kind, name, role, weekStartDay, dayColors, memberCount}]` |
| `POST /planners` | any user ⟨Q10⟩ | `{id, name, weekStartDay?}` | `201` household planner, caller is owner |
| `DELETE /planners/{id}` | owner | — | `204` (households only) |
| `GET /planners/{id}/members` | member | — | `[{userId, email, displayName?, role, joinedAt}]` |
| `PATCH /planners/{id}/members/{userId}` | owner | `{role: 'editor'\|'viewer'}` | `200` |
| `DELETE /planners/{id}/members/{userId}` | owner, or self to leave | — | `204`; the owner can't remove themself (409 `OWNER_MUST_TRANSFER`) |
| `POST /planners/{id}/transfer-ownership` | owner | `{userId}` | `200`; the previous owner becomes an editor |

Planner **settings** (`name`, `weekStartDay`, `dayColors`) are edited offline through sync
(entity `planner`, owner only), not through PATCH.

## 5. Invitations

| Method & path | Role | Body | Result |
|---|---|---|---|
| `POST /planners/{id}/invitations` | owner | `{kind:'email', email, role}` or `{kind:'code', role}` | `201 {id, kind, role, expiresAt, code?, link?}`; email kind queues an email |
| `GET /planners/{id}/invitations` | owner | — | pending invitations |
| `DELETE /planners/{id}/invitations/{invId}` | owner | — | `204` (revoke) |
| `GET /invitations/preview?token=…` or `?code=…` | any user | — | `{plannerName, role, invitedBy, expiresAt}` |
| `POST /invitations/accept` | any user ⟨Q10⟩ | `{token}` or `{code}` | `200 {plannerId, role}`; 409 if already a member, 410 if expired or revoked |

Deep link format: `weeklyplanner://invite?token=…` plus a universal/app link on the API domain. ⟨Q11⟩ covers expiry, single vs multi use, and email matching.

## 6. Sync — `/v1/sync`

### 6.1 Entity types

`planner` (settings only), `day_entry`, `week_note`, `task`, `weekly_todo`, `habit`,
`habit_schedule`, `completion`, `event`, `event_exception`, `event_reminder`. (`completion` replaced `habit_check` with targets — DECISIONS J7.)
Field names and types match [database-schema.md](database-schema.md) in camelCase. The Zod
schema per entity validates each field value.

### 6.2 `POST /sync/push`

```json
{
  "nodeId": "01J9Z…",
  "mutations": [
    {
      "entityType": "task",
      "id": "0192f0c4-…",
      "plannerId": "0192e…",
      "fields": { "title": "pay phone bill", "done": true },
      "clocks": { "title": "1729771200000:0000:01J9Z…", "done": "1729771260000:0001:01J9Z…" }
    }
  ]
}
```

- At most 500 mutations per request. Mutations for unknown IDs create rows; creating a row
  requires all of its required fields.
- Per mutation, the server checks: membership and role (editor or owner; `planner` settings
  owner only; `event_reminder.userId` must be the caller ⟨Q5⟩), field validation, per-field merge,
  then cross-field invariants on the merged row.
- Response:

```json
{
  "results": [
    { "id": "0192f0c4-…", "status": "applied" },
    { "id": "…", "status": "rejected", "code": "INVARIANT_VIOLATION", "current": { "…": "authoritative row incl. fieldClocks" } }
  ],
  "serverTime": "2026-10-24T10:00:00Z"
}
```

`status` is one of `applied` (some or all fields won), `stale` (every field lost the clock
comparison; the client receives the winning values on pull), or `rejected` (validation,
permission or invariant failure; `current` holds the row to adopt, or null if it doesn't exist).
The whole push for one planner runs in one transaction under that planner's row lock.

### 6.3 `POST /sync/pull`

```json
{ "cursors": { "0192e…": 1042, "0193a…": 0 }, "limit": 1000 }
```

Response:

```json
{
  "planners": [ { "id": "0192e…", "kind": "personal", "role": "owner" } ],
  "changes": [
    { "entityType": "task", "plannerId": "0192e…", "serverSeq": 1043,
      "row": { "id": "…", "date": "2026-10-26", "title": "…", "done": false, "position": "a1", "deleted": false },
      "fieldClocks": { "title": "…", "done": "…" } }
  ],
  "cursors": { "0192e…": 1043, "0193a…": 210 },
  "hasMore": false
}
```

- `planners` is the caller's full membership snapshot. The client deletes local data for
  planners missing from it and starts at cursor 0 for new ones. Planners missing from `cursors`
  are included from 0.
- `event_reminder` rows belonging to other users are filtered out. ⟨Q5⟩
- 410 `CURSOR_EXPIRED` when a cursor is older than the tombstone retention window. The client
  then drops that planner locally and re-pulls from 0, keeping its outbox.

## 7. Admin — `/v1/admin` (requires `isAdmin`)

| Method & path | Result |
|---|---|
| `GET /admin/users?query=&status=&cursor=&limit=` | `{items:[{id, email, createdAt, lastLoginAt, emailVerified, disabled, deletionScheduledFor}], nextCursor}` |
| `POST /admin/users/{id}/disable` | `204`; revokes refresh tokens |
| `POST /admin/users/{id}/enable` | `204` |
| `GET /admin/stats` | ⟨Q13⟩ proposed: `{users:{total, verified, disabled, pendingDeletion, active7d, active30d}, planners:{personal, household}}` |

Admins are granted via a CLI command in the API container (`pnpm admin:grant <email>`). ⟨Q14⟩

## 8. Health

| Path | Purpose |
|---|---|
| `GET /healthz` | Liveness: process up |
| `GET /readyz` | Readiness: Postgres and Redis reachable, migrations applied |
