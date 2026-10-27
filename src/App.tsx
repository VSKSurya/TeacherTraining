import { useEffect } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Provider, useSelector } from 'react-redux';
import { store, type RootState } from './store';
import { Sidebar, Topbar, Footer, DashboardContent, DashboardModals, DashboardBridge } from './components/DashboardParts';
import ContentLibrary from './ContentLibrary';
import { Reports } from './reports/Reports';
import Login from './Login';
import HolidayMaster from './HolidayMaster';
import Projects from './Projects';
import TrainingPlanPage from './components/TrainingPlan';
import Batches from './components/Batches';
import Attendance from './components/Attendance';
import SchoolnetDashboard from './components/SchoolnetDashboard';
import StateAdminDashboard from './components/StateAdminDashboard';
import SchoolAdminDashboard from './components/SchoolAdminDashboard';
import TrainerDashboard from './components/TrainerDashboard';
import TraineeDashboard from './components/TraineeDashboard';
import OpenRegistration from './components/OpenRegistration';
import RegistrationRequests from './components/RegistrationRequests';
import RecoverTraineeId from './components/RecoverTraineeId';
import TrainerRepository from './components/TrainerRepository';
import AssessmentFeedback from './components/AssessmentFeedback';
import CertificateTemplates from './components/CertificateTemplates';
import { canAccessRoute, getSession, ROLE_LABELS } from './auth';

const theme = createTheme({
  palette: { primary: { main: '#176fba' }, background: { default: '#f4f7fb', paper: '#ffffff' }, text: { primary: '#173553', secondary: '#71839a' } },
  typography: { fontFamily: 'Poppins, "Segoe UI", Arial, sans-serif' },
  components: { MuiCssBaseline: { styleOverrides: { body: { minWidth: 320, fontSize: 13 } } } },
});
function DashboardFrame() {
  const { audience, selectedPhase, sidebarCollapsed, filters } = useSelector((state: RootState) => state.dashboard);
  const session = getSession();
  useEffect(() => { document.body.classList.add('react-dashboard'); return () => document.body.classList.remove('react-dashboard'); }, []);
  if (session?.role === 'schoolnet-super-admin' || session?.role === 'schoolnet-project-admin') return <ThemeProvider theme={theme}><CssBaseline /><SchoolnetDashboard /></ThemeProvider>;
  if (session?.role === 'state-admin') return <ThemeProvider theme={theme}><CssBaseline /><StateAdminDashboard /></ThemeProvider>;
  if (session?.role === 'school-admin') return <ThemeProvider theme={theme}><CssBaseline /><SchoolAdminDashboard /></ThemeProvider>;
  if (session?.role === 'trainer') return <ThemeProvider theme={theme}><CssBaseline /><TrainerDashboard /></ThemeProvider>;
  if (session?.role === 'trainee') return <ThemeProvider theme={theme}><CssBaseline /><TraineeDashboard /></ThemeProvider>;
  return <ThemeProvider theme={theme}><CssBaseline /><div className="app" data-audience={audience} data-selected-phase={selectedPhase ?? ''} data-sidebar-collapsed={sidebarCollapsed} data-active-filters={Object.values(filters).filter(Boolean).length}><Sidebar /><main className="main" id="overview"><Topbar /><DashboardContent /><Footer /></main></div><DashboardModals /><DashboardBridge /></ThemeProvider>;
}
function AppContent() {
  const basePath = import.meta.env.BASE_URL;
  const pathname = window.location.pathname;
  const path = (pathname.startsWith(basePath) ? `/${pathname.slice(basePath.length)}` : pathname).replace(/\/$/, '');
  const session = getSession();
  useEffect(() => {
    const pages: Record<string, string> = {
      '/login': 'Sign in', '/register': 'Open Registration', '/recover-trainee': 'Recover Trainee ID',
      '/projects': 'Projects', '/training-plans': 'Training Plans', '/batches': 'Batches',
      '/registration-requests': 'Registration Requests', '/trainers': 'Trainer Repository',
      '/attendance': 'Daily Attendance', '/holiday-master': 'Holiday Master',
      '/content-library': 'Learning Library', '/assessments': 'Assessments and Feedback',
      '/certificates': 'Certificate Templates',
      '/reports/batch-performance': 'Batch Performance', '/reports/training-summary': 'Training Summary',
      '/reports/attendance-report': 'Attendance Report', '/reports/assessment-feedback': 'Assessment and Feedback Report',
    };
    const role = session ? ROLE_LABELS[session.role] : '';
    const page = pages[path] ?? 'Dashboard';
    const title = session ? `${role} · ${page} · ${session.userId} | Schoolnet` : `${page} | Schoolnet`;
    const roleDescription = session ? `Signed in as ${session.userId}, ${role}. Access the Schoolnet teacher training portal.` : 'Schoolnet teacher training portal for projects, training plans, batches, learning resources, and registration.';
    document.title = title;
    const updateMeta = (selector: string, attribute: string, value: string, create: () => HTMLMetaElement) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) { element = create(); document.head.appendChild(element); }
      element.setAttribute(attribute, value);
    };
    updateMeta('meta[name="description"]', 'content', roleDescription, () => { const meta = document.createElement('meta'); meta.name = 'description'; return meta; });
    updateMeta('meta[name="application-name"]', 'content', session ? `Schoolnet ${role}` : 'Schoolnet Teacher Training', () => { const meta = document.createElement('meta'); meta.name = 'application-name'; return meta; });
    updateMeta('meta[property="og:title"]', 'content', title, () => { const meta = document.createElement('meta'); meta.setAttribute('property', 'og:title'); return meta; });
    updateMeta('meta[property="og:description"]', 'content', roleDescription, () => { const meta = document.createElement('meta'); meta.setAttribute('property', 'og:description'); return meta; });
  }, [path, session?.userId, session?.role]);
  if (path === '/login') return <Login />;
  if (path === '/register') return <OpenRegistration />;
  if (path === '/recover-trainee') return <RecoverTraineeId />;
  if (!session) return <Login />;
  if (!canAccessRoute(session.role, path)) return <DashboardFrame />;
  if (path === '/projects') return <Projects />;
  if (path === '/training-plans') return <TrainingPlanPage />;
  if (path === '/batches') return <Batches />;
  if (path === '/registration-requests') return <RegistrationRequests />;
  if (path === '/trainers') return <TrainerRepository />;
  if (path === '/attendance') return <Attendance />;
  if (path === '/holiday-master') return <HolidayMaster />;
  if (path === '/content-library') return <ContentLibrary />;
  if (path === '/assessments') return <AssessmentFeedback />;
  if (path === '/certificates') return <CertificateTemplates />;
  if (path.startsWith('/reports/')) return <Reports report={path.slice('/reports/'.length)} />;
  return <DashboardFrame />;
}
function DashboardApp() { return <Provider store={store}><AppContent /></Provider>; }
export default DashboardApp;
