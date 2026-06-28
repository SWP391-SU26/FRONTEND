# Workflow 1 Frontend Plan - Authentication & User Access

## Scope

Frontend only. Do not change backend code.

Workflow 1 covers:

- Register account.
- Login account.
- Store frontend session.
- Redirect by role.
- Protect authenticated routes.
- Protect admin routes.
- Logout.
- Admin user list.
- Admin role update.
- Admin user delete.

## API Mapping

| UI area | Backend API |
|---|---|
| Register page | `POST /api/auth/register` |
| Login page | `POST /api/auth/login` |
| Logout buttons | `POST /api/auth/logout/{userId}` |
| Admin users page | `GET /api/auth/users` |
| Role update | `PUT /api/auth/users/{userId}/role` |
| Delete user | `DELETE /api/auth/users/{userId}?requesterId={adminUserId}` |

## Implemented Frontend Behavior

1. Login and register use real backend APIs through `src/services/authService.js`.
2. Auth response mapping supports the documented backend shape where response `data` is the user object.
3. Frontend session works even when backend does not return a token.
4. Authenticated routes redirect guests to `/login`.
5. `/admin/*` routes require an authenticated admin role.
6. Login/register redirect admins to `/admin/dashboard` and other users to `/workspace`.
7. Register password validation matches the backend example minimum of 6 characters.
8. Admin Users page loads real users from backend.
9. Admin can update roles using the role update API.
10. Admin can delete users using the requester-aware delete API.
11. The current logged-in admin account cannot be deleted from the same session.
12. Password reset is shown as unavailable because no backend forgot-password API exists in the current documentation.

## Manual Test Checklist

1. Open `/login` while logged out.
2. Login with a student account.
3. Confirm redirect goes to `/workspace`.
4. Try opening `/admin/dashboard` as student.
5. Confirm redirect goes back to `/workspace`.
6. Logout.
7. Login with an admin account.
8. Confirm redirect goes to `/admin/dashboard`.
9. Open `/admin/users`.
10. Confirm user rows load from backend.
11. Change a user's role and refresh to verify persistence.
12. Delete a non-current user and confirm the row disappears.
13. Register a new account with a 6-character password.
14. Confirm the new account is saved and redirected by role.

## Known Backend Gap

Forgot-password/reset-password is not part of the documented backend API. The frontend should not fake this flow.
