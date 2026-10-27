import { useEffect, useMemo, useState } from 'react';
import { Box, Dialog, IconButton, Snackbar } from '@mui/material';
import { batchRecords, locations, statusNames, trainers, uniqueSorted, type BatchRecord } from '../data/reportData';
import { Sidebar, Topbar, Footer, type AppPage } from '../components/DashboardParts';
import { ReportFilterPanel, ReportPanel, ReportTable, type FilterSpec, type ReportFilters, type TableColumn } from './ReportComponents';
import AssessmentFeedbackReport from './AssessmentFeedbackReport';
import { ReportBarChart, ReportViewToggle, type ReportView } from './ReportCharts';

const reportMeta = {
  'batch-performance': { page: 'Batch Performance' as AppPage, title: 'Batch Performance', description: 'Review scheduled batches, attendance, and completion across the training plan.', heading: 'Batch performance details', note: '750 batch records from the Phasewise Dashboard. UDISE codes and end dates are not provided in that data.' },
  'training-summary': { page: 'Training Summary' as AppPage, title: 'Training Summary', description: 'Review trainee progress across training plans and locations.', heading: 'Training summary details', note: 'Figures use the 750 Phasewise Dashboard batches. Certified trainee data is not provided and is shown as -.' },
  'attendance-report': { page: 'Attendance Report' as AppPage, title: 'Attendance Report', description: 'Review participant attendance records across batches, locations, and training plans.', heading: 'Attendance details', note: 'Sample participant attendance entries are generated from Phasewise Dashboard rates for ongoing and completed batches; one training date is available per batch.' },
};
type ReportKey = keyof typeof reportMeta;
const REPORT_PAGE_SIZE = 10;
const emptyBatchFilters = { batch: '', udise: '', state: '', district: '', trainer: '', start: '', end: '', status: '', attendance: '' };
const emptySummaryFilters = { plan: '', state: '', district: '', trainer: '', start: '', to: '', status: '', attendance: '' };
const emptyAttendanceFilters = { plan: '', state: '', district: '', trainer: '', start: '', end: '', attendance: '' };
const stateOptions = locations.map(location => ({ label: location.name, value: location.name }));
const trainerOptions = trainers.map(name => ({ label: name, value: name }));
const statusOptions = statusNames.map(name => ({ label: name, value: name }));
const planOptions = uniqueSorted(batchRecords.map(row => row.plan)).map(plan => ({ label: plan, value: plan }));
const batchFilters: FilterSpec[] = [
  { key: 'batch', label: 'Batch ID', type: 'search', placeholder: 'Search batch ID' }, { key: 'udise', label: 'School UDISE', type: 'search', placeholder: 'Search UDISE' },
  { key: 'state', label: 'State', type: 'select', placeholder: 'All states', options: stateOptions }, { key: 'district', label: 'District', type: 'select', placeholder: 'All districts' },
  { key: 'trainer', label: 'Trainer Name', type: 'select', placeholder: 'All trainers', options: trainerOptions }, { key: 'start', label: 'Start Date', type: 'date' }, { key: 'end', label: 'End Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', placeholder: 'All statuses', options: statusOptions }, { key: 'attendance', label: 'Attendance', type: 'select', placeholder: 'Any attendance', options: [{ label: 'Less than 50%', value: 'lt-50' }, { label: 'Less than 75%', value: 'lt-75' }, { label: 'Less than 90%', value: 'lt-90' }, { label: '50% or higher', value: 'gte-50' }, { label: '75% or higher', value: 'gte-75' }, { label: '90% or higher', value: 'gte-90' }] },
];
const summaryFilters: FilterSpec[] = [
  { key: 'plan', label: 'Training Plan', type: 'select', placeholder: 'All training plans', options: uniqueSorted(batchRecords.map(row => row.plan.replace(' · ', ' - '))).map(v => ({ label: v, value: v })) },
  { key: 'state', label: 'State', type: 'select', placeholder: 'All states', options: stateOptions }, { key: 'district', label: 'District', type: 'select', placeholder: 'All districts' }, { key: 'trainer', label: 'Trainer Name', type: 'select', placeholder: 'All trainers', options: trainerOptions },
  { key: 'start', label: 'Start Date', type: 'date' }, { key: 'to', label: 'To Date', type: 'date' }, { key: 'status', label: 'Status', type: 'select', placeholder: 'All statuses', options: statusOptions },
  { key: 'attendance', label: 'Attendance', type: 'select', placeholder: 'Any attendance', options: [{ label: 'Less than 50%', value: 'lt-50' }, { label: 'Less than 75%', value: 'lt-75' }, { label: 'Less than 90%', value: 'lt-90' }, { label: '50% or higher', value: 'gte-50' }, { label: '75% or higher', value: 'gte-75' }, { label: '90% or higher', value: 'gte-90' }] },
];
const attendanceFilters: FilterSpec[] = [
  { key: 'plan', label: 'Training Plan', type: 'select', placeholder: 'All training plans', options: uniqueSorted(batchRecords.map(row => row.plan.replace(' · ', ' - '))).map(v => ({ label: v, value: v })) },
  { key: 'state', label: 'State', type: 'select', placeholder: 'All states', options: stateOptions }, { key: 'district', label: 'District', type: 'select', placeholder: 'All districts' }, { key: 'trainer', label: 'Trainer Name', type: 'select', placeholder: 'All trainers', options: trainerOptions },
  { key: 'start', label: 'Start Date', type: 'date' }, { key: 'end', label: 'End Date', type: 'date' },
  { key: 'attendance', label: 'Attendance (less than / greater than)', type: 'select', placeholder: 'Any attendance', options: [{ label: 'Less than 50%', value: 'lt-50' }, { label: 'Less than 75%', value: 'lt-75' }, { label: 'Less than 90%', value: 'lt-90' }, { label: 'Greater than 50%', value: 'gt-50' }, { label: 'Greater than 75%', value: 'gt-75' }, { label: 'Greater than 90%', value: 'gt-90' }] },
];
const localDay = (date: Date, end = false) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), end ? 23 : 0, end ? 59 : 0, end ? 59 : 0);
const attendanceMatch = (value: number, filter: string) => {
  const [operator, text] = filter.split('-'); if (!text) return true; const threshold = Number(text);
  if (operator === 'lt') return value < threshold;
  if (operator === 'gte') return value >= threshold;
  if (operator === 'gt') return value > threshold;
  return true;
};
const asPlanLabel = (plan: string) => plan.replace(' · ', ' - ');
const reportDistrictOptions = (state: string) => uniqueSorted(batchRecords.filter(row => !state || row.state === state).map(row => row.district)).map(district => ({ label: district, value: district }));

