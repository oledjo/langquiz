# Implementation Plan: User Registration, User-Specific Stats & Exercise Imports

## Current State Summary

- **Backend:** Express.js + TypeScript + PostgreSQL
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **No auth at all** — no user table, no login/register endpoints, no JWT
- **Progress is global** — `progress` table has no `user_id`; all users share one stat pool
- **Custom exercises live in localStorage** — not tied to any user, lost on device change

---

## Goals

1. User registration and login (email + password)
2. All progress/stats scoped to the authenticated user
3. Custom exercise imports stored server-side per-user (replacing localStorage)

---

## Step 1 — Database Migration (new file: `002_users.sql`)

Add a `users` table, add `user_id` to `progress`, and add a `user_exercises` table for server-side custom exercise storage. The existing `progress` rows (if any) will have `user_id = NULL` and be treated as legacy anonymous data.

```sql
-- users table
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- add user_id to progress (nullable to preserve existing rows)
ALTER TABLE progress ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id);

-- replace global view with user-scoped view
DROP VIEW IF EXISTS exercise_stats;
CREATE OR REPLACE VIEW exercise_stats AS
SELECT
  user_id,
  exercise_id,
  COUNT(*)::INT AS total_attempts,
  SUM(CASE WHEN correct THEN 1 ELSE 0 END)::INT AS correct_attempts,
  MAX(answered_at) AS last_answered
FROM progress
WHERE user_id IS NOT NULL
GROUP BY user_id, exercise_id;

-- user-owned custom exercises
CREATE TABLE IF NOT EXISTS user_exercises (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);
CREATE INDEX IF NOT EXISTS idx_user_exercises_user_id ON user_exercises(user_id);
```

---

## Step 2 — Backend: Auth Infrastructure

### 2a. Install dependencies

```
bcryptjs       — password hashing
jsonwebtoken   — JWT creation & verification
@types/bcryptjs, @types/jsonwebtoken  — TS types
```

### 2b. New files

**`src/auth/jwt.ts`**
- `signToken(userId: number): string` — signs a JWT with 7-day expiry using `JWT_SECRET` env var
- `verifyToken(token: string): { userId: number }` — verifies and returns payload

**`src/auth/middleware.ts`**
- Express middleware `requireAuth` — reads `Authorization: Bearer <token>`, calls `verifyToken`, attaches `req.userId: number`; returns 401 if missing/invalid

### 2c. New route file: `src/routes/auth.ts`

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/register` | `{ email, password }` | `{ token, user: { id, email } }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user: { id, email } }` |
| GET | `/api/auth/me` | — (auth header) | `{ id, email }` |

**Register logic:**
1. Validate email format and password length (min 8 chars)
2. Check for duplicate email → 409 Conflict
3. Hash password with `bcryptjs` (cost 12)
4. Insert user, return signed JWT

**Login logic:**
1. Look up user by email → 401 if not found
2. Compare password hash → 401 if wrong
3. Return signed JWT

### 2d. New route file: `src/routes/userExercises.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/user-exercises` | Return all custom exercises for the logged-in user |
| POST | `/api/user-exercises` | Bulk-upsert validated exercises (same validation as current registry) |
| DELETE | `/api/user-exercises/:exerciseId` | Delete a single custom exercise |
| DELETE | `/api/user-exercises?topic=X` | Delete all custom exercises for a topic |

All routes protected by `requireAuth`.

### 2e. Modify `src/routes/progress.ts`

- `POST /api/progress` — now protected by `requireAuth`; inserts `user_id` from `req.userId`
- `GET /api/progress/:exerciseId` — now protected; filters by `user_id`

### 2f. Modify `src/routes/stats.ts`

- `GET /api/stats` — now protected; filters `exercise_stats` view by `user_id`
- `GET /api/stats/:exerciseId` — now protected; adds `user_id` filter

### 2g. Register new routes in `src/index.ts`

```typescript
import { authRouter } from './routes/auth'
import { userExercisesRouter } from './routes/userExercises'

app.use('/api/auth', authRouter)
app.use('/api/user-exercises', userExercisesRouter)
```

### 2h. Environment variable

Add `JWT_SECRET` to `.env` / deployment config. Document in README.

---

## Step 3 — Frontend: Auth Context & Pages

### 3a. `src/auth/AuthContext.tsx`

A React context that provides:
```typescript
interface AuthContextValue {
  user: { id: number; email: string } | null
  token: string | null
  login(email: string, password: string): Promise<void>
  register(email: string, password: string): Promise<void>
  logout(): void
  isLoading: boolean
}
```

- Persists `token` in `localStorage` (`langquiz.auth-token`)
- On mount: reads stored token, calls `GET /api/auth/me` to rehydrate `user`; clears token if 401
- All downstream API calls read `token` from context

### 3b. `src/auth/AuthPage.tsx`

A single page with a toggle between **Login** and **Register** tabs.

- Email + password form
- Inline validation errors (empty fields, password too short)
- Calls `login()` / `register()` from `AuthContext`
- On success: context updates → app shows main UI
- Tailwind-styled to match the existing design

### 3c. Update `App.tsx`

Wrap the whole app in `<AuthProvider>`. At the top level:
```tsx
const { user, isLoading } = useAuth()

