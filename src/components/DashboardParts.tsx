import { memo, useEffect, useState } from 'react';
import { Box, Dialog, IconButton, Popover, Snackbar, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { setAudience, setFilter, setPhase, clearFilters } from '../store';
import { sidebarMarkup, topbarMarkup, dashboardMarkup, modalMarkup } from '../sourceMarkup';
import { locations } from '../data/locations';
import { kgbvSchools } from '../data/kgbvSchools';
import { canAccessMenu, getSession, ROLE_LABELS, signOut, type MenuKey } from '../auth';
import { formatDateTime } from '../dateFormat';

declare global {
  interface Window { KGBV_SCHOOLS?: typeof kgbvSchools }
}

const Markup = memo(function Markup({ html, className }: { html: string; className?: string }) {
  const baseAwareHtml = html.replace(/\b(src|href)="\/(?!\/)/g, (_match, attribute: string) => `${attribute}="${import.meta.env.BASE_URL}`);
  return <div className={`component-markup ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: baseAwareHtml }} />;
});
export type AppPage = 'Dashboard' | 'Projects' | 'Training Plans' | 'Batches' | 'Attendance' | 'Content Library' | 'Assessments & Feedback' | 'Certificates' | 'Batch Performance' | 'Training Summary' | 'Attendance Report' | 'Assessment & Feedback Report' | 'Holiday Master' | 'Trainer Repository' | 'Compliance Checklist';
export function Sidebar({ activePage = 'Dashboard' }: { activePage?: AppPage }) {
  const dashboard = activePage === 'Dashboard';
  const role = getSession()?.role ?? 'sponsor-admin';
  let html = sidebarMarkup
    .replace('class="side-link active" href="#overview" aria-current="page"', `class="side-link${dashboard ? ' active' : ''}" href="/"${dashboard ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="#projects"', `class="side-link${activePage === 'Projects' ? ' active' : ''}" href="/projects"${activePage === 'Projects' ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="#training-progress"', `class="side-link${activePage === 'Training Plans' ? ' active' : ''}" href="/training-plans"${activePage === 'Training Plans' ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="#batch-status"', `class="side-link${activePage === 'Batches' ? ' active' : ''}" href="/batches"${activePage === 'Batches' ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="#attendance"', `class="side-link${activePage === 'Attendance' ? ' active' : ''}" href="/attendance"${activePage === 'Attendance' ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="Attendance.html"', `class="side-link${activePage === 'Attendance' ? ' active' : ''}" href="/attendance"${activePage === 'Attendance' ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="ContentLibrary.html"', `class="side-link${activePage === 'Content Library' ? ' active' : ''}" href="/content-library"${activePage === 'Content Library' ? ' aria-current="page"' : ''}`);
  html = html.replace('</nav>', `<a class="side-link${activePage === 'Trainer Repository' ? ' active' : ''}" href="/trainers"${activePage === 'Trainer Repository' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 20c.4-3.5 2.2-5.3 5.5-5.3s5.1 1.8 5.5 5.3M16 7h5m-5 4h5m-5 4h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Trainer Repository</span></a><a class="side-link${activePage === 'Holiday Master' ? ' active' : ''}" href="/holiday-master"${activePage === 'Holiday Master' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M7.5 3v4m9-4v4m-13 2h17M8 13h3m2 0h3m-8 4h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Holiday Master</span></a></nav>`);
  html = html.replace('href="#effectiveness">Feedback Report</a>', 'href="/reports/assessment-feedback">Assessment &amp; Feedback Report</a>');
  const reportLinks: Record<string, string> = { 'Batch Performance': '/reports/batch-performance', 'Training Summary': '/reports/training-summary', 'Attendance Report': '/reports/attendance-report', 'Assessment & Feedback Report': '/reports/assessment-feedback' };
  for (const [label, href] of Object.entries(reportLinks)) {
    const fileName = label === 'Batch Performance' ? 'Batch_performance.html' : label === 'Training Summary' ? 'Training_Summary.html' : 'Attendance_Report.html';
    html = html.replace(`href="${fileName}"`, `href="${href}"${activePage === label ? ' aria-current="page"' : ''}`);
  }
  if (activePage in reportLinks) html = html.replace('<summary class="side-link">', '<summary class="side-link active">');
  const menuByLabel: Record<string, MenuKey> = {
    Dashboard: 'dashboard', Projects: 'projects', 'Training Plans': 'training-plans', Batches: 'batches',
    Attendance: 'attendance', 'Content Library': 'content-library', Assessments: 'assessments',
    Certificates: 'certificates', 'MIS Reports': 'mis-reports', 'Holiday Master': 'holiday-master', 'Trainer Repository': 'trainer-repository',
  };
  const sidebarDocument = new DOMParser().parseFromString(html, 'text/html');
  const activeReportHref = reportLinks[activePage];
  if (activeReportHref) {
    const reportGroup = sidebarDocument.querySelector<HTMLDetailsElement>('.side-group');
    const activeReportLink = reportGroup?.querySelector<HTMLAnchorElement>(`.side-submenu a[href="${activeReportHref}"]`);
    if (reportGroup) reportGroup.open = true;
    if (activeReportLink) {
      activeReportLink.classList.add('active');
      activeReportLink.setAttribute('aria-current', 'page');
    }
  }
  const certificatesLink = [...sidebarDocument.querySelectorAll<HTMLAnchorElement>('.side-nav > .side-link')].find(link => link.textContent?.trim() === 'Certificates');
  if (certificatesLink) {
    certificatesLink.href = '/certificates';
    if (activePage === 'Certificates') { certificatesLink.classList.add('active'); certificatesLink.setAttribute('aria-current', 'page'); }
  }
  const assessmentsLink = [...sidebarDocument.querySelectorAll<HTMLAnchorElement>('.side-nav > .side-link')].find(link => link.textContent?.trim() === 'Assessments');
  if (assessmentsLink) {
    assessmentsLink.href = '/assessments';
    if (activePage === 'Assessments & Feedback') { assessmentsLink.classList.add('active'); assessmentsLink.setAttribute('aria-current', 'page'); }
  }
  sidebarDocument.querySelectorAll<HTMLElement>('.side-nav > .side-link, .side-nav > .side-group').forEach(item => {
    const label = item.querySelector('span')?.textContent?.trim() ?? item.querySelector('summary')?.textContent?.trim() ?? '';
    const menu = menuByLabel[label];
    if (menu && !canAccessMenu(role, menu)) item.remove();
  });
  html = sidebarDocument.body.innerHTML;
  useEffect(() => {
    const syncResponsiveCollapse = () => {
      const button = document.querySelector<HTMLButtonElement>('.sidebar .collapse');
      const app = button?.closest<HTMLElement>('.app');
      if (!button || !app || !window.matchMedia('(max-width: 900px) and (min-width: 621px)').matches) return;
      if (app.classList.contains('is-expanded') || app.classList.contains('is-collapsed')) return;
      app.classList.add('is-collapsed');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Expand navigation');
    };
    syncResponsiveCollapse();
    window.addEventListener('resize', syncResponsiveCollapse);
    const groups = () => Array.from(document.querySelectorAll<HTMLDetailsElement>('.sidebar .side-group'));
    const placeSubmenu = (group: HTMLDetailsElement) => {
      const submenu = group.querySelector<HTMLElement>('.side-submenu');
      const summary = group.querySelector<HTMLElement>('summary');
      if (!submenu || !summary || !group.open || !window.matchMedia('(max-width: 620px)').matches) return;
      const width = Math.min(220, window.innerWidth - 16);
      const rect = summary.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
      submenu.style.setProperty('--submenu-left', `${left}px`);
    };
    const onToggle = (event: Event) => {
      const group = event.target;
      if (group instanceof HTMLDetailsElement && group.matches('.sidebar .side-group')) placeSubmenu(group);
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const collapseButton = event.target.closest<HTMLButtonElement>('.sidebar .collapse');
      if (collapseButton) {
        const app = collapseButton.closest<HTMLElement>('.app');
        if (!app) return;
        const collapsed = app.classList.toggle('is-collapsed');
        const tablet = window.matchMedia('(max-width: 900px) and (min-width: 621px)').matches;
        app.classList.toggle('is-expanded', !collapsed && tablet);
        collapseButton.setAttribute('aria-expanded', String(!collapsed));
        collapseButton.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
        return;
      }
      const link = event.target.closest<HTMLAnchorElement>('.sidebar .side-submenu a');
      if (!link) return;
      const group = link.closest<HTMLDetailsElement>('.side-group');
      if (group) {
        group.open = false;
        group.querySelector<HTMLElement>('.side-submenu')?.style.removeProperty('--submenu-left');
      }
    };
    const onLayoutChange = () => groups().forEach(placeSubmenu);
    const sidebar = document.querySelector('.sidebar');
    document.addEventListener('toggle', onToggle, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('resize', onLayoutChange);
    sidebar?.addEventListener('scroll', onLayoutChange, { passive: true });
    return () => {
      document.removeEventListener('toggle', onToggle, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('resize', syncResponsiveCollapse);
      window.removeEventListener('resize', onLayoutChange);
      sidebar?.removeEventListener('scroll', onLayoutChange);
    };
  }, []);
  return <Markup html={html} />;
}
export function Topbar({ title = 'Dashboard', logoSrc }: { title?: string; description?: string; logoSrc?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => window.localStorage.getItem('teacher-training-theme') === 'dark' ? 'dark' : 'light');
  const session = getSession();
  const roleLabel = session ? session.userId.toLowerCase() === 'demo1' && session.role === 'sponsor-admin' ? 'ERnet Admin' : ROLE_LABELS[session.role] : 'Guest';
  const initials = roleLabel.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const themeSwitch = `<div class="theme-switch" role="group" aria-label="Choose color theme"><button class="theme-option${theme === 'light' ? ' active' : ''}" id="theme-light" type="button" aria-pressed="${theme === 'light'}" title="Light theme"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg><span>Light</span></button><button class="theme-option${theme === 'dark' ? ' active' : ''}" id="theme-dark" type="button" aria-pressed="${theme === 'dark'}" title="Dark theme"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg><span>Dark</span></button></div>`;
  const heading = logoSrc ? `<h1><img src="${logoSrc}" alt="${title}" style="display:block;max-width:190px;max-height:48px;object-fit:contain" /></h1>` : `<h1>${title}</h1>`;
  const html = topbarMarkup.replace('<h1>Dashboard</h1>', heading).replace('<span class="divider" aria-hidden="true"></span>', `${themeSwitch}<span class="divider" aria-hidden="true"></span>`)
    .replace('aria-label="Project Sponsor account"', `aria-label="${roleLabel} account"`)
    .replace('<span class="avatar">PS</span><span>Project Sponsor</span>', `<span class="avatar">${initials}</span><span>${roleLabel}</span>`);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [lastLogin] = useState(() => {
    const stored = window.localStorage.getItem('teacher-training-last-login');
    return stored ? new Date(stored) : null;
  });
  useEffect(() => {
    window.localStorage.setItem('teacher-training-last-login', new Date().toISOString());
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('teacher-training-theme', theme);
  }, [theme]);
  useEffect(() => {
    const onNotificationClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const themeButton = target.closest<HTMLButtonElement>('#theme-light, #theme-dark');
      const button = target.closest<HTMLElement>('#notifications');
      const profileButton = target.closest<HTMLElement>('#profile-button');
      if (themeButton?.id === 'theme-light' || themeButton?.id === 'theme-dark') { event.stopPropagation(); setTheme(themeButton.id === 'theme-dark' ? 'dark' : 'light'); }
      else if (button) { event.stopPropagation(); setAnchor(current => current ? null : button); setProfileAnchor(null); }
      else if (profileButton) { event.stopPropagation(); setProfileAnchor(current => current ? null : profileButton); setAnchor(null); }
    };
    document.addEventListener('click', onNotificationClick, true);
    return () => document.removeEventListener('click', onNotificationClick, true);
  }, []);
  return <><Markup html={html} /><Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
    <Box sx={{ width: { xs: 300, sm: 360 }, p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 750, color: '#12365c' }}>Notifications</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, mb: 1.5, color: '#71839a' }}>Updates and shortcuts for your training dashboard</Typography>
      {[
        { title: 'Batch status', text: 'Review upcoming, ongoing, and completed training batches.', href: `${import.meta.env.BASE_URL}#batch-status` },
        { title: 'Attendance report', text: 'Check attendance records and follow up on participation.', href: `${import.meta.env.BASE_URL}reports/attendance-report` },
        { title: 'Training summary', text: 'Review batch progress, registrations, and completions.', href: `${import.meta.env.BASE_URL}reports/training-summary` },
      ].map(item => <Box key={item.title} component="a" href={item.href} onClick={() => setAnchor(null)} sx={{ display: 'block', px: 1.25, py: 1, mb: 0.75, borderRadius: 1.5, bgcolor: '#f5f8fb', color: 'inherit', textDecoration: 'none', '&:hover': { bgcolor: '#edf4fa' } }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: '#176fba' }}>{item.title}</Typography>
        <Typography variant="caption" sx={{ color: '#61778e', lineHeight: 1.45 }}>{item.text}</Typography>
      </Box>)}
    </Box>
  </Popover><Popover open={Boolean(profileAnchor)} anchorEl={profileAnchor} onClose={() => setProfileAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
    <Box sx={{ width: 230, p: 1 }}>
      <Box sx={{ px: 1.25, py: 1 }}><Typography variant="body2" sx={{ fontWeight: 750, color: '#12365c' }}>{roleLabel}</Typography><Typography variant="caption" sx={{ display: 'block', color: '#71839a' }}>User ID: {session?.userId ?? 'Not signed in'}</Typography><Typography variant="caption" sx={{ color: '#71839a' }}>Last login: {lastLogin ? formatDateTime(lastLogin) : 'First visit on this device'}</Typography></Box>
      <Box component="button" type="button" onClick={() => { setProfileAnchor(null); setProfileOpen(true); }} sx={{ display: 'block', width: '100%', px: 1.25, py: 1, border: 0, borderRadius: 1, bgcolor: 'transparent', color: '#244765', textAlign: 'left', cursor: 'pointer', '&:hover': { bgcolor: '#f2f6fa' } }}>My Profile</Box>
      <Box component="button" type="button" onClick={() => { setProfileAnchor(null); signOut(); window.localStorage.removeItem('teacher-training-last-login'); window.location.assign(`${import.meta.env.BASE_URL}login`); }} sx={{ display: 'block', width: '100%', px: 1.25, py: 1, border: 0, borderRadius: 1, bgcolor: 'transparent', color: '#a33a3a', textAlign: 'left', cursor: 'pointer', '&:hover': { bgcolor: '#fff4f4' } }}>Logout</Box>
    </Box>
  </Popover><Dialog open={profileOpen} onClose={() => setProfileOpen(false)} PaperProps={{ sx: { width: 'min(400px, calc(100vw - 32px))', p: 2.5, borderRadius: 2 } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 750, color: '#12365c' }}>My Profile</Typography><IconButton aria-label="Close profile" onClick={() => setProfileOpen(false)}>×</IconButton></Box>
    <Box sx={{ display: 'grid', gap: 1.25, mt: 1 }}>
      <Box><Typography variant="caption" sx={{ color: '#71839a' }}>User ID</Typography><Typography variant="body2" sx={{ fontWeight: 650, color: '#244765' }}>{session?.userId ?? 'Not signed in'}</Typography></Box>
      <Box><Typography variant="caption" sx={{ color: '#71839a' }}>Role</Typography><Typography variant="body2" sx={{ fontWeight: 650, color: '#244765' }}>{roleLabel}</Typography></Box>
      <Box><Typography variant="caption" sx={{ color: '#71839a' }}>Last login</Typography><Typography variant="body2" sx={{ fontWeight: 650 }}>{lastLogin ? formatDateTime(lastLogin) : 'First visit on this device'}</Typography></Box>
    </Box>
  </Dialog><Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast('')} message={toast} /></>;
}
export function Footer() { return <footer className="page-footer">© Schoolnet India Limited</footer>; }
const studentModules = [
  'Cyber Safety and Digital Responsibility',
  'Digital Creativity',
  'AI Awareness',
];
const teacherDashboardMarkup = dashboardMarkup.replace(
  'id="phase-overview-title">Phase wise Training</h2>',
  'id="phase-overview-title">Phases of Teacher Capacity Building (25 hours)</h2>',
).replace(
  /<select id="state">[\s\S]*?<\/select>/,
  `<select id="state"><option>All States</option>${locations.map(location => `<option>${location.name}</option>`).join('')}</select>`,
).replace(
  '<section class="dashboard-grid" aria-label="Training charts">',
  '<div class="dashboard-insight-row"><section class="dashboard-grid" aria-label="Training charts">',
).replace(
  '</section>\n\n    <div class="location-performance-layout"',
  '</section></div>\n\n    <div class="location-performance-layout"',
);

