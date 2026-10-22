export type UserRole = 'admin' | 'planner' | 'viewer';
export type UserRecord = { userId: string; role: UserRole; active: boolean };
export type SessionUser = Pick<UserRecord, 'userId' | 'role'>;

const USERS_KEY = 'teacher-training-users';
const SESSION_KEY = 'teacher-training-session';
const DEFAULT_USERS: UserRecord[] = [{ userId: 'Demo1', role: 'admin', active: true }];

export function getUsers(): UserRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(USERS_KEY) ?? 'null');
    if (Array.isArray(parsed)) return parsed as UserRecord[];
  } catch { /* recover with the demo administrator */ }
  localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
}
export function saveUsers(users: UserRecord[]) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
export function getSession(): SessionUser | null {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as SessionUser | null;
    if (!session) return null;
    const user = getUsers().find(item => item.userId.toLowerCase() === session.userId.toLowerCase() && item.active);
    if (!user) { localStorage.removeItem(SESSION_KEY); return null; }
    return { userId: user.userId, role: user.role };
  } catch { return null; }
}
export function signIn(userId: string, password: string): SessionUser | null {
  const user = getUsers().find(item => item.userId.toLowerCase() === userId.trim().toLowerCase() && item.active);
  if (!user || password !== 'demo1@123') return null;
  const session = { userId: user.userId, role: user.role };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
export function signOut() { localStorage.removeItem(SESSION_KEY); }
