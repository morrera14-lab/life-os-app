# Life OS App — Expo scaffold

**Frozen 2026-08-17 (pre-build sprint session 3 of 3). Build proper starts Sep 15 2026.**
Planning docs live in the vault: `Life OS/Projects/life-os-app/` (REQUIREMENTS.md, ARCHITECTURE.md, AI_MANAGEMENT.md, CHANGELOG.md — the freeze entry there lists exactly what exists and the first three re-entry tasks).

## What this is

Expo SDK 54 + Expo Router + TypeScript skeleton matching ARCHITECTURE.md and the Faith Apps (WordApp-Expo) patterns: Cinzel + EB Garamond fonts, gold/cream design tokens (`lib/theme.ts`), Supabase auth against the **separate** `life-os-app` project (`tvnvijvuuwfbgwnzrrgn` — not WordApp's), `@sentry/react-native` with guarded init + post-crash prompt (REQ-F27), and a working in-app feedback form writing to the `feedback` table (REQ-F28).

**Deliberately NOT installed:** `node_modules` — this freeze is source-only. **Deliberately stubs:** Daily Briefing, Capture, Habits screens (no logic beyond auth + feedback, per the freeze scope).

## First run (Sep 15 re-entry, step 1)

```bash
cd ~/Documents/LifeOSApp/life-os-app-expo
npm install
npx expo start --ios
```

Version pins follow WordApp-Expo's working set (Expo ~54, RN 0.81.5, React 19.1.0). If `npm install` surfaces peer conflicts after 5 weeks of ecosystem drift, `npx expo install --fix` reconciles Expo-managed packages.

## Env

`.env` is committed and contains **public client keys only** (same convention as Faith Apps' eas.json). `EXPO_PUBLIC_SENTRY_DSN` is empty — create a new Sentry project (separate from WordApp's) and paste its DSN; empty DSN means Sentry is silently disabled, the app still runs.

## Layout

```
app/_layout.tsx        fonts + Sentry init + auth gate (redirects to /sign-in)
app/sign-in.tsx        email/password auth (Apple Sign-In = Sep task)
app/(tabs)/            Today (briefing stub) · Capture (stub) · Habits (stub) · Settings (sign-out + feedback)
components/FeedbackModal.tsx   REQ-F28, working
lib/theme.ts           design tokens (WordApp palette + type ramp)
lib/supabase.ts        guarded client (Faith Apps pattern)
lib/sentry.ts          guarded init + crashedLastRun prompt (REQ-F27)
```

Signing up seeds Faith/Health/Career domains + a profile row automatically (server-side trigger — vault `scripts/migrations/01_profiles_and_domains.sql`).
