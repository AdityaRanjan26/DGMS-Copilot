/**
 * lib/auth.ts
 *
 * Single source of truth for the current user role.
 * Change CURRENT_ROLE to "Admin" to simulate an administrator session.
 */

export type Role = "Safety Officer" | "Executive Reviewer" | "Document Admin" | "Admin";

/** Hard-coded for the prototype — replace with a real session lookup in production. */
export const CURRENT_ROLE: Role = "Safety Officer";

export function isAdmin(): boolean {
  return CURRENT_ROLE === "Admin";
}
