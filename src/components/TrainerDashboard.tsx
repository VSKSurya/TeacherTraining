import { useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';

type Row = Record<string, unknown>;
type Batch = Row & { id: string; batchCode?: string; name?: string; trainerCode?: string; trainerName?: string; projectId?: string; projectName?: string; projectPlanAssociationId?: string; trainingPlanCode?: string; trainingDates?: string[]; trainingStartDate?: string; trainingEndAuto?: string; trainingDuration?: number; trainingStartTime?: string; trainingEndTime?: string; status?: string; schoolUdiseVenue?: string; state?: string; district?: string };
type Plan = Row & { id: string; code?: string; name?: string; resources?: string[]; resourceAssignments?: { id?: string; resource: string; fromDay?: number; toDay?: number }[] };
const KEYS = { batches: 'teacher-training-batch-plan-uses', registrations: 'teacher-training-registrations', attendance: 'teacher-training-attendance-records', assessments: 'teacher-training-assessment-records', feedback: 'teacher-training-feedback-records', plans: 'teacher-training-plans', associations: 'teacher-training-project-plan-associations', resourceUsage: 'teacher-training-resource-usage' };
function readRows<T extends Row>(key: string): T[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as T[] : []; } catch { return []; } }
function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function date(value: unknown) { return text(value).slice(0, 10); }
function businessToday() {
  const zone = import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || 'Asia/Kolkata';
  const asDate = (timeZone: string) => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const values = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; };
  try { return asDate(zone); } catch { return asDate('Asia/Kolkata'); }
}
function scheduledDays(batch: Batch) {
  if (Array.isArray(batch.trainingDates) && batch.trainingDates.length) return [...new Set(batch.trainingDates.map(date).filter(Boolean))].sort();
  const start = date(batch.trainingStartDate); if (!start) return [];
  const current = new Date(`${start}T12:00:00`); const dates: string[] = []; const duration = Math.max(1, Math.min(365, Number(batch.trainingDuration) || 1));
  while (dates.length < duration) { if (current.getDay() !== 0 && current.getDay() !== 6) dates.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`); current.setDate(current.getDate() + 1); }
  return dates;
}
function batchRef(row: Row) { return text(row.batchId ?? row.batchCode ?? row.batchUniqueId); }
function personRef(row: Row) { return text(row.traineeId ?? row.participantId ?? row.userId ?? row.registrationId ?? row.id); }
function isApproved(row: Row) { return row.approved === true || ['approved', 'confirmed', 'enrolled'].includes(text(row.status).toLowerCase()); }
function isPendingApproval(row: Row) { return row.approved === false || ['pending', 'submitted', 'awaiting approval', 'requested'].includes(text(row.status).toLowerCase()); }
function isDone(row: Row) { return row.completed === true || ['completed', 'complete', 'submitted', 'graded', 'passed'].includes(text(row.status).toLowerCase()); }
function fmtDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
function dayKey(dateValue: Date) { return `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`; }
function Card({ title, value, detail, color = '#153f68' }: { title: string; value: string | number; detail: string; color?: string }) { return <Paper elevation={0} sx={{ p: 1.75, border: '1px solid #e3ebf3', borderRadius: 2, minHeight: 112 }}><Typography variant="caption" sx={{ color: '#60788e', fontWeight: 700 }}>{title}</Typography><Typography variant="h4" sx={{ mt: .6, color, fontWeight: 800, fontSize: 'clamp(23px,2vw,30px)', letterSpacing: '-.6px' }}>{value}</Typography><Typography variant="caption" color="text.secondary">{detail}</Typography></Paper>; }

export default function TrainerDashboard() {
  const session = getSession();
  const batches = useMemo(() => readRows<Batch>(KEYS.batches), []);
  const registrations = useMemo(() => readRows<Row>(KEYS.registrations), []);
  const attendance = useMemo(() => readRows<Row>(KEYS.attendance), []);
  const assessments = useMemo(() => readRows<Row>(KEYS.assessments), []);
  const feedback = useMemo(() => readRows<Row>(KEYS.feedback), []);
  const plans = useMemo(() => readRows<Plan>(KEYS.plans), []);
  const associations = useMemo(() => readRows<Row>(KEYS.associations), []);
  const resourceUsage = useMemo(() => readRows<Row>(KEYS.resourceUsage), []);
  const userId = session?.userId ?? '';
  const myBatches = batches.filter(batch => text(batch.trainerCode).toLowerCase() === userId.toLowerCase() && !['cancelled', 'archived'].includes(text(batch.status).toLowerCase()));
  const identifiers = (batch: Batch) => new Set([batch.id, batch.batchCode ?? '', text(batch.uniqueId)].filter(Boolean));
  const related = (rows: Row[], batch: Batch) => rows.filter(row => identifiers(batch).has(batchRef(row)));
  const activeBatches = myBatches.filter(batch => !['completed'].includes(text(batch.status).toLowerCase()));
  const today = businessToday();
  const upcoming = myBatches.flatMap(batch => scheduledDays(batch).filter(day => day >= today).map(day => ({ batch, day }))).sort((a, b) => a.day.localeCompare(b.day)).slice(0, 10);
  const assignedDates = new Map<string, Batch[]>();
  for (const batch of activeBatches) for (const day of scheduledDays(batch)) assignedDates.set(day, [...(assignedDates.get(day) ?? []), batch]);
  const conflicts: { date: string; first: Batch; second: Batch; possible: boolean }[] = [];
  for (const [dateValue, dayBatches] of assignedDates) for (let left = 0; left < dayBatches.length; left++) for (let right = left + 1; right < dayBatches.length; right++) {
    const first = dayBatches[left], second = dayBatches[right];
    const firstStart = text(first.trainingStartTime), firstEnd = text(first.trainingEndTime), secondStart = text(second.trainingStartTime), secondEnd = text(second.trainingEndTime);
    const possible = !firstStart || !firstEnd || !secondStart || !secondEnd;
    if (possible || (firstStart < secondEnd && secondStart < firstEnd)) conflicts.push({ date: dateValue, first, second, possible });
  }
  const pendingApprovals = myBatches.flatMap(batch => related(registrations, batch).filter(isPendingApproval).map(row => ({ batch, row })));
  const attendanceByDay = myBatches.flatMap(batch => {
    const ids = identifiers(batch); const trainees = related(registrations, batch).filter(row => !['cancelled', 'rejected', 'withdrawn'].includes(text(row.status).toLowerCase()));
    return scheduledDays(batch).filter(day => day <= today).flatMap(day => {
      const saved = related(attendance, batch).filter(row => date(row.trainingDate ?? row.attendanceDate ?? row.date) === day);
      const presentIds = new Set(saved.map(personRef).filter(Boolean));
      const missing = trainees.filter(person => { const id = personRef(person); return !id || !presentIds.has(id); });
      return missing.length ? [{ batch, day, missing: missing.length }] : [];
    });
  }).sort((a, b) => a.day.localeCompare(b.day));
  const pendingAssessmentTasks = myBatches.flatMap(batch => {
    const trainees = related(registrations, batch).filter(row => isApproved(row) || !row.status);
    const doneRecords = related(assessments, batch).filter(isDone);
    const pending = Math.max(0, trainees.length - doneRecords.length);
    return pending ? [{ batch, pending, total: trainees.length }] : [];
  });
  const pendingFeedbackTasks = myBatches.flatMap(batch => {
    const trainees = related(registrations, batch).filter(row => isApproved(row) || !row.status);
    const responses = related(feedback, batch).length;
    const pending = Math.max(0, trainees.length - responses);
    return pending ? [{ batch, pending, total: trainees.length }] : [];
  });
  const completedCount = myBatches.filter(batch => text(batch.status).toLowerCase() === 'completed').length;
  const completionPercent = myBatches.length ? Math.round(completedCount / myBatches.length * 100) : 0;
  const calendarBase = (() => { const [year, month] = today.split('-').map(Number); return new Date(year, month - 1, 1); })();
  const [visibleMonth, setVisibleMonth] = useState(calendarBase);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(today);
  const monthYear = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const calendarCells: (Date | null)[] = [...Array(visibleMonth.getDay()).fill(null)];
  for (let day = 1; day <= new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate(); day++) calendarCells.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
  while (calendarCells.length % 7) calendarCells.push(null);
  const selectedDayBatches = assignedDates.get(selectedCalendarDay) ?? [];
  const resourceRows = myBatches.flatMap(batch => {
    const association = associations.find(row => text(row.id) === text(batch.projectPlanAssociationId));
    const plan = plans.find(item => item.id === text(association?.trainingPlanId) || item.code === batch.trainingPlanCode);
    const names = [...new Set([...(plan?.resources ?? []), ...(plan?.resourceAssignments ?? []).map(item => item.resource)].filter(Boolean))];
    return names.map(name => ({ batch, name, usage: resourceUsage.filter(row => identifiers(batch).has(batchRef(row)) && text(row.resource ?? row.resourceName ?? row.contentTitle) === name).length }));
  });
  const batchCompletionLabel = (batch: Batch) => text(batch.status) || 'Scheduled';

  return <div className="app"><Sidebar /><main className="main"><Topbar title="Trainer Dashboard" description={`Your assigned training schedule and delivery tasks · ${userId}`} />
    <Box sx={{ maxWidth: 1480, mx: 'auto', pb: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.25 }}>
        <Card title="Upcoming sessions" value={upcoming.length} detail="Future and today's scheduled dates" />
        <Card title="Assigned batches" value={myBatches.length} detail={`${activeBatches.length} active · ${completedCount} completed`} />
        <Card title="Registration approvals" value={pendingApprovals.length} detail="Awaiting your review" color={pendingApprovals.length ? '#b66b00' : '#078347'} />
        <Card title="Attendance pending" value={attendanceByDay.length} detail="Past training dates with unmarked trainees" color={attendanceByDay.length ? '#b66b00' : '#078347'} />
      </Box>
      {!myBatches.length && <Alert severity="info" sx={{ mt: 1.5 }}>No batches are assigned to {userId}. Your schedule will appear here after an administrator assigns you as trainer.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.15fr .85fr' }, gap: 1.5, mt: 1.5 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ mb: 1.25 }}><Box><Typography variant="h6" sx={{ fontWeight: 750 }}>Availability calendar</Typography><Typography variant="caption" color="text.secondary">Scheduled dates show your assigned sessions. Multiple sessions on one day are flagged for a time check.</Typography></Box><Stack direction="row" spacing={.5} alignItems="center"><Button size="small" aria-label="Previous month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>‹</Button><Typography variant="body2" sx={{ minWidth: 135, textAlign: 'center', fontWeight: 700 }}>{monthYear}</Typography><Button size="small" aria-label="Next month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>›</Button></Stack></Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: .5 }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Typography key={day} variant="caption" align="center" sx={{ color: '#6c8297', fontWeight: 700, py: .5 }}>{day}</Typography>)}{calendarCells.map((cell, index) => { if (!cell) return <Box key={`empty-${index}`} />; const key = dayKey(cell); const scheduled = assignedDates.get(key) ?? []; const isSelected = key === selectedCalendarDay; return <Button key={key} onClick={() => setSelectedCalendarDay(key)} aria-label={`${fmtDate(key)}${scheduled.length ? `, ${scheduled.length} assigned session(s)` : ', available'}`} sx={{ minWidth: 0, minHeight: 52, p: .5, display: 'flex', flexDirection: 'column', gap: .15, border: isSelected ? '2px solid #176fba' : '1px solid #e9eff5', bgcolor: key === today ? '#eff7ff' : '#fff', color: '#193b58' }}><Typography variant="body2" sx={{ fontWeight: key === today ? 800 : 600 }}>{cell.getDate()}</Typography>{scheduled.length > 0 && <Box sx={{ display: 'flex', gap: .25 }}>{scheduled.slice(0, 3).map((item, dot) => <Box key={`${item.id}-${dot}`} sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: conflicts.some(conflict => conflict.date === key && (conflict.first.id === item.id || conflict.second.id === item.id)) ? '#d64a4a' : '#21835b' }} />)}</Box>}</Button>; })}</Box>
          <Box sx={{ mt: 1.5, p: 1.25, bgcolor: '#f7fafd', borderRadius: 1.5 }}><Typography variant="subtitle2" sx={{ fontWeight: 750, mb: .5 }}>{fmtDate(selectedCalendarDay)} · {selectedDayBatches.length ? `${selectedDayBatches.length} assigned session(s)` : 'Available'}</Typography>{selectedDayBatches.length ? selectedDayBatches.map(batch => <Typography key={batch.id} variant="body2" color="text.secondary">{batch.batchCode || batch.name || 'Batch'} · {batch.trainingStartTime || 'Time not set'}–{batch.trainingEndTime || 'Time not set'}</Typography>) : <Typography variant="body2" color="text.secondary">No assigned training sessions on this date.</Typography>}</Box>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 750 }}>Trainer allocation conflicts</Typography><Chip size="small" label={`${conflicts.length} flagged`} color={conflicts.length ? 'error' : 'success'} /></Stack>{conflicts.length ? <Stack spacing={.8}>{conflicts.slice(0, 8).map((item, index) => <Box key={`${item.date}-${index}`} sx={{ py: .8, borderTop: '1px solid #edf1f5' }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{fmtDate(item.date)} · {item.possible ? 'Time check needed' : 'Overlapping allocation'}</Typography><Typography variant="caption" color="text.secondary">{item.first.batchCode || item.first.name} ({item.first.trainingStartTime || '?'}–{item.first.trainingEndTime || '?'}) · {item.second.batchCode || item.second.name} ({item.second.trainingStartTime || '?'}–{item.second.trainingEndTime || '?'})</Typography></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">No overlapping trainer allocations were detected.</Typography>}</Paper>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5, mt: 1.5 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 750 }}>Upcoming and assigned batches</Typography><Stack direction="row" spacing={.5}><Button size="small" href={`${import.meta.env.BASE_URL}trainers`} sx={{ textTransform: 'none' }}>Availability</Button><Button size="small" href={`${import.meta.env.BASE_URL}batches`} sx={{ textTransform: 'none' }}>Open batches</Button></Stack></Stack>{upcoming.length ? <Stack spacing={.6}>{upcoming.slice(0, 6).map(({ batch, day }) => <Box key={`${batch.id}-${day}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: .8, borderTop: '1px solid #edf1f5' }}><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{batch.batchCode || batch.name || 'Training batch'}</Typography><Typography variant="caption" color="text.secondary">{text(batch.projectName) || text(batch.state) || 'Assigned session'} · {batch.trainingStartTime || 'Time not set'}–{batch.trainingEndTime || 'Time not set'}</Typography></Box><Stack alignItems="flex-end" spacing={.45}><Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>{fmtDate(day)}</Typography><Chip size="small" variant="outlined" label={batchCompletionLabel(batch)} /></Stack></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">No future or today's training dates are scheduled.</Typography>}</Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>Attendance pending by day</Typography>{attendanceByDay.length ? <TableContainer sx={{ maxHeight: 260 }}><Table size="small"><TableHead><TableRow><TableCell>Training date</TableCell><TableCell>Batch</TableCell><TableCell align="right">Missing trainee marks</TableCell></TableRow></TableHead><TableBody>{attendanceByDay.slice(0, 12).map(item => <TableRow key={`${item.batch.id}-${item.day}`}><TableCell>{fmtDate(item.day)}</TableCell><TableCell>{item.batch.batchCode || item.batch.name || 'Batch'}</TableCell><TableCell align="right"><Chip size="small" color="warning" label={item.missing} /></TableCell></TableRow>)}</TableBody></Table></TableContainer> : <Typography variant="body2" color="text.secondary">All past assigned training dates have attendance recorded, or no trainee registrations are available.</Typography>}</Paper>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5, mt: 1.5 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 750 }}>Pending registration approvals</Typography><Button size="small" href={`${import.meta.env.BASE_URL}registration-requests`} sx={{ textTransform: 'none' }}>Review</Button></Stack>{pendingApprovals.length ? <Stack spacing={.7}>{pendingApprovals.slice(0, 8).map(({ batch, row }, index) => <Box key={`${batch.id}-${personRef(row)}-${index}`} sx={{ display: 'flex', justifyContent: 'space-between', py: .7, borderTop: '1px solid #edf1f5' }}><Typography variant="body2">{text(row.traineeName ?? row.participantName ?? row.name ?? personRef(row)) || 'Trainee'} · {batch.batchCode || 'Batch'}</Typography><Chip size="small" color="warning" label={text(row.status) || 'Pending'} /></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">No registration approvals are pending for your assigned batches.</Typography>}</Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}><Typography variant="h6" sx={{ fontWeight: 750 }}>Assessment and feedback tasks</Typography><Button size="small" href={`${import.meta.env.BASE_URL}assessments`} sx={{ textTransform: 'none' }}>Open</Button></Stack><Stack direction="row" spacing={1} sx={{ mb: 1.1 }}><Chip size="small" color={pendingAssessmentTasks.length ? 'warning' : 'success'} variant="outlined" label={`${pendingAssessmentTasks.reduce((sum, task) => sum + task.pending, 0)} assessment(s) pending`} /><Chip size="small" color={pendingFeedbackTasks.length ? 'warning' : 'success'} variant="outlined" label={`${pendingFeedbackTasks.reduce((sum, task) => sum + task.pending, 0)} feedback response(s) pending`} /></Stack>{pendingAssessmentTasks.length || pendingFeedbackTasks.length ? <Stack spacing={.75}>{[...pendingAssessmentTasks.map(task => ({ ...task, type: 'Assessment' })), ...pendingFeedbackTasks.map(task => ({ ...task, type: 'Feedback' }))].slice(0, 8).map((task, index) => <Box key={`${task.type}-${task.batch.id}-${index}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: .6, borderTop: '1px solid #edf1f5' }}><Typography variant="body2">{task.batch.batchCode || 'Batch'} · {task.type}</Typography><Typography variant="caption" color="text.secondary">{task.pending} of {task.total} trainees</Typography></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">No assessment or feedback tasks are pending.</Typography>}</Paper>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5, mt: 1.5 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" sx={{ fontWeight: 750 }}>Batch completion status</Typography><Typography variant="body2" sx={{ fontWeight: 750 }}>{completedCount} / {myBatches.length}</Typography></Stack><LinearProgress variant="determinate" value={completionPercent} color="success" sx={{ mt: 1, mb: 1.25, height: 8, borderRadius: 5 }} />{myBatches.length ? <Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap">{myBatches.map(batch => <Chip key={batch.id} size="small" variant="outlined" color={text(batch.status).toLowerCase() === 'completed' ? 'success' : text(batch.status).toLowerCase() === 'cancelled' ? 'default' : 'primary'} label={`${batch.batchCode || batch.name || 'Batch'} · ${batchCompletionLabel(batch)}`} />)}</Stack> : <Typography variant="body2" color="text.secondary">No assigned batches are available.</Typography>}</Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>Resource access and usage</Typography>{resourceRows.length ? <Stack spacing={.65}>{resourceRows.slice(0, 10).map((item, index) => <Box key={`${item.batch.id}-${item.name}-${index}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: .6, borderTop: '1px solid #edf1f5' }}><Typography variant="body2">{item.name} · {item.batch.batchCode || 'Batch'}</Typography><Typography variant="caption" color="text.secondary">{item.usage ? `${item.usage} usage record(s)` : 'Available · usage not recorded'}</Typography></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">No batch-linked resources or usage records are available.</Typography>}</Paper>
      </Box>
    </Box><Footer /></main></div>;
}
