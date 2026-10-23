import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Sidebar, Topbar, Footer, type AppPage } from './components/DashboardParts';
import { getSession, getUsers, ROLE_LABELS, ROLES, saveUsers, signOut, type UserRecord, type UserRole } from './auth';
import './holiday-master.css';
import { formatDate, formatDateTime, parseDisplayDate } from './dateFormat';

type Holiday = { id: string; name: string; date: string; scope: 'National' | 'State'; state: string; district: string; school: string; active: boolean; note: string };
type AuditEntry = { id: string; at: string; actor: string; action: string; detail: string };
const HOLIDAYS_KEY = 'teacher-training-holidays';
const AUDIT_KEY = 'teacher-training-audit';
const POLICY_KEY = 'teacher-training-holiday-policy';
const LOCATIONS: Record<string, { districts: Record<string, string[]> }> = {
  Maharashtra: { districts: { Pune: ['Pune Central School', 'Pimpri Learning Center'], Mumbai: ['Mumbai Public School'] } },
  Karnataka: { districts: { Bengaluru: ['Bengaluru North School', 'Bengaluru South School'], Mysuru: ['Mysuru Learning Center'] } },
  'Tamil Nadu': { districts: { Chennai: ['Chennai Central School'], Coimbatore: ['Coimbatore Public School'] } },
};
const seed: Holiday[] = [
  { id: 'h1', name: 'Republic Day', date: '2027-01-26', scope: 'National', state: '', district: '', school: '', active: true, note: 'National calendar' },
  { id: 'h2', name: 'Independence Day', date: '2027-08-15', scope: 'National', state: '', district: '', school: '', active: true, note: 'National calendar' },
  { id: 'h3', name: 'Maharashtra Day', date: '2027-05-01', scope: 'State', state: 'Maharashtra', district: '', school: '', active: true, note: 'State calendar' },
  { id: 'h4', name: 'Karnataka Rajyotsava', date: '2027-11-01', scope: 'State', state: 'Karnataka', district: '', school: '', active: true, note: 'State calendar' },
];
function readList<T,>(key: string, fallback: T[]): T[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null'); if (Array.isArray(value)) return value as T[]; } catch { /* use defaults */ }
  localStorage.setItem(key, JSON.stringify(fallback)); return fallback;
}
function audit(actor: string, action: string, detail: string) {
  const items = readList<AuditEntry>(AUDIT_KEY, []);
  items.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, detail });
  localStorage.setItem(AUDIT_KEY, JSON.stringify(items.slice(0, 100)));
}
const blank = { name: '', date: '', scope: 'National' as Holiday['scope'], state: '', district: '', school: '', note: '' };

