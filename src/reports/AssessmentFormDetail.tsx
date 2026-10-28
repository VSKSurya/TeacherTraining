import { useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { ReportBarChart } from './ReportCharts';
import { formatDate } from '../dateFormat';

type Row = Record<string, any>;
type FormQuestion = { id: string; prompt: string; options?: string[]; correctIndex?: number; points?: number; selection?: 'multiple' };
type FormRecord = { id: string; title: string; kind: string; stage: string; planCode?: string; day?: number; questions: FormQuestion[] };
type Submission = { id: string; formId?: string; formTitle?: string; traineeId?: string; userId?: string; registrationId?: string; batchId?: string; batchCode?: string; planCode?: string; submittedAt?: string; score?: number; maxMarks?: number; passed?: boolean; answers?: Record<string, string> };
const COLORS = ['#2584b9', '#16945b', '#e69a32', '#815bb3', '#dd6670', '#36a6a0', '#657c92', '#c17d3c'];
const text = (value: unknown) => typeof value === 'string' ? value : '';
const hiddenFeedbackPrompts = new Set(['name of the school', 'name of the teacher', 'contact number']);
const visibleQuestions = (form: FormRecord) => form.kind === 'feedback'
  ? form.questions.filter(question => !hiddenFeedbackPrompts.has(question.prompt.trim().replace(/\s*\*$/, '').toLowerCase()))
  : form.stage === 'pre' ? form.questions.slice(5) : form.questions;
const read = (key: string): Row[] => { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as Row[] : []; } catch { return []; } };
const refs = (row: Row) => [row.id, row.batchId, row.batchCode, row.uniqueId].map(text).filter(Boolean);
const identityRefs = (row: Row) => [row.traineeId, row.userId, row.participantId, row.studentId, row.id].map(value => text(value).trim().toLowerCase()).filter(Boolean);
const getBatchPlanCode = (batch: Row, plan: Row | undefined) => text(batch.trainingPlanCode ?? batch.planCode ?? plan?.code);
function findAnswerIndex(question: FormQuestion, raw: unknown) {
  const value = text(raw);
  if (!value) return -1;
  const index = Number(value);
  return Number.isInteger(index) && question.options?.[index] !== undefined ? index : question.options?.findIndex(option => option === value) ?? -1;
}
function optionPercent(count: number, total: number) { return total ? `${(count / total * 100).toFixed(1)}%` : '0.0%'; }

