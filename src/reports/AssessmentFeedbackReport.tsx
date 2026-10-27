import { useMemo, useState } from 'react';
import { Box, Button, Container, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from '../components/DashboardParts';
import { ReportBarChart, ReportViewToggle, type ReportView } from './ReportCharts';
import { ReportPagination } from './ReportComponents';
import { formatDate } from '../dateFormat';
import AssessmentFormDetail from './AssessmentFormDetail';

const PAGE_SIZE = 10;

type Row = Record<string, unknown>;
type Result = { id: string; formId: string; formTitle: string; kind: string; stage: string; traineeId: string; batchCode: string; planCode: string; day: string; date: string; submittedAt: string; answers: Record<string, string>; score?: number; maxMarks?: number; passed?: boolean; learningGain?: number; status: string };
function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function readRows(key: string): Row[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as Row[] : []; } catch { return []; } }

export default function AssessmentFeedbackReport() {
  const [kind, setKind] = useState('all');
  const [view, setView] = useState<ReportView>('table');
  const [page, setPage] = useState(1);
  const [selectedForm, setSelectedForm] = useState<{ id: string; title: string; kind: string; stage: string; planCode?: string; day?: number; questions: { id: string; prompt: string; options?: string[]; correctIndex?: number; points?: number }[] } | null>(null);
  const formDefinitions = useMemo(() => readRows('teacher-training-assessment-form-master'), []);
  const results = useMemo<Result[]>(() => {
    const sourceRows: Row[] = [
      ...readRows('teacher-training-assessment-records').map(row => ({ ...row, kind: 'assessment' })),
      ...readRows('teacher-training-feedback-records').map(row => ({ ...row, kind: 'feedback' })),
    ];
    return sourceRows.map(row => ({ id: text(row.id), formId: text(row.formId), formTitle: text(row.formTitle ?? row.title ?? row.name) || 'Form', kind: text(row.kind) || 'assessment', stage: text(row.stage), traineeId: text(row.traineeId ?? row.userId), batchCode: text(row.batchCode ?? row.batchId), planCode: text(row.planCode), day: String(row.day ?? ''), date: text(row.submittedAt).slice(0, 10), submittedAt: text(row.submittedAt), answers: row.answers && typeof row.answers === 'object' ? row.answers as Record<string, string> : {}, ...(typeof row.score === 'number' ? { score: row.score } : {}), ...(typeof row.maxMarks === 'number' ? { maxMarks: row.maxMarks } : {}), ...(typeof row.passed === 'boolean' ? { passed: row.passed } : {}), ...(typeof row.learningGain === 'number' ? { learningGain: row.learningGain } : {}), status: text(row.status) || (row.completed ? 'submitted' : 'pending') })).sort((a, b) => b.date.localeCompare(a.date));
  }, []);
  const rows = results.filter(row => (kind === 'all' || row.kind === kind) && !['pending', 'in progress', 'not started'].includes(row.status.toLowerCase()));
  const groupedRows = [...rows.reduce((groups, row, index) => {
    const groupKey = JSON.stringify([row.formId || row.formTitle, row.kind, row.stage, row.batchCode, row.planCode, row.day]);
    const group = groups.get(groupKey) ?? { key: groupKey, row, participants: new Set<string>(), latestSubmittedAt: '' };
    const participantId = row.traineeId || row.id || `submission-${index}`;
    group.participants.add(participantId);
    if (row.submittedAt >= group.latestSubmittedAt) {
      group.latestSubmittedAt = row.submittedAt;
      group.row = row;
    }
    groups.set(groupKey, group);
    return groups;
  }, new Map<string, { key: string; row: Result; participants: Set<string>; latestSubmittedAt: string }>()).values()].sort((a, b) => b.latestSubmittedAt.localeCompare(a.latestSubmittedAt));
  const pageCount = Math.max(1, Math.ceil(groupedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = groupedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const graded = rows.filter(row => row.kind !== 'feedback' && row.score !== undefined);
  const passed = graded.filter(row => row.passed).length;
  const feedbackCount = rows.filter(row => row.kind === 'feedback').length;
  const assessmentCount = rows.filter(row => row.kind === 'assessment').length;
  const byStage = [...graded.reduce((groups, row) => { const group = groups.get(row.stage || 'Other') ?? { count: 0, gainTotal: 0, gainCount: 0 }; group.count++; if (row.learningGain !== undefined) { group.gainTotal += row.learningGain; group.gainCount++; } groups.set(row.stage || 'Other', group); return groups; }, new Map<string, { count: number; gainTotal: number; gainCount: number }>()).entries()].map(([stage, values]) => ({ label: stage, values: [values.gainCount ? values.gainTotal / values.gainCount : 0] }));
  function openDetailedReport(row: Result) {
    const definition = formDefinitions.find(form => text(form.id) === row.formId) ?? formDefinitions.find(form => text(form.title).trim().toLowerCase() === row.formTitle.trim().toLowerCase());
    setSelectedForm(definition ? { id: text(definition.id), title: text(definition.title) || row.formTitle, kind: text(definition.kind) || row.kind, stage: text(definition.stage) || row.stage, planCode: text(definition.planCode), day: Number(definition.day) || Number(row.day) || 1, questions: Array.isArray(definition.questions) ? definition.questions : [] } : { id: row.formId || row.formTitle, title: row.formTitle, kind: row.kind, stage: row.stage, planCode: row.planCode, day: Number(row.day) || 1, questions: [] });
  }
  if (selectedForm) {
    const formSubmissions = results.filter(row => (selectedForm.id === row.formId || (!row.formId && row.formTitle.trim().toLowerCase() === selectedForm.title.trim().toLowerCase())) && !['pending', 'in progress', 'not started'].includes(row.status.toLowerCase()));
    return <div className="app report-app"><Sidebar activePage="Assessment & Feedback Report" /><main className="main report-main"><Topbar title="Assessment & Feedback Report" description="Consolidated form responses, question analysis, and participant answer sheets." /><Container maxWidth="xl" sx={{ py: 2.5 }}><AssessmentFormDetail form={selectedForm} submissions={formSubmissions} onBack={() => setSelectedForm(null)} /></Container><Footer /></main></div>;
  }
  return <div className="app report-app"><Sidebar activePage="Assessment & Feedback Report" /><main className="main report-main"><Topbar title="Assessment & Feedback Report" description="Review completion, graded outcomes, and learning gain from recorded submissions." /><Container maxWidth="xl" sx={{ py: 2.5 }}><Stack spacing={1.5}>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><TextField select size="small" label="Result type" value={kind} onChange={event => { setKind(event.target.value); setPage(1); }} sx={{ minWidth: 200 }}><MenuItem value="all">All results</MenuItem><MenuItem value="assessment">Assessments</MenuItem><MenuItem value="feedback">Feedback</MenuItem></TextField></Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.25 }}>
      <Summary label="Submissions" value={rows.length} />
      <Summary label="Graded" value={graded.length} />
      <Summary label="Pass rate" value={graded.length ? `${Math.round(passed / graded.length * 100)}%` : '—'} />
      <Summary label="Feedback responses" value={feedbackCount} />
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><ReportViewToggle view={view} onChange={setView} /></Box>
    {view === 'graph' ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}><ReportBarChart title="Submission mix" description="Assessment and feedback submissions under the selected result filter" series={[{ label: 'Assessments', color: '#2584b9' }, { label: 'Feedback', color: '#815bb3' }]} rows={[{ label: 'Submissions', values: [assessmentCount, feedbackCount] }]} chartType="pie" /><ReportBarChart title="Graded assessment outcomes" description="Pass and not-passed counts; non-graded forms are excluded" series={[{ label: 'Passed', color: '#16945b' }, { label: 'Not passed', color: '#dd6670' }]} rows={[{ label: 'Graded assessments', values: [passed, graded.length - passed] }]} chartType="pie" /><ReportBarChart title="Average learning gain" description="Mean post-assessment minus pre-assessment marks where comparable scores are available" series={[{ label: 'Learning gain', color: '#e69a32' }]} rows={byStage} formatter={value => `${value > 0 ? '+' : ''}${value.toFixed(1)}`} signed /></Box> : <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf1', borderRadius: 2 }}><Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>Submission details · {rows.length}</Typography>{groupedRows.length ? <><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Form</TableCell><TableCell align="right">Total submitted</TableCell><TableCell>Batch</TableCell><TableCell>Plan / day</TableCell><TableCell>Date of Submitted</TableCell></TableRow></TableHead><TableBody>{pageRows.map(group => <TableRow key={group.key}><TableCell><Button size="small" onClick={() => openDetailedReport(group.row)} sx={{ p: 0, minWidth: 0, justifyContent: 'flex-start', textTransform: 'none', fontWeight: 700 }}>{group.row.formTitle}</Button><Typography variant="caption" display="block" color="text.secondary">{group.row.kind} · {group.row.stage}</Typography></TableCell><TableCell align="right">{group.participants.size}</TableCell><TableCell>{group.row.batchCode || '—'}</TableCell><TableCell>{group.row.planCode || '—'}{group.row.day ? ` · Day ${group.row.day}` : ''}</TableCell><TableCell>{formatDate(group.latestSubmittedAt.slice(0, 10)) || '—'}</TableCell></TableRow>)}</TableBody></Table></TableContainer><ReportPagination total={groupedRows.length} page={currentPage} pageSize={PAGE_SIZE} onPageChange={setPage} /></> : <Typography color="text.secondary">No assessment or feedback submissions match this filter.</Typography>}</Paper>}
  </Stack></Container><Footer /></main></div>;
}
function Summary({ label, value }: { label: string; value: string | number }) { return <Paper elevation={0} sx={{ p: 1.75, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography><Typography variant="h4" fontWeight={800} color="#153f68">{value}</Typography></Paper>; }
