export type UserRole =
  | 'sponsor-admin'
  | 'schoolnet-super-admin'
  | 'schoolnet-project-admin'
  | 'state-admin'
  | 'school-admin'
  | 'trainer'
  | 'trainee'
  | 'reporting-audit-user';

export type MenuKey =
  | 'dashboard'
  | 'projects'
  | 'training-plans'
  | 'batches'
  | 'attendance'
  | 'content-library'
  | 'assessments'
  | 'assessment-feedback'
  | 'certificates'
  | 'mis-reports'
  | 'holiday-master'
  | 'trainer-repository';

export type UserRecord = { userId: string; role: UserRole; active: boolean; password?: string };
export type SessionUser = Pick<UserRecord, 'userId' | 'role'>;

export const DEMO_PASSWORD = 'demo1@123';
export const TRAINER_DEFAULT_PASSWORD = 'Pass@123';
export const ROLE_LABELS: Record<UserRole, string> = {
  'sponsor-admin': 'Sponsor Admin',
  'schoolnet-super-admin': 'Schoolnet Super Admin',
  'schoolnet-project-admin': 'Schoolnet Project Admin',
  'state-admin': 'State Admin',
  'school-admin': 'School Admin',
  trainer: 'Trainer',
  trainee: 'Trainee',
  'reporting-audit-user': 'Reporting/Audit User',
};

export const ROLES = Object.keys(ROLE_LABELS) as UserRole[];

const ROLE_MENUS: Record<UserRole, readonly MenuKey[]> = {
  'sponsor-admin': ['dashboard', 'content-library', 'assessment-feedback', 'mis-reports', 'trainer-repository'],
  'schoolnet-super-admin': ['dashboard', 'projects', 'training-plans', 'batches', 'attendance', 'content-library', 'assessment-feedback', 'certificates', 'mis-reports', 'holiday-master', 'trainer-repository'],
  'schoolnet-project-admin': ['dashboard', 'projects', 'training-plans', 'batches', 'attendance', 'content-library', 'assessment-feedback', 'certificates', 'mis-reports', 'trainer-repository'],
  'state-admin': ['dashboard', 'projects', 'training-plans', 'batches', 'attendance', 'assessment-feedback', 'mis-reports', 'trainer-repository'],
  'school-admin': ['dashboard', 'projects', 'training-plans', 'batches', 'attendance', 'content-library', 'assessment-feedback', 'trainer-repository'],
  trainer: ['dashboard', 'projects', 'batches', 'attendance', 'content-library', 'assessment-feedback', 'trainer-repository'],
  trainee: ['dashboard', 'projects', 'content-library', 'assessments', 'assessment-feedback', 'certificates'],
  'reporting-audit-user': ['dashboard', 'projects', 'mis-reports'],
};

export function canAccessMenu(role: UserRole, menu: MenuKey) {
  return ROLE_MENUS[role].includes(menu);
}

export function canAccessRoute(role: UserRole, path: string) {
  if (path === '/compliance') return canAccessMenu(role, 'dashboard');
  if (path === '/certificates') return ['sponsor-admin', 'schoolnet-super-admin', 'schoolnet-project-admin', 'trainee'].includes(role);
  if (path === '/assessments') return canAccessMenu(role, 'assessment-feedback');
  if (path === '/trainers') return canAccessMenu(role, 'trainer-repository');
  if (path === '/registration-requests') return ['schoolnet-super-admin', 'schoolnet-project-admin', 'state-admin', 'school-admin', 'trainer'].includes(role);
  if (!path || path === '/') return canAccessMenu(role, 'dashboard');
  if (path === '/holiday-master') return canAccessMenu(role, 'holiday-master');
  if (path === '/content-library') return canAccessMenu(role, 'content-library');
  if (path === '/projects') return canAccessMenu(role, 'projects');
  if (path === '/training-plans') return canAccessMenu(role, 'training-plans');
  if (path === '/batches') return canAccessMenu(role, 'batches');
  if (path === '/attendance') return canAccessMenu(role, 'attendance');
  if (path.startsWith('/reports/')) return canAccessMenu(role, 'mis-reports');
  return canAccessMenu(role, 'dashboard');
}

const USERS_KEY = 'teacher-training-users';
const SESSION_KEY = 'teacher-training-session';
const DEFAULT_USERS: UserRecord[] = [
  { userId: 'Demo1', role: 'sponsor-admin', active: true },
  { userId: 'Demo2', role: 'schoolnet-super-admin', active: true },
  { userId: 'Demo3', role: 'schoolnet-project-admin', active: true },
  { userId: 'Demo4', role: 'state-admin', active: true },
  { userId: 'Demo5', role: 'school-admin', active: true },
  { userId: 'Demo6', role: 'trainer', active: true },
  { userId: 'Demo7', role: 'trainee', active: true },
  { userId: 'Demo8', role: 'reporting-audit-user', active: true },
];
const roleValues = new Set<UserRole>(ROLES);
const legacyRoleMap: Record<string, UserRole> = {
  admin: 'schoolnet-super-admin',
  planner: 'schoolnet-project-admin',
  viewer: 'reporting-audit-user',
};

function normalizedRole(value: unknown, userId: string): UserRole {
  if (typeof value === 'string' && roleValues.has(value as UserRole)) return value as UserRole;
  const demo = DEFAULT_USERS.find(user => user.userId.toLowerCase() === userId.toLowerCase());
  return demo?.role ?? (typeof value === 'string' ? legacyRoleMap[value] : undefined) ?? 'reporting-audit-user';
}

export function getUsers(): UserRecord[] {
  let saved: unknown;
  try { saved = JSON.parse(localStorage.getItem(USERS_KEY) ?? 'null'); } catch { saved = null; }

  const users: UserRecord[] = Array.isArray(saved)
    ? saved.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && typeof (item as Record<string, unknown>).userId === 'string'))
      .map(item => ({ userId: item.userId as string, role: normalizedRole(item.role, item.userId as string), active: item.active !== false, ...(typeof item.password === 'string' ? { password: item.password } : {}) }))
    : [];

  for (const demoUser of DEFAULT_USERS) {
    const existing = users.find(user => user.userId.toLowerCase() === demoUser.userId.toLowerCase());
    if (!existing) users.push(demoUser);
  }

  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return users;
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
  if (!user || password !== (user.password ?? DEMO_PASSWORD)) return null;
  const session = { userId: user.userId, role: user.role };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function signOut() { localStorage.removeItem(SESSION_KEY); }