function ShellBehavior({ onToast }: { onToast: (text: string) => void }) {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('#notifications')) onToast('You’re all caught up on dashboard notifications.');
      else if (target.closest('#profile-button')) onToast('Signed in as Project Sponsor.');
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, [onToast]);
  return null;
}

function BatchPerformance() {
  const [filters, setFilters] = useState<ReportFilters>(emptyBatchFilters);
  const [view, setView] = useState<ReportView>('table');
  const [page, setPage] = useState(1);
  const districts = useMemo(() => reportDistrictOptions(filters.state), [filters.state]);
  const rows = useMemo(() => batchRecords.filter(row => {
    if (filters.batch && !row.batch.toLowerCase().includes(filters.batch.trim().toLowerCase())) return false;
    if (filters.udise && !row.udise.toLowerCase().includes(filters.udise.trim().toLowerCase())) return false;
    if (filters.state && row.state !== filters.state) return false;
    if (filters.district && row.district !== filters.district) return false;
    if (filters.trainer && row.trainer !== filters.trainer) return false;
    if (filters.start && row.startDate < new Date(`${filters.start}T00:00:00`)) return false;
    if (filters.end && (!row.endDate || row.endDate > new Date(`${filters.end}T23:59:59`))) return false;
    if (filters.status && row.status !== filters.status) return false;
    return attendanceMatch(row.attendance, filters.attendance);
  }), [filters]);
  const pages = Math.max(1, Math.ceil(rows.length / REPORT_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = rows.slice((currentPage - 1) * REPORT_PAGE_SIZE, currentPage * REPORT_PAGE_SIZE);
  const columns: TableColumn<BatchRecord>[] = [
    { key: 'batch', label: 'Batch ID' }, { key: 'udise', label: 'School UDISE' }, { key: 'school', label: 'School Name' }, { key: 'state', label: 'State' }, { key: 'district', label: 'District' }, { key: 'plan', label: 'Training Plan' }, { key: 'trainer', label: 'Trainer Name' }, { key: 'dateText', label: 'Start Date' }, { key: 'endDate', label: 'End Date', render: () => '—' }, { key: 'capacity', label: 'Batch Capacity' }, { key: 'registered', label: 'Registered' }, { key: 'attended', label: 'Attended' }, { key: 'completed', label: 'Completed' }, { key: 'attendance', label: 'Attendance %', render: row => `${row.attendance}%` }, { key: 'status', label: 'Status', render: row => <span className={`status ${row.status.toLowerCase()}`}>{row.status}</span> },
  ];
  const setValue = (key: string, value: string) => setFilters(previous => {
    const next = { ...previous, [key]: value };
    if (key === 'state' && next.district && !reportDistrictOptions(value).some(option => option.value === next.district)) next.district = '';
    return next;
  });
  const changeFilter = (key: string, value: string) => { setValue(key, value); setPage(1); };
  const clearFilters = () => { setFilters(emptyBatchFilters); setPage(1); };
  const statusColors = ['#8295a8', '#2386bd', '#16945b'];
  const statusSeries = statusNames.map((label, index) => ({ label, color: statusColors[index] }));
  const batchStatusRows = [{ label: 'Filtered batches', values: statusNames.map(status => rows.filter(row => row.status === status).length) }];
  const attendanceByStatus = statusNames.map(status => { const matching = rows.filter(row => row.status === status); return { label: status, values: [matching.length ? matching.reduce((sum, row) => sum + row.attendance, 0) / matching.length : 0] }; });
  return <ReportPage kind="batch-performance"><ReportFilterPanel fields={batchFilters.map(field => field.key === 'district' ? { ...field, options: districts } : field)} values={filters} onChange={changeFilter} onClear={clearFilters} onApply={() => setPage(1)} /><Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 1, md: 2 } }}><ReportViewToggle view={view} onChange={setView} /></Box>{view === 'graph' ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, px: { xs: 1, md: 2 } }}><ReportBarChart title="Batch status" description="Filtered batch count by delivery status" series={statusSeries} rows={batchStatusRows} chartType="pie" /><ReportBarChart title="Attendance by status" description="Average attendance percentage in each batch status" series={[{ label: 'Average attendance', color: '#176fba' }]} rows={attendanceByStatus} formatter={value => `${value.toFixed(1)}%`} chartType="cluster" /></Box> : <ReportPanel title="Batch performance details" description={reportMeta['batch-performance'].note} count={`${rows.length.toLocaleString()} of ${batchRecords.length.toLocaleString()} batches`}><ReportTable columns={columns} rows={pageRows} rowKey={row => row.batch} emptyMessage="No batches match these filters." tableClassName="batch-table" pagination={{ total: rows.length, page: currentPage, pageSize: REPORT_PAGE_SIZE, onPageChange: setPage }} /></ReportPanel>}</ReportPage>;
}