export default function AssessmentFormDetail({ form, submissions, onBack }: { form: FormRecord; submissions: Submission[]; onBack: () => void }) {
  const [view, setView] = useState<'combined' | 'table' | 'chart'>('combined');
  const [participant, setParticipant] = useState<Submission | null>(null);
  const batches = useMemo(() => read('teacher-training-batch-plan-uses'), []);
  const plans = useMemo(() => read('teacher-training-plans'), []);
  const registrations = useMemo(() => read('teacher-training-registrations'), []);
  const trainees = useMemo(() => read('teacher-training-trainees'), []);
  const associations = useMemo(() => read('teacher-training-project-plan-associations'), []);
  const assignedBatches = batches.filter(batch => {
    const association = associations.find(item => text(item.id) === text(batch.projectPlanAssociationId));
    const plan = plans.find(item => text(item.id) === text(batch.trainingPlanId ?? association?.trainingPlanId) || text(item.code) === getBatchPlanCode(batch, undefined));
    const code = getBatchPlanCode(batch, plan);
    const linked = Array.isArray(plan?.resourceAssignments) && plan.resourceAssignments.some((item: Row) => text(item.formId) === form.id);
    return linked || text(form.planCode) === '*' || (!!text(form.planCode) && (text(form.planCode) === code || text(form.planCode) === text(plan?.code)));
  });
  const batchRefsSet = new Set(assignedBatches.flatMap(refs));
  submissions.forEach(row => { if (row.batchId) batchRefsSet.add(row.batchId); if (row.batchCode) batchRefsSet.add(row.batchCode); });
  const registered = registrations.filter(row => refs(row).some(ref => batchRefsSet.has(ref)) && !['rejected', 'cancelled', 'withdrawn'].includes(text(row.status ?? row.registrationStatus ?? row.approvalStatus).toLowerCase()));
  const registeredIds = new Set(registered.map(row => identityRefs(row).find(Boolean)).filter(Boolean));
  const submittedIds = new Set(submissions.map(row => identityRefs(row).find(Boolean) || row.id).filter(Boolean));
  const submittedCount = submittedIds.size;
  const totalRegistered = registeredIds.size || (registered.length ? registered.length : submittedCount);
  const pendingCount = Math.max(0, totalRegistered - submittedCount);
  const submissionPercentage = totalRegistered ? submittedCount / totalRegistered * 100 : 0;
  const scored = submissions.filter(row => typeof row.score === 'number' && typeof row.maxMarks === 'number' && row.maxMarks > 0);
  const averageScore = scored.length ? scored.reduce((sum, row) => sum + (row.score! / row.maxMarks! * 100), 0) / scored.length : null;
  const reportQuestions = visibleQuestions(form);
  const reportQuestionNumber = (index: number) => form.stage === 'pre' ? index + 6 : index + 1;
  const questionStats = reportQuestions.map((question, questionIndex) => {
    const optionCounts = (question.options ?? []).map(() => 0);
    let correct = 0; let incorrect = 0; let skipped = 0;
    const freeText: { value: string; count: number }[] = [];
    submissions.forEach(row => {
      const raw = row.answers?.[question.id];
      if (question.selection === 'multiple' && question.options?.length) {
        let selected: number[] = [];
        try { selected = JSON.parse(text(raw) || '[]'); } catch { selected = []; }
        if (!selected.length) { skipped++; return; }
        selected.forEach(answerIndex => { if (Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < optionCounts.length) optionCounts[answerIndex]++; });
      } else if (question.options?.length) {
        const answerIndex = findAnswerIndex(question, raw);
        if (answerIndex < 0) { skipped++; return; }
        optionCounts[answerIndex]++;
        if (question.correctIndex !== undefined) answerIndex === question.correctIndex ? correct++ : incorrect++;
      } else {
        const answer = text(raw).trim();
        if (!answer) { skipped++; return; }
        const index = freeText.findIndex(item => item.value === answer);
        if (index < 0) freeText.push({ value: answer, count: 1 }); else freeText[index].count++;
      }
    });
    const answeredCount = submissions.length - skipped;
    const questionType = !question.options?.length ? 'Text' : question.selection === 'multiple' ? 'Multiple Choice' : question.options.some(option => /^\s*\d+\s*-/.test(option)) || form.stage === 'feedback' ? 'Rating' : 'Single Choice';
    return { question, questionIndex, optionCounts, correct, incorrect, skipped, answeredCount, freeText, questionType };
  });
  const objectiveStats = questionStats.filter(item => item.question.correctIndex !== undefined);
  const summaryBatches = assignedBatches.length ? assignedBatches : batches.filter(batch => submissions.some(row => refs(batch).includes(text(row.batchId ?? row.batchCode))));
  const projectNames = [...new Set(summaryBatches.map(batch => text(batch.projectName)).filter(Boolean))];
  const batchNames = [...new Set(summaryBatches.map(batch => text(batch.batchCode ?? batch.name ?? batch.id)).filter(Boolean))];
  const states = [...new Set(summaryBatches.map(batch => text(batch.state)).filter(Boolean))];
  const districts = [...new Set(summaryBatches.map(batch => text(batch.district)).filter(Boolean))];
  const schools = [...new Set(summaryBatches.map(batch => text(batch.schoolName ?? batch.name)).filter(Boolean))];
  const trainingDates = [...new Set(summaryBatches.flatMap(batch => Array.isArray(batch.trainingDates) ? batch.trainingDates.map(text) : [text(batch.trainingStartDate)].filter(Boolean)))];
  const responseProfile = (row: Submission) => {
    const keys = identityRefs(row);
    const registration = registrations.find(item => (row.registrationId && text(item.id) === row.registrationId) || identityRefs(item).some(key => keys.includes(key)));
    const trainee = trainees.find(item => identityRefs(item).some(key => keys.includes(key)));
    const batch = batches.find(item => refs(item).some(ref => ref === text(row.batchId ?? row.batchCode)));
    return { registration, trainee, batch };
  };
  const answerFor = (row: Submission, question: FormQuestion) => {
    const raw = row.answers?.[question.id];
    if (question.selection === 'multiple') {
      try { const selected: number[] = JSON.parse(text(raw) || '[]'); return selected.map(index => `${String.fromCharCode(65 + index)}. ${question.options?.[index]}`).join(', ') || 'Skipped'; } catch { return 'Skipped'; }
    }
    const index = findAnswerIndex(question, raw);
    return index >= 0 ? `${String.fromCharCode(65 + index)}. ${question.options?.[index]}` : text(raw) || 'Skipped';
  };

  return <Stack spacing={1.5}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}><Box><Typography variant="h5" fontWeight={800}>{form.stage === 'pre' ? 'Pre-Assessment Form – Detailed Report' : `${form.title} – Detailed Report`}</Typography><Typography variant="body2" color="text.secondary">Consolidated response analysis for {form.title} · {submissions.length} submission(s)</Typography></Box><Button variant="outlined" onClick={onBack}>Back to submission details</Button></Stack>
    <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>Report Summary</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.25 }}>
      <SummaryItem label="Project Name" value={projectNames.join(', ') || '—'} /><SummaryItem label="Batch Name / Code" value={batchNames.join(', ') || '—'} /><SummaryItem label="State / District / School" value={[states.join(', '), districts.join(', '), schools.join(', ')].filter(Boolean).join(' / ') || '—'} /><SummaryItem label="Training Date" value={trainingDates.map(date => formatDate(date)).join(', ') || '—'} /><SummaryItem label="Total Registered Participants" value={totalRegistered} /><SummaryItem label="Total Submitted Responses" value={submittedCount} /><SummaryItem label="Pending Responses" value={pendingCount} /><SummaryItem label="Submission Percentage" value={`${submissionPercentage.toFixed(1)}%`} /><SummaryItem label="Average Assessment Score" value={averageScore === null ? 'Not scored' : `${averageScore.toFixed(1)}%`} />
    </Box></Paper>
    {!submissions.length && <Alert severity="info">No submitted responses are recorded for this form yet. Question charts will populate as participants submit their forms.</Alert>}
    <Stack direction="row" justifyContent="flex-end"><ToggleButtonGroup size="small" exclusive value={view} onChange={(_, next) => { if (next) setView(next); }} aria-label="Report display mode"><ToggleButton value="table">Table View</ToggleButton><ToggleButton value="chart">Chart View</ToggleButton><ToggleButton value="combined">Combined View</ToggleButton></ToggleButtonGroup></Stack>
    {(view === 'table' || view === 'combined') && <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>Question-wise Answer Analysis</Typography>{questionStats.map(({ question, questionIndex, optionCounts, correct, incorrect, skipped, answeredCount, freeText, questionType }) => <Box key={question.id} sx={{ mb: 2.25 }}><Typography variant="subtitle1" fontWeight={750}>Question {reportQuestionNumber(questionIndex)}: {question.prompt}</Typography><Typography variant="caption" color="text.secondary">Question Type: {questionType} · Skipped: {skipped} · Correct: {question.correctIndex === undefined ? 'Not configured' : correct} · Incorrect: {question.correctIndex === undefined ? 'Not configured' : incorrect}</Typography>{question.options?.length ? <TableContainer sx={{ mt: .75 }}><Table size="small"><TableHead><TableRow><TableCell>Answer Option</TableCell><TableCell align="right">Selected Count</TableCell><TableCell align="right">Percentage</TableCell></TableRow></TableHead><TableBody>{question.options.map((option, index) => <TableRow key={option}><TableCell>{String.fromCharCode(65 + index)}. {option}{question.correctIndex === index && <Chip size="small" color="success" label="Correct" sx={{ ml: 1 }} />}</TableCell><TableCell align="right">{optionCounts[index]}</TableCell><TableCell align="right">{optionPercent(optionCounts[index], answeredCount)}</TableCell></TableRow>)}<TableRow><TableCell><strong>Total answered</strong></TableCell><TableCell align="right"><strong>{answeredCount}</strong></TableCell><TableCell align="right"><strong>{answeredCount ? '100.0%' : '0.0%'}</strong></TableCell></TableRow></TableBody></Table></TableContainer> : <Stack direction="row" flexWrap="wrap" gap={.75} sx={{ mt: .75 }}>{freeText.length ? freeText.map(item => <Chip key={item.value} variant="outlined" label={`${item.value}: ${item.count} response(s)`} />) : <Typography variant="body2" color="text.secondary">No written responses yet.</Typography>}</Stack>}</Box>)}</Paper>}
    {(view === 'chart' || view === 'combined') && <><Typography variant="h6" fontWeight={750}>Graphical Representation</Typography>{objectiveStats.length > 0 && <ReportBarChart title="Question-wise correct and incorrect comparison" description="Objective response counts across submitted participants" series={[{ label: 'Correct', color: '#16945b' }, { label: 'Incorrect', color: '#dd6670' }]} rows={objectiveStats.map(item => ({ label: `Q${reportQuestionNumber(item.questionIndex)}`, values: [item.correct, item.incorrect] }))} chartType="cluster" />}<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 1.25 }}>{questionStats.map(({ question, questionIndex, optionCounts, answeredCount, freeText }) => { const questionNumber = reportQuestionNumber(questionIndex); const optionNames = (question.options ?? []).map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`); const chartNames = optionNames.length ? optionNames : freeText.map(item => item.value); const chartValues = optionNames.length ? optionCounts : freeText.map(item => item.count); return <ReportBarChart key={`charts-${question.id}`}  title={`Question ${questionNumber}: ${question.prompt}`} description={`Answer distribution · ${answeredCount} answered response(s); skipped: ${submissions.length - answeredCount}`} series={chartNames.map((label, index) => ({ label, color: COLORS[index % COLORS.length] }))} rows={[{ label: `Question ${questionNumber}`, values: chartValues }]} formatter={value => `${value} (${optionPercent(value, answeredCount)})`} chartType="pie" />; })}</Box></>}
    {(view === 'table' || view === 'combined') && <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>Participant-wise Answers</Typography>{submissions.length ? <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Participant Name</TableCell><TableCell>Participant Unique ID</TableCell><TableCell>State / District / School</TableCell><TableCell>Batch Code</TableCell><TableCell>Submission Date</TableCell><TableCell>Total Score</TableCell><TableCell /></TableRow></TableHead><TableBody>{submissions.map(row => { const { registration, trainee, batch } = responseProfile(row); return <TableRow key={row.id}><TableCell>{text(registration?.traineeName ?? registration?.name ?? trainee?.name) || 'Participant'}</TableCell><TableCell>{text(row.traineeId ?? row.userId) || '—'}</TableCell><TableCell>{[text(registration?.state ?? trainee?.state ?? batch?.state), text(registration?.district ?? trainee?.district ?? batch?.district), text(registration?.schoolName ?? trainee?.schoolName ?? batch?.schoolName)].filter(Boolean).join(' / ') || '—'}</TableCell><TableCell>{text(row.batchCode ?? batch?.batchCode) || '—'}</TableCell><TableCell>{row.submittedAt ? formatDate(text(row.submittedAt)) : '—'}</TableCell><TableCell>{typeof row.score === 'number' ? `${row.score}/${row.maxMarks ?? '—'}` : '—'}</TableCell><TableCell><Button size="small" onClick={() => setParticipant(row)}>View answer sheet</Button></TableCell></TableRow>; })}</TableBody></Table></TableContainer> : <Typography color="text.secondary">No participant submissions for this form.</Typography>}</Paper>}
    <Dialog open={Boolean(participant)} onClose={() => setParticipant(null)} maxWidth="md" fullWidth><DialogTitle>Submitted answer sheet · {text(participant?.traineeId ?? participant?.userId)}</DialogTitle><DialogContent><Stack spacing={1} sx={{ pt: 1 }}>{reportQuestions.map((question, index) => { const raw = participant?.answers?.[question.id]; const selectedIndex = findAnswerIndex(question, raw); const correct = question.correctIndex === undefined ? null : selectedIndex === question.correctIndex; return <Paper key={question.id} variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={700}>Q{reportQuestionNumber(index)}. {question.prompt}</Typography><Typography variant="body2" sx={{ mt: .5 }}>Selected answer: {answerFor(participant ?? { id: '' }, question)}</Typography>{correct !== null && <Chip size="small" sx={{ mt: .5 }} color={correct ? 'success' : 'error'} label={correct ? 'Correct' : selectedIndex < 0 ? 'Skipped' : 'Incorrect'} />}</Paper>; })}<Typography fontWeight={750}>Total score: {typeof participant?.score === 'number' ? `${participant.score}/${participant.maxMarks ?? '—'}` : 'Not scored'}</Typography></Stack></DialogContent><DialogActions><Button onClick={() => setParticipant(null)}>Close</Button></DialogActions></Dialog>
  </Stack>;
}

function SummaryItem({ label, value }: { label: string; value: string | number }) { return <Paper variant="outlined" sx={{ p: 1.25, minWidth: 0 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography><Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{value}</Typography></Paper>; }
