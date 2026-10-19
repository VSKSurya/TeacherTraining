import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { setAudience, setFilter, setPhase, setSidebarCollapsed, clearFilters } from '../store';
import { sidebarMarkup, topbarMarkup, dashboardMarkup, modalMarkup } from '../sourceMarkup';

function Markup({ html, className }: { html: string; className?: string }) {
  const baseAwareHtml = html.replace(/\b(src|href)="\/(?!\/)/g, (_match, attribute: string) => `${attribute}="${import.meta.env.BASE_URL}`);
  return <div className={`component-markup ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: baseAwareHtml }} />;
}
export type AppPage = 'Dashboard' | 'Content Library' | 'Batch Performance' | 'Training Summary' | 'Attendance Report';
export function Sidebar({ activePage = 'Dashboard' }: { activePage?: AppPage }) {
  const dashboard = activePage === 'Dashboard';
  let html = sidebarMarkup
    .replace('class="side-link active" href="#overview" aria-current="page"', `class="side-link${dashboard ? ' active' : ''}" href="/"${dashboard ? ' aria-current="page"' : ''}`)
    .replace('class="side-link" href="ContentLibrary.html"', `class="side-link${activePage === 'Content Library' ? ' active' : ''}" href="/content-library"${activePage === 'Content Library' ? ' aria-current="page"' : ''}`);
  const reportLinks: Record<string, string> = { 'Batch Performance': '/reports/batch-performance', 'Training Summary': '/reports/training-summary', 'Attendance Report': '/reports/attendance-report' };
  for (const [label, href] of Object.entries(reportLinks)) {
    const fileName = label === 'Batch Performance' ? 'Batch_performance.html' : label === 'Training Summary' ? 'Training_Summary.html' : 'Attendance_Report.html';
    html = html.replace(`href="${fileName}"`, `href="${href}"${activePage === label ? ' aria-current="page"' : ''}`);
  }
  if (activePage in reportLinks) html = html.replace('<details class="side-group">', '<details class="side-group" open>').replace('<summary class="side-link">', '<summary class="side-link active">');
  return <Markup html={html} />;
}
export function Topbar({ title = 'Dashboard' }: { title?: string; description?: string }) {
  const html = topbarMarkup.replace('<h1>Dashboard</h1>', `<h1>${title}</h1>`);
  return <Markup html={html} />;
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