type SummaryRow = { plan: string; batches: number; planned: number; registered: number; started: number; completed: number; attendance: number; completion: number };
function TrainingSummary() {
  const [filters, setFilters] = useState<ReportFilters>(emptySummaryFilters);
  const [view, setView] = useState<ReportView>('table');
  const [page, setPage] = useState(1);
  const districts = useMemo(() => reportDistrictOptions(filters.state), [filters.state]);
  const rows = useMemo(() => {
    const source = batchRecords.filter(row => {
      if (filters.plan && asPlanLabel(row.plan) !== filters.plan) return false;
      if (filters.state && row.state !== filters.state) return false;
      if (filters.district && row.district !== filters.district) return false;
      if (filters.trainer && row.trainer !== filters.trainer) return false;
      if (filters.start && row.startDate < new Date(`${filters.start}T00:00:00`)) return false;
      if (filters.to && row.startDate > new Date(`${filters.to}T23:59:59`)) return false;
      if (filters.status && row.status !== filters.status) return false;
      return attendanceMatch(row.attendance, filters.attendance);
    });
    const grouped = new Map<string, SummaryRow>();
    for (const record of source) {
      const name = asPlanLabel(record.plan);
      const row = grouped.get(name) ?? { plan: name, batches: 0, planned: 0, registered: 0, started: 0, completed: 0, attendance: 0, completion: 0 };
      row.batches++; row.planned += record.registered; row.registered += record.registered;
      if (record.status !== 'Scheduled') row.started += record.registered;
      row.completed += record.completed; row.attendance += record.attended;
      grouped.set(name, row);
    }
    return [...grouped.values()].sort((a, b) => a.plan.localeCompare(b.plan)).map(row => ({ ...row, attendance: row.registered ? row.attendance / row.registered * 100 : 0, completion: row.planned ? row.completed / row.planned * 100 : 0 }));
  }, [filters]);
  const pages = Math.max(1, Math.ceil(rows.length / REPORT_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = rows.slice((currentPage - 1) * REPORT_PAGE_SIZE, currentPage * REPORT_PAGE_SIZE);
  const columns: TableColumn<SummaryRow>[] = [
    { key: 'plan', label: 'Training Plan' }, { key: 'batches', label: 'Total Batches' }, { key: 'planned', label: 'Planned Trainees', render: row => row.planned.toLocaleString() }, { key: 'registered', label: 'Registered', render: row => row.registered.toLocaleString() }, { key: 'started', label: 'Training Started', render: row => row.started.toLocaleString() }, { key: 'completed', label: 'Completed', render: row => row.completed.toLocaleString() }, { key: 'certified', label: 'Certified', render: () => '-' }, { key: 'attendance', label: 'Attendance %', render: row => `${row.attendance.toFixed(1)}%` }, { key: 'completion', label: 'Completion %', render: row => `${row.completion.toFixed(1)}%` },
  ];
  const setValue = (key: string, value: string) => setFilters(previous => {
    const next = { ...previous, [key]: value };
    if (key === 'state' && next.district && !reportDistrictOptions(value).some(option => option.value === next.district)) next.district = '';
    return next;
  });
  const changeFilter = (key: string, value: string) => { setValue(key, value); setPage(1); };
  const clearFilters = () => { setFilters(emptySummaryFilters); setPage(1); };
  const matchingBatches = batchRecords.filter(row => (!filters.plan || asPlanLabel(row.plan) === filters.plan) && (!filters.state || row.state === filters.state) && (!filters.district || row.district === filters.district) && (!filters.trainer || row.trainer === filters.trainer) && (!filters.start || row.startDate >= new Date(`${filters.start}T00:00:00`)) && (!filters.to || row.startDate <= new Date(`${filters.to}T23:59:59`)) && (!filters.status || row.status === filters.status) && attendanceMatch(row.attendance, filters.attendance)).length;
  const traineeSeries = [{ label: 'Planned', color: '#9bb1c5' }, { label: 'Registered', color: '#2584b9' }, { label: 'Completed', color: '#16945b' }];
  const traineeRows = rows.map(row => ({ label: row.plan, values: [row.planned, row.registered, row.completed] }));
  const rateRows = rows.map(row => ({ label: row.plan, values: [row.attendance, row.completion] }));
  return <ReportPage kind="training-summary"><ReportFilterPanel fields={summaryFilters.map(field => field.key === 'district' ? { ...field, options: districts } : field)} values={filters} onChange={changeFilter} onClear={clearFilters} onApply={() => setPage(1)} /><Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 1, md: 2 } }}><ReportViewToggle view={view} onChange={setView} /></Box>{view === 'graph' ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, px: { xs: 1, md: 2 } }}><ReportBarChart title="Trainee progress by plan" description="Planned, registered, and completed trainees in the filtered plans" series={traineeSeries} rows={traineeRows} chartType="cluster" /><ReportBarChart title="Training rates by plan" description="Attendance and completion percentages for the filtered plans" series={[{ label: 'Attendance', color: '#2584b9' }, { label: 'Completion', color: '#16945b' }]} rows={rateRows} formatter={value => `${value.toFixed(1)}%`} /></Box> : <ReportPanel title="Training summary details" description={reportMeta['training-summary'].note} count={`${rows.length} training plans from ${matchingBatches.toLocaleString()} batches`}><ReportTable columns={columns} rows={pageRows} rowKey={row => row.plan} emptyMessage="No training plans match these filters." tableClassName="summary-table" pagination={{ total: rows.length, page: currentPage, pageSize: REPORT_PAGE_SIZE, onPageChange: setPage }} /></ReportPanel>}</ReportPage>;
}

