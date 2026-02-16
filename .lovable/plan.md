

## Fix: Auto-Reload on Idle (Auth Token Refresh Issue)

### Root Cause

The authentication state change listener in `useUserRole.ts` reacts to **all** auth events, including `TOKEN_REFRESHED`. Supabase automatically refreshes tokens periodically and when a browser tab regains focus after being idle. Each refresh:

1. Sets `isLoading = true` in `useUserRole`
2. `ProtectedRoute` shows a loading spinner (briefly unmounting the admin page)
3. If there's a brief race condition, `isAuthenticated` reads as `false`, triggering a redirect to `/auth`
4. `/auth` detects you're logged in and sends you to `/dashboard` instead of back to `/admin`

### Fix (2 files)

#### 1. `src/hooks/useUserRole.ts`
- Filter the `onAuthStateChange` callback to only react to `SIGNED_IN`, `SIGNED_OUT`, and `INITIAL_SESSION` events
- Ignore `TOKEN_REFRESHED` events -- these don't change roles or auth status
- This prevents unnecessary loading states and redirects

#### 2. `src/pages/Index.tsx`
- Similarly filter `onAuthStateChange` to ignore `TOKEN_REFRESHED` events
- This prevents the Index page logic from interfering if the event fires globally

### Technical Details

**File: `src/hooks/useUserRole.ts`** -- Change the `onAuthStateChange` callback:

```typescript
// Before (reacts to ALL events including TOKEN_REFRESHED)
supabase.auth.onAuthStateChange(() => {
  setIsLoading(true);
  fetchRoles();
});

// After (only reacts to meaningful auth changes)
supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') return; // skip token refreshes
  setIsLoading(true);
  fetchRoles();
});
```

**File: `src/pages/Index.tsx`** -- Same filtering:

```typescript
// Before
supabase.auth.onAuthStateChange((event, session) => {
  if (session) { navigate("/dashboard"); }
  else { navigate("/auth"); }
});

// After
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') return;
  if (session) { navigate("/dashboard"); }
  else { navigate("/auth"); }
});
```

### What Does NOT Change
- Login/logout behavior works exactly the same
- Role detection on sign-in/sign-out still works
- No database or schema changes
- No other files affected

