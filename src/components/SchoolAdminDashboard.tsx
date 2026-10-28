import { useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { formatDate } from '../dateFormat';
import { calculateAttendance } from '../attendanceMetrics';
import { buildTrainingCompletionRows, summarizeTrainingCompletion } from '../completion';
import { getSession } from '../auth';
import { kgbvSchools, type KgbvSchool } from '../data/kgbvSchools';
import { batchIdentifiers } from '../batchCodes';

type Row = Record<string, unknown>;
type Batch = Row & { id: string; batchCode?: string; projectId?: string; schoolUdiseVenue?: string; status?: string; trainingStartDate?: string; trainingEndAuto?: string; trainingDates?: string[]; trainingStartTime?: string; trainingEndTime?: string; trainingCycle?: string; trainerCode?: string };
const KEYS = { projects: 'teacher-training-projects', batches: 'teacher-training-batch-plan-uses', registrations: 'teacher-training-registrations', attendance: 'teacher-training-attendance-records', exclusions: 'teacher-training-attendance-exclusions', assessments: 'teacher-training-assessment-records', feedback: 'teacher-training-feedback-records', certificates: 'teacher-training-certificates', eligible: 'teacher-training-eligible-participants', eligibleTeachers: 'teacher-training-eligible-teachers', eligibleStudents: 'teacher-training-eligible-students', schoolEligibility: 'teacher-training-school-eligibility', schoolAccess: 'teacher-training-school-access', schoolAssignments: 'teacher-training-school-admin-assignments' };
function readRows<T extends Row>(key: string): T[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as T[] : []; } catch { return []; } }
function readStored(key: string): unknown { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } }
function str(value: unknown) { return typeof value === 'string' ? value : ''; }
function rowSchool(row: Row) { return str(row.schoolUdise ?? row.schoolUdiseVenue ?? row.udise ?? row.schoolId); }
function rowBatch(row: Row) { return str(row.batchId ?? row.batchCode ?? row.batchUniqueId); }
function present(row: Row) { return row.present === true || row.attended === true || ['present', 'attended'].includes(str(row.status).toLowerCase()); }
function approved(row: Row) { return row.approved === true || ['approved', 'confirmed', 'enrolled'].includes(str(row.status).toLowerCase()); }
function done(row: Row) { return row.completed === true || ['completed', 'complete', 'submitted', 'graded', 'passed'].includes(str(row.status).toLowerCase()); }
function date(value: unknown) { return str(value).slice(0, 10); }
function businessToday() {
  const zone = import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || 'Asia/Kolkata';
  try { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const values = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; }
  catch { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const values = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; }
}
function schoolAssignmentsFor(userId: string) {
  const result = new Set<string>();
  for (const key of [KEYS.schoolAccess, KEYS.schoolAssignments]) {
    const value = readStored(key);
    if (Array.isArray(value)) for (const row of value) {
      if (typeof row === 'string') { if (key === KEYS.schoolAccess) result.add(row); continue; }
      if (!row || typeof row !== 'object') continue;
      const record = row as Row;
      if (str(record.userId).toLowerCase() === userId.toLowerCase() || (Array.isArray(record.assignedUsers) && record.assignedUsers.map(String).some(user => user.toLowerCase() === userId.toLowerCase()))) {
        const id = rowSchool(record); if (id) result.add(id);
      }
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const userRows = (value as Record<string, unknown>)[userId] ?? (value as Record<string, unknown>)[userId.toLowerCase()];
      if (Array.isArray(userRows)) userRows.forEach(item => { if (typeof item === 'string') result.add(item); else if (item && typeof item === 'object') { const id = rowSchool(item as Row); if (id) result.add(id); } });
      else if (typeof userRows === 'string') result.add(userRows);
    }
  }
  return result;
}
function Stat({ label, value, detail, color = '#153f68' }: { label: string; value: string | number; detail: string; color?: string }) { return <Paper elevation={0} sx={{ p: 1.75, minHeight: 112, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="caption" sx={{ color: '#60788e', fontWeight: 700 }}>{label}</Typography><Typography variant="h4" sx={{ mt: .6, color, fontSize: 'clamp(23px,2vw,30px)', fontWeight: 800, letterSpacing: '-.7px' }}>{value}</Typography><Typography variant="caption" color="text.secondary">{detail}</Typography></Paper>; }

export default function SchoolAdminDashboard() {
  const session = getSession();
  const batches = useMemo(() => readRows<Batch>(KEYS.batches), []);
  const registrations = useMemo(() => readRows<Row>(KEYS.registrations), []);
  const attendance = useMemo(() => readRows<Row>(KEYS.attendance), []);
  const attendanceExclusions = useMemo(() => readRows<Row>(KEYS.exclusions), []);
  const assessments = useMemo(() => readRows<Row>(KEYS.assessments), []);
  const feedback = useMemo(() => readRows<Row>(KEYS.feedback), []);
  const plans = useMemo(() => readRows<Row>('teacher-training-plans'), []);
  const associations = useMemo(() => readRows<Row>('teacher-training-project-plan-associations'), []);
  const externalCourses = useMemo(() => readRows<Row>('teacher-training-external-course-records'), []);
  const assessmentForms = useMemo(() => readRows<Row>('teacher-training-assessment-form-master'), []);
  const certificates = useMemo(() => readRows<Row>(KEYS.certificates), []);
  const eligibleRows = useMemo<Row[]>(() => [...readRows<Row>(KEYS.eligible), ...readRows<Row>(KEYS.schoolEligibility), ...readRows<Row>(KEYS.eligibleTeachers).map(row => ({ ...row, participantType: 'teacher', eligible: row.eligible ?? true })), ...readRows<Row>(KEYS.eligibleStudents).map(row => ({ ...row, participantType: 'student', eligible: row.eligible ?? true }))], []);
  const userId = session?.userId ?? '';
  const activeBatches = batches.filter(batch => !['cancelled', 'archived'].includes(str(batch.status).toLowerCase()));
  const explicitSchools = schoolAssignmentsFor(userId);
  const schoolIds = new Set([...kgbvSchools.map(school => school.udise), ...explicitSchools, ...activeBatches.map(batch => str(batch.schoolUdiseVenue)).filter(Boolean)]);
  const schools = [...schoolIds].map(id => kgbvSchools.find(school => school.udise === id) ?? { udise: id, school: `School ${id}`, state: '', district: '', block: '', enrollment: 0 } as KgbvSchool);
  const [stateFilter, setStateFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [blockFilter, setBlockFilter] = useState('');
  const [udiseFilter, setUdiseFilter] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const stateOptions = [...new Set(schools.map(item => item.state).filter(Boolean))].sort();
  const stateSchools = schools.filter(item => !stateFilter || item.state === stateFilter);
  const districtOptions = [...new Set(stateSchools.map(item => item.district).filter(Boolean))].sort();
  const districtSchools = stateSchools.filter(item => !districtFilter || item.district === districtFilter);
  const blockOptions = [...new Set(districtSchools.map(item => item.block).filter(Boolean))].sort();
  const blockSchools = districtSchools.filter(item => !blockFilter || item.block === blockFilter);
  const schoolOptions = blockSchools.filter(item => !udiseFilter || item.udise.toLowerCase().includes(udiseFilter.trim().toLowerCase()));
  const selectedSchools = selectedSchoolId && schoolOptions.some(item => item.udise === selectedSchoolId) ? schoolOptions.filter(item => item.udise === selectedSchoolId) : schoolOptions;
  const selectedId = selectedSchools.length === 1 ? selectedSchools[0].udise : '';
  const school = selectedSchools[0];
  const selectedSchoolIds = new Set(selectedSchools.map(item => item.udise));
  const schoolBatches = activeBatches.filter(batch => selectedSchoolIds.has(str(batch.schoolUdiseVenue)));
  const batchIds = new Set(schoolBatches.flatMap(batchIdentifiers));
  const related = (rows: Row[]) => rows.filter(row => batchIds.has(rowBatch(row)) || selectedSchoolIds.has(rowSchool(row)));
  const schoolRegistrations = related(registrations).filter(row => !['cancelled', 'withdrawn', 'rejected'].includes(str(row.status).toLowerCase()));
  const approvedRegistrations = schoolRegistrations.filter(approved);
  const schoolAttendance = related(attendance);
  const schoolAssessments = related(assessments);
  const schoolFeedback = related(feedback);
  const schoolExternalCourses = related(externalCourses);
  const schoolCertificates = related(certificates);
  const attendanceSummary = calculateAttendance(schoolBatches, schoolRegistrations, schoolAttendance, attendanceExclusions);
  const presentCount = attendanceSummary.present;
  const attendanceRate = attendanceSummary.percentage;
  const assessmentDone = schoolAssessments.filter(done).length;
  const issuedCertificates = schoolCertificates.filter(row => row.issued === true || ['issued', 'generated', 'delivered'].includes(str(row.status).toLowerCase())).length;
  const eligibleForSchool = eligibleRows.filter(row => selectedSchoolIds.has(rowSchool(row)) || (rowBatch(row) && batchIds.has(rowBatch(row))));
  const isEligible = (row: Row) => row.eligible === true || ['eligible', 'approved', 'active'].includes(str(row.eligibilityStatus ?? row.status).toLowerCase());
  const isTeacher = (row: Row) => ['teacher', 'educator', 'trainer'].includes(str(row.participantType ?? row.beneficiaryCategory ?? row.role ?? row.category).toLowerCase());
  const isStudent = (row: Row) => ['student', 'pupil', 'learner'].includes(str(row.participantType ?? row.beneficiaryCategory ?? row.role ?? row.category).toLowerCase());
  const eligibleTeachers = eligibleForSchool.filter(row => isEligible(row) && isTeacher(row)).length || eligibleForSchool.reduce((sum, row) => sum + (Number(row.eligibleTeachers) || 0), 0);
  const eligibleStudents = eligibleForSchool.filter(row => isEligible(row) && isStudent(row)).length || eligibleForSchool.reduce((sum, row) => sum + (Number(row.eligibleStudents) || 0), 0);
  const today = businessToday();
  const schedule = schoolBatches.flatMap(batch => {
    const dates = Array.isArray(batch.trainingDates) && batch.trainingDates.length ? batch.trainingDates.map(String) : [date(batch.trainingStartDate)].filter(Boolean);
    return dates.filter(item => date(item) >= today && date(item) <= date(batch.trainingEndAuto || item)).map(item => ({ batch, date: date(item) }));
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  const pendingApprovals = schoolRegistrations.filter(row => !approved(row)).length;
  const pendingAssessments = Math.max(0, approvedRegistrations.length - schoolAssessments.filter(done).length);
  const pendingFeedback = Math.max(0, approvedRegistrations.length - schoolFeedback.length);
  const completedBatchCount = schoolBatches.filter(batch => str(batch.status).toLowerCase() === 'completed').length;
  const completion = summarizeTrainingCompletion(buildTrainingCompletionRows(schoolRegistrations, schoolBatches, plans, associations), { attendance: schoolAttendance, assessments: schoolAssessments, feedback: schoolFeedback, externalCourses: schoolExternalCourses, assessmentForms, exclusions: attendanceExclusions, asOf: today });
  const completedTraineeIds = new Set(approvedRegistrations.filter(row => {
    const candidate = buildTrainingCompletionRows([row], schoolBatches, plans, associations)[0];
    return candidate && summarizeTrainingCompletion([candidate], { attendance: schoolAttendance, assessments: schoolAssessments, feedback: schoolFeedback, externalCourses: schoolExternalCourses, assessmentForms, exclusions: attendanceExclusions, asOf: today }).completed > 0;
  }).map(row => str(row.traineeId ?? row.participantId ?? row.userId ?? row.id)).filter(Boolean));
  const missingAttendance = attendanceSummary.pending;
  const overdueBatches = schoolBatches.filter(batch => !['completed', 'cancelled'].includes(str(batch.status).toLowerCase()) && date(batch.trainingEndAuto) && date(batch.trainingEndAuto) < today).length;
  const pendingActions = [
    ...(pendingApprovals ? [{ title: 'Trainees awaiting approval', count: pendingApprovals, detail: 'Review registrations for this school.', href: '/batches' }] : []),
    ...(overdueBatches ? [{ title: 'Training dates past due', count: overdueBatches, detail: 'Update the batch status or schedule.', href: '/batches' }] : []),
    ...(missingAttendance ? [{ title: 'Attendance records missing', count: missingAttendance, detail: 'Review past training dates with incomplete trainee attendance.', href: '/attendance' }] : []),
    ...(completion.pending ? [{ title: 'Training completion pending', count: completion.pending, detail: 'Completion criteria cannot be determined until required records are saved.', href: '/assessments' }] : []),
    ...(pendingAssessments ? [{ title: 'Assessment records pending', count: pendingAssessments, detail: 'Approved trainees without completed assessment records.', href: '/assessments' }] : []),
    ...(pendingFeedback ? [{ title: 'Feedback responses pending', count: pendingFeedback, detail: 'Feedback has not been recorded for all approved trainees.', href: '/assessments' }] : []),
    ...(completedTraineeIds.size > issuedCertificates ? [{ title: 'Certificates to review', count: completedTraineeIds.size - issuedCertificates, detail: 'Review completed trainees who do not have an issued certificate.', href: '/assessments' }] : []),
  ];

  return <div className="app"><Sidebar /><main className="main"><Topbar title="School Admin Dashboard" description="A state and school view of training delivery, participation, and pending work." />
    <Box sx={{ width: '100%', maxWidth: '100%', margin: '0px', pb: 3 }}>
      {!schools.length ? <Alert severity="warning" sx={{ mb: 2 }}>No schools are available in the school master data.</Alert> : <>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ mb: 1.25 }}><Typography variant="h5" sx={{ color: '#12365c', fontWeight: 780, fontSize: 'clamp(22px,2.25vw,29px)', letterSpacing: '-.7px' }}>Overview</Typography><Typography variant="body2" color="text.secondary">{selectedSchools.length === 1 && school ? `${school.state ? `${school.state} · ${school.district} · ` : ''}${school.school} · UDISE ${school.udise}` : `${selectedSchools.length} authorized school${selectedSchools.length === 1 ? '' : 's'} in the selected hierarchy`}</Typography></Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(150px, 1fr))', gap: 1, overflowX: 'auto', pb: .5 }}>
            <TextField select size="small" label="State" value={stateFilter} onChange={event => { setStateFilter(event.target.value); setDistrictFilter(''); setBlockFilter(''); setSelectedSchoolId(''); }}><MenuItem value="">All authorized states</MenuItem>{stateOptions.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
            <TextField select size="small" label="District" value={districtFilter} onChange={event => { setDistrictFilter(event.target.value); setBlockFilter(''); setSelectedSchoolId(''); }}><MenuItem value="">All districts</MenuItem>{districtOptions.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
            <TextField select size="small" label="Block" value={blockFilter} onChange={event => { setBlockFilter(event.target.value); setSelectedSchoolId(''); }}><MenuItem value="">All blocks</MenuItem>{blockOptions.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
            <TextField select size="small" label="School" value={selectedSchoolId} onChange={event => setSelectedSchoolId(event.target.value)}><MenuItem value="">All schools in selection</MenuItem>{schoolOptions.map(item => <MenuItem key={item.udise} value={item.udise}>{item.school}</MenuItem>)}</TextField>
            <TextField size="small" label="UDISE Code" placeholder="Search UDISE code" value={udiseFilter} onChange={event => { setUdiseFilter(event.target.value); setSelectedSchoolId(''); }} inputProps={{ 'aria-label': 'Filter by UDISE code' }} />
          </Box>
        </Box>
        {!selectedSchools.length && <Alert severity="info" sx={{ mb: 1.5 }}>No authorized schools match the selected filters.</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.25 }}>
          <Stat label="Eligible teachers" value={eligibleRows.length ? eligibleTeachers : '—'} detail={eligibleRows.length ? 'On the school eligibility roster' : 'Eligibility roster not configured'} />
          <Stat label="Eligible students" value={eligibleRows.length ? eligibleStudents : '—'} detail={eligibleRows.length ? `On roster · school profile enrollment ${selectedSchools.reduce((total, item) => total + (item.enrollment || 0), 0)}` : `School profile enrollment: ${selectedSchools.reduce((total, item) => total + (item.enrollment || 0), 0)}; eligibility roster not configured`} />
          <Stat label="Registered trainees" value={schoolRegistrations.length} detail={`${approvedRegistrations.length} approved`} />
          <Stat label="Training batches" value={schoolBatches.length} detail={`${completedBatchCount} completed`} />
          <Stat label="Attendance" value={attendanceRate === null ? '—' : `${attendanceRate}%`} detail={`${presentCount} present / ${attendanceSummary.expected} expected · ${attendanceSummary.absent} absent · ${attendanceSummary.pending} pending`} color="#078347" />
          <Stat label="Training completion" value={completion.percentage === null ? '—' : `${completion.percentage}%`} detail={`${completion.confirmed} confirmed · ${completion.completed} completed / ${completion.eligibleConfirmed} due confirmed · ${completion.pending} pending · ${completion.inProgress} in progress · ${completion.notCompleted} not completed · ${completion.notConfigured} not configured`} color="#078347" />
          <Stat label="Assessments" value={`${assessmentDone}/${schoolAssessments.length}`} detail={schoolAssessments.length ? 'Completed / recorded' : 'No assessment records'} />
          <Stat label="Certificates issued" value={issuedCertificates} detail={`${schoolCertificates.length} certificate record(s)`} color="#7858a6" />
        </Box>
        {eligibleRows.length === 0 && <Alert severity="info" sx={{ mt: 1.5 }}>Teacher and student eligibility counts require a school eligibility roster. The enrollment figure above is the school profile total and is not treated as an eligibility count.</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.1fr .9fr' }, gap: 1.5, mt: 1.5 }}>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 750 }}>Training schedule</Typography><Button size="small" href="/batches" sx={{ textTransform: 'none' }}>View batches</Button></Stack>{schedule.length ? <Stack spacing={.75}>{schedule.map(({ batch, date: trainingDate }) => <Box key={`${batch.id}-${trainingDate}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, py: 1, borderTop: '1px solid #edf1f5' }}><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{batch.batchCode || 'Training batch'}</Typography><Typography variant="caption" color="text.secondary">{str(batch.trainingCycle) || 'Training'} · Trainer {str(batch.trainerCode) || 'not assigned'}{batch.trainingStartTime ? ` · ${batch.trainingStartTime}` : ''}</Typography></Box><Stack alignItems="flex-end" spacing={.5}><Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>{formatDate(trainingDate)}</Typography><Chip size="small" label={str(batch.status) || 'Scheduled'} variant="outlined" /></Stack></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">No upcoming training dates are scheduled for this school.</Typography>}</Paper>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" sx={{ fontWeight: 750, mb: 1.5 }}>Attendance and learning status</Typography><Stack spacing={1.5}><Box><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Attendance records</Typography><Typography variant="body2" fontWeight={700}>{schoolAttendance.length}</Typography></Stack><LinearProgress variant="determinate" value={attendanceRate ?? 0} color="success" sx={{ mt: .6, height: 7, borderRadius: 5 }} /></Box><Box><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Assessments completed</Typography><Typography variant="body2" fontWeight={700}>{schoolAssessments.length ? `${assessmentDone} / ${schoolAssessments.length}` : 'No data'}</Typography></Stack><LinearProgress variant="determinate" value={schoolAssessments.length ? assessmentDone / schoolAssessments.length * 100 : 0} sx={{ mt: .6, height: 7, borderRadius: 5 }} /></Box><Box><Stack direction="row" justifyContent="space-between"><Typography variant="body2">Feedback received</Typography><Typography variant="body2" fontWeight={700}>{schoolFeedback.length}{approvedRegistrations.length ? ` / ${approvedRegistrations.length} approved trainees` : ''}</Typography></Stack><LinearProgress variant="determinate" value={approvedRegistrations.length ? Math.min(100, schoolFeedback.length / approvedRegistrations.length * 100) : 0} color="secondary" sx={{ mt: .6, height: 7, borderRadius: 5 }} /></Box><Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Chip size="small" color="success" variant="outlined" label={`${approvedRegistrations.length} approved`} /><Chip size="small" color="warning" variant="outlined" label={`${pendingApprovals} awaiting approval`} /><Chip size="small" variant="outlined" label={`${issuedCertificates} certificates issued`} /></Stack></Stack></Paper>
        </Box>
        <Paper elevation={0} sx={{ p: 2, mt: 1.5, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>Pending actions</Typography>{pendingActions.length ? <Stack spacing={.75}>{pendingActions.map(action => <Box key={action.title} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: .8, borderTop: '1px solid #edf1f5' }}><Chip size="small" color="warning" label={action.count} /><Box sx={{ flex: 1 }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{action.title}</Typography><Typography variant="caption" color="text.secondary">{action.detail}</Typography></Box><Button size="small" href={action.href} sx={{ textTransform: 'none' }}>Open</Button></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">No pending actions are detected for this school.</Typography>}</Paper>
      </>}
    </Box><Footer /></main></div>;
}
