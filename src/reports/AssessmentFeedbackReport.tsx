import { useMemo, useState } from 'react';
import { Box, Chip, Container, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from '../components/DashboardParts';
import { ReportBarChart, ReportViewToggle, type ReportView } from './ReportCharts';
import { ReportPagination } from './ReportComponents';
import { formatDate } from '../dateFormat';

const PAGE_SIZE = 10;

type Row = Record<string, unknown>;
type Result = { id: string; formTitle: string; kind: string; stage: string; traineeId: string; batchCode: string; planCode: string; day: string; date: string; score?: number; maxMarks?: number; passed?: boolean; learningGain?: number; status: string };
function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function readRows(key: string): Row[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as Row[] : []; } catch { return []; } }

export default function AssessmentFeedbackReport() {
  const [kind, setKind] = useState('all');
  const [view, setView] = useState<ReportView>('table');
  const [page, setPage] = useState(1);
  const results = useMemo<Result[]>(() => {
    const sourceRows: Row[] = [
      ...readRows('teacher-training-assessment-records').map(row => ({ ...row, kind: 'assessment' })),
      ...readRows('teacher-training-feedback-records').map(row => ({ ...row, kind: 'feedback' })),
    ];
    return sourceRows.map(row => ({ id: text(row.id), formTitle: text(row.formTitle ?? row.title) || 'Form', kind: text(row.kind) || 'assessment', stage: text(row.stage), traineeId: text(row.traineeId ?? row.userId), batchCode: text(row.batchCode ?? row.batchId), planCode: text(row.planCode), day: String(row.day ?? ''), date: text(row.submittedAt).slice(0, 10), ...(typeof row.score === 'number' ? { score: row.score } : {}), ...(typeof row.maxMarks === 'number' ? { maxMarks: row.maxMarks } : {}), ...(typeof row.passed === 'boolean' ? { passed: row.passed } : {}), ...(typeof row.learningGain === 'number' ? { learningGain: row.learningGain } : {}), status: text(row.status) || (row.completed ? 'submitted' : 'pending') })).sort((a, b) => b.date.localeCompare(a.date));
  }, []);
  const rows = results.filter(row => kind === 'all' || row.kind === kind);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const graded = rows.filter(row => row.score !== undefined);
  const passed = graded.filter(row => row.passed).length;
  const feedbackCount = rows.filter(row => row.kind === 'feedback').length;
  const assessmentCount = rows.filter(row => row.kind === 'assessment').length;
  const byStage = [...graded.reduce((groups, row) => { const group = groups.get(row.stage || 'Other') ?? { count: 0, gainTotal: 0, gainCount: 0 }; group.count++; if (row.learningGain !== undefined) { group.gainTotal += row.learningGain; group.gainCount++; } groups.set(row.stage || 'Other', group); return groups; }, new Map<string, { count: number; gainTotal: number; gainCount: number }>()).entries()].map(([stage, values]) => ({ label: stage, values: [values.gainCount ? values.gainTotal / values.gainCount : 0] }));
  return <div className="app report-app"><Sidebar activePage="Assessment & Feedback Report" /><main className="main report-main"><Topbar title="Assessment & Feedback Report" description="Review completion, graded outcomes, and learning gain from recorded submissions." /><Container maxWidth="xl" sx={{ py: 2.5 }}><Stack spacing={1.5}>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><TextField select size="small" label="Result type" value={kind} onChange={event => { setKind(event.target.value); setPage(1); }} sx={{ minWidth: 200 }}><MenuItem value="all">All results</MenuItem><MenuItem value="assessment">Assessments</MenuItem><MenuItem value="feedback">Feedback</MenuItem></TextField></Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.25 }}>
      <Summary label="Submissions" value={rows.length} />
      <Summary label="Graded" value={graded.length} />
      <Summary label="Pass rate" value={graded.length ? `${Math.round(passed / graded.length * 100)}%` : '—'} />
      <Summary label="Feedback responses" value={feedbackCount} />
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}><ReportViewToggle view={view} onChange={setView} /></Box>
    {view === 'graph' ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}><ReportBarChart title="Submission mix" description="Assessment and feedback submissions under the selected result filter" series={[{ label: 'Assessments', color: '#2584b9' }, { label: 'Feedback', color: '#815bb3' }]} rows={[{ label: 'Submissions', values: [assessmentCount, feedbackCount] }]} chartType="pie" /><ReportBarChart title="Graded assessment outcomes" description="Pass and not-passed counts; non-graded forms are excluded" series={[{ label: 'Passed', color: '#16945b' }, { label: 'Not passed', color: '#dd6670' }]} rows={[{ label: 'Graded assessments', values: [passed, graded.length - passed] }]} chartType="pie" /><ReportBarChart title="Average learning gain" description="Mean post-assessment minus pre-assessment marks where comparable scores are available" series={[{ label: 'Learning gain', color: '#e69a32' }]} rows={byStage} formatter={value => `${value > 0 ? '+' : ''}${value.toFixed(1)}`} signed /></Box> : <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>Submission detail · {rows.length}</Typography>{rows.length ? <><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Form</TableCell><TableCell>Trainee</TableCell><TableCell>Batch</TableCell><TableCell>Plan / day</TableCell><TableCell>Submitted</TableCell><TableCell>Score / outcome</TableCell><TableCell>Learning gain</TableCell></TableRow></TableHead><TableBody>{pageRows.map(row => <TableRow key={row.id}><TableCell>{row.formTitle}<br /><Typography variant="caption" color="text.secondary">{row.kind} · {row.stage}</Typography></TableCell><TableCell>{row.traineeId || '—'}</TableCell><TableCell>{row.batchCode || '—'}</TableCell><TableCell>{row.planCode || '—'}{row.day ? ` · Day ${row.day}` : ''}</TableCell><TableCell>{formatDate(row.date) || '—'}</TableCell><TableCell>{row.score !== undefined ? <Stack direction="row" spacing={.6} alignItems="center"><span>{row.score}/{row.maxMarks}</span><Chip size="small" color={row.passed ? 'success' : 'warning'} label={row.passed ? 'Pass' : 'Not passed'} /></Stack> : <Chip size="small" variant="outlined" label={row.kind === 'feedback' ? 'Feedback received' : row.status} />}</TableCell><TableCell>{row.learningGain === undefined ? '—' : `${row.learningGain > 0 ? '+' : ''}${row.learningGain}`}</TableCell></TableRow>)}</TableBody></Table></TableContainer><ReportPagination total={rows.length} page={currentPage} pageSize={PAGE_SIZE} onPageChange={setPage} /></> : <Typography color="text.secondary">No assessment or feedback submissions match this filter.</Typography>}</Paper>}
  </Stack></Container><Footer /></main></div>;
}
function Summary({ label, value }: { label: string; value: string | number }) { return <Paper elevation={0} sx={{ p: 1.75, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography><Typography variant="h4" fontWeight={800} color="#153f68">{value}</Typography></Paper>; }
