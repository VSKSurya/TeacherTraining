import { useMemo, useState } from 'react';
import { Alert, Box, Breadcrumbs, Button, Chip, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';
import { kgbvSchools, type KgbvSchool } from '../data/kgbvSchools';
import { locations } from '../data/locations';

type Row = Record<string, unknown>;
type Project = Row & { id: string; name: string; code?: string; states?: string[]; assignedUsers?: string[] };
type Batch = Row & { id: string; batchCode?: string; projectId?: string; status?: string; state?: string; district?: string; schoolUdiseVenue?: string; trainingStartDate?: string; trainingEndAuto?: string; trainingCycle?: string; trainerCode?: string; trainingDuration?: number; plannedParticipants?: number; registeredParticipants?: number; trainedParticipants?: number; trainingDates?: string[] };
type ClusterLink = { state: string; district: string; block: string; cluster: string; schoolUdise?: string };
type Level = 'state' | 'district' | 'block' | 'cluster' | 'school' | 'batch';
type Path = { state: string; district: string; block: string; cluster: string; schoolUdise: string };
const PROJECTS_KEY = 'teacher-training-projects';
const BATCHES_KEY = 'teacher-training-batch-plan-uses';
const CLUSTERS_KEY = 'teacher-training-cluster-master';
const REGISTRATIONS_KEY = 'teacher-training-registrations';
const ATTENDANCE_KEY = 'teacher-training-attendance-records';
const ASSESSMENTS_KEY = 'teacher-training-assessment-records';
const EMPTY_PATH: Path = { state: '', district: '', block: '', cluster: '', schoolUdise: '' };
function readRows<T extends Row>(key: string): T[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as T[] : []; } catch { return []; } }
function str(value: unknown) { return typeof value === 'string' ? value : ''; }
function num(...values: unknown[]) { for (const value of values) { const parsed = Number(value); if (Number.isFinite(parsed) && parsed >= 0) return parsed; } return 0; }
function date(value: unknown) { return str(value).slice(0, 10); }
function present(row: Row) { const status = str(row.status).toLowerCase(); return row.present === true || row.attended === true || ['present', 'attended', 'completed', 'complete'].includes(status); }
function completed(row: Row) { return row.completed === true || ['completed', 'complete', 'submitted', 'graded'].includes(str(row.status).toLowerCase()); }
function passed(row: Row) { return row.passed === true || ['passed', 'pass'].includes(str(row.result ?? row.status).toLowerCase()); }
function pct(value: number, total: number) { return total ? Math.round(value / total * 100) : null; }
function pctLabel(value: number | null) { return value === null ? '—' : `${value}%`; }
function schoolFromBatch(batch: Batch): KgbvSchool | undefined { return kgbvSchools.find(item => item.udise === str(batch.schoolUdiseVenue)); }
function metricLabel(rows: Batch[], registrations: Row[], attendance: Row[]) {
  const planned = rows.reduce((sum, item) => sum + num(item.plannedParticipants, item.plannedUsers, item.participantCount), 0);
  const registered = registrations.length || rows.reduce((sum, item) => sum + num(item.registeredParticipants, item.registeredUsersCount), 0);
  const trainedIds = new Set(attendance.filter(present).map(item => str(item.participantId ?? item.traineeId ?? item.userId)).filter(Boolean));
  const trained = trainedIds.size || rows.reduce((sum, item) => sum + num(item.trainedParticipants, item.completedUsers), 0);
  return { planned, registered, trained };
}
function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) { return <Paper elevation={0} sx={{ p: 1.5, minHeight: 116, border: '1px solid #e3ebf3', borderRadius: 1.5, display: 'flex', flexDirection: 'column' }}><Typography variant="caption" sx={{ color: '#254665', fontSize: 11, fontWeight: 700, lineHeight: 1.35 }}>{label}</Typography><Typography variant="h4" sx={{ mt: .5, color: '#153f68', fontSize: 'clamp(19px,1.6vw,24px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-.5px', whiteSpace: 'nowrap' }}>{value}</Typography><Typography variant="caption" color="text.secondary" sx={{ mt: .5, fontSize: 10, lineHeight: 1.35 }}>{sub}</Typography></Paper>; }