export default function HolidayMaster() {
  const [session] = useState(getSession);
  const [holidays, setHolidays] = useState<Holiday[]>(() => readList(HOLIDAYS_KEY, seed));
  const [users, setUserList] = useState<UserRecord[]>(() => getUsers());
  const [entries, setEntries] = useState<AuditEntry[]>(() => readList(AUDIT_KEY, []));
  const [tab, setTab] = useState<'holidays' | 'access' | 'audit'>('holidays');
  const [scopeFilter, setScopeFilter] = useState('All');
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(blank);
  const [dateEntry, setDateEntry] = useState('');
  const holidayDatePicker = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [policy, setPolicy] = useState<'block' | 'warn'>(() => localStorage.getItem(POLICY_KEY) === 'warn' ? 'warn' : 'block');
  const [newUser, setNewUser] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('reporting-audit-user');
  const admin = session?.role === 'schoolnet-super-admin';
  useEffect(() => { document.body.classList.add('react-dashboard'); return () => document.body.classList.remove('react-dashboard'); }, []);
  const districts = form.state ? Object.keys(LOCATIONS[form.state]?.districts ?? {}) : [];
  const schools = form.state && form.district ? LOCATIONS[form.state]?.districts[form.district] ?? [] : [];
  const visibleHolidays = useMemo(() => holidays.filter(item => (showInactive || item.active) && (scopeFilter === 'All' || item.scope === scopeFilter)), [holidays, scopeFilter, showInactive]);
  const refreshAudit = () => setEntries(readList(AUDIT_KEY, []));
  const setHolidayRecords = (next: Holiday[]) => { setHolidays(next); localStorage.setItem(HOLIDAYS_KEY, JSON.stringify(next)); };
  const changeForm = (key: keyof typeof blank, value: string) => setForm(old => {
    const next: typeof blank = { ...old, [key]: value } as typeof blank;
    if (key === 'scope' && value === 'National') Object.assign(next, { state: '', district: '', school: '' });
    if (key === 'state') Object.assign(next, { district: '', school: '' });
    if (key === 'district') Object.assign(next, { school: '' });
    return next;
  });
  function saveHoliday(event: FormEvent) {
    event.preventDefault();
    if (!form.date) { setFeedback('Enter a valid date in dd-MMM-yyyy format, for example 26-Jan-2027.'); return; }
    if (form.scope === 'State' && (!form.state || (form.district && !LOCATIONS[form.state]?.districts[form.district]) || (form.school && !LOCATIONS[form.state]?.districts[form.district]?.includes(form.school)))) {
      setFeedback('Choose a valid state, district, and school hierarchy.'); return;
    }
    const record: Holiday = { ...form, id: editing ?? crypto.randomUUID(), scope: form.scope, state: form.scope === 'National' ? '' : form.state, district: form.scope === 'National' ? '' : form.district, school: form.scope === 'National' ? '' : form.school, active: editing ? holidays.find(item => item.id === editing)?.active ?? true : true };
    setHolidayRecords(editing ? holidays.map(item => item.id === editing ? record : item) : [record, ...holidays]);
    audit(session!.userId, editing ? 'Holiday updated' : 'Holiday added', `${record.name} · ${formatDate(record.date)} · ${record.scope}${record.state ? ` · ${record.state}` : ''}`); refreshAudit();
    setForm(blank); setDateEntry(''); setEditing(null); setFeedback(editing ? 'Holiday updated.' : 'Holiday added.');
  }
  function editHoliday(item: Holiday) { setEditing(item.id); setForm({ name: item.name, date: item.date, scope: item.scope, state: item.state, district: item.district, school: item.school, note: item.note }); setDateEntry(formatDate(item.date)); setFeedback(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function deactivate(item: Holiday) { const action = item.active ? 'Holiday deactivated' : 'Holiday reactivated'; setHolidayRecords(holidays.map(row => row.id === item.id ? { ...row, active: !row.active } : row)); audit(session!.userId, action, `${item.name} · ${formatDate(item.date)}`); refreshAudit(); }
  function changePolicy(value: 'block' | 'warn') { setPolicy(value); localStorage.setItem(POLICY_KEY, value); audit(session!.userId, 'Holiday conflict policy changed', value === 'block' ? 'Block batch scheduling on holidays' : 'Warn and allow batch scheduling'); refreshAudit(); }
  function addUser(event: FormEvent) { event.preventDefault(); const userId = newUser.trim(); if (!userId || users.some(user => user.userId.toLowerCase() === userId.toLowerCase())) return; const next = [...users, { userId, role: newRole, active: true }]; setUserList(next); saveUsers(next); audit(session!.userId, 'User added', `${userId} · ${ROLE_LABELS[newRole]}`); setNewUser(''); refreshAudit(); }
  function updateUser(user: UserRecord, patch: Partial<UserRecord>) { const next = users.map(row => row.userId === user.userId ? { ...row, ...patch } : row); setUserList(next); saveUsers(next); audit(session!.userId, patch.role ? 'User role changed' : (patch.active ? 'User activated' : 'User deactivated'), `${user.userId} · ${patch.role ? ROLE_LABELS[patch.role] : patch.active ? 'active' : 'inactive'}`); refreshAudit(); if (user.userId === session!.userId && patch.role && patch.role !== 'schoolnet-super-admin') { signOut(); window.location.assign(`${import.meta.env.BASE_URL}login`); } }
  if (!session) return <main className="hm-gate"><section><span className="hm-gate-icon">⌑</span><h1>Sign in required</h1><p>Please sign in to access Holiday Master.</p><a href={`${import.meta.env.BASE_URL}login`}>Go to sign in</a></section></main>;
  if (!admin) return <main className="hm-gate"><section><span className="hm-gate-icon">!</span><h1>Schoolnet Super Admin access required</h1><p>Your account does not have permission to manage master records.</p><a href={import.meta.env.BASE_URL}>Return to dashboard</a></section></main>;
  return <div className="app holiday-app"><Sidebar activePage={'Holiday Master' satisfies AppPage} /><main className="main holiday-main"><Topbar title="Holiday Master" description="Manage national and state calendars for training operations." />
    <div className="hm-content"><section className="hm-banner"><div><span className="hm-eyebrow">MASTER DATA · CALENDAR</span><h1>Holiday Master</h1><p>Keep training plans aligned with the right national and state holidays.</p></div><div className="hm-summary"><strong>{holidays.filter(item => item.active).length}</strong><span>Active holidays</span></div></section>
      <nav className="hm-tabs" aria-label="Holiday administration">{([['holidays','Holiday calendar'],['access','Access & users'],['audit','Audit log']] as const).map(([key,label]) => <button key={key} type="button" className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{label}{key === 'audit' && entries.length > 0 && <i>{entries.length}</i>}</button>)}</nav>
      {tab === 'holidays' && <><section className="hm-policy"><div><strong>Batch scheduling rule</strong><p>Choose how scheduling conflicts with active holidays should be handled.</p></div><div className="hm-policy-options"><label><input type="radio" checked={policy === 'block'} onChange={() => changePolicy('block')} /> Block scheduling</label><label><input type="radio" checked={policy === 'warn'} onChange={() => changePolicy('warn')} /> Show warning</label></div></section>
        <div className="hm-columns"><section className="hm-card"><div className="hm-card-head"><div><h2>{editing ? 'Edit holiday' : 'Add a holiday'}</h2><p>National and state calendars are maintained independently.</p></div><span className="hm-plus">＋</span></div><form className="hm-form" onSubmit={saveHoliday}>
          <label>Holiday name <b>*</b><input required value={form.name} onChange={e => changeForm('name',e.target.value)} placeholder="e.g. Maharashtra Day" /></label>
          <label>Date <b>*</b><span className="hm-date-entry"><input required type="text" placeholder="dd-MMM-yyyy" value={dateEntry} onChange={e => { const value = e.target.value; setDateEntry(value); changeForm('date', parseDisplayDate(value) ?? ''); }} /><button type="button" aria-label="Choose holiday date" onClick={() => { const input = holidayDatePicker.current; if (!input) return; if (input.showPicker) input.showPicker(); else input.focus(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></svg></button><input ref={holidayDatePicker} className="hm-native-date" type="date" aria-label="Holiday date calendar" value={form.date} onChange={e => { setDateEntry(formatDate(e.target.value)); changeForm('date',e.target.value); }} /></span></label>
          <label>Calendar scope <b>*</b><select value={form.scope} onChange={e => changeForm('scope',e.target.value)}><option>National</option><option>State</option></select></label>
          {form.scope === 'State' && <><label>State <b>*</b><select required value={form.state} onChange={e => changeForm('state',e.target.value)}><option value="">Select state</option>{Object.keys(LOCATIONS).map(state => <option key={state}>{state}</option>)}</select></label><div className="hm-form-row"><label>District<select disabled={!form.state} value={form.district} onChange={e => changeForm('district',e.target.value)}><option value="">All districts</option>{districts.map(item => <option key={item}>{item}</option>)}</select></label><label>School<select disabled={!form.district} value={form.school} onChange={e => changeForm('school',e.target.value)}><option value="">All schools</option>{schools.map(item => <option key={item}>{item}</option>)}</select></label></div></>}
          <label>Notes <textarea value={form.note} onChange={e => changeForm('note',e.target.value)} placeholder="Optional details" rows={2} /></label>
          {feedback && <p className="hm-feedback" role="status">{feedback}</p>}<div className="hm-form-actions"><button className="hm-primary" type="submit">{editing ? 'Save changes' : 'Add holiday'}</button>{editing && <button type="button" className="hm-secondary" onClick={() => { setEditing(null); setForm(blank); setDateEntry(''); }}>Cancel</button>}</div>
        </form></section>
        <section className="hm-card hm-register"><div className="hm-card-head"><div><h2>Holiday calendar</h2><p>Manage dates used in training and trainer availability checks.</p></div><span className="hm-calendar-icon">▦</span></div><div className="hm-toolbar"><div className="hm-filter-tabs"><button className={scopeFilter === 'All' ? 'active' : ''} onClick={() => setScopeFilter('All')}>All</button><button className={scopeFilter === 'National' ? 'active' : ''} onClick={() => setScopeFilter('National')}>National</button><button className={scopeFilter === 'State' ? 'active' : ''} onClick={() => setScopeFilter('State')}>State</button></div><label className="hm-inactive"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive</label></div>
          <div className="hm-table-scroll"><table className="hm-table"><thead><tr><th>Holiday</th><th>Date</th><th>Scope</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleHolidays.map(item => <tr key={item.id}><td><strong>{item.name}</strong>{item.note && <small>{item.note}</small>}</td><td>{formatDate(item.date)}</td><td><span className={`hm-scope ${item.scope.toLowerCase()}`}>{item.scope}</span></td><td>{item.scope === 'National' ? 'All India' : <>{item.state}<small>{item.district ? `${item.district}${item.school ? ` · ${item.school}` : ''}` : 'All districts and schools'}</small></>}</td><td><span className={`hm-status ${item.active ? 'active' : ''}`}>{item.active ? 'Active' : 'Inactive'}</span></td><td><div className="hm-row-actions"><button type="button" onClick={() => editHoliday(item)}>Edit</button><button type="button" className={item.active ? 'deactivate' : ''} onClick={() => deactivate(item)}>{item.active ? 'Deactivate' : 'Activate'}</button></div></td></tr>)}{visibleHolidays.length === 0 && <tr><td colSpan={6} className="hm-empty">No holidays match this filter.</td></tr>}</tbody></table></div>
          <div className="hm-calendar-note"><span>i</span><p>Active holidays are checked during batch scheduling and trainer availability validation. Current policy: <strong>{policy === 'block' ? 'block scheduling' : 'show a warning'}</strong>.</p></div>
        </section></div></>}
      {tab === 'access' && <section className="hm-card hm-access"><div className="hm-card-head"><div><h2>Users and Responsibilities</h2><p>Schoolnet Super Admins manage user roles and access. Deactivated accounts cannot sign in.</p></div><span className="hm-lock">♙</span></div><form className="hm-add-user" onSubmit={addUser}><label>User ID<input required value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="Enter a user ID" /></label><label>Role<select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)}>{ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label><button className="hm-primary">Add user</button></form><div className="hm-table-scroll"><table className="hm-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map(user => <tr key={user.userId}><td><strong>{user.userId}</strong>{user.userId === session.userId && <small>Current account</small>}</td><td><select aria-label={`Role for ${user.userId}`} value={user.role} onChange={e => updateUser(user,{role:e.target.value as UserRole})}>{ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></td><td><span className={`hm-status ${user.active ? 'active' : ''}`}>{user.active ? 'Active' : 'Deactivated'}</span></td><td><button type="button" className="hm-user-toggle" disabled={user.userId === session.userId && user.role === 'schoolnet-super-admin'} onClick={() => updateUser(user,{active:!user.active})}>{user.active ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}</tbody></table></div><p className="hm-demo-note">Demo accounts: Demo1–Demo8. Password for all demo accounts: <code>demo1@123</code>.</p></section>}
      {tab === 'audit' && <section className="hm-card hm-audit"><div className="hm-card-head"><div><h2>Audit log</h2><p>Recent changes to user access, holiday records, and calendar rules.</p></div><span className="hm-audit-icon">◷</span></div><div className="hm-table-scroll"><table className="hm-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead><tbody>{entries.map(item => <tr key={item.id}><td>{formatDateTime(item.at)}</td><td><strong>{item.actor}</strong></td><td>{item.action}</td><td>{item.detail}</td></tr>)}{entries.length === 0 && <tr><td colSpan={4} className="hm-empty">No changes recorded yet. Changes to holidays and user roles will appear here.</td></tr>}</tbody></table></div></section>}
      <div className="hm-footnote">Changes are recorded in the local demo audit log. Production access control and audit trails must be enforced by the server.</div>
    </div><Footer /></main></div>;
}
