# AgriCtec

A farm-records, credit-score and loan-access app for farmers in Ghana, plus a Super Admin Console
that runs the platform. Next.js 16 (App Router, Turbopack, `proxy.ts`), React 19 with the React
Compiler, TypeScript strict, Tailwind v4 and zustand. All data lives in the browser's localStorage
(demo) — see [Moving to a real backend](#moving-to-a-real-backend).

## Getting started

```bash
npm install
cp .env.example .env   # optional: your own super admin sign-in (see below)
npm run dev            # http://localhost:3000
```

| Command                               | What it does                                    |
| ------------------------------------- | ----------------------------------------------- |
| `npm run dev`                         | Development server (Turbopack)                  |
| `npm run build` / `npm start`         | Production build and server                     |
| `npm run lint`                        | ESLint (React Compiler rules included)          |
| `npx tsc --noEmit`                    | Type check                                      |
| `node --test "tests/*.test.cjs"`      | All tests (services, rules, permissions, audit) |
| `node --test tests/admin-qa.test.cjs` | The admin QA suite: every action × every role   |

## Admin Console

The console lives at **`/admin`** and has its own sign-in at **`/admin-login`**. Farmer and admin
sessions are completely separate: a farmer session never opens the console, and signing in or out
on one side never touches the other.

### Signing in (demo)

The first admin sign-in seeds a demo world: about 60 farmers across all 16 regions, their records
and MoMo transactions, 25 loan applications, verifications, risk flags, announcements and a team.

| Who                          | Email                         | Password                                        |
| ---------------------------- | ----------------------------- | ----------------------------------------------- |
| Super Admin (no `.env`)      | `superadmin@agrictec.app`     | `Admin@2026` — must be changed at first sign-in |
| Admin                        | `efua.asantewaa@agrictec.app` | `Team@2026`                                     |
| Support                      | `kofi.adjei@agrictec.app`     | `Team@2026`                                     |
| Analyst                      | `yaw.darko@agrictec.app`      | `Team@2026`                                     |
| Any seeded farmer (`/login`) | shown in **All Farmers**      | `Farmer@2026`                                   |

**Your own Super Admin:** set `admin_email` and `admin_password` in `.env` (see `.env.example`),
then restart the dev server or rebuild. At build time `next.config.ts` keeps only the email and a
SHA-256 hash of the password; the password itself never reaches the browser bundle. `.env` is
git-ignored — never commit it.

Five failed sign-ins lock the form for five minutes, and 30 minutes of inactivity signs an admin
out (with a two-minute warning).

### Roles

Every page, menu item and button is shown only to roles that may use it, and every service action
checks the permission again (`lib/admin/permissions.ts`), so hiding is never the only guard.

| Permission                                             | Analyst | Support | Admin | Super Admin |
| ------------------------------------------------------ | :-----: | :-----: | :---: | :---------: |
| Overview                                               |   ✅    |   ✅    |  ✅   |     ✅      |
| View farmers                                           |   ✅    |   ✅    |  ✅   |     ✅      |
| Edit farmers, notes, password resets                   |         |   ✅    |  ✅   |     ✅      |
| Suspend / reactivate                                   |         |         |  ✅   |     ✅      |
| Delete farmers permanently                             |         |         |       |     ✅      |
| View as farmer (read-only)                             |         |   ✅    |  ✅   |     ✅      |
| Review verifications                                   |         |   ✅    |  ✅   |     ✅      |
| View loan applications                                 |   ✅    |   ✅    |  ✅   |     ✅      |
| Move applications                                      |         |         |  ✅   |     ✅      |
| Manage lenders                                         |         |         |  ✅   |     ✅      |
| Credit rules                                           |         |         |       |     ✅      |
| Content (market, weather, crops, assistant, diagnoses) |         |         |  ✅   |     ✅      |
| Announcements                                          |         |         |  ✅   |     ✅      |
| Risk & fraud review                                    |         |   ✅    |  ✅   |     ✅      |
| Reports & exports                                      |   ✅    |         |  ✅   |     ✅      |
| Team & roles                                           |         |         |       |     ✅      |
| Audit log                                              |         |         |  ✅   |     ✅      |
| System settings, backups, danger zone                  |         |         |       |     ✅      |

A page a role can't use shows a "You don't have access to this page" screen. Nobody can demote or
disable themselves, and the last active Super Admin can never be removed.

### How the farmer app reads the platform config

The farmer app no longer hard-codes anything the admin controls. It reads it through services
that the console writes to (`agrictec:platform:*` keys, listed in `lib/admin/keys.ts`):

| Admin control                                                        | Farmer app reads it through                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Credit rules (weights, bands, eligibility)                           | `config.service` → `calculateCreditScore(…, config)` and the loan checks                                |
| Lenders (rates, limits, on/off)                                      | `lenders.service` — only active lenders are offered                                                     |
| Market prices, weather override, crops, assistant replies, diagnoses | `content.service` (the old constants are the seed defaults)                                             |
| Feature flags, maintenance mode, sign-ups, guest mode                | `config.service` → `platform-store` (menus hide, pages say "unavailable", maintenance replaces the app) |
| Plans (Premium price and features)                                   | `config.service` → the upgrade dialog                                                                   |
| Announcements                                                        | `announcements.service` → the dashboard banner (by region and crop)                                     |
| Loan decisions, verifications, suspensions                           | the farmer's applications timeline, verification status and sign-in check                               |

An open farmer tab stays in step: when the console saves in another tab, the browser's `storage`
event reaches `use-platform-sync`, and the stores reload in place (a hidden tab catches up when it
regains focus). A suspended or deleted farmer's open session is signed out at once.

### The audit logging rule

**Every admin write goes through `withAudit()`** (`lib/admin/audit.ts`). It checks the permission
first — if that fails, nothing runs and nothing is logged — then runs the change and appends
exactly one entry with the actor, the action, the target and the **before** and **after** values.
Sign-ins, sign-outs and password changes are logged too.

- The log is **append-only**: there is no edit or delete, for anyone, including a Super Admin.
- Past 5,000 entries the oldest move to a downloadable archive; nothing is silently dropped.
- Secrets never enter it: temporary passwords, password hashes and full Ghana Card numbers are
  left out (only the masked card and its hash are ever stored).
- `tests/admin-qa.test.cjs` runs every console action as every role and fails if an allowed write
  doesn't add exactly one entry, or a refused one changes anything at all.

### Moving to a real backend

This is a **demo**. Everything — accounts, password hashes, the audit log, the admin session —
lives in one browser's localStorage, so another person on the same device (or anyone with the dev
tools open) could read or change it. The cookies `proxy.ts` checks are only fast redirects, not
security. Real multi-user administration needs a server that authenticates every request and
enforces roles there.

Every storage call already goes through one module, and every feature through a service, so the
move is a matter of replacing these with API calls (same function signatures):

| Replace                                                                                          | With a server that…                                                                                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `services/storage.ts`                                                                            | is gone: no data on the device                                                                               |
| `services/auth.service.ts`, `services/admin/admin-auth.service.ts`, `lib/admin/admin-session.ts` | issues httpOnly sessions; hashes passwords with a slow hash (bcrypt/argon2), not SHA-256                     |
| `lib/admin/permissions.ts` checks, `lib/admin/audit.ts`                                          | enforces roles and writes the audit log server-side, in one transaction with each change                     |
| `services/admin/*.service.ts`                                                                    | owns farmers, verifications, loans, lenders, config, content, announcements, risk, team, reports and backups |
| `services/*.service.ts` (farmer side)                                                            | serves each farmer only their own data                                                                       |
| `proxy.ts`                                                                                       | checks the real session instead of a cookie flag                                                             |
| `use-platform-sync`                                                                              | listens for server pushes (WebSocket/SSE) instead of the `storage` event                                     |

Ghana Card numbers should be verified against NIA and stored encrypted; scheduled reports and real
notification sending also need the backend.
