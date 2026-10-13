# SchoolSphere Mobile — Student & Teacher App

Expo + React Native + TypeScript app sharing the SchoolSphere ERP backend
(`/api/v1`), JWT auth, and per-school tenant isolation.

## Stack

- Expo (SDK 53) + Expo Router (file-based navigation)
- TypeScript, TanStack Query (server state), Zustand (auth state)
- Axios (with automatic access-token refresh), Expo SecureStore (tokens)
- NativeWind (Tailwind for React Native) + light/dark-ready theme

## Getting started

```bash
# from repo root (installs the apps/mobile workspace too)
npm install

# configure backend URL
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_API_URL=http://<your-ip>:4000/api/v1   (use LAN IP for devices)

# run
npx expo start --workspace=apps/mobile
# or: cd apps/mobile && npx expo start
```

Press `a` (Android emulator) or scan the QR with Expo Go.

## Login

Use the **username + temporary password** created by the school admin in the
web dashboard (Students/Teachers → key icon, or the *App Logins* page).
The app auto-detects the `STUDENT` / `TEACHER` role from the JWT and opens
the matching dashboard. Other roles are rejected with a pointer to the web
dashboard.

## Structure

```
app/
  _layout.tsx        QueryClient + SecureStore hydration + Slot
  index.tsx          role router (login | student | teacher)
  login.tsx          username/email + password
  (student)/         Home, Academics, Attendance, Results, Profile
                     + Fees, Library, Transport, Homework, Exams, Notices
  (teacher)/         Home, Classes, Attendance, Homework, Profile
                     + Students, Timetable, Exams/Marks, Notices
src/
  api/client.ts      axios + refresh + SecureStore token vault
  api/mobile.ts      typed endpoint wrappers (/mobile/* + reused ops)
  api/hooks.ts       TanStack Query hooks
  store/auth.ts      zustand auth (login/hydrate/logout, role guard)
  components/ui.tsx  cards, skeletons, empty/error, pills, Screen
  theme.ts           brand tokens
```

## Backend endpoints used

- `POST /auth/login|refresh|logout`, `GET /auth/profile`, `POST /auth/change-password`
- `GET /mobile/me|dashboard|timetable|attendance|homework|exams|results|fees|library|transport`
- `GET /mobile/teacher/dashboard|classes|students`, `GET /mobile/notifications|announcements`
- Reused ops: `GET /attendance/roster`, `POST /attendance/bulk`,
  `POST /subjects/homework|assignments`, `GET /exams/:id/results`

All scoping is enforced server-side (`schoolId` from JWT, student-own /
teacher-assigned checks). The UI never trusts client-supplied IDs.

## Builds

```bash
cd apps/mobile
eas build --platform android --profile preview   # APK for testing
eas build --platform android --profile production # AAB for Play Store
eas build --platform ios --profile production     # iOS (needs Apple dev account)
```

Set the production `EXPO_PUBLIC_API_URL` via `eas.json` env or EAS secrets
before building.