type AttendanceRow = { batch: string; batchIndex: number; plan: string; state: string; district: string; trainer: string; date: Date; dateText: string; present: boolean; totalDays: number; daysPresent: number; attendance: number; name: string };
const firstNames = ['Aarav', 'Aditi', 'Ananya', 'Arjun', 'Divya', 'Farhan', 'Ishita', 'Kiran', 'Lakshmi', 'Manoj', 'Nisha', 'Pavan', 'Priya', 'Rahul', 'Sana', 'Sanjay', 'Sita', 'Varun', 'Vijay', 'Zoya'];
const lastNames = ['Rao', 'Sharma', 'Kumar', 'Reddy', 'Nair', 'Patel', 'Das', 'Singh', 'Iyer', 'Khan', 'Devi', 'Joshi', 'Menon', 'Gupta', 'Naidu', 'Pillai'];
const attendanceRows: AttendanceRow[] = batchRecords.filter(batch => batch.status !== 'Scheduled').flatMap(batch => Array.from({ length: 110 }, (_, personIndex) => {
  const first = firstNames[(batch.index + personIndex * 3) % firstNames.length];
  const last = lastNames[(batch.index * 5 + personIndex * 7) % lastNames.length];
  const present = personIndex < batch.attended;
  return { batch: batch.batch, batchIndex: batch.index, plan: asPlanLabel(batch.plan), state: batch.state, district: batch.district, trainer: batch.trainer, date: batch.startDate, dateText: batch.dateText, present, totalDays: 1, daysPresent: present ? 1 : 0, attendance: present ? 100 : 0, name: `${first} ${last}` };
}));
function AttendanceReport() {
  const [filters, setFilters] = useState<ReportFilters>(emptyAttendanceFilters);
  const [view, setView] = useState<ReportView>('table');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AttendanceRow | null>(null);
  const districts = useMemo(() => reportDistrictOptions(filters.state), [filters.state]);
  const rows = useMemo(() => attendanceRows.filter(row => {
    if (filters.plan && row.plan !== filters.plan) return false;
    if (filters.state && row.state !== filters.state) return false;
    if (filters.district && row.district !== filters.district) return false;
    if (filters.trainer && row.trainer !== filters.trainer) return false;
    if (filters.start && row.date < new Date(`${filters.start}T00:00:00`)) return false;
    if (filters.end && row.date > new Date(`${filters.end}T23:59:59`)) return false;
    return attendanceMatch(row.attendance, filters.attendance);
  }), [filters]);
  const pageSize = REPORT_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const columns: TableColumn<AttendanceRow>[] = [
    { key: 'batch', label: 'Batch' }, { key: 'name', label: 'Trainee' }, { key: 'dateText', label: 'Training Date' }, { key: 'present', label: 'Present', render: row => row.present ? '1' : '0' }, { key: 'absent', label: 'Absent', render: row => row.present ? '0' : '1' }, { key: 'totalDays', label: 'Total Days' }, { key: 'daysPresent', label: 'Days Present' }, { key: 'attendance', label: 'Attendance %', render: row => `${row.attendance}%` }, { key: 'action', label: 'Action', render: row => <button className="action-button" type="button" onClick={() => setSelected(row)}>View</button> },
  ];
  const setValue = (key: string, value: string) => {
    setFilters(previous => {
      const next = { ...previous, [key]: value };
      if (key === 'state' && next.district && !reportDistrictOptions(value).some(option => option.value === next.district)) next.district = '';
      return next;
    }); setPage(1);
  };
  const clear = () => { setFilters(emptyAttendanceFilters); setPage(1); };
  const presentCount = rows.filter(row => row.present).length;
  const absentCount = rows.length - presentCount;
  const attendanceByPlan = [...rows.reduce((grouped, row) => { const current = grouped.get(row.plan) ?? { count: 0, total: 0 }; current.count++; current.total += row.attendance; grouped.set(row.plan, current); return grouped; }, new Map<string, { count: number; total: number }>()).entries()].map(([plan, value]) => ({ label: plan, values: [value.count ? value.total / value.count : 0] })).sort((a, b) => a.label.localeCompare(b.label));
  return <><ReportPage kind="attendance-report"><ReportFilterPanel fields={attendanceFilters.map(field => field.key === 'district' ? { ...field, options: districts } : field)} values={filters} onChange={setValue} onClear={clear} onApply={() => setPage(1)} /><Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 1, md: 2 } }}><ReportViewToggle view={view} onChange={setView} /></Box>{view === 'graph' ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, px: { xs: 1, md: 2 } }}><ReportBarChart title="Present and absent" description="Attendance record counts using the active report filters" series={[{ label: 'Present', color: '#16945b' }, { label: 'Absent', color: '#dd6670' }]} rows={[{ label: 'Filtered records', values: [presentCount, absentCount] }]} chartType="pie" /><ReportBarChart title="Attendance rate by plan" description="Average present percentage in the filtered plan records" series={[{ label: 'Attendance', color: '#2584b9' }]} rows={attendanceByPlan} formatter={value => `${value.toFixed(1)}%`} /></Box> : <ReportPanel title="Attendance details" description={reportMeta['attendance-report'].note} count={`${rows.length.toLocaleString()} attendance records`}><ReportTable columns={columns} rows={pageRows} rowKey={(row, index) => `${row.batchIndex}-${(currentPage - 1) * pageSize + index}-${row.name}`} emptyMessage="No attendance records match these filters." tableClassName="attendance-table" pagination={{ total: rows.length, page: currentPage, pageSize, onPageChange: setPage }} /></ReportPanel>}</ReportPage>
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} PaperProps={{ className: 'attendance-dialog' }} slotProps={{ backdrop: { className: 'attendance-backdrop' } }}>{selected && <><header><div><span className="dialog-eyebrow">Attendance record</span><h2>{selected.name}</h2></div><IconButton className="dialog-close" aria-label="Close details" onClick={() => setSelected(null)}>×</IconButton></header><div className="dialog-content">{[['Batch', selected.batch], ['Training Plan', selected.plan], ['Training Date', selected.dateText], ['Location', `${selected.district}, ${selected.state}`], ['Trainer', selected.trainer], ['Attendance', selected.present ? 'Present' : 'Absent']].map(([label, value]) => <div className="dialog-item" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></>}</Dialog>
  </>;
}
function ReportPage({ kind, children }: { kind: ReportKey; children: React.ReactNode }) {
  const meta = reportMeta[kind];
  const [toast, setToast] = useState('');
  return <div className="app report-app"><Sidebar activePage={meta.page} /><main className="main report-main"><Topbar title={meta.title} description={meta.description} />{children}<Footer /></main><ShellBehavior onToast={setToast} /><Snackbar open={Boolean(toast)} autoHideDuration={2800} onClose={() => setToast('')} message={toast} /></div>;
}
export function Reports({ report }: { report: string }) {
  if (report === 'assessment-feedback') return <AssessmentFeedbackReport />;
  if (report === 'batch-performance') return <BatchPerformance />;
  if (report === 'training-summary') return <TrainingSummary />;
  return <AttendanceReport />;
}
