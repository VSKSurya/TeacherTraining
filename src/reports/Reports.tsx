import { useEffect, useMemo, useState } from 'react';
import { Box, Snackbar } from '@mui/material';
import { batchRecords, locations, statusNames, trainers, uniqueSorted, type BatchRecord } from '../data/reportData';
import { Sidebar, Topbar, Footer, type AppPage } from '../components/DashboardParts';
import { ReportFilterPanel, ReportPanel, ReportTable, type FilterSpec, type ReportFilters, type TableColumn } from './ReportComponents';
import AssessmentFeedbackReport from './AssessmentFeedbackReport';
import { ReportBarChart, ReportViewToggle, type ReportView } from './ReportCharts';
import { formatDate } from '../dateFormat';
import { downloadExcelWorkbook } from './exportExcel';
import AttendanceDetail, { type AttendanceBatchDetail, type AttendancePersonDetail } from './AttendanceDetail';
import './report-export.css';

const reportMeta = {
  'batch-performance': { page: 'Batch Performance' as AppPage, title: 'Batch Performance', description: 'Review scheduled batches, attendance, and completion across the training plan.', heading: 'Batch performance details', note: '750 generated batch records aligned to the dashboard phases. End dates use the last calendar day of each phase month.' },
  'training-summary': { page: 'Training Summary' as AppPage, title: 'Training Summary', description: 'Review trainee progress across training plans and locations.', heading: 'Training summary details', note: '' },
  'attendance-report': { page: 'Attendance Report' as AppPage, title: 'Attendance Report', description: 'Review participant attendance records across batches, locations, and training plans.', heading: 'Attendance details', note: 'Batch summaries include four training days; select View Details to review daily participant attendance.' },
};
type ReportKey = keyof typeof reportMeta;
const REPORT_PAGE_SIZE = 10;
const emptyBatchFilters = { batch: '', udise: '', state: '', district: '', phase: '', plan: '', participant: 'All', trainer: '', start: '', end: '', status: '', attendance: '' };
const emptySummaryFilters = { plan: '', state: '', district: '', block: '', trainer: '', start: '', to: '', participant: 'All', status: '' };
const emptyAttendanceFilters = { plan: '', state: '', district: '', trainer: '', start: '', end: '', attendance: '' };
const stateOptions = locations.map(location => ({ label: location.name, value: location.name }));
const trainerOptions = trainers.map(name => ({ label: name, value: name }));
const statusOptions = statusNames.map(name => ({ label: name, value: name }));
const batchPhaseOptions = uniqueSorted(batchRecords.map(row => row.phase)).map(phase => ({ label: phase, value: phase }));
const batchTrainingPlanOptions = uniqueSorted(batchRecords.map(row => row.trainingPlan)).map(plan => ({ label: plan, value: plan }));
const batchFilters: FilterSpec[] = [
  { key: 'batch', label: 'Batch ID', type: 'search', placeholder: 'Search batch ID' }, { key: 'udise', label: 'School UDISE', type: 'search', placeholder: 'Search UDISE' },
  { key: 'state', label: 'State', type: 'select', placeholder: 'All states', options: stateOptions }, { key: 'district', label: 'District', type: 'select', placeholder: 'All districts' },
  { key: 'phase', label: 'Phase wise', type: 'select', placeholder: 'All phases', options: batchPhaseOptions }, { key: 'plan', label: 'Training Plan', type: 'select', placeholder: 'All training plans', options: batchTrainingPlanOptions },
  { key: 'participant', label: 'Participant', type: 'select', options: [{ label: 'All', value: 'All' }, { label: 'Teacher', value: 'Teacher' }, { label: 'Student', value: 'Student' }] },
  { key: 'trainer', label: 'Trainer Name', type: 'select', placeholder: 'All trainers', options: trainerOptions }, { key: 'start', label: 'From Start Date', type: 'date' }, { key: 'end', label: 'To Start Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', placeholder: 'All statuses', options: statusOptions }, { key: 'attendance', label: 'Attendance', type: 'select', placeholder: 'Any attendance', options: [{ label: 'Less than 50%', value: 'lt-50' }, { label: 'Less than 75%', value: 'lt-75' }, { label: 'Less than 90%', value: 'lt-90' }, { label: '50% or higher', value: 'gte-50' }, { label: '75% or higher', value: 'gte-75' }, { label: '90% or higher', value: 'gte-90' }] },
];
const summaryFilters: FilterSpec[] = [
  { key: 'plan', label: 'Training Plan', type: 'select', placeholder: 'All training plans', options: uniqueSorted(batchRecords.map(row => row.plan.replace(' · ', ' - '))).map(v => ({ label: v, value: v })) },
  { key: 'state', label: 'State', type: 'select', placeholder: 'All states', options: stateOptions }, { key: 'district', label: 'District', type: 'select', placeholder: 'Select a state first' }, { key: 'block', label: 'Block', type: 'select', placeholder: 'Select a district first' }, { key: 'trainer', label: 'Trainer Name', type: 'select', placeholder: 'All trainers', options: trainerOptions },
  { key: 'start', label: 'From Start Date', type: 'date' }, { key: 'to', label: 'To Start Date', type: 'date' },
  { key: 'participant', label: 'Participant type', type: 'select', options: [{ label: 'All', value: 'All' }, { label: 'Students', value: 'Students' }, { label: 'Teachers', value: 'Teachers' }] },
  { key: 'status', label: 'Status', type: 'select', placeholder: 'All statuses', options: statusOptions },
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
const reportBlockOptions = (state: string, district: string) => uniqueSorted(batchRecords.filter(row => (!state || row.state === state) && (!district || row.district === district)).map(row => row.block)).map(block => ({ label: block, value: block }));

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
  const [sortBy, setSortBy] = useState<string>('batch');
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const districts = useMemo(() => reportDistrictOptions(filters.state), [filters.state]);
  const rows = useMemo(() => batchRecords.filter(row => {
    if (filters.batch && !row.batch.toLowerCase().includes(filters.batch.trim().toLowerCase())) return false;
    if (filters.udise && !row.udise.toLowerCase().includes(filters.udise.trim().toLowerCase())) return false;
    if (filters.state && row.state !== filters.state) return false;
    if (filters.district && row.district !== filters.district) return false;
    if (filters.phase && row.phase !== filters.phase) return false;
    if (filters.plan && row.trainingPlan !== filters.plan) return false;
    if (filters.participant !== 'All' && filters.participant && row.participant !== filters.participant) return false;
    if (filters.trainer && row.trainer !== filters.trainer) return false;
    if (filters.start && row.startDate < new Date(`${filters.start}T00:00:00`)) return false;
    if (filters.end && row.startDate > new Date(`${filters.end}T23:59:59`)) return false;
    if (filters.status && row.status !== filters.status) return false;
    return attendanceMatch(row.attendance, filters.attendance);
  }), [filters]);
  const columns: TableColumn<BatchRecord>[] = [
    { key: 'batch', label: 'Batch ID' },
    { key: 'udise', label: 'School UDISE (Venue)' },
    { key: 'school', label: 'School Name (Venue)' },
    { key: 'state', label: 'State' },
    { key: 'district', label: 'District' },
    { key: 'block', label: 'Block' },
    { key: 'phase', label: 'Phase' },
    { key: 'trainingPlan', label: 'Training Plan' },
    { key: 'trainer', label: 'Trainer' },
    { key: 'startDate', label: 'Start Date', render: row => formatDate(row.startDate) },
    { key: 'endDate', label: 'End Date', render: row => row.endDate ? formatDate(row.endDate) : '-' },
    { key: 'registered', label: 'Registered', align: 'right' },
    { key: 'attended', label: 'Attended', align: 'right' },
    { key: 'attendance', label: 'Attendance %', align: 'right', render: row => `${row.attendance.toFixed(1)}%` },
    { key: 'completed', label: 'Completed', align: 'right' },
    { key: 'completionRate', label: 'Completion %', align: 'right', render: row => `${(row.registered ? row.completed / row.registered * 100 : 0).toFixed(1)}%` },
    { key: 'status', label: 'Status' },
  ];
  const orderedRows = useMemo(() => [...rows].sort((left, right) => {
    const value = (row: BatchRecord) => sortBy === 'completionRate' ? (row.registered ? row.completed / row.registered * 100 : 0) : row[sortBy as keyof BatchRecord];
    const a = value(left), b = value(right);
    const result = a instanceof Date || b instanceof Date ? (a instanceof Date ? a.getTime() : Number.NEGATIVE_INFINITY) - (b instanceof Date ? b.getTime() : Number.NEGATIVE_INFINITY)
      : typeof a === 'number' && typeof b === 'number' ? a - b
      : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
    return sortDirection === 'ascending' ? result : -result;
  }), [rows, sortBy, sortDirection]);
  const exportToExcel = async () => {
    setExporting(true);
    setExportError('');
    try {
      const values = orderedRows.map(row => [
        row.batch, row.udise, row.school, row.state, row.district, row.block, row.phase, row.trainingPlan, row.trainer,
        formatDate(row.startDate), row.endDate ? formatDate(row.endDate) : '', row.registered, row.attended,
        `${row.attendance.toFixed(1)}%`, row.completed,
        `${(row.registered ? row.completed / row.registered * 100 : 0).toFixed(1)}%`, row.status,
      ]);
      await downloadExcelWorkbook(`batch-performance-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Batch Performance', columns.map(column => column.label), values);
    } catch {
      setExportError('The Excel file could not be created. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  const pages = Math.max(1, Math.ceil(orderedRows.length / REPORT_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = orderedRows.slice((currentPage - 1) * REPORT_PAGE_SIZE, currentPage * REPORT_PAGE_SIZE);
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
  const attendanceByStatus = statusNames.map(status => { const matching = rows.filter(row => row.status === status); const registered = matching.reduce((sum, row) => sum + row.registered, 0); const attended = matching.reduce((sum, row) => sum + row.attended, 0); return { label: status, values: [registered ? attended / registered * 100 : 0] }; });
  return <ReportPage kind="batch-performance">
    <ReportFilterPanel fields={batchFilters.map(field => field.key === 'district' ? { ...field, options: districts } : field)} values={filters} onChange={changeFilter} onClear={clearFilters} />
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 1, md: 2 } }}><ReportViewToggle view={view} onChange={setView} /></Box>
    {view === 'graph'
      ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, px: { xs: 1, md: 2 } }}><ReportBarChart title="Batch status" description="Filtered batch count by delivery status" series={statusSeries} rows={batchStatusRows} chartType="pie" /><ReportBarChart title="Attendance by status" description="Attendance calculated as total attended divided by total registered in each status" series={[{ label: 'Average attendance', color: '#176fba' }]} rows={attendanceByStatus} formatter={value => `${value.toFixed(1)}%`} chartType="cluster" /></Box>
      : <ReportPanel title="Batch performance details" description={reportMeta['batch-performance'].note} count={`${rows.length.toLocaleString()} of ${batchRecords.length.toLocaleString()} batches`}>
        <Box className="summary-report-toolbar" sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, p: 1.25, borderBottom: '1px solid #edf1f5', flexWrap: 'wrap' }}>
          <button className="report-export-button" type="button" onClick={exportToExcel} disabled={exporting || !orderedRows.length}>{exporting ? 'Preparing Excel…' : 'Download Excel'}</button>
          <div className="location-head-actions">
            <label className="location-sort-label" htmlFor="batch-performance-sort">Sort by</label>
            <select className="location-sort-select" id="batch-performance-sort" aria-label="Sort batches by" value={sortBy} onChange={event => { setSortBy(event.target.value); setPage(1); }}>{columns.map(column => <option key={String(column.key)} value={String(column.key)}>{column.label}</option>)}</select>
            <div className="batch-performance-sort-toggle" role="group" aria-label="Sort direction">
              <button type="button" aria-pressed={sortDirection === 'ascending'} onClick={() => { setSortDirection('ascending'); setPage(1); }}>Ascending</button>
              <button type="button" aria-pressed={sortDirection === 'descending'} onClick={() => { setSortDirection('descending'); setPage(1); }}>Descending</button>
            </div>
          </div>
        </Box>
        <ReportTable columns={columns} rows={pageRows} rowKey={row => row.batch} emptyMessage="No batches match these filters." tableClassName="batch-table" pagination={{ total: orderedRows.length, page: currentPage, pageSize: REPORT_PAGE_SIZE, onPageChange: setPage }} />
      </ReportPanel>}
    <Snackbar open={Boolean(exportError)} autoHideDuration={4000} onClose={() => setExportError('')} message={exportError} />
  </ReportPage>;
}

type SummaryRow = { plan: string; batchesPlanned: number; registered: number; ongoingBatches: number; completedBatches: number; usersCompleted: number; attendance: number; completion: number };
type SummarySortKey = keyof SummaryRow;
const summarySortOptions: { label: string; value: SummarySortKey }[] = [
  { label: 'Training Plan', value: 'plan' }, { label: 'Total Batches Planned', value: 'batchesPlanned' }, { label: 'No. of users Registered', value: 'registered' },
  { label: 'On going batches', value: 'ongoingBatches' }, { label: 'Completed Batches', value: 'completedBatches' }, { label: 'No. of users completed the training', value: 'usersCompleted' },
  { label: 'Completion %', value: 'completion' }, { label: 'Attendance %', value: 'attendance' },
];
type SummaryParticipant = 'All' | 'Students' | 'Teachers';
function dashboardParticipantMetrics(record: BatchRecord, audience: SummaryParticipant) {
  const metricsFor = (participant: 'Students' | 'Teachers') => {
    const planned = participant === 'Teachers' ? record.teacherParticipants : record.studentParticipants;
    const scheduled = record.dashboardStatus === 'Scheduled';
    const registered = scheduled ? Math.round(planned * (participant === 'Teachers' ? .95 : .91)) : planned;
    const attendanceRate = scheduled ? 0 : Math.max(0, Math.min(100, record.dashboardAttendance + (participant === 'Teachers' ? 2 : -2)));
    const completionRate = scheduled ? 0 : record.dashboardStatus === 'Completed' ? 100 : Math.max(0, Math.min(100, record.dashboardCompletion + (participant === 'Teachers' ? 2 : -2)));
    return { planned, registered, attended: Math.min(registered, Math.round(planned * attendanceRate / 100)), completed: Math.round(planned * completionRate / 100) };
  };
  const teacher = audience === 'Students' ? null : metricsFor('Teachers');
  const student = audience === 'Teachers' ? null : metricsFor('Students');
  return {
    planned: (teacher?.planned ?? 0) + (student?.planned ?? 0),
    registered: (teacher?.registered ?? 0) + (student?.registered ?? 0),
    attended: (teacher?.attended ?? 0) + (student?.attended ?? 0),
    completed: (teacher?.completed ?? 0) + (student?.completed ?? 0),
  };
}
function TrainingSummary() {
  const [filters, setFilters] = useState<ReportFilters>(emptySummaryFilters);
  const [view, setView] = useState<ReportView>('table');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SummarySortKey>('plan');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const districts = useMemo(() => reportDistrictOptions(filters.state), [filters.state]);
  const blocks = useMemo(() => reportBlockOptions(filters.state, filters.district), [filters.state, filters.district]);
  const rows = useMemo(() => {
    const source = batchRecords.filter(row => {
      if (filters.plan && asPlanLabel(row.plan) !== filters.plan) return false;
      if (filters.state && row.state !== filters.state) return false;
      if (filters.district && row.district !== filters.district) return false;
      if (filters.block && row.block !== filters.block) return false;
      if (filters.trainer && row.trainer !== filters.trainer) return false;
      if (filters.start && row.startDate < new Date(`${filters.start}T00:00:00`)) return false;
      if (filters.to && row.startDate > new Date(`${filters.to}T23:59:59`)) return false;
      if (filters.status && row.dashboardStatus !== filters.status) return false;
      return true;
    });
    const grouped = new Map<string, SummaryRow>();
    for (const record of source) {
      const name = asPlanLabel(record.plan);
      const row = grouped.get(name) ?? { plan: name, batchesPlanned: 0, registered: 0, ongoingBatches: 0, completedBatches: 0, usersCompleted: 0, attendance: 0, completion: 0 };
      const metrics = dashboardParticipantMetrics(record, filters.participant as SummaryParticipant);
      row.batchesPlanned++;
      row.registered += metrics.registered;
      if (record.dashboardStatus === 'Ongoing') row.ongoingBatches++;
      if (record.dashboardStatus === 'Completed') row.completedBatches++;
      row.usersCompleted += metrics.completed;
      row.attendance += metrics.attended;
      grouped.set(name, row);
    }
    return [...grouped.values()].sort((a, b) => a.plan.localeCompare(b.plan)).map(row => ({ ...row, attendance: row.registered ? row.attendance / row.registered * 100 : 0, completion: row.registered ? row.usersCompleted / row.registered * 100 : 0 }));
  }, [filters]);
  const sortedRows = useMemo(() => [...rows].sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];
    const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
    return (sortDirection === 'asc' ? comparison : -comparison) || left.plan.localeCompare(right.plan);
  }), [rows, sortBy, sortDirection]);
  const pages = Math.max(1, Math.ceil(rows.length / REPORT_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = sortedRows.slice((currentPage - 1) * REPORT_PAGE_SIZE, currentPage * REPORT_PAGE_SIZE);
  const columns: TableColumn<SummaryRow>[] = [
    { key: 'plan', label: 'Training Plan' }, { key: 'batchesPlanned', label: 'Total Batches Planned', align: 'right' },
    { key: 'registered', label: 'No. of users Registered', align: 'right' }, { key: 'ongoingBatches', label: 'On going batches', align: 'right' },
    { key: 'completedBatches', label: 'Completed Batches', align: 'right' }, { key: 'usersCompleted', label: 'No. of users completed the training', align: 'right' },
    { key: 'completion', label: 'Completion %', align: 'right', render: row => `${row.completion.toFixed(1)}%` },
    { key: 'attendance', label: 'Attendance %', align: 'right', render: row => `${row.attendance.toFixed(1)}%` },
  ];
  const setValue = (key: string, value: string) => setFilters(previous => {
    const next = { ...previous, [key]: value };
    if (key === 'state') { next.district = ''; next.block = ''; }
    if (key === 'district') next.block = '';
    return next;
  });
  const changeFilter = (key: string, value: string) => { setValue(key, value); setPage(1); };
  const clearFilters = () => { setFilters(emptySummaryFilters); setPage(1); };
  const matchingBatches = sortedRows.reduce((total, row) => total + row.batchesPlanned, 0);
  const traineeSeries = [{ label: 'Registered', color: '#2584b9' }, { label: 'Completed', color: '#16945b' }];
  const traineeRows = sortedRows.map(row => ({ label: row.plan, values: [row.registered, row.usersCompleted] }));
  const rateRows = sortedRows.map(row => ({ label: row.plan, values: [row.attendance, row.completion] }));
  const sortControls = <div className="summary-sort-controls card-sort-controls"><label htmlFor="training-summary-sort">Sort by</label><select id="training-summary-sort" value={sortBy} onChange={event => { setSortBy(event.target.value as SummarySortKey); setPage(1); }}>{summarySortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><div className="summary-sort-direction" role="group" aria-label="Sort direction"><button type="button" aria-pressed={sortDirection === 'asc'} className={sortDirection === 'asc' ? 'active' : ''} onClick={() => { setSortDirection('asc'); setPage(1); }}>Ascending</button><button type="button" aria-pressed={sortDirection === 'desc'} className={sortDirection === 'desc' ? 'active' : ''} onClick={() => { setSortDirection('desc'); setPage(1); }}>Descending</button></div></div>;
  const filterFields = summaryFilters.map(field => field.key === 'district'
    ? { ...field, options: districts, disabled: !filters.state }
    : field.key === 'block' ? { ...field, options: blocks, disabled: !filters.district } : field);
  return <ReportPage kind="training-summary"><ReportFilterPanel fields={filterFields} values={filters} onChange={changeFilter} onClear={clearFilters} /><Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 1, md: 2 } }}><ReportViewToggle view={view} onChange={setView} /></Box>{view === 'graph' ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, px: { xs: 1, md: 2 } }}><ReportBarChart title="Trainee progress by plan" description="Registered and completed users in the filtered plans" series={traineeSeries} rows={traineeRows} chartType="cluster" /><ReportBarChart title="Training rates by plan" description="Attendance and completion percentages in the filtered plans" series={[{ label: 'Attendance', color: '#2584b9' }, { label: 'Completion', color: '#16945b' }]} rows={rateRows} formatter={value => `${value.toFixed(1)}%`} /></Box> : <ReportPanel title="Training summary details" description={reportMeta['training-summary'].note} count={`${rows.length} training plans from ${matchingBatches.toLocaleString()} batches`}>{sortControls}<ReportTable columns={columns} rows={pageRows} rowKey={row => row.plan} emptyMessage="No training plans match these filters." tableClassName="summary-table" pagination={{ total: rows.length, page: currentPage, pageSize: REPORT_PAGE_SIZE, onPageChange: setPage }} /></ReportPanel>}</ReportPage>;
}

type AttendanceRecord = AttendancePersonDetail & { batch: string; batchIndex: number; plan: string; udise: string; school: string; state: string; district: string; block: string; trainer: string; date: Date; totalTrainingDays: number };
type AttendanceSummary = AttendanceBatchDetail & { batchIndex: number; plan: string; totalPresent: number; totalPossible: number };
const attendanceTrainingDays = 4;
const firstNames = ['Aarav', 'Aditi', 'Ananya', 'Arjun', 'Divya', 'Farhan', 'Ishita', 'Kiran', 'Lakshmi', 'Manoj', 'Nisha', 'Pavan', 'Priya', 'Rahul', 'Sana', 'Sanjay', 'Sita', 'Varun', 'Vijay', 'Zoya'];
const lastNames = ['Rao', 'Sharma', 'Kumar', 'Reddy', 'Nair', 'Patel', 'Das', 'Singh', 'Iyer', 'Khan', 'Devi', 'Joshi', 'Menon', 'Gupta', 'Naidu', 'Pillai'];
const attendanceRows: AttendanceRecord[] = batchRecords.filter(batch => batch.status !== 'Scheduled').flatMap(batch => Array.from({ length: batch.registered }, (_, personIndex) => {
  const first = firstNames[(batch.index + personIndex * 3) % firstNames.length];
  const last = lastNames[(batch.index * 5 + personIndex * 7) % lastNames.length];
  const days = Array.from({ length: attendanceTrainingDays }, (_, dayIndex) => ((batch.index * 11 + personIndex * 29 + dayIndex * 17) % 100) < batch.attendance);
  const userId = `user${String(personIndex + 1).padStart(3, '0')}`;
  return {
    batch: batch.batch, batchIndex: batch.index, plan: asPlanLabel(batch.plan), udise: batch.udise, school: batch.school,
    state: batch.state, district: batch.district, block: batch.block, trainer: batch.trainer, date: batch.startDate,
    totalTrainingDays: attendanceTrainingDays, userId, name: `${first} ${last}`, mobileMasked: `98xxxx${980 + personIndex}`,
    emailMasked: `us******${personIndex + 1}@hxxx.co`, days, daysPresent: days.filter(Boolean).length,
  };
}));

function AttendanceReport() {
  const [filters, setFilters] = useState<ReportFilters>(emptyAttendanceFilters);
  const [view, setView] = useState<ReportView>('table');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AttendanceSummary | null>(null);
  const districts = useMemo(() => reportDistrictOptions(filters.state), [filters.state]);
  const batchRows = useMemo<AttendanceSummary[]>(() => {
    const groups = new Map<number, AttendanceRecord[]>();
    for (const record of attendanceRows) groups.set(record.batchIndex, [...(groups.get(record.batchIndex) ?? []), record]);
    return [...groups.entries()].map(([batchIndex, users]) => {
      const first = users[0];
      const totalPresent = users.reduce((sum, user) => sum + user.daysPresent, 0);
      const totalPossible = users.length * first.totalTrainingDays;
      return {
        batchIndex, batch: first.batch, plan: first.plan, udise: first.udise, school: first.school, state: first.state,
        district: first.district, block: first.block, trainer: first.trainer, startDate: first.date, endDate: batchRecords[batchIndex]?.endDate ?? null,
        totalTrainingDays: first.totalTrainingDays, registered: users.length,
        presentAllDays: users.filter(user => user.daysPresent === first.totalTrainingDays).length,
        absentUsers: users.filter(user => user.daysPresent < first.totalTrainingDays).length,
        attendance: totalPossible ? totalPresent / totalPossible * 100 : 0, totalPresent, totalPossible, users: users.map(({ batch: _batch, batchIndex: _batchIndex, plan: _plan, udise: _udise, school: _school, state: _state, district: _district, block: _block, trainer: _trainer, date: _date, totalTrainingDays: _days, ...user }) => user),
      };
    });
  }, []);
  const rows = useMemo(() => batchRows.filter(row => {
    if (filters.plan && row.plan !== filters.plan) return false;
    if (filters.state && row.state !== filters.state) return false;
    if (filters.district && row.district !== filters.district) return false;
    if (filters.trainer && row.trainer !== filters.trainer) return false;
    if (filters.start && row.startDate < new Date(`${filters.start}T00:00:00`)) return false;
    if (filters.end && row.startDate > new Date(`${filters.end}T23:59:59`)) return false;
    return attendanceMatch(row.attendance, filters.attendance);
  }), [batchRows, filters]);
  const pageSize = REPORT_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const columns: TableColumn<AttendanceSummary>[] = [
    { key: 'batch', label: 'Batch Code' },
    { key: 'registered', label: 'Registered', align: 'right' },
    { key: 'startDate', label: 'Training Start Date', render: row => formatDate(row.startDate) },
    { key: 'totalTrainingDays', label: 'Total Training Days', align: 'right' },
    { key: 'presentAllDays', label: 'No. of users Present all days', align: 'right' },
    { key: 'absentUsers', label: 'No. of users Absent on days', align: 'right' },
    { key: 'attendance', label: 'Attendance %', align: 'right', render: row => `${row.attendance.toFixed(1)}%` },
    { key: 'viewDetails', label: 'View Details', render: row => <button className='action-button' type='button' onClick={() => setSelected(row)}>View Details</button> },
  ];
  const setValue = (key: string, value: string) => {
    setFilters(previous => {
      const next = { ...previous, [key]: value };
      if (key === 'state' && next.district && !reportDistrictOptions(value).some(option => option.value === next.district)) next.district = '';
      return next;
    }); setPage(1);
  };
  const clear = () => { setFilters(emptyAttendanceFilters); setPage(1); };
  const totalPresent = rows.reduce((sum, row) => sum + row.totalPresent, 0);
  const totalPossible = rows.reduce((sum, row) => sum + row.totalPossible, 0);
  const absentCount = totalPossible - totalPresent;
  const attendanceByPlan = [...rows.reduce((grouped, row) => { const current = grouped.get(row.plan) ?? { present: 0, possible: 0 }; current.present += row.totalPresent; current.possible += row.totalPossible; grouped.set(row.plan, current); return grouped; }, new Map<string, { present: number; possible: number }>()).entries()].map(([plan, value]) => ({ label: plan, values: [value.possible ? value.present / value.possible * 100 : 0] })).sort((a, b) => a.label.localeCompare(b.label));
  if (selected) return <ReportPage kind='attendance-report'><AttendanceDetail batch={selected} onBack={() => setSelected(null)} /></ReportPage>;
  return <ReportPage kind='attendance-report'><ReportFilterPanel fields={attendanceFilters.map(field => field.key === 'district' ? { ...field, options: districts } : field)} values={filters} onChange={setValue} onClear={clear} /><Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 1, md: 2 } }}><ReportViewToggle view={view} onChange={setView} /></Box>{view === 'graph' ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, px: { xs: 1, md: 2 } }}><ReportBarChart title='Present and absent' description='Present and absent attendance slots across the filtered batches' series={[{ label: 'Present', color: '#16945b' }, { label: 'Absent', color: '#dd6670' }]} rows={[{ label: 'Filtered batches', values: [totalPresent, absentCount] }]} chartType='pie' /><ReportBarChart title='Attendance rate by plan' description='Attendance calculated across all training days for each filtered plan' series={[{ label: 'Attendance', color: '#2584b9' }]} rows={attendanceByPlan} formatter={value => `${value.toFixed(1)}%`} /></Box> : <ReportPanel title='Attendance Reports' description='Batch-level attendance summaries. Select View Details for daily participant attendance.' count={`${rows.length.toLocaleString()} batches`}><ReportTable columns={columns} rows={pageRows} rowKey={row => row.batch} emptyMessage='No batches match these filters.' tableClassName='attendance-table attendance-summary-table' pagination={{ total: rows.length, page: currentPage, pageSize, onPageChange: setPage }} /></ReportPanel>}</ReportPage>;
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