if (isLoading) return <LoadingSpinner />
if (!user) return <AuthPage />
return <MainApp />   // existing UI
```

Add a **logout button** (top-right corner) that calls `logout()`.

---

## Step 4 — Frontend: Update API Layer

### 4a. Update `src/api/progressApi.ts`

Add `token` parameter to `postResult` and `fetchStats`:

```typescript
export async function postResult(
  exerciseId: string, correct: boolean, token: string
): Promise<void>

export async function fetchStats(token: string): Promise<ExerciseStats[]>
```

Add `Authorization: Bearer <token>` header to all requests.

### 4b. New `src/api/userExercisesApi.ts`

```typescript
export async function fetchUserExercises(token: string): Promise<Exercise[]>
export async function uploadUserExercises(exercises: Exercise[], token: string): Promise<CustomImportResult>
export async function deleteUserExercise(exerciseId: string, token: string): Promise<void>
export async function deleteUserExercisesByTopic(topic: string, token: string): Promise<void>
```

### 4c. Update hooks

**`src/hooks/useProgress.ts`** — read `token` from `useAuth()`, pass to API functions.

**`src/hooks/useExerciseSession.ts`** — same; pass token when posting results.

---

## Step 5 — Frontend: Migrate Custom Exercises to Backend

### 5a. Update `src/registry/exerciseRegistry.ts`

- Remove `readCustomExercisesFromStorage` / `writeCustomExercisesToStorage` localStorage functions
- Keep `importCustomExercises` validation logic but instead of writing to localStorage, call `uploadUserExercises` API
- `getCustomExercises()` now fetches from `GET /api/user-exercises`
- `getAllExercises()` merges built-in registry + server-side exercises (fetched once on mount, refreshed after import)
- `removeCustomExercisesByTopic()` calls `DELETE /api/user-exercises?topic=X`

### 5b. New hook: `src/hooks/useUserExercises.ts`

Manages async loading of user exercises, exposes:
```typescript
{
  userExercises: Exercise[]
  importExercises(jsonText: string): Promise<CustomImportResult>
  deleteByTopic(topic: string): Promise<number>
  reload(): Promise<void>
  isLoading: boolean
}
```

### 5c. Migrate existing localStorage data (one-time)

On first login after the migration, check localStorage for `langquiz.custom-exercises.v1` and if present, upload the exercises to the backend via `POST /api/user-exercises`, then clear localStorage. This runs in `AuthContext` after successful login/rehydration.

---

## Step 6 — Error Handling & UX Polish

- If any API call returns 401, call `logout()` automatically (token expired)
- Show a loading state while user exercises are fetching
- Show clear error messages on registration (email taken) and login (wrong credentials)
- The import modal shows the same result feedback (`added N, skipped M, errors [...]`) as before

---

## File Change Summary

### New files
| File | Purpose |
|------|---------|
| `backend/src/db/migrations/002_users.sql` | DB schema additions |
| `backend/src/auth/jwt.ts` | JWT sign/verify helpers |
| `backend/src/auth/middleware.ts` | `requireAuth` middleware |
| `backend/src/routes/auth.ts` | Register/login/me endpoints |
| `backend/src/routes/userExercises.ts` | Per-user exercise CRUD |
| `frontend/src/auth/AuthContext.tsx` | Auth state + provider |
| `frontend/src/auth/AuthPage.tsx` | Login/Register UI |
| `frontend/src/api/userExercisesApi.ts` | User exercise API client |
| `frontend/src/hooks/useUserExercises.ts` | User exercise state hook |

### Modified files
| File | Changes |
|------|---------|
| `backend/src/index.ts` | Register auth & userExercises routers |
| `backend/src/routes/progress.ts` | Add `requireAuth`, associate `user_id` |
| `backend/src/routes/stats.ts` | Add `requireAuth`, filter by `user_id` |
| `frontend/src/App.tsx` | Wrap in `AuthProvider`, show `AuthPage` when logged out, add logout button |
| `frontend/src/api/progressApi.ts` | Add `token` param and `Authorization` header |
| `frontend/src/hooks/useProgress.ts` | Pass token from auth context |
| `frontend/src/hooks/useExerciseSession.ts` | Pass token when posting results |
| `frontend/src/registry/exerciseRegistry.ts` | Replace localStorage with backend API |

---

## Security Considerations

- Passwords hashed with bcrypt (cost 12) — never stored in plain text
- JWTs short-lived enough to limit exposure; no refresh token needed for MVP
- All user-data endpoints gated behind `requireAuth` middleware
- SQL queries use parameterised statements (existing pattern in the codebase)
- Email normalised to lowercase before storage to prevent duplicate accounts

---

## Out of Scope (for this implementation)

- OAuth / social login
- Email verification
- Password reset flow
- Admin/role management
- Rate limiting on auth endpoints (can be added later)