const studentOverviewMarkup = `<section class="phase-overview student-overview" aria-labelledby="student-overview-title" hidden aria-hidden="true">
  <div class="phase-overview-header"><h2 class="phase-overview-title" id="student-overview-title">Student Capacity Building Framework (15 hours)</h2><button class="info-button" type="button" aria-label="Show student capacity building information" data-info-title="Student Capacity Building Framework" data-info="Three student modules: Cyber Safety and Digital Responsibility, Digital Creativity, and AI Awareness. Each module is 5 hours, for 15 hours total.">i</button></div>
  <div class="student-module-grid">${studentModules.map((module, index) => `<article class="student-module-card" role="button" tabindex="0" aria-pressed="false" data-student-module="${index + 1}">
    <div class="phase-node student-module-node" aria-hidden="true">${index + 1}</div>
    <span class="phase-number">Module ${index + 1}</span><h3>${module}</h3>
    <div class="phase-facts"><div class="phase-fact"><span>5 hrs</span></div></div>
  </article>`).join('')}</div>
</section>`;

const dashboardWithStudentOverview = teacherDashboardMarkup.replace(
  /<section class="phase-overview"[\s\S]*?<\/section>/,
  teacherOverview => `${teacherOverview}${studentOverviewMarkup}`,
);

export function DashboardContent() {
  const audience = useSelector((state: RootState) => state.dashboard.audience);
  useEffect(() => {
    const teacherOverview = document.querySelector<HTMLElement>('.main .phase-overview:not(.student-overview)');
    const studentOverview = document.querySelector<HTMLElement>('.main .student-overview');
    if (teacherOverview) teacherOverview.hidden = audience === 'Student';
    if (studentOverview) {
      studentOverview.hidden = audience === 'Teacher';
      studentOverview.setAttribute('aria-hidden', String(audience === 'Teacher'));
    }
    document.querySelectorAll<HTMLButtonElement>('.dashboard-controls .audience-button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.audience === audience));
    });
  }, [audience]);
  return <Markup html={dashboardWithStudentOverview} />;
}
export function DashboardModals() { return <Markup html={modalMarkup} />; }

