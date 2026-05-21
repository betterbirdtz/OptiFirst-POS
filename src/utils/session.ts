import type { UserSession } from "../types";

export function getSessionUser(): UserSession | null {
  try {
    const session = localStorage.getItem("session_user");
    return session ? (JSON.parse(session) as UserSession) : null;
  } catch {
    localStorage.removeItem("session_user");
    return null;
  }
}
