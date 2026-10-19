import { useEffect } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Provider, useSelector } from 'react-redux';
import { store, type RootState } from './store';
import { Sidebar, Topbar, Footer, DashboardContent, DashboardModals, DashboardBridge } from './components/DashboardParts';
import ContentLibrary from './ContentLibrary';
import { Reports } from './reports/Reports';

const theme = createTheme({
  palette: { primary: { main: '#176fba' }, background: { default: '#f4f7fb', paper: '#ffffff' }, text: { primary: '#173553', secondary: '#71839a' } },
  typography: { fontFamily: 'Poppins, "Segoe UI", Arial, sans-serif' },
  components: { MuiCssBaseline: { styleOverrides: { body: { minWidth: 320, fontSize: 13 } } } },
});
function DashboardFrame() {
  const { audience, selectedPhase, sidebarCollapsed, filters } = useSelector((state: RootState) => state.dashboard);
  useEffect(() => { document.body.classList.add('react-dashboard'); return () => document.body.classList.remove('react-dashboard'); }, []);
  return <ThemeProvider theme={theme}><CssBaseline /><div className="app" data-audience={audience} data-selected-phase={selectedPhase ?? ''} data-sidebar-collapsed={sidebarCollapsed} data-active-filters={Object.values(filters).filter(Boolean).length}><Sidebar /><main className="main" id="overview"><Topbar /><DashboardContent /><Footer /></main></div><DashboardModals /><DashboardBridge /></ThemeProvider>;
}
function AppContent() {
  const path = window.location.pathname.replace(/\/$/, '');
  if (path === '/content-library') return <ContentLibrary />;
  if (path.startsWith('/reports/')) return <Reports report={path.slice('/reports/'.length)} />;
  return <DashboardFrame />;
}
function DashboardApp() { return <Provider store={store}><AppContent /></Provider>; }
export default DashboardApp;
