import { useMemo } from 'react';
import { Box, Button, Chip, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';

type Row = Record<string, unknown>;
type Batch = Row & { id: string; batchCode?: string; name?: string; projectId?: string; projectPlanAssociationId?: string; trainingPlanCode?: string; trainingDates?: string[]; trainingStartDate?: string; trainingEndAuto?: string; trainingStartTime?: string; trainingEndTime?: string; status?: string; venue?: string; schoolUdiseVenue?: string; meetingUrl?: string; meetingLink?: string; meetingDetails?: string; trainingPlanName?: string; resources?: string[]; assignedResources?: unknown[] };
type Plan = Row & { id: string; code?: string; name?: string; resources?: string[]; resourceAssignments?: { id?: string; resource: string; fromDay?: number; toDay?: number; throughProjectEnd?: boolean }[] };
const KEYS = { registrations: 'teacher-training-registrations', batches: 'teacher-training-batch-plan-uses', attendance: 'teacher-training-attendance-records', assessments: 'teacher-training-assessment-records', feedback: 'teacher-training-feedback-records', certificates: 'teacher-training-certificates', plans: 'teacher-training-plans', associations: 'teacher-training-project-plan-associations', forms: 'teacher-training-assessment-form-master' };
function readRows<T extends Row>(key: string): T[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as T[] : []; } catch { return []; } }
function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function date(value: unknown) { return text(value).slice(0, 10); }
function todayInBusinessZone() {
  const zone = import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || 'Asia/Kolkata';
  const dateAt = (timeZone: string) => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const values = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; };
  try { return dateAt(zone); } catch { return dateAt('Asia/Kolkata'); }
}
function rowBatch(row: Row) { return text(row.batchId ?? row.batchCode ?? row.batchUniqueId); }
function rowIds(row: Row) { return [row.userId, row.traineeId, row.participantId, row.studentId, row.beneficiaryId, row.candidateId].map(value => text(value).toLowerCase()).filter(Boolean); }
function approved(row: Row) { return row.approved === true || ['approved', 'confirmed', 'enrolled'].includes(text(row.status).toLowerCase()); }
function completed(row: Row) { return row.completed === true || ['completed', 'complete', 'submitted', 'graded', 'passed'].includes(text(row.status).toLowerCase()); }
function present(row: Row) { return row.present === true || row.attended === true || ['present', 'attended'].includes(text(row.status).toLowerCase()); }
function fmtDate(value: string) { if (!value) return 'Date pending'; return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
function batchIds(batch: Batch) { return new Set([batch.id, batch.batchCode ?? '', text(batch.uniqueId)].filter(Boolean)); }
function Metric({ label, value, detail, color = '#153f68' }: { label: string; value: string | number; detail: string; color?: string }) { return <Paper elevation={0} sx={{ p: 1.75, border: '1px solid #e3ebf3', borderRadius: 2, minHeight: 108 }}><Typography variant="caption" sx={{ fontWeight: 700, color: '#60788e' }}>{label}</Typography><Typography variant="h4" sx={{ mt: .5, fontWeight: 800, color, fontSize: 'clamp(22px,2vw,29px)' }}>{value}</Typography><Typography variant="caption" color="text.secondary">{detail}</Typography></Paper>; }

export default function TraineeDashboard() {
  const session = getSession();
  const traineeId = session?.userId ?? '';
  const registrations = useMemo(() => readRows<Row>(KEYS.registrations), []);
  const batches = useMemo(() => readRows<Batch>(KEYS.batches), []);
  const attendance = useMemo(() => readRows<Row>(KEYS.attendance), []);
  const assessments = useMemo(() => readRows<Row>(KEYS.assessments), []);
  const feedback = useMemo(() => readRows<Row>(KEYS.feedback), []);
  const certificates = useMemo(() => readRows<Row>(KEYS.certificates), []);
  const plans = useMemo(() => readRows<Plan>(KEYS.plans), []);
  const assessmentForms = useMemo(() => readRows<Row>(KEYS.forms), []);
  const associations = useMemo(() => readRows<Row>(KEYS.associations), []);
  const ownRegistrations = registrations.filter(row => rowIds(row).includes(traineeId.toLowerCase()) || text(row.id).toLowerCase() === traineeId.toLowerCase());
  const registrationIds = new Set(ownRegistrations.flatMap(row => [text(row.id), text(row.registrationId)]).filter(Boolean));
  const ownBatchRefs = new Set(ownRegistrations.map(rowBatch).filter(Boolean));
  const ownBatches = batches.filter(batch => [...batchIds(batch)].some(id => ownBatchRefs.has(id)));
  const batchById = new Map(ownBatches.flatMap(batch => [...batchIds(batch)].map(id => [id, batch] as const)));
  const isOwnRecord = (row: Row) => rowIds(row).includes(traineeId.toLowerCase()) || (text(row.registrationId) !== '' && registrationIds.has(text(row.registrationId)));
  const ownRelatedRecords = (rows: Row[]) => rows.filter(row => isOwnRecord(row) && (!rowBatch(row) || batchById.has(rowBatch(row))));
  const ownAttendance = ownRelatedRecords(attendance).sort((a, b) => date(b.trainingDate ?? b.attendanceDate ?? b.date).localeCompare(date(a.trainingDate ?? a.attendanceDate ?? a.date)));
  const ownAssessments = ownRelatedRecords(assessments);
  const ownFeedback = ownRelatedRecords(feedback);
  const ownCertificates = ownRelatedRecords(certificates).filter(row => row.issued === true || ['issued', 'generated', 'available', 'delivered'].includes(text(row.status).toLowerCase()) || Boolean(row.downloadUrl ?? row.certificateUrl));
  const approvedRegistrations = ownRegistrations.filter(approved);
  const today = todayInBusinessZone();
  const upcomingSessions = ownBatches.flatMap(batch => {
    const sessionDates = Array.isArray(batch.trainingDates) && batch.trainingDates.length ? batch.trainingDates.map(date) : [date(batch.trainingStartDate)].filter(Boolean);
    return sessionDates.filter(sessionDate => sessionDate >= today && (!date(batch.trainingEndAuto) || sessionDate <= date(batch.trainingEndAuto))).map(sessionDate => ({ batch, date: sessionDate }));
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
  const resourceList = ownBatches.flatMap(batch => {
    const association = associations.find(row => text(row.id) === text(batch.projectPlanAssociationId));
    const plan = plans.find(item => item.id === text(association?.trainingPlanId) || item.code === batch.trainingPlanCode);
    const assignmentRows = (plan?.resourceAssignments ?? []).map(item => ({ name: item.resource, range: item.throughProjectEnd ? `Day ${item.fromDay ?? 1}+` : item.fromDay === item.toDay ? `Day ${item.fromDay ?? 1}` : `Days ${item.fromDay ?? 1}–${item.toDay ?? ''}` }));
    const names = [...new Set([...(plan?.resources ?? []), ...(Array.isArray(batch.resources) ? batch.resources.map(String) : [])])];
    return [...assignmentRows, ...names.filter(name => !assignmentRows.some(item => item.name === name)).map(name => ({ name, range: 'Assigned to batch' }))].map(item => ({ ...item, batch }));
  });
  const pendingAssessments = ownAssessments.filter(row => !completed(row));
  const pendingFeedback = ownFeedback.filter(row => !row.submitted && !row.completed && !['submitted', 'completed', 'complete', 'received'].includes(text(row.status).toLowerCase()));
  const expectedResources = resourceList.filter(item => /assessment/i.test(item.name));
  const feedbackResources = resourceList.filter(item => /feedback|survey/i.test(item.name));
  const assessmentResourcesPending = expectedResources.filter(item => !ownAssessments.some(row => batchIds(item.batch).has(rowBatch(row))));
  const feedbackResourcesPending = feedbackResources.filter(item => !ownFeedback.some(row => batchIds(item.batch).has(rowBatch(row)) && (row.submitted === true || row.completed === true || ['submitted', 'completed', 'complete', 'received'].includes(text(row.status).toLowerCase()))));
  const assessmentTaskCount = pendingAssessments.length + assessmentResourcesPending.length;
  const feedbackTaskCount = pendingFeedback.length + feedbackResourcesPending.length;
  const mandatoryFormsComplete = (registration: Row) => {
    const batch = batchById.get(rowBatch(registration));
    if (!batch) return true;
    const planCode = text(batch.trainingPlanCode);
    const requiredForms = assessmentForms.filter(form => form.mandatory === true && (text(form.planCode) === '*' || text(form.planCode) === planCode));
    return requiredForms.every(form => [...ownAssessments, ...ownFeedback].some(result => text(result.formId) === text(form.id) && batchIds(batch).has(rowBatch(result)) && (result.completed === true || ['submitted', 'completed', 'complete', 'graded', 'passed'].includes(text(result.status).toLowerCase()))));
  };
  const registrationComplete = (row: Row) => (completed(row) || ownBatches.some(batch => batchIds(batch).has(rowBatch(row)) && text(batch.status).toLowerCase() === 'completed')) && mandatoryFormsComplete(row);
  const trainingDone = ownRegistrations.filter(registrationComplete).length;
  const completionRate = ownRegistrations.length ? Math.round(trainingDone / ownRegistrations.length * 100) : 0;
  const ownName = text(ownRegistrations[0]?.traineeName ?? ownRegistrations[0]?.participantName ?? ownRegistrations[0]?.name) || traineeId;

  return <div className="app"><Sidebar /><main className="main"><Topbar title="Trainee Dashboard" description={`Your training, learning tasks, and records · ${ownName}`} />
    <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.25 }}>
        <Metric label="Registered batches" value={ownRegistrations.length} detail={`${approvedRegistrations.length} approved`} />
        <Metric label="Upcoming sessions" value={upcomingSessions.length} detail="Across your registered batches" />
        <Metric label="Pending assessments" value={assessmentTaskCount} detail="Assigned assessment tasks" color={assessmentTaskCount ? '#b66b00' : '#078347'} />
        <Metric label="Available certificates" value={ownCertificates.length} detail="Issued to your account" color="#7858a6" />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.05fr .95fr' }, gap: 1.5, mt: 1.5 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 750 }}>My registered batches</Typography><Button size="small" href={`${import.meta.env.BASE_URL}content-library`} sx={{ textTransform: 'none' }}>Learning library</Button></Stack>{ownRegistrations.length ? <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Batch</TableCell><TableCell>Registration</TableCell><TableCell>Approval</TableCell></TableRow></TableHead><TableBody>{ownRegistrations.map((registration, index) => { const batch = batchById.get(rowBatch(registration)); const status = text(registration.status) || 'Registered'; return <TableRow key={`${text(registration.id) || rowBatch(registration)}-${index}`}><TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{batch?.batchCode || text(registration.batchCode) || 'Training batch'}</Typography><Typography variant="caption" color="text.secondary">{batch?.trainingPlanName || batch?.trainingPlanCode || ''}</Typography></TableCell><TableCell>{text(registration.registrationStatus) || 'Registered'}</TableCell><TableCell><Chip size="small" color={approved(registration) ? 'success' : ['rejected', 'cancelled'].includes(status.toLowerCase()) ? 'default' : 'warning'} label={approved(registration) ? 'Approved' : status} /></TableCell></TableRow>; })}</TableBody></Table></TableContainer> : <Typography variant="body2" color="text.secondary">No registrations found for your trainee account.</Typography>}</Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>Training schedule and meeting details</Typography>{upcomingSessions.length ? <Stack spacing={.75}>{upcomingSessions.slice(0, 7).map(({ batch, date: sessionDate }) => <Box key={`${batch.id}-${sessionDate}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.25, py: .75, borderTop: '1px solid #edf1f5' }}><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{batch.batchCode || batch.name || 'Training session'}</Typography><Typography variant="caption" color="text.secondary">{batch.trainingStartTime || 'Time pending'}{batch.trainingEndTime ? `–${batch.trainingEndTime}` : ''} · {text(batch.venue ?? batch.schoolUdiseVenue) || 'Venue pending'}</Typography>{(batch.meetingUrl || batch.meetingLink || batch.meetingDetails) && <Typography variant="caption" display="block" color="text.secondary">{batch.meetingDetails || 'Meeting details available'}{(batch.meetingUrl || batch.meetingLink) && <> · <a href={text(batch.meetingUrl ?? batch.meetingLink)} target="_blank" rel="noreferrer">Join meeting</a></>}</Typography>}</Box><Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>{fmtDate(sessionDate)}</Typography></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">No upcoming sessions have been scheduled for your batches.</Typography>}</Paper>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5, mt: 1.5 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>Assigned learning resources</Typography>{resourceList.length ? <Stack spacing={.75}>{resourceList.map((item, index) => <Box key={`${item.batch.id}-${item.name}-${index}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: .65, borderTop: '1px solid #edf1f5' }}><Typography variant="body2" sx={{ fontWeight: 650 }}>{item.name}</Typography><Typography variant="caption" color="text.secondary">{item.batch.batchCode || 'Batch'} · {item.range}</Typography></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">No batch-specific resources are assigned yet. Browse the learning library for available materials.</Typography>}<Button size="small" href={`${import.meta.env.BASE_URL}content-library`} sx={{ mt: 1, textTransform: 'none' }}>Open learning library</Button></Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 750 }}>Pending assessments and feedback</Typography><Button size="small" href={`${import.meta.env.BASE_URL}assessments`} sx={{ textTransform: 'none' }}>Open tasks</Button></Stack><Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.25 }}><Chip size="small" color={assessmentTaskCount ? 'warning' : 'success'} variant="outlined" label={`${assessmentTaskCount} assessment task(s)`} /><Chip size="small" color={feedbackTaskCount ? 'warning' : 'success'} variant="outlined" label={`${feedbackTaskCount} feedback task(s)`} /></Stack>{pendingAssessments.map((row, index) => <Typography key={`assessment-${index}`} variant="body2" sx={{ py: .5, borderTop: '1px solid #edf1f5' }}>{text(row.title ?? row.assessmentName) || 'Assessment'} · {text(row.status) || 'Pending'}</Typography>)}{assessmentResourcesPending.map((item, index) => <Typography key={`assessment-resource-${index}`} variant="body2" sx={{ py: .5, borderTop: '1px solid #edf1f5' }}>{item.name} · {item.batch.batchCode || 'Batch'}</Typography>)}{pendingFeedback.map((row, index) => <Typography key={`feedback-${index}`} variant="body2" sx={{ py: .5, borderTop: '1px solid #edf1f5' }}>{text(row.title ?? row.formName) || 'Feedback form'} · {text(row.status) || 'Pending'}</Typography>)}{feedbackResourcesPending.map((item, index) => <Typography key={`feedback-resource-${index}`} variant="body2" sx={{ py: .5, borderTop: '1px solid #edf1f5' }}>{item.name} · {item.batch.batchCode || 'Batch'}</Typography>)}{!pendingAssessments.length && !assessmentResourcesPending.length && !pendingFeedback.length && !feedbackResourcesPending.length && <Typography variant="body2" color="text.secondary">No pending assessment or feedback tasks are recorded.</Typography>}</Paper>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5, mt: 1.5 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>My attendance record</Typography>{ownAttendance.length ? <TableContainer sx={{ maxHeight: 300 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Batch</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{ownAttendance.slice(0, 12).map((row, index) => { const batch = batchById.get(rowBatch(row)); const status = present(row) ? 'Present' : text(row.status) || 'Absent'; return <TableRow key={`${text(row.id) || index}`}><TableCell>{fmtDate(date(row.trainingDate ?? row.attendanceDate ?? row.date))}</TableCell><TableCell>{batch?.batchCode || rowBatch(row) || '—'}</TableCell><TableCell><Chip size="small" color={status.toLowerCase() === 'present' ? 'success' : 'default'} label={status} /></TableCell></TableRow>; })}</TableBody></Table></TableContainer> : <Typography variant="body2" color="text.secondary">No attendance records are available for your registrations.</Typography>}</Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" sx={{ fontWeight: 750 }}>Training completion</Typography><Typography variant="body2" sx={{ fontWeight: 750 }}>{trainingDone} / {ownRegistrations.length}</Typography></Stack><LinearProgress variant="determinate" value={completionRate} color="success" sx={{ mt: 1, mb: 1.3, height: 8, borderRadius: 5 }} />{ownRegistrations.length ? <Stack spacing={.65}>{ownRegistrations.map((row, index) => { const batch = batchById.get(rowBatch(row)); const isComplete = registrationComplete(row); return <Box key={`${text(row.id) || index}-completion`} sx={{ display: 'flex', justifyContent: 'space-between', py: .55, borderTop: '1px solid #edf1f5' }}><Typography variant="body2">{batch?.batchCode || text(row.batchCode) || 'Batch'}</Typography><Chip size="small" color={isComplete ? 'success' : 'default'} label={isComplete ? 'Completed' : text(batch?.status) || 'In progress'} /></Box>; })}</Stack> : <Typography variant="body2" color="text.secondary">Your completion status will appear after registration.</Typography>}</Paper>
      </Box>
      <Paper elevation={0} sx={{ p: 2, mt: 1.5, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>Available certificates</Typography>{ownCertificates.length ? <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">{ownCertificates.map((row, index) => { const batch = batchById.get(rowBatch(row)); const link = text(row.downloadUrl ?? row.certificateUrl); return <Paper key={`${text(row.id) || index}`} variant="outlined" sx={{ p: 1.25, minWidth: 220, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{text(row.title ?? row.certificateName) || 'Training certificate'}</Typography><Typography variant="caption" color="text.secondary">{batch?.batchCode || text(row.batchCode) || 'Completed batch'}</Typography></Box>{link ? <Button size="small" href={link} target="_blank" rel="noreferrer" sx={{ textTransform: 'none' }}>View</Button> : <Chip size="small" color="success" label="Issued" />}</Paper>; })}</Stack> : <Typography variant="body2" color="text.secondary">No certificates have been issued to your trainee account.</Typography>}</Paper>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>This dashboard only displays registrations and learning records linked to your signed-in trainee account.</Typography>
    </Box><Footer /></main></div>;
}
