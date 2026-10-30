import './styles.css';
import './content-library.css';
import './reports/reports.css';
import './theme.css';
import './font-scale.css';
import './display-fixes.css';
import './holiday-master.css';
import './compliance.css';
import './projects.css';
import './certificate.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import DashboardApp from './App';
import { seedDemoSampleData } from './demoSampleData';
import { standardizeStoredBatchCodes } from './batchCodes';
import { applyFontScale, readFontScale } from './fontScale';

try { document.documentElement.dataset.theme = window.localStorage.getItem('teacher-training-theme') === 'dark' ? 'dark' : 'light'; } catch { document.documentElement.dataset.theme = 'light'; }
applyFontScale(readFontScale());
seedDemoSampleData();
standardizeStoredBatchCodes();
createRoot(document.getElementById('root')!).render(<DashboardApp />);
