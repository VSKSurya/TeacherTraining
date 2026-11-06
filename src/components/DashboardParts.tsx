import { memo, useEffect, useState } from 'react';
import { Box, Dialog, IconButton, Popover, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { setAudience, setFilter, setPhase, clearFilters, store } from '../store';
import { sidebarMarkup, topbarMarkup, dashboardMarkup, modalMarkup } from '../sourceMarkup';
import { locations } from '../data/locations';
import { kgbvSchools } from '../data/kgbvSchools';
import { canAccessMenu, getSession, ROLE_LABELS, signOut, type MenuKey } from '../auth';
import { formatDateTime } from '../dateFormat';
import { applyFontScale, readFontScale, DEFAULT_FONT_SCALE, MIN_FONT_SCALE, MAX_FONT_SCALE } from '../fontScale';

declare global {
  interface Window { KGBV_SCHOOLS?: typeof kgbvSchools }
}

const Markup = memo(function Markup({ html, className }: { html: string; className?: string }) {
  const baseAwareHtml = html.replace(/\b(src|href)="\/(?!\/)/g, (_match, attribute: string) => `${attribute}="${import.meta.env.BASE_URL}`);
  return <div className={`component-markup ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: baseAwareHtml }} />;
});
export type AppPage = 'Dashboard' | 'Projects' | 'Training Plans' | 'Batches' | 'Attendance' | 'Content Library' | 'Assessments & Feedback' | 'Certificates' | 'Batch Performance' | 'Training Summary' | 'Attendance Report' | 'Assessment & Feedback Report' | 'Participant Wise Feedback Report' | 'Holiday Master' | 'Trainer Directory' | 'Uploaded Documents' | 'Upload Documents' | 'Compliance Checklist';
export function Sidebar({ activePage = 'Dashboard' }: { activePage?: AppPage }) {
  const dashboard = activePage === 'Dashboard';
  const role = getSession()?.role ?? 'sponsor-admin';
  let html = sidebarMarkup
    .replace('class="side-link active" href="#overview" aria-current="page"', `class="side-link${dashboard ? ' active' : ''}" href="#/"${dashboard ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="#projects"', `class="side-link${activePage === 'Projects' ? ' active' : ''}" href="#/projects"${activePage === 'Projects' ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="#training-progress"', `class="side-link${activePage === 'Training Plans' ? ' active' : ''}" href="#/training-plans"${activePage === 'Training Plans' ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="#batch-status"', `class="side-link${activePage === 'Batches' ? ' active' : ''}" href="#/batches"${activePage === 'Batches' ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="#attendance"', `class="side-link${activePage === 'Attendance' ? ' active' : ''}" href="#/attendance"${activePage === 'Attendance' ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="Attendance.html"', `class="side-link${activePage === 'Attendance' ? ' active' : ''}" href="#/attendance"${activePage === 'Attendance' ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="ContentLibrary.html"', `class="side-link${activePage === 'Content Library' ? ' active' : ''}" href="#/content-library"${activePage === 'Content Library' ? ' aria-current="page"' : ''}`);
  html = html.replace('</nav>', `<a class="side-link${activePage === 'Trainer Directory' ? ' active' : ''}" href="#/trainers"${activePage === 'Trainer Directory' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 20c.4-3.5 2.2-5.3 5.5-5.3s5.1 1.8 5.5 5.3M16 7h5m-5 4h5m-5 4h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Trainer Directory</span></a><a class="side-link${activePage === 'Uploaded Documents' ? ' active' : ''}" href="#/trainer-evidence"${activePage === 'Uploaded Documents' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 0v5h5M8 12h7m-7 3h4m1 3 2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Uploaded Documents</span></a><a class="side-link${activePage === 'Upload Documents' ? ' active' : ''}" href="#/upload-documents"${activePage === 'Upload Documents' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Upload Documents</span></a><a class="side-link${activePage === 'Holiday Master' ? ' active' : ''}" href="#/holiday-master"${activePage === 'Holiday Master' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M7.5 3v4m9-4v4m-13 2h17M8 13h3m2 0h3m-8 4h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Holiday Master</span></a></nav>`);
  html = html.replace('href="#effectiveness">Feedback Report</a>', 'href="#/reports/assessment-feedback">Assessment &amp; Feedback Report</a>');
  html = html.replace('href="#/reports/assessment-feedback">Assessment &amp; Feedback Report</a>', 'href="#/reports/assessment-feedback">Assessment &amp; Feedback Report</a><a href="#/reports/participant-feedback">Participant Wise Feedback Report</a>');
  const reportLinks: Record<string, string> = { 'Batch Performance': '#/reports/batch-performance', 'Training Summary': '#/reports/training-summary', 'Attendance Report': '#/reports/attendance-report', 'Assessment & Feedback Report': '#/reports/assessment-feedback', 'Participant Wise Feedback Report': '#/reports/participant-feedback' };
  for (const [label, href] of Object.entries(reportLinks)) {
    const fileName = label === 'Batch Performance' ? 'Batch_performance.html' : label === 'Training Summary' ? 'Training_Summary.html' : label === 'Attendance Report' ? 'Attendance_Report.html' : '';
    if (fileName) html = html.replace(`href="${fileName}"`, `href="${href}"${activePage === label ? ' aria-current="page"' : ''}`);
  }
  if (activePage in reportLinks) html = html.replace('<summary class="side-link">', '<summary class="side-link active">');
  const menuByLabel: Record<string, MenuKey> = {
    Dashboard: 'dashboard', Projects: 'projects', 'Training Plans': 'training-plans', Batches: 'batches',
    Attendance: 'attendance', 'Content Library': 'content-library', Assessments: 'assessments',
    Certificates: 'certificates', 'MIS Reports': 'mis-reports', 'Holiday Master': 'holiday-master', 'Trainer Directory': 'trainer-repository', 'Uploaded Documents': 'trainer-evidence', 'Upload Documents': 'upload-documents',
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
    certificatesLink.href = '#/certificates';
    if (activePage === 'Certificates') { certificatesLink.classList.add('active'); certificatesLink.setAttribute('aria-current', 'page'); }
  }
  const assessmentsLink = [...sidebarDocument.querySelectorAll<HTMLAnchorElement>('.side-nav > .side-link')].find(link => link.textContent?.trim() === 'Assessments');
  if (assessmentsLink) {
    assessmentsLink.href = '#/assessments';
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
      if (!submenu || !summary) return;
      const mobile = window.matchMedia('(max-width: 620px)').matches;
      const collapsedDesktop = !mobile && window.innerWidth > 900 && group.closest('.app')?.classList.contains('is-collapsed');
      if (collapsedDesktop) {
        const hoveredOrFocused = group.matches(':hover') || group.contains(document.activeElement);
        if (!hoveredOrFocused) {
          submenu.style.removeProperty('--submenu-left');
          submenu.style.removeProperty('--submenu-top');
          return;
        }
        const width = Math.min(230, window.innerWidth - 16);
        const rect = summary.getBoundingClientRect();
        const height = Math.min(submenu.scrollHeight, window.innerHeight - 16);
        const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right + 8));
        const top = Math.max(8, Math.min(window.innerHeight - height - 8, rect.top));
        submenu.style.setProperty('--submenu-left', `${left}px`);
        submenu.style.setProperty('--submenu-top', `${top}px`);
        return;
      }
      if (!mobile || !group.open) {
        submenu.style.removeProperty('--submenu-left');
        submenu.style.removeProperty('--submenu-top');
        return;
      }
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
        groups().forEach(placeSubmenu);
        return;
      }
      const link = event.target.closest<HTMLAnchorElement>('.sidebar .side-submenu a');
      if (!link) return;
      const group = link.closest<HTMLDetailsElement>('.side-group');
      if (group) {
        group.open = false;
        group.querySelector<HTMLElement>('.side-submenu')?.style.removeProperty('--submenu-left');
        group.querySelector<HTMLElement>('.side-submenu')?.style.removeProperty('--submenu-top');
      }
    };
    const onGroupPointerEnter = (event: Event) => placeSubmenu(event.currentTarget as HTMLDetailsElement);
    const onGroupPointerLeave = (event: Event) => placeSubmenu(event.currentTarget as HTMLDetailsElement);
    const onGroupFocusChange = (event: Event) => placeSubmenu(event.currentTarget as HTMLDetailsElement);
    const sideGroups = groups();
    sideGroups.forEach(group => {
      group.addEventListener('pointerenter', onGroupPointerEnter);
      group.addEventListener('pointerleave', onGroupPointerLeave);
      group.addEventListener('focusin', onGroupFocusChange);
      group.addEventListener('focusout', onGroupFocusChange);
    });
    const onLayoutChange = () => groups().forEach(placeSubmenu);
    const sidebar = document.querySelector('.sidebar');
    document.addEventListener('toggle', onToggle, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('resize', onLayoutChange);
    sidebar?.addEventListener('scroll', onLayoutChange, { passive: true });
    return () => {
      document.removeEventListener('toggle', onToggle, true);
      document.removeEventListener('click', onClick, true);
      sideGroups.forEach(group => {
        group.removeEventListener('pointerenter', onGroupPointerEnter);
        group.removeEventListener('pointerleave', onGroupPointerLeave);
        group.removeEventListener('focusin', onGroupFocusChange);
        group.removeEventListener('focusout', onGroupFocusChange);
      });
      window.removeEventListener('resize', syncResponsiveCollapse);
      window.removeEventListener('resize', onLayoutChange);
      sidebar?.removeEventListener('scroll', onLayoutChange);
    };
  }, []);
  return <Markup html={html} />;
}
export function Topbar({ title = 'Dashboard', logoSrc }: { title?: string; description?: string; logoSrc?: string }) {
  const dispatch = useDispatch<AppDispatch>();
  const audience = useSelector((state: RootState) => state.dashboard.audience);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => window.localStorage.getItem('teacher-training-theme') === 'dark' ? 'dark' : 'light');
  const [fontScale, setFontScale] = useState(readFontScale);
  const session = getSession();
  const roleLabel = session ? session.userId.toLowerCase() === 'demo1' && session.role === 'sponsor-admin' ? 'Ernet Admin' : ROLE_LABELS[session.role] : 'Guest';
  const ernetLogin = session?.role === 'sponsor-admin';
  const initials = roleLabel.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const heading = logoSrc ? `<h1><img src="${logoSrc}" alt="${title}" style="display:block;max-width:190px;max-height:48px;object-fit:contain" /></h1>` : `<h1>${title}</h1>`;
  const audienceToggle = ernetLogin ? '<div class="audience-switch topbar-audience-switch" role="group" aria-label="Dashboard audience"><button class="audience-button topbar-audience-button" type="button" data-audience="Teacher" aria-pressed="false">Teacher</button><button class="audience-button topbar-audience-button" type="button" data-audience="Student" aria-pressed="false">Student</button></div>' : '';
  const html = topbarMarkup.replace('<h1>Dashboard</h1>', heading).replace('<div class="top-actions">', `<div class="top-actions">${audienceToggle}`)
    .replace('aria-label="Project Sponsor account"', `aria-label="${roleLabel} account"`)
    .replace('<span class="avatar">PS</span><span>Project Sponsor</span>', `<span class="avatar">${initials}</span><span>${roleLabel}</span>`);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [accessibilityAnchor, setAccessibilityAnchor] = useState<HTMLElement | null>(null);
  const [accessibility, setAccessibility] = useState<{ contrast: 'normal' | 'high'; textSpacing: boolean; lineHeight: boolean; hideImages: boolean; bigCursor: boolean }>(() => {
    const defaults = { contrast: 'normal' as 'normal' | 'high', textSpacing: false, lineHeight: false, hideImages: false, bigCursor: false };
    try { return { ...defaults, ...JSON.parse(window.localStorage.getItem('teacher-training-accessibility') ?? '{}') }; } catch { return defaults; }
  });
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const updateFontScale = (action: 'increase' | 'decrease' | 'reset') => {
    const current = readFontScale();
    const next = action === 'reset' ? DEFAULT_FONT_SCALE : action === 'increase' ? current + 0.1 : current - 0.1;
    setFontScale(applyFontScale(next));
  };
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
    if (!ernetLogin) return;
    document.querySelectorAll<HTMLButtonElement>('.topbar-audience-button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.audience === audience));
    });
  }, [audience, ernetLogin]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accessibilityContrast = accessibility.contrast;
    root.classList.toggle('a11y-text-spacing', accessibility.textSpacing);
    root.classList.toggle('a11y-line-height', accessibility.lineHeight);
    root.classList.toggle('a11y-hide-images', accessibility.hideImages);
    root.classList.toggle('a11y-big-cursor', accessibility.bigCursor);
    window.localStorage.setItem('teacher-training-accessibility', JSON.stringify(accessibility));
  }, [accessibility]);
  useEffect(() => {
    const onNotificationClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const audienceButton = target.closest<HTMLButtonElement>('.topbar-audience-button');
      const accessibilityButton = target.closest<HTMLButtonElement>('#accessibility-tools-button');
      const button = target.closest<HTMLElement>('#notifications');
      const profileButton = target.closest<HTMLElement>('#profile-button');
      if (audienceButton && ernetLogin) {
        const nextAudience = audienceButton.dataset.audience;
        if (nextAudience === 'Teacher' || nextAudience === 'Student') {
          event.stopPropagation();
          dispatch(setAudience(nextAudience));
          dispatch(setPhase(nextAudience === 'Teacher' ? 3 : 1));
        }
      }
      else if (accessibilityButton) { event.stopPropagation(); setAccessibilityAnchor(current => current ? null : accessibilityButton); setAnchor(null); setProfileAnchor(null); }
      else if (button) { event.stopPropagation(); setAnchor(current => current ? null : button); setProfileAnchor(null); }
      else if (profileButton) { event.stopPropagation(); setProfileAnchor(current => current ? null : profileButton); setAnchor(null); }
    };
    document.addEventListener('click', onNotificationClick, true);
    return () => document.removeEventListener('click', onNotificationClick, true);
  }, []);
  const accessButton = '<button class="icon-button accessibility-tools-trigger" type="button" id="accessibility-tools-button" aria-label="Open Accessibility Tools" aria-haspopup="dialog" title="Accessibility Tools"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="7.5" r="1.5" fill="currentColor"/><path d="M5.5 10h13M12 10v9m0-9-4 5m4-5 4 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
  const topbarWithAccess = html.replace('<button class="icon-button notification"', `${accessButton}<button class="icon-button notification"`);
  const setA11y = (key: keyof typeof accessibility, value: boolean | 'normal' | 'high') => setAccessibility(current => ({ ...current, [key]: value }));
  const changeAccessibilityText = updateFontScale;
  const topbarWithA11y = topbarWithAccess;
  return <><Markup html={topbarWithA11y} /><Popover open={Boolean(accessibilityAnchor)} anchorEl={accessibilityAnchor} onClose={() => setAccessibilityAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} marginThreshold={12} PaperProps={{ role: 'dialog', 'aria-labelledby': 'accessibility-tools-title', sx: { width: { xs: 'min(330px, calc(100vw - 24px))', sm: 330 }, maxHeight: 'calc(100vh - 64px)', overflowY: 'auto', p: 1.25, border: '1px solid #dce4ec', borderRadius: 2.5, bgcolor: 'background.paper', boxShadow: '0 12px 36px #142a3f26', '& button': { fontSize: '0.8125rem' } } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}><Typography id="accessibility-tools-title" variant="h6" sx={{ fontSize: 16, fontWeight: 650 }}>Accessibility Tools</Typography><IconButton aria-label="Close Accessibility Tools" size="small" onClick={() => setAccessibilityAnchor(null)}>×</IconButton></Box>
    <Typography component="h2" sx={{ mt: 1, pb: 0.4, borderBottom: '1px solid', borderColor: 'text.primary', fontSize: 14, fontWeight: 700 }}>Contrast Adjustment</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.5, mt: 0.75 }}>
      {([{ key: 'high', label: 'High Contrast', icon: '◐' }, { key: 'normal', label: 'Normal', icon: '☼' }] as const).map(item => <Box key={item.key} component="button" type="button" aria-pressed={accessibility.contrast === item.key} onClick={() => setA11y('contrast', item.key)} sx={{ minHeight: 58, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 0.25, border: '1px solid', borderColor: accessibility.contrast === item.key ? '#e53b48' : '#dce4ec', borderRadius: 2, bgcolor: 'transparent', color: 'text.primary', font: 'inherit', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}><Box component="span" aria-hidden="true" sx={{ fontSize: 23, lineHeight: 1 }}>{item.icon}</Box><Box component="span">{item.label}</Box></Box>)}
    </Box>
    <Typography component="h2" sx={{ mt: 1, pb: 0.4, borderBottom: '1px solid', borderColor: 'text.primary', fontSize: 14, fontWeight: 700 }}>Themes</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.5, mt: 0.75 }}>
      {([{ mode: 'light', label: 'Light', icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg> }, { mode: 'dark', label: 'Dark', icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg> }] as const).map(item => <Box key={item.mode} component="button" type="button" aria-pressed={theme === item.mode} onClick={() => setTheme(item.mode)} sx={{ minHeight: 58, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 0.25, border: '1px solid', borderColor: theme === item.mode ? '#176fba' : '#dce4ec', borderRadius: 2, bgcolor: theme === item.mode ? 'action.selected' : 'transparent', color: 'text.primary', font: 'inherit', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}><Box component="span" aria-hidden="true" sx={{ display: 'grid', placeItems: 'center' }}>{item.icon}</Box><Box component="span">{item.label}</Box></Box>)}
    </Box>
    <Typography component="h2" sx={{ mt: 1, pb: 0.4, borderBottom: '1px solid', borderColor: 'text.primary', fontSize: 14, fontWeight: 700 }}>Text Size</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.5, mt: 0.75 }}>
      {([{ action: 'increase', label: 'Increase Text' }, { action: 'decrease', label: 'Decrease Text' }, { action: 'reset', label: 'Reset Text' }] as const).map(item => <Box key={item.action} component="button" type="button" disabled={item.action === 'increase' ? fontScale >= MAX_FONT_SCALE : item.action === 'decrease' ? fontScale <= MIN_FONT_SCALE : false} onClick={() => changeAccessibilityText(item.action)} sx={{ minHeight: 58, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 0.35, border: '1px solid #dce4ec', borderRadius: 2, bgcolor: 'transparent', color: 'text.primary', font: 'inherit', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:disabled': { cursor: 'default', opacity: 0.45 } }}><Box component="span" aria-hidden="true" sx={{ display: 'grid', placeItems: 'center', width: 22, height: 22, fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{item.action === 'reset' ? <svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M20 11a8 8 0 1 0 1 4M20 4v7h-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 16l2-6h1l2 6m-4-2h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> : <svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M3 19 8 5h2l5 14M5 14h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d={item.action === 'increase' ? 'M18 13V5m-3 3 3-3 3 3' : 'M18 5v8m-3-3 3 3 3-3'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}</Box><Box component="span">{item.label}</Box></Box>)}
      {([{ key: 'textSpacing', label: 'Text Spacing', icon: 'T↔' }, { key: 'lineHeight', label: 'Line Height', icon: '↕' }] as const).map(item => <Box key={item.key} component="button" type="button" aria-pressed={accessibility[item.key]} onClick={() => setA11y(item.key, !accessibility[item.key])} sx={{ minHeight: 58, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 0.35, border: '1px solid', borderColor: accessibility[item.key] ? '#176fba' : '#dce4ec', borderRadius: 2, bgcolor: accessibility[item.key] ? 'action.selected' : 'transparent', color: 'text.primary', font: 'inherit', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}><Box component="span" aria-hidden="true" sx={{ fontSize: 23, lineHeight: 1 }}>{item.icon}</Box><Box component="span">{item.label}</Box></Box>)}
    </Box>
    <Typography component="h2" sx={{ mt: 1, pb: 0.4, borderBottom: '1px solid', borderColor: 'text.primary', fontSize: 14, fontWeight: 700 }}>Others</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.5, mt: 0.75 }}>
      {([{ key: 'hideImages', label: accessibility.hideImages ? 'Show Images' : 'Hide Images', icon: '▧' }, { key: 'bigCursor', label: 'Big Cursor', icon: '➤' }] as const).map(item => <Box key={item.key} component="button" type="button" aria-pressed={accessibility[item.key]} onClick={() => setA11y(item.key, !accessibility[item.key])} sx={{ minHeight: 58, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 0.35, border: '1px solid', borderColor: accessibility[item.key] ? '#176fba' : '#dce4ec', borderRadius: 2, bgcolor: accessibility[item.key] ? 'action.selected' : 'transparent', color: 'text.primary', font: 'inherit', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}><Box component="span" aria-hidden="true" sx={{ fontSize: 23, lineHeight: 1 }}>{item.icon}</Box><Box component="span">{item.label}</Box></Box>)}
    </Box>
  </Popover><Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
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
  </Popover><Popover open={Boolean(profileAnchor)} anchorEl={profileAnchor} onClose={() => setProfileAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} marginThreshold={12}>
    <Box sx={{ width: 230, p: 1 }}>
      <Box sx={{ px: 1.25, py: 1 }}><Typography variant="body2" sx={{ fontWeight: 750, color: '#12365c' }}>{roleLabel}</Typography><Typography variant="caption" sx={{ display: 'block', color: '#71839a' }}>User ID: {session?.userId ?? 'Not signed in'}</Typography><Typography variant="caption" sx={{ color: '#71839a' }}>Last login: {lastLogin ? formatDateTime(lastLogin) : 'First visit on this device'}</Typography></Box>
      <Box component="button" type="button" onClick={() => { setProfileAnchor(null); setProfileOpen(true); }} sx={{ display: 'block', width: '100%', px: 1.25, py: 1, border: 0, borderRadius: 1, bgcolor: 'transparent', color: '#244765', textAlign: 'left', cursor: 'pointer', '&:hover': { bgcolor: '#f2f6fa' } }}>My Profile</Box>
      <Box component="button" type="button" onClick={() => { setProfileAnchor(null); signOut(); window.localStorage.removeItem('teacher-training-last-login'); window.location.assign(`${import.meta.env.BASE_URL}#/login`); }} sx={{ display: 'block', width: '100%', px: 1.25, py: 1, border: 0, borderRadius: 1, bgcolor: 'transparent', color: '#a33a3a', textAlign: 'left', cursor: 'pointer', '&:hover': { bgcolor: '#fff4f4' } }}>Logout</Box>
    </Box>
  </Popover><Dialog open={profileOpen} onClose={() => setProfileOpen(false)} PaperProps={{ sx: { width: 'min(400px, calc(100vw - 32px))', p: 2.5, borderRadius: 2 } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 750, color: '#12365c' }}>My Profile</Typography><IconButton aria-label="Close profile" onClick={() => setProfileOpen(false)}>×</IconButton></Box>
    <Box sx={{ display: 'grid', gap: 1.25, mt: 1 }}>
      <Box><Typography variant="caption" sx={{ color: '#71839a' }}>User ID</Typography><Typography variant="body2" sx={{ fontWeight: 650, color: '#244765' }}>{session?.userId ?? 'Not signed in'}</Typography></Box>
      <Box><Typography variant="caption" sx={{ color: '#71839a' }}>Role</Typography><Typography variant="body2" sx={{ fontWeight: 650, color: '#244765' }}>{roleLabel}</Typography></Box>
      <Box><Typography variant="caption" sx={{ color: '#71839a' }}>Last login</Typography><Typography variant="body2" sx={{ fontWeight: 650 }}>{lastLogin ? formatDateTime(lastLogin) : 'First visit on this device'}</Typography></Box>
    </Box>
  </Dialog></>;
}
export function Footer() { return <footer className="page-footer">© Schoolnet India Limited</footer>; }
const studentModules = [
  'Cyber Safety and Digital Responsibility',
  'Digital Creativity',
  'AI Awareness',
];
const teacherDashboardMarkup = dashboardMarkup.replace(/<div class="audience-switch"[\s\S]*?<\/div>/, '').replace(
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
).replace(/<span class="counter-icon">[\s\S]*?<\/span>/g, '');

export function DashboardContent() {
  const audience = useSelector((state: RootState) => state.dashboard.audience);
  const effectiveAudience = getSession()?.role === 'sponsor-admin' ? audience : 'Teacher';
  useEffect(() => {
    const teacherOverview = document.querySelector<HTMLElement>('.main .phase-overview:not(.student-overview)');
    const studentOverview = document.querySelector<HTMLElement>('.main .student-overview');
    if (teacherOverview) teacherOverview.hidden = effectiveAudience === 'Student';
    if (studentOverview) {
      studentOverview.hidden = effectiveAudience === 'Teacher';
      studentOverview.setAttribute('aria-hidden', String(effectiveAudience === 'Teacher'));
    }
  }, [effectiveAudience]);
  return <Markup html={dashboardWithStudentOverview} />;
}
export function DashboardModals() { return <Markup html={modalMarkup} />; }

export function DashboardBridge() {
  const dispatch = useDispatch<AppDispatch>();
  const audience = useSelector((state: RootState) => state.dashboard.audience);
  const selectedPhase = useSelector((state: RootState) => state.dashboard.selectedPhase);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dashboard-audience-change', { detail: audience }));
  }, [audience]);
  useEffect(() => {
    window.KGBV_SCHOOLS = kgbvSchools;
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}legacy-dashboard.js`;
    script.async = false;
    const syncPhase = () => window.dispatchEvent(new CustomEvent('dashboard-phase-change', { detail: store.getState().dashboard.selectedPhase }));
    script.addEventListener('load', syncPhase);
    document.body.appendChild(script);
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
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
      script.removeEventListener('load', syncPhase);
      script.remove();
      delete window.KGBV_SCHOOLS;
    };
  }, [dispatch]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dashboard-phase-change', { detail: selectedPhase }));
  }, [selectedPhase]);
  return null;
}