export function DashboardBridge() {
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    window.KGBV_SCHOOLS = kgbvSchools;
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}legacy-dashboard.js`;
    script.async = false;
    document.body.appendChild(script);
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const audience = target.closest<HTMLElement>('[data-audience]')?.dataset.audience;
      if (audience === 'Teacher' || audience === 'Student') {
        dispatch(setAudience(audience));
        dispatch(setPhase(audience === 'Teacher' ? 3 : 1));
      }
      const selectableCard = target.closest<HTMLElement>('.phase-card, .student-module-card');
      if (selectableCard) {
        const phase = Number(selectableCard.querySelector('.phase-number')?.textContent?.match(/\d+/)?.[0]);
        if (phase) window.setTimeout(() => dispatch(setPhase(selectableCard.classList.contains('selected') ? phase : null)), 0);
      }
      if (target.closest('#clear-filters')) dispatch(clearFilters());
    };
    const onChange = (event: Event) => {
      const select = event.target as HTMLSelectElement;
      if (select.matches('.filter select')) dispatch(setFilter({ key: select.id, value: select.selectedIndex ? select.value : '' }));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const selectableCard = (event.target as HTMLElement).closest<HTMLElement>('.phase-card, .student-module-card');
      if (!selectableCard) return;
      const phase = Number(selectableCard.querySelector('.phase-number')?.textContent?.match(/\d+/)?.[0]);
      if (phase) window.setTimeout(() => dispatch(setPhase(selectableCard.classList.contains('selected') ? phase : null)), 0);
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('keydown', onKeyDown, true);
      script.remove();
      delete window.KGBV_SCHOOLS;
    };
  }, [dispatch]);
  return null;
}

