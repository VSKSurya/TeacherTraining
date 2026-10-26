import './styles.css';
import './content-library.css';
import './reports/reports.css';
import './theme.css';
import './holiday-master.css';
import './projects.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import DashboardApp from './App';
import { seedDemoSampleData } from './demoSampleData';

seedDemoSampleData();
createRoot(document.getElementById('root')!).render(<DashboardApp />);
