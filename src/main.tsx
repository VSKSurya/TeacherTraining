import './styles.css';
import './content-library.css';
import './reports/reports.css';
import './theme.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import DashboardApp from './App';

createRoot(document.getElementById('root')!).render(<DashboardApp />);
