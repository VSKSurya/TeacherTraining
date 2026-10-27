import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Chip, FormControl, LinearProgress, MenuItem, Paper, Select, Stack, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession, getUsers } from '../auth';
import { formatDate } from '../dateFormat';
import { businessToday, calculateAttendance } from '../attendanceMetrics';
import { buildTrainingCompletionRows, summarizeTrainingCompletion } from '../completion';

type Row = Record<string, unknown>;
type Project = Row & { id: string; name: string; code?: string; status?: string; assignedUsers?: string[]; endDate?: string };
type Plan = Row & { id: string; code?: string; name?: string; status?: string };
type Association = Row & { id: string; projectId: string; trainingPlanId: string; status?: string };
type Batch = Row & { id: string; batchCode?: string; projectId?: string; projectPlanAssociationId?: string; status?: string; trainingStartDate?: string; trainingEndAuto?: string; trainerCode?: string; trainingDuration?: number; trainingDates?: string[] };
const KEYS = { projects: 'teacher-training-projects', plans: 'teacher-training-plans', associations: 'teacher-training-project-plan-associations', batches: 'teacher-training-batch-plan-uses', registrations: 'teacher-training-registrations', attendance: 'teacher-training-attendance-records', exclusions: 'teacher-training-attendance-exclusions', assessments: 'teacher-training-assessment-records', feedback: 'teacher-training-feedback-records', external: 'teacher-training-external-course-records', forms: 'teacher-training-assessment-form-master' };
function readRows<T extends Row>(key: string): T[] { try { const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') as T[] : []; } catch { return []; } }
function numeric(...values: unknown[]) { for (const value of values) { const number = Number(value); if (Number.isFinite(number) && number >= 0) return number; } return 0; }
function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function isPresent(row: Row) { const status = text(row.status).toLowerCase(); return row.present === true || row.attended === true || ['present', 'attended', 'complete', 'completed'].includes(status); }
function isApproved(row: Row) { return row.approved === true || ['approved', 'confirmed', 'enrolled'].includes(text(row.status).toLowerCase()); }
function isCompleted(row: Row) { return row.completed === true || ['completed', 'complete', 'submitted', 'graded'].includes(text(row.status).toLowerCase()); }
function isPassed(row: Row) { return row.passed === true || ['pass', 'passed'].includes(text(row.result ?? row.status).toLowerCase()); }
function dayValue(value: unknown) { return text(value).slice(0, 10); }
function dateDays(batch: Batch) { if (Array.isArray(batch.trainingDates)) return batch.trainingDates.map(String); if (!batch.trainingStartDate) return []; const result: string[] = []; const date = new Date(`${batch.trainingStartDate}T12:00:00`); const duration = numeric(batch.trainingDuration) || 1; for (let i = 0; i < duration && i < 400; ) { const day = date.getDay(); if (day !== 0 && day !== 6) { result.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`); i++; } date.setDate(date.getDate() + 1); } return result; }
function overlaps(a: Batch, b: Batch) { const aStart = text(a.trainingStartTime), aEnd = text(a.trainingEndTime), bStart = text(b.trainingStartTime), bEnd = text(b.trainingEndTime); const hasTimeOverlap = !aStart || !aEnd || !bStart || !bEnd || (aStart < bEnd && bStart < aEnd); return Boolean(a.trainerCode && a.trainerCode.toLowerCase() === b.trainerCode?.toLowerCase() && dateDays(a).some(day => dateDays(b).includes(day)) && hasTimeOverlap); }
function percent(value: number, total: number) { return total > 0 ? Math.round(value / total * 100) : null; }
function pctText(value: number | null) { return value === null ? '—' : `${value}%`; }
function metricValue(value: number | null | undefined) { return value === null || value === undefined ? '—' : value.toLocaleString(); }

function MetricCard({ label, value, detail, color = '#176fba' }: { label: string; value: string; detail: string; color?: string }) {
  return <Box component="article" className="kpi schoolnet-kpi" sx={{ '& .kpi-value': { color } }}><div className="kpi-top"><span className="kpi-label">{label}</span><span className="kpi-icon" style={{ color }} aria-hidden="true">●</span></div><div className="kpi-value">{value}</div><div className="kpi-sub" title={detail}>{detail}</div></Box>;
}
function Bar({ label, value, total, color = '#1675c7' }: { label: string; value: number; total: number; color?: string }) {
  const progress = total ? Math.max(0, Math.min(100, value / total * 100)) : 0;
  return <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(92px,1fr) 2fr auto', alignItems: 'center', gap: 1, mb: 1.15 }}><Typography variant="caption" sx={{ color: '#536e85' }}>{label}</Typography><LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 8, bgcolor: '#edf2f6', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 8 } }} /><Typography variant="caption" sx={{ color: '#173553', fontWeight: 700 }}>{value.toLocaleString()}</Typography></Box>;
}

export default function SchoolnetDashboard() {
  const session = getSession();
  const superAdmin = session?.role === 'schoolnet-super-admin';
  const allProjects = useMemo(() => readRows<Project>(KEYS.projects), []);
  const allPlans = useMemo(() => readRows<Plan>(KEYS.plans), []);
  const allAssociations = useMemo(() => readRows<Association>(KEYS.associations), []);
  const allBatches = useMemo(() => readRows<Batch>(KEYS.batches), []);
  const allRegistrations = useMemo(() => readRows<Row>(KEYS.registrations), []);
  const allAttendance = useMemo(() => readRows<Row>(KEYS.attendance), []);
  const allExclusions = useMemo(() => readRows<Row>(KEYS.exclusions), []);
  const allAssessments = useMemo(() => readRows<Row>(KEYS.assessments), []);
  const allFeedback = useMemo(() => readRows<Row>(KEYS.feedback), []);
  const allExternalCourses = useMemo(() => readRows<Row>(KEYS.external), []);
  const allAssessmentForms = useMemo(() => readRows<Row>(KEYS.forms), []);
  const trainers = useMemo(() => getUsers().filter(user => user.active && user.role === 'trainer'), []);
  const authorizedProjects = useMemo(() => allProjects.filter(project => superAdmin || Boolean(session && project.assignedUsers?.includes(session.userId))), [allProjects, superAdmin, session]);
  const [selectedProject, setSelectedProject] = useState('');
  const projects = selectedProject ? authorizedProjects.filter(project => project.id === selectedProject) : authorizedProjects;
  const projectIds = new Set(projects.map(project => project.id));
  const associations = allAssociations.filter(item => projectIds.has(item.projectId));
  const associationIds = new Set(associations.map(item => item.id));
  const planIds = new Set(associations.map(item => item.trainingPlanId));
  const plans = allPlans.filter(plan => planIds.has(plan.id));
  const batches = allBatches.filter(batch => projectIds.has(text(batch.projectId)) && (batch.status ?? 'Scheduled') !== 'Archived');
  const batchIds = new Set(batches.flatMap(batch => [batch.id, batch.batchCode ?? '', text(batch.uniqueId)]).filter(Boolean));
  const filterRelated = (rows: Row[]) => rows.filter(row => batchIds.has(text(row.batchId ?? row.batchCode ?? row.batchUniqueId)) || associationIds.has(text(row.projectPlanAssociationId)));
  const registrations = filterRelated(allRegistrations);
  const attendance = filterRelated(allAttendance);
  const assessments = filterRelated(allAssessments);
  const feedback = filterRelated(allFeedback);
  const activeBatches = batches.filter(batch => !['Cancelled', 'Archived'].includes(text(batch.status)));
  const statusNames = ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'];
  const statusCounts = Object.fromEntries(statusNames.map(status => [status, batches.filter(batch => text(batch.status ?? 'Scheduled').toLowerCase() === status.toLowerCase()).length]));
  const plannedParticipants = batches.reduce((sum, batch) => sum + numeric(batch.plannedParticipants, batch.plannedUsers, batch.participantCount), 0);
  const registered = registrations.length || batches.reduce((sum, batch) => sum + numeric(batch.registeredParticipants, batch.registeredUsersCount), 0);
  const approved = registrations.length ? registrations.filter(isApproved).length : batches.reduce((sum, batch) => sum + numeric(batch.approvedParticipants, batch.approvedUsers), 0);
  const trainedRecords = new Set(attendance.filter(isPresent).map(row => text(row.participantId ?? row.traineeId ?? row.userId ?? row.registrationId)).filter(Boolean));
  const trained = trainedRecords.size || batches.reduce((sum, batch) => sum + numeric(batch.trainedParticipants, batch.completedUsers), 0);
  const attendanceSummary = calculateAttendance(batches, registrations, attendance, allExclusions);
  const attendanceRate = attendanceSummary.percentage;
  const completion = summarizeTrainingCompletion(buildTrainingCompletionRows(registrations, batches, plans, associations), { attendance, assessments, feedback, externalCourses: filterRelated(allExternalCourses), assessmentForms: allAssessmentForms, exclusions: allExclusions, asOf: businessToday() });
  const assessmentCompleted = assessments.filter(isCompleted).length;
  const assessmentPasses = assessments.filter(isPassed).length;
  const assessmentCompletionRate = assessments.length ? percent(assessmentCompleted, assessments.length) : null;
  const assessmentPassRate = assessmentCompleted ? percent(assessmentPasses, assessmentCompleted) : null;
  const ratings = feedback.map(row => numeric(row.satisfactionRating, row.rating, row.satisfaction)).filter(value => value > 0);
  const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    const app = document.querySelector<HTMLElement>('.schoolnet-dashboard');
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.collapse')) return;
      setSidebarCollapsed(current => !current);
    };
    app?.addEventListener('click', onClick);
    return () => app?.removeEventListener('click', onClick);
  }, []);
  useEffect(() => {
    const app = document.querySelector<HTMLElement>('.schoolnet-dashboard');
    const button = app?.querySelector<HTMLButtonElement>('.collapse');
    button?.setAttribute('aria-expanded', String(!sidebarCollapsed));
  }, [sidebarCollapsed]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = activeBatches.filter(batch => dayValue(batch.trainingStartDate) >= today).sort((a, b) => dayValue(a.trainingStartDate).localeCompare(dayValue(b.trainingStartDate))).slice(0, 6);
  const delayed = activeBatches.filter(batch => text(batch.status).toLowerCase() !== 'completed' && dayValue(batch.trainingEndAuto) && dayValue(batch.trainingEndAuto) < today);
  const conflicts: [Batch, Batch][] = [];
  for (let left = 0; left < activeBatches.length; left++) for (let right = left + 1; right < activeBatches.length; right++) if (overlaps(activeBatches[left], activeBatches[right])) conflicts.push([activeBatches[left], activeBatches[right]]);
  const assignedTrainerIds = new Set(activeBatches.map(batch => text(batch.trainerCode).toLowerCase()).filter(Boolean));
  const activeTrainerCount = trainers.length;
  const assignedTrainers = trainers.filter(trainer => assignedTrainerIds.has(trainer.userId.toLowerCase())).length;
  const trainerUtilization = percent(assignedTrainers, activeTrainerCount);
  const scheduledPlanCount = associations.filter(item => item.status === 'Active' && plans.some(plan => plan.id === item.trainingPlanId && plan.status === 'Active')).length;
  const batchDataPresent = allBatches.length > 0;
  const participantDataPresent = allRegistrations.length > 0 || batches.some(batch => batch.plannedParticipants !== undefined || batch.plannedUsers !== undefined);
  const analyticsPresent = allAttendance.length > 0 || allAssessments.length > 0 || allFeedback.length > 0;
  const dateFmt = (value: unknown) => value ? formatDate(dayValue(value)) : 'Date pending';

  return <div className={`app schoolnet-dashboard ${sidebarCollapsed ? 'is-collapsed' : 'is-expanded'}`}><Sidebar /><main className="main"><Topbar title="Schoolnet Dashboard" description="Cross-project training delivery and operational monitoring." />
    <Box sx={{ width: '100%', maxWidth: 1600, mx: 'auto', pb: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="flex-end" spacing={1.5} sx={{ mb: 2 }}>
        {session?.role !== 'schoolnet-project-admin' && !superAdmin && <Box><Typography variant="h5" sx={{ color: '#12365c', fontWeight: 780, fontSize: 'clamp(22px,2.25vw,29px)', lineHeight: 1.2, letterSpacing: '-.7px' }}>Schoolnet monitoring</Typography><Typography variant="body2" color="text.secondary" sx={{ fontSize: 14 }}>Authorized projects for {session?.userId ?? ''}</Typography></Box>}
        <FormControl size="small" sx={{ minWidth: 240 }}><Select displayEmpty value={selectedProject} onChange={event => setSelectedProject(event.target.value)} inputProps={{ 'aria-label': 'Filter dashboard by project' }}><MenuItem value="">All Authorised Projects</MenuItem>{authorizedProjects.map(project => <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>)}</Select></FormControl>
      </Stack>
      {!batchDataPresent && <Alert severity="info" sx={{ mb: 2 }}>No batch records are available yet. Delivery metrics will populate as batches and training records are added.</Alert>}
      <Box className="kpis schoolnet-kpis">
        <MetricCard label="Projects" value={metricValue(projects.length)} detail={`${projects.filter(p => text(p.status).toLowerCase() === 'active').length} active · ${projects.filter(p => text(p.status).toLowerCase() === 'planning').length} planning`} />
        <MetricCard label="Active plans linked" value={metricValue(scheduledPlanCount)} detail={`${plans.filter(plan => plan.status === 'Active').length} reusable active definitions`} color="#078347" />
        <MetricCard label="Total batches" value={metricValue(batches.length)} detail={`${statusCounts.Scheduled} scheduled · ${statusCounts.Ongoing} ongoing · ${statusCounts.Completed} completed`} color="#7858a6" />
        <MetricCard label="Upcoming batches" value={metricValue(upcoming.length)} detail="Scheduled in the future" color="#cf7800" />
        <MetricCard label="Planned participants" value={participantDataPresent ? metricValue(plannedParticipants) : '—'} detail={`${metricValue(registered)} registered`} />
        <MetricCard label="Approved participants" value={participantDataPresent || registrations.length ? metricValue(approved) : '—'} detail={`${metricValue(trained)} trained`} color="#078347" />
        <MetricCard label="Attendance" value={attendanceRate === null ? '—' : `${attendanceRate}%`} detail={`${attendanceSummary.present} present / ${attendanceSummary.expected} expected · ${attendanceSummary.pending} pending · ${attendanceSummary.excluded} excluded`} color="#078347" />
        <MetricCard label="Training completion" value={completion.percentage === null ? '—' : `${completion.percentage}%`} detail={`${completion.completed} completed / ${completion.eligibleConfirmed} due confirmed · ${completion.pending} pending · ${completion.inProgress} in progress · ${completion.notCompleted} not completed · ${completion.notConfigured} not configured`} color="#078347" />
        <MetricCard label="Assessment completion" value={pctText(assessmentCompletionRate)} detail={assessments.length ? `${assessmentCompleted} of ${assessments.length} assessments complete` : 'Assessment records not available'} />
        <MetricCard label="Assessment pass rate" value={pctText(assessmentPassRate)} detail={assessmentCompleted ? `${assessmentPasses} passed of ${assessmentCompleted} completed` : 'Pass results not available'} color="#078347" />
        <MetricCard label="Feedback satisfaction" value={averageRating === null ? '—' : averageRating.toFixed(1)} detail={ratings.length ? `Average rating from ${ratings.length} responses` : 'Feedback records not available'} color="#7858a6" />
        <MetricCard label="Trainer utilization" value={trainerUtilization === null ? '—' : `${trainerUtilization}%`} detail={`${assignedTrainers} assigned · ${Math.max(activeTrainerCount - assignedTrainers, 0)} available of ${activeTrainerCount} active trainers`} color="#cf7800" />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.2fr .8fr' }, gap: 1.5, mt: 1.5 }}>
        <Paper className="panel schoolnet-panel" elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 1.5, fontSize: 12, '& .MuiTypography-body2': { fontSize: 12 }, '& .MuiTypography-caption': { fontSize: 10 }, '& .MuiChip-label': { fontSize: 10 }, '& .MuiAlert-message': { fontSize: 11 } }}>
          <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 750, fontSize: 15, letterSpacing: '-.15px' }}>Project and delivery status</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>{['Planning', 'Active', 'On Hold', 'Completed'].map(status => <Chip key={status} label={`${status}: ${projects.filter(project => text(project.status).toLowerCase() === status.toLowerCase()).length}`} size="small" variant="outlined" />)}</Stack>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#365772', fontSize: 12, fontWeight: 700 }}>Batches by status</Typography>
          {statusNames.map((status, index) => <Bar key={status} label={status} value={statusCounts[status]} total={batches.length} color={['#176fba', '#cf7800', '#078347', '#9aa9b7'][index]} />)}
          <Typography variant="caption" color="text.secondary">Training planned: {scheduledPlanCount} active project-plan associations · Batches scheduled: {statusCounts.Scheduled + statusCounts.Ongoing + statusCounts.Completed}</Typography>
        </Paper>
        <Paper className="panel schoolnet-panel" elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 1.5, fontSize: 12, '& .MuiTypography-body2': { fontSize: 12 }, '& .MuiTypography-caption': { fontSize: 10 }, '& .MuiChip-label': { fontSize: 10 }, '& .MuiAlert-message': { fontSize: 11 } }}>
          <Typography variant="h6" sx={{ fontWeight: 750, fontSize: 15, letterSpacing: '-.15px' }}>Scheduling watch</Typography>
          <Stack direction="row" spacing={1} sx={{ my: 1.3 }}><Chip color={conflicts.length ? 'error' : 'success'} size="small" label={`${conflicts.length} trainer conflicts`} /><Chip color={delayed.length ? 'warning' : 'success'} size="small" label={`${delayed.length} delayed batches`} /></Stack>
          {conflicts.length > 0 && <Alert severity="error" sx={{ mb: 1 }}>Trainer overlaps detected: {conflicts.slice(0, 3).map(([a, b]) => `${a.batchCode ?? a.id} / ${b.batchCode ?? b.id}`).join(', ')}.</Alert>}
          {delayed.length > 0 && <Alert severity="warning" sx={{ mb: 1 }}>{delayed.length} active batch(es) have a planned end date in the past.</Alert>}
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#365772', fontSize: 12, fontWeight: 700 }}>Upcoming batches</Typography>
          {upcoming.length ? upcoming.map(batch => <Box key={batch.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: .85, borderTop: '1px solid #edf1f5' }}><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{text(batch.batchCode) || text(batch.name) || 'Batch'}</Typography><Typography variant="caption" color="text.secondary">{projects.find(project => project.id === batch.projectId)?.name ?? 'Project'} · {batch.trainerCode || 'Trainer pending'}</Typography></Box><Typography variant="caption" sx={{ color: '#536e85', whiteSpace: 'nowrap' }}>{dateFmt(batch.trainingStartDate)}</Typography></Box>) : <Typography variant="body2" color="text.secondary">No upcoming batches are scheduled.</Typography>}
        </Paper>
      </Box>
      <Paper className="panel schoolnet-panel" elevation={0} sx={{ mt: 1.5, p: 2, border: '1px solid #e3ebf3', borderRadius: 1.5, '& .MuiTypography-caption': { fontSize: 10 }, '& .MuiChip-label': { fontSize: 10 } }}>
        <Typography variant="h6" sx={{ mb: 1.3, fontWeight: 750, fontSize: 15, letterSpacing: '-.15px' }}>Project health</Typography>
        {projects.length ? <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={{ width: '100%', minWidth: 920, borderCollapse: 'collapse', '& th': { textAlign: 'left', p: 1, bgcolor: '#f6f9fc', color: '#61778e', fontSize: 11 }, '& td': { p: 1, borderTop: '1px solid #edf1f5', fontSize: 11 } }}><thead><tr><th>Project</th><th>Status</th><th>Linked plans</th><th>Batches</th><th>Attendance</th><th>Completion</th><th>Risk</th></tr></thead><tbody>{projects.map(project => {
          const projectAssociations = associations.filter(item => item.projectId === project.id && item.status === 'Active');
          const projectBatches = batches.filter(batch => batch.projectId === project.id); const projectActive = projectBatches.filter(batch => !['Cancelled', 'Archived'].includes(text(batch.status)));
          const projectBatchIds = new Set(projectBatches.flatMap(batch => [batch.id, batch.batchCode ?? '', text(batch.uniqueId)]).filter(Boolean));
          const projectAttendanceSummary = calculateAttendance(projectActive, registrations.filter(row => projectBatchIds.has(text(row.batchId ?? row.batchCode ?? row.batchUniqueId))), attendance.filter(row => projectBatchIds.has(text(row.batchId ?? row.batchCode ?? row.batchUniqueId))), allExclusions);
          const completedBatches = projectBatches.filter(batch => text(batch.status).toLowerCase() === 'completed').length;
          const late = projectActive.filter(batch => text(batch.status).toLowerCase() !== 'completed' && dayValue(batch.trainingEndAuto) && dayValue(batch.trainingEndAuto) < today).length;
          const health = project.endDate && project.endDate < today && text(project.status).toLowerCase() !== 'completed' ? 'Project period elapsed' : late ? `${late} delayed batch(es)` : projectActive.some(batch => !batch.trainerCode) ? 'Trainer unassigned' : 'On track';
          return <tr key={project.id}><td><strong>{project.name}</strong><Typography variant="caption" display="block" color="text.secondary">{project.code ?? ''}</Typography></td><td>{project.status ?? '—'}</td><td>{projectAssociations.length}</td><td>{projectBatches.length}</td><td>{projectAttendanceSummary.percentage === null ? '—' : `${projectAttendanceSummary.percentage}%`}<Typography variant="caption" display="block" color="text.secondary">{projectAttendanceSummary.present}/{projectAttendanceSummary.expected} · {projectAttendanceSummary.pending} pending</Typography></td><td>{pctText(percent(completedBatches, projectActive.length))}</td><td><Chip size="small" label={health} color={health === 'On track' ? 'success' : 'warning'} /></td></tr>;
        })}</tbody></Box></Box> : <Typography color="text.secondary">No authorized projects are available.</Typography>}
      </Paper>
      {analyticsPresent && <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#71839a' }}>Participant and learning analytics are calculated from records available in this browser’s dashboard data.</Typography>}
    </Box><Footer /></main></div>;
}
