import { useEffect, useState } from 'react';
import { Box, Dialog, IconButton, Popover, Snackbar, Typography } from '@mui/material';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { setAudience, setFilter, setPhase, setSidebarCollapsed, clearFilters } from '../store';
import { sidebarMarkup, topbarMarkup, dashboardMarkup, modalMarkup } from '../sourceMarkup';
import { signOut } from '../auth';
import { formatDateTime } from '../dateFormat';

function Markup({ html, className }: { html: string; className?: string }) {
  const baseAwareHtml = html.replace(/\b(src|href)="\/(?!\/)/g, (_match, attribute: string) => `${attribute}="${import.meta.env.BASE_URL}`);
  return <div className={`component-markup ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: baseAwareHtml }} />;
}
export type AppPage = 'Dashboard' | 'Content Library' | 'Batch Performance' | 'Training Summary' | 'Attendance Report' | 'Holiday Master';
export function Sidebar({ activePage = 'Dashboard' }: { activePage?: AppPage }) {
  const dashboard = activePage === 'Dashboard';
  let html = sidebarMarkup
    .replace('class="side-link active" href="#overview" aria-current="page"', `class="side-link${dashboard ? ' active' : ''}" href="/"${dashboard ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="ContentLibrary.html"', `class="side-link${activePage === 'Content Library' ? ' active' : ''}" href="/content-library"${activePage === 'Content Library' ? ' aria-current="page"' : ''}`);
  html = html.replace('</nav>', `<a class="side-link${activePage === 'Holiday Master' ? ' active' : ''}" href="/holiday-master"${activePage === 'Holiday Master' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M7.5 3v4m9-4v4m-13 2h17M8 13h3m2 0h3m-8 4h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Holiday Master</span></a></nav>`);
  const reportLinks: Record<string, string> = { 'Batch Performance': '/reports/batch-performance', 'Training Summary': '/reports/training-summary', 'Attendance Report': '/reports/attendance-report' };
  for (const [label, href] of Object.entries(reportLinks)) {
    const fileName = label === 'Batch Performance' ? 'Batch_performance.html' : label === 'Training Summary' ? 'Training_Summary.html' : 'Attendance_Report.html';
    html = html.replace(`href="${fileName}"`, `href="${href}"${activePage === label ? ' aria-current="page"' : ''}`);
  }
  if (activePage in reportLinks) html = html.replace('<summary class="side-link">', '<summary class="side-link active">');
  useEffect(() => {
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
      window.removeEventListener('resize', onLayoutChange);
      sidebar?.removeEventListener('scroll', onLayoutChange);
    };
  }, []);
  return <Markup html={html} />;
}
export function Topbar({ title = 'Dashboard' }: { title?: string; description?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => window.localStorage.getItem('teacher-training-theme') === 'dark' ? 'dark' : 'light');
  const themeSwitch = `<div class="theme-switch" role="group" aria-label="Choose color theme"><button class="theme-option${theme === 'light' ? ' active' : ''}" id="theme-light" type="button" aria-pressed="${theme === 'light'}" title="Light theme"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg><span>Light</span></button><button class="theme-option${theme === 'dark' ? ' active' : ''}" id="theme-dark" type="button" aria-pressed="${theme === 'dark'}" title="Dark theme"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg><span>Dark</span></button></div>`;
  const html = topbarMarkup.replace('<h1>Dashboard</h1>', `<h1>${title}</h1>`).replace('<span class="divider" aria-hidden="true"></span>', `${themeSwitch}<span class="divider" aria-hidden="true"></span>`);
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
    const onNotificationClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const themeButton = target.closest<HTMLElement>('[id^="theme-"]');
      const button = target.closest<HTMLElement>('#notifications');
      const profileButton = target.closest<HTMLElement>('#profile-button');
      if (themeButton?.id === 'theme-light' || themeButton?.id === 'theme-dark') { event.stopPropagation(); setTheme(themeButton.id === 'theme-dark' ? 'dark' : 'light'); }
      else if (button) { event.stopPropagation(); setAnchor(current => current ? null : button); setProfileAnchor(null); }
      else if (profileButton) { event.stopPropagation(); setProfileAnchor(current => current ? null : profileButton); setAnchor(null); }
    };
    document.addEventListener('click', onNotificationClick, true);
    return () => document.removeEventListener('click', onNotificationClick, true);
  }, [theme]);
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
      <Box sx={{ px: 1.25, py: 1 }}><Typography variant="body2" sx={{ fontWeight: 750, color: '#12365c' }}>Project Sponsor</Typography><Typography variant="caption" sx={{ color: '#71839a' }}>Last login: {lastLogin ? formatDateTime(lastLogin) : 'First visit on this device'}</Typography></Box>
      <Box component="button" type="button" onClick={() => { setProfileAnchor(null); setProfileOpen(true); }} sx={{ display: 'block', width: '100%', px: 1.25, py: 1, border: 0, borderRadius: 1, bgcolor: 'transparent', color: '#244765', textAlign: 'left', cursor: 'pointer', '&:hover': { bgcolor: '#f2f6fa' } }}>My Profile</Box>
      <Box component="button" type="button" onClick={() => { setProfileAnchor(null); signOut(); window.localStorage.removeItem('teacher-training-last-login'); window.location.assign(`${import.meta.env.BASE_URL}login`); }} sx={{ display: 'block', width: '100%', px: 1.25, py: 1, border: 0, borderRadius: 1, bgcolor: 'transparent', color: '#a33a3a', textAlign: 'left', cursor: 'pointer', '&:hover': { bgcolor: '#fff4f4' } }}>Logout</Box>
    </Box>
  </Popover><Dialog open={profileOpen} onClose={() => setProfileOpen(false)} PaperProps={{ sx: { width: 'min(400px, calc(100vw - 32px))', p: 2.5, borderRadius: 2 } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 750, color: '#12365c' }}>My Profile</Typography><IconButton aria-label="Close profile" onClick={() => setProfileOpen(false)}>×</IconButton></Box>
    <Typography variant="body2" sx={{ color: '#244765' }}>Project Sponsor</Typography><Typography variant="body2" sx={{ mt: 1, color: '#71839a' }}>Last login</Typography><Typography variant="body2" sx={{ fontWeight: 650 }}>{lastLogin ? formatDateTime(lastLogin) : 'First visit on this device'}</Typography>
  </Dialog><Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast('')} message={toast} /></>;
}
export function Footer() { return <footer className="page-footer">© Schoolnet India Limited</footer>; }
export function DashboardContent() { return <Markup html={dashboardMarkup} />; }
export function DashboardModals() { return <Markup html={modalMarkup} />; }

export function DashboardBridge() {
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}legacy-dashboard.js`;
    script.async = false;
    document.body.appendChild(script);
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const audience = target.closest<HTMLElement>('[data-audience]')?.dataset.audience;
      if (audience === 'Teacher' || audience === 'Student') dispatch(setAudience(audience));
      const phaseCard = target.closest<HTMLElement>('.phase-card');
      if (phaseCard) {
        const phase = Number(phaseCard.querySelector('.phase-number')?.textContent?.match(/\d+/)?.[0]);
        if (phase) window.setTimeout(() => dispatch(setPhase(phaseCard.classList.contains('selected') ? phase : null)), 0);
      }
      if (target.closest('#clear-filters')) dispatch(clearFilters());
      if (target.closest('.collapse')) window.setTimeout(() => dispatch(setSidebarCollapsed(document.querySelector('.app')?.classList.contains('is-collapsed') ?? false)), 0);
    };
    const onChange = (event: Event) => {
      const select = event.target as HTMLSelectElement;
      if (select.matches('.filter select')) dispatch(setFilter({ key: select.id, value: select.selectedIndex ? select.value : '' }));
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
      script.remove();
    };
  }, [dispatch]);
  return null;
}