export default function StateAdminDashboard() {
  const session = getSession();
  const projects = useMemo(() => readRows<Project>(PROJECTS_KEY), []);
  const batches = useMemo(() => readRows<Batch>(BATCHES_KEY), []);
  const registrations = useMemo(() => readRows<Row>(REGISTRATIONS_KEY), []);
  const attendance = useMemo(() => readRows<Row>(ATTENDANCE_KEY), []);
  const assessments = useMemo(() => readRows<Row>(ASSESSMENTS_KEY), []);
  const clusterLinks = useMemo(() => readRows<ClusterLink>(CLUSTERS_KEY), []);
  const projectScope = projects.filter(item => item.assignedUsers?.includes(session?.userId ?? ''));
  const explicitScope = (() => { try { const saved: unknown = JSON.parse(localStorage.getItem('teacher-training-state-access') ?? 'null'); if (saved && typeof saved === 'object' && Array.isArray((saved as Record<string, unknown>)[session?.userId ?? ''])) return (saved as Record<string, string[]>)[session?.userId ?? '']; } catch { /* use project scope */ } return null; })();
  const projectStates = [...new Set(projectScope.flatMap(project => project.states ?? []))];
  const allowedStates = explicitScope ?? (projectStates.length ? projectStates : locations.map(item => item.name));
  const [level, setLevel] = useState<Level>('state');
  const [path, setPath] = useState<Path>(EMPTY_PATH);
  const [stateFilter, setStateFilter] = useState('');
  const states = locations.map(item => item.name).filter(name => allowedStates.includes(name) && (!stateFilter || name === stateFilter));
  const stateBatches = batches.filter(batch => states.includes(str(batch.state) || schoolFromBatch(batch)?.state || '') && !['Cancelled', 'Archived'].includes(str(batch.status)));
  const scopeProjects = projects.filter(project => (!projectScope.length || projectScope.some(item => item.id === project.id)) && (!(project.states?.length) || project.states.some(state => states.includes(state))));
  const projectIds = new Set(scopeProjects.map(item => item.id));
  const visibleBatches = stateBatches.filter(batch => projectScope.length ? Boolean(batch.projectId && projectIds.has(batch.projectId)) : (!batch.projectId || projectIds.size === 0 || projectIds.has(batch.projectId)));
  const batchIds = new Set(visibleBatches.flatMap(batch => [batch.id, batch.batchCode ?? '', str(batch.uniqueId)]).filter(Boolean));
  const registrationsInScope = registrations.filter(row => batchIds.has(str(row.batchId ?? row.batchCode ?? row.batchUniqueId)));
  const attendanceInScope = attendance.filter(row => batchIds.has(str(row.batchId ?? row.batchCode ?? row.batchUniqueId)));
  const assessmentsInScope = assessments.filter(row => batchIds.has(str(row.batchId ?? row.batchCode ?? row.batchUniqueId)));
  const metrics = metricLabel(visibleBatches, registrationsInScope, attendanceInScope);
  const metricsFor = (rows: Batch[]) => {
    const ids = new Set(rows.flatMap(batch => [batch.id, batch.batchCode ?? '', str(batch.uniqueId)]).filter(Boolean));
    const rowRegistrations = registrationsInScope.filter(row => ids.has(str(row.batchId ?? row.batchCode ?? row.batchUniqueId)));
    const rowAttendance = attendanceInScope.filter(row => ids.has(str(row.batchId ?? row.batchCode ?? row.batchUniqueId)));
    return metricLabel(rows, rowRegistrations, rowAttendance);
  };
  const attendanceRate = attendanceInScope.length ? pct(attendanceInScope.filter(present).length, attendanceInScope.length) : null;
  const assessmentDone = assessmentsInScope.filter(completed).length;
  const assessmentPass = assessmentsInScope.filter(passed).length;
  const completionRate = metrics.planned ? pct(metrics.trained, metrics.planned) : pct(visibleBatches.filter(row => str(row.status).toLowerCase() === 'completed').length, visibleBatches.length);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = visibleBatches.filter(batch => date(batch.trainingStartDate) >= today).sort((a, b) => date(a.trainingStartDate).localeCompare(date(b.trainingStartDate))).slice(0, 5);
  const interventions = visibleBatches.filter(batch => {
    const status = str(batch.status).toLowerCase();
    return !['completed', 'cancelled', 'archived'].includes(status) && ((date(batch.trainingEndAuto) && date(batch.trainingEndAuto) < today) || !batch.trainerCode);
  });
  const cycleNames = [...new Set(visibleBatches.map(batch => str(batch.trainingCycle).trim()).filter(Boolean))];
  const cyclesCompleted = cycleNames.filter(cycle => visibleBatches.filter(batch => str(batch.trainingCycle).trim() === cycle).every(batch => str(batch.status).toLowerCase() === 'completed')).length;
  const cyclesPending = cycleNames.length - cyclesCompleted;
  const currentSchools = stateFilter ? kgbvSchools.filter(item => item.state === stateFilter) : kgbvSchools.filter(item => states.includes(item.state));
  const coveredSchools = new Set(visibleBatches.map(batch => str(batch.schoolUdiseVenue)).filter(udise => currentSchools.some(school => school.udise === udise))).size;
  const schoolCoverage = pct(coveredSchools, currentSchools.length);
  const schoolsByPath = (state: string, district: string, block: string, cluster: string) => {
    let rows = kgbvSchools.filter(school => school.state === state && school.district === district && school.block === block);
    const mappings = clusterLinks.filter(link => link.state === state && link.district === district && link.block === block && link.cluster === cluster);
    if (cluster && cluster !== 'Cluster mapping unavailable' && mappings.length) { const udiseIds = new Set(mappings.map(link => link.schoolUdise).filter(Boolean)); rows = rows.filter(school => udiseIds.has(school.udise)); }
    return rows;
  };
  const batchesForSchool = (school: KgbvSchool) => visibleBatches.filter(batch => str(batch.schoolUdiseVenue) === school.udise || (str(batch.state) === school.state && str(batch.district) === school.district && !batch.schoolUdiseVenue));

  const drill = (next: Level, updates: Partial<Path>) => { setPath(current => ({ ...current, ...updates })); setLevel(next); };
  const go = (next: Level) => {
    setPath(current => next === 'state' ? EMPTY_PATH : next === 'district' ? { ...current, district: '', block: '', cluster: '', schoolUdise: '' } : next === 'block' ? { ...current, block: '', cluster: '', schoolUdise: '' } : next === 'cluster' ? { ...current, cluster: '', schoolUdise: '' } : next === 'school' ? { ...current, schoolUdise: '' } : current);
    setLevel(next);
  };
  const crumbs: { label: string; level: Level }[] = [{ label: 'States', level: 'state' }, ...(path.state ? [{ label: path.state, level: 'district' as Level }] : []), ...(path.district ? [{ label: path.district, level: 'block' as Level }] : []), ...(path.block ? [{ label: path.block, level: 'cluster' as Level }] : []), ...(path.cluster ? [{ label: path.cluster, level: 'school' as Level }] : []), ...(path.schoolUdise ? [{ label: kgbvSchools.find(item => item.udise === path.schoolUdise)?.school ?? path.schoolUdise, level: 'batch' as Level }] : [])];
  const firstRow = visibleBatches[0];
  const scopeSchoolData = Boolean(firstRow?.schoolUdiseVenue);

  let tableTitle = 'States';
  let tableRows: { key: string; name: string; detail: string; schools: number; batches: number; planned: number; registered: number; trained: number; onOpen: () => void }[] = [];
  if (level === 'state') {
    tableRows = states.map(state => { const schools = kgbvSchools.filter(item => item.state === state); const rows = visibleBatches.filter(batch => str(batch.state) === state || schoolFromBatch(batch)?.state === state); const counts = metricsFor(rows); return { key: state, name: state, detail: `${new Set(rows.map(batch => str(batch.district)).filter(Boolean)).size} districts`, schools: schools.length, batches: rows.length, ...counts, onOpen: () => drill('district', { state }) }; });
  } else if (level === 'district') {
    tableTitle = `${path.state} · Districts`;
    const districts = [...new Set(kgbvSchools.filter(item => item.state === path.state).map(item => item.district))].sort();
    tableRows = districts.map(district => { const schools = kgbvSchools.filter(item => item.state === path.state && item.district === district); const rows = visibleBatches.filter(batch => (str(batch.state) === path.state || schoolFromBatch(batch)?.state === path.state) && (str(batch.district) === district || schoolFromBatch(batch)?.district === district)); return { key: district, name: district, detail: `${new Set(schools.map(item => item.block)).size} blocks`, schools: schools.length, batches: rows.length, ...metricsFor(rows), onOpen: () => drill('block', { district }) }; });
  } else if (level === 'block') {
    tableTitle = `${path.district} · Blocks`;
    const blocks = [...new Set(kgbvSchools.filter(item => item.state === path.state && item.district === path.district).map(item => item.block))].sort();
    tableRows = blocks.map(block => { const schools = kgbvSchools.filter(item => item.state === path.state && item.district === path.district && item.block === block); const mappedClusters = [...new Set(clusterLinks.filter(link => link.state === path.state && link.district === path.district && link.block === block).map(link => link.cluster))]; const clusters = mappedClusters.length ? mappedClusters : ['Cluster mapping unavailable']; const rows = visibleBatches.filter(batch => schools.some(school => school.udise === batch.schoolUdiseVenue)); return { key: block, name: block, detail: `${clusters.length} cluster(s) · ${schools.length} schools`, schools: schools.length, batches: rows.length, ...metricsFor(rows), onOpen: () => drill('cluster', { block }) }; });
  } else if (level === 'cluster') {
    tableTitle = `${path.block} · Clusters`;
    const mapped = [...new Set(clusterLinks.filter(link => link.state === path.state && link.district === path.district && link.block === path.block).map(link => link.cluster))];
    const clusters = mapped.length ? mapped : ['Cluster mapping unavailable'];
    tableRows = clusters.map(cluster => { const schools = schoolsByPath(path.state, path.district, path.block, cluster); const rows = visibleBatches.filter(batch => schools.some(school => school.udise === batch.schoolUdiseVenue)); return { key: cluster, name: cluster, detail: mapped.length ? 'Cluster master' : 'Cluster master data is not configured', schools: schools.length, batches: rows.length, ...metricsFor(rows), onOpen: () => drill('school', { cluster }) }; });
  } else if (level === 'school') {
    tableTitle = `${path.cluster} · Schools`;
    const schools = schoolsByPath(path.state, path.district, path.block, path.cluster);
    tableRows = schools.map(school => { const rows = batchesForSchool(school); return { key: school.udise, name: school.school, detail: `UDISE ${school.udise} · ${school.block}`, schools: 1, batches: rows.length, ...metricsFor(rows), onOpen: () => drill('batch', { schoolUdise: school.udise }) }; });
  } else {
    const school = kgbvSchools.find(item => item.udise === path.schoolUdise);
    tableTitle = `${school?.school ?? 'School'} · Batches`;
    tableRows = batchesForSchool(school ?? { state: path.state, district: path.district, block: path.block, school: path.schoolUdise, udise: path.schoolUdise, enrollment: 0 }).map(batch => ({ key: batch.id, name: str(batch.batchCode) || 'Batch', detail: `${str(batch.trainingCycle) || 'Cycle not tagged'} · ${str(batch.trainingPlanCode)}`, schools: 1, batches: 1, ...metricsFor([batch]), onOpen: () => undefined }));
  }

  return <div className="app"><Sidebar /><main className="main"><Topbar title="State Admin Dashboard" description="State-level training coverage, outcomes, and interventions." />
    <Box className="state-admin-dashboard-content" sx={{ width: '100%', maxWidth: 1500, mx: 'auto', pb: 3, fontSize: 12, '& .MuiTypography-body2': { fontSize: 12 }, '& .MuiTypography-caption': { fontSize: 10 }, '& .MuiButton-sizeSmall': { fontSize: 11 }, '& .MuiChip-label': { fontSize: 10 }, '& .MuiAlert-message': { fontSize: 11 }, '& .MuiTableCell-root': { fontSize: 11, lineHeight: 1.4, py: .75 }, '& .MuiTableCell-head': { fontWeight: 700, color: '#61778e', backgroundColor: '#f6f9fc' } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="flex-end" alignItems={{ xs: 'stretch', md: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Select size="small" displayEmpty value={stateFilter} onChange={event => { setStateFilter(event.target.value); setPath(EMPTY_PATH); setLevel('state'); }} inputProps={{ 'aria-label': 'Filter authorized states' }} sx={{ minWidth: 230 }}><MenuItem value="">All authorized states</MenuItem>{states.map(state => <MenuItem key={state} value={state}>{state}</MenuItem>)}</Select>
      </Stack>
      {stateBatches.length === 0 && <Alert severity="info" sx={{ mb: 2 }}>No batch records are available in the selected state scope yet. School coverage is based on the available UDISE master list.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', lg: 'repeat(5,minmax(0,1fr))' }, gap: 1.25, mb: 1.5 }}>
        <StatCard label="Schools covered" value={`${coveredSchools} / ${currentSchools.length}`} sub={`${pctLabel(schoolCoverage)} of UDISE schools`} />
        <StatCard label="Training cycles" value={cycleNames.length ? `${cyclesCompleted} / ${cycleNames.length}` : '—'} sub={cycleNames.length ? `${cyclesPending} pending` : 'Cycle not tagged on batches'} />
        <StatCard label="Participants" value={metrics.planned ? metrics.planned.toLocaleString() : '—'} sub={`${metrics.registered.toLocaleString()} registered · ${metrics.trained.toLocaleString()} trained`} />
        <StatCard label="Attendance" value={pctLabel(attendanceRate)} sub={attendanceInScope.length ? `${attendanceInScope.filter(present).length} present marks` : 'Attendance data unavailable'} />
        <StatCard label="Training completion" value={pctLabel(completionRate)} sub={metrics.planned ? 'Trained / planned participants' : 'Completed / total batches'} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 1.5 }}><Typography variant="h6" sx={{ fontWeight: 750, fontSize: 15, letterSpacing: '-.15px', mb: 1 }}>Assessment outcomes</Typography><Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Chip label={`Completed: ${assessmentsInScope.filter(completed).length}`} color="primary" variant="outlined" /><Chip label={`Passed: ${assessmentsInScope.filter(passed).length}`} color="success" variant="outlined" /><Chip label={`Pass rate: ${pctLabel(assessmentDone ? pct(assessmentPass, assessmentDone) : null)}`} /></Stack>{!assessmentsInScope.length && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Assessment records are not available for this scope.</Typography>}</Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 1.5 }}><Typography variant="h6" sx={{ fontWeight: 750, fontSize: 15, letterSpacing: '-.15px', mb: 1 }}>Upcoming training</Typography>{upcoming.length ? upcoming.map(batch => <Box key={batch.id} sx={{ display: 'flex', justifyContent: 'space-between', py: .65, borderTop: '1px solid #edf1f5', gap: 1 }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{str(batch.batchCode) || 'Batch'} · {str(batch.state)}</Typography><Typography variant="caption" color="text.secondary">{date(batch.trainingStartDate)}</Typography></Box>) : <Typography variant="body2" color="text.secondary">No upcoming batches are scheduled.</Typography>}</Paper>
      </Box>
      <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, border: '1px solid #e3ebf3', borderRadius: 1.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ mb: 1.25 }}>
          <Box><Typography variant="h6" sx={{ fontWeight: 750, fontSize: 15, letterSpacing: '-.15px' }}>{tableTitle}</Typography><Typography variant="caption" color="text.secondary">Schools in master: {tableRows.reduce((sum, row) => sum + row.schools, 0)} · Batches: {tableRows.reduce((sum, row) => sum + row.batches, 0)}</Typography></Box>
          <Breadcrumbs aria-label="State dashboard drilldown">{crumbs.map((crumb, index) => <Button key={`${crumb.label}-${index}`} size="small" color={index === crumbs.length - 1 ? 'inherit' : 'primary'} onClick={() => go(crumb.level)} sx={{ textTransform: 'none', minWidth: 0, px: .5 }}>{crumb.label}</Button>)}</Breadcrumbs>
        </Stack>
        {level === 'state' && projectScope.length > 0 && projectStates.length === 0 && <Alert severity="warning" sx={{ mb: 1.5 }}>Assigned projects have no state scope configured; the dashboard is showing all available UDISE states.</Alert>}
        {level === 'cluster' && clusterLinks.length === 0 && <Alert severity="info" sx={{ mb: 1.5 }}>Cluster master data is not available. The drilldown keeps the Cluster step and groups this block’s schools under an unmapped cluster until cluster records are added.</Alert>}
        <TableContainer><Table size="small"><TableHead><TableRow><TableCell>{level === 'state' ? 'State' : level === 'district' ? 'District' : level === 'block' ? 'Block' : level === 'cluster' ? 'Cluster' : level === 'school' ? 'School / UDISE' : 'Batch'}</TableCell><TableCell>Hierarchy / cycle</TableCell><TableCell align="right">Schools</TableCell><TableCell align="right">Batches</TableCell><TableCell align="right">Planned</TableCell><TableCell align="right">Registered</TableCell><TableCell align="right">Trained</TableCell><TableCell>Drill down</TableCell></TableRow></TableHead><TableBody>{tableRows.map(row => <TableRow key={row.key} hover><TableCell sx={{ fontWeight: 700 }}>{row.name}</TableCell><TableCell>{row.detail}</TableCell><TableCell align="right">{row.schools}</TableCell><TableCell align="right">{row.batches}</TableCell><TableCell align="right">{row.planned || '—'}</TableCell><TableCell align="right">{row.registered || '—'}</TableCell><TableCell align="right">{row.trained || '—'}</TableCell><TableCell><Button size="small" onClick={row.onOpen} disabled={level === 'batch'} sx={{ textTransform: 'none' }}>{level === 'batch' ? 'Current level' : 'Open'}</Button></TableCell></TableRow>)}{!tableRows.length && <TableRow><TableCell colSpan={8} align="center">No rows at this level.</TableCell></TableRow>}</TableBody></Table></TableContainer>
      </Paper>
      <Paper elevation={0} sx={{ mt: 1.5, p: 2, border: '1px solid #e3ebf3', borderRadius: 1.5 }}><Typography variant="h6" sx={{ fontWeight: 750, fontSize: 15, letterSpacing: '-.15px', mb: 1 }}>Schools and batches requiring intervention</Typography>{interventions.length ? <Stack spacing={.75}>{interventions.slice(0, 10).map(batch => { const school = schoolFromBatch(batch); const reason = date(batch.trainingEndAuto) && date(batch.trainingEndAuto) < today ? 'Past planned end date' : 'Trainer not assigned'; return <Box key={batch.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: .7, borderTop: '1px solid #edf1f5' }}><Typography variant="body2"><strong>{str(batch.batchCode) || 'Batch'}</strong> · {(school?.school ?? str(batch.schoolUdiseVenue)) || 'School not linked'}</Typography><Chip size="small" color="warning" label={reason} /></Box>; })}</Stack> : <Typography variant="body2" color="text.secondary">No delayed or unassigned-trainer batches are flagged in this state scope.</Typography>}</Paper>
      {!scopeSchoolData && visibleBatches.length > 0 && <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#71839a' }}>Some uploaded batches lack a UDISE school reference and are counted by their state/district fields.</Typography>}
    </Box><Footer /></main></div>;
}
