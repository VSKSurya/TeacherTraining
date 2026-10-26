import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Radio, RadioGroup, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';

type Row = Record<string, unknown>;
type Question = { id: string; prompt: string; options: string[]; correctIndex?: number; points: number; required: boolean };
type FormRecord = { id: string; title: string; kind: 'assessment' | 'feedback'; grading: 'graded' | 'non-graded'; source: 'native' | 'document' | 'external' | 'integrated'; link?: string; planCode: string; day: number; stage: 'pre' | 'post' | 'daily' | 'feedback'; maxMarks: number; passMarks: number; attemptLimit: number; timeLimit?: number; availableFrom?: string; availableUntil?: string; allowUnanswered: boolean; mandatory: boolean; comparable: boolean; questions: Question[]; createdAt: string };
type Submission = Row & { id: string; formId: string; formTitle: string; kind: string; grading?: string; comparable?: boolean; traineeId: string; userId: string; registrationId?: string; batchId: string; batchCode: string; planCode: string; day: number; stage: string; submittedAt: string; completed: boolean; status: string; score?: number; maxMarks?: number; passed?: boolean; learningGain?: number; answers?: Record<string, string> };

const KEY = { forms: 'teacher-training-assessment-form-master', assessment: 'teacher-training-assessment-records', feedback: 'teacher-training-feedback-records', plans: 'teacher-training-plans', batches: 'teacher-training-batch-plan-uses', registrations: 'teacher-training-registrations' };
function readRows<T extends Row>(key: string): T[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as T[] : []; } catch { return []; } }
function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function date(value: unknown) { return text(value).slice(0, 10); }
function id() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function jsonSave(key: string, rows: unknown[]) { localStorage.setItem(key, JSON.stringify(rows)); }
function normalizeStage(form: FormRecord) { return form.stage === 'feedback' ? 'feedback' : form.stage; }
function traineeIds(row: Row) { return [row.traineeId, row.participantId, row.userId, row.studentId, row.id].map(value => text(value).trim().toLowerCase()).filter(Boolean); }
function rowBatch(row: Row) { return text(row.batchId ?? row.batchCode ?? row.batchUniqueId); }
function batchRefs(batch: Row) { return [text(batch.id), text(batch.batchCode), text(batch.uniqueId)].filter(Boolean); }
function batchDates(batch: Row) { const stored = batch.trainingDates; if (Array.isArray(stored)) return stored.map(date).filter(Boolean); const start = date(batch.trainingStartDate); return start ? [start] : []; }
function assignedTrainer(batch: Row, userId: string) { return [batch.trainerCode, batch.trainerId, batch.trainerUserId].some(value => text(value).toLowerCase() === userId.toLowerCase()); }
function registrationApproved(row: Row) { return row.approved === true || ['approved', 'confirmed', 'enrolled'].includes(text(row.status).toLowerCase()); }
function businessToday() { const zone = import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || 'Asia/Kolkata'; try { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const values = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; } catch { return new Date().toISOString().slice(0, 10); } }
function parseQuestions(value: string, kind: 'assessment' | 'feedback'): Question[] {
  return value.split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [prompt = '', ...optionParts] = line.split('|').map(part => part.trim());
    const optionText = optionParts[0] ?? '';
    const options = optionText.split(';').map(item => item.trim()).filter(Boolean);
    const correctAnswer = optionParts[1] ?? '';
    return { id: id(), prompt, options, correctIndex: correctAnswer ? options.findIndex(option => option.toLowerCase() === correctAnswer.toLowerCase()) : undefined, points: 1, required: true };
  }).filter(question => question.prompt).map((question, index) => ({ ...question, id: `q-${Date.now()}-${index}`, points: kind === 'assessment' && question.options.length >= 2 ? 1 : 0 }));
}

export default function AssessmentFeedback() {
  const session = getSession();
  const userId = session?.userId ?? '';
  const role = session?.role ?? 'trainee';
  const canCreate = ['schoolnet-super-admin', 'schoolnet-project-admin'].includes(role);
  const isTrainee = role === 'trainee';
  const [forms, setForms] = useState<FormRecord[]>(() => readRows<FormRecord>(KEY.forms));
  const [assessments, setAssessments] = useState<Submission[]>(() => readRows<Submission>(KEY.assessment));
  const [feedbackRows, setFeedbackRows] = useState<Submission[]>(() => readRows<Submission>(KEY.feedback));
  const plans = useMemo(() => readRows<Row>(KEY.plans), []);
  const batches = useMemo(() => readRows<Row>(KEY.batches), []);
  const registrations = useMemo(() => readRows<Row>(KEY.registrations), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedFormId, setSelectedFormId] = useState('');
  const [taskStartedAt, setTaskStartedAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [formDraft, setFormDraft] = useState({ title: '', kind: 'assessment' as 'assessment' | 'feedback', grading: 'graded' as 'graded' | 'non-graded', source: 'native' as FormRecord['source'], link: '', planCode: '', day: '1', stage: 'pre' as FormRecord['stage'], maxMarks: '0', passMarks: '1', attemptLimit: '1', timeLimit: '', availableFrom: '', availableUntil: '', allowUnanswered: true, mandatory: false, comparable: true, questions: '' });

  const ownRegistrations = registrations.filter(row => traineeIds(row).includes(userId.toLowerCase()) && registrationApproved(row));
  const ownBatchRefs = new Set(ownRegistrations.map(rowBatch));
  const authorizedBatches = isTrainee
    ? batches.filter(batch => batchRefs(batch).some(ref => ownBatchRefs.has(ref)))
    : role === 'trainer' ? batches.filter(batch => assignedTrainer(batch, userId)) : batches;
  const formBatches = (form: FormRecord) => authorizedBatches.filter(batch => {
    const planCode = text(batch.trainingPlanCode ?? batch.planCode);
    const plan = plans.find(item => text(item.id) === text(batch.trainingPlanId) || text(item.code) === planCode);
    return (form.planCode === '*' || form.planCode === planCode || form.planCode === text(plan?.code)) && !['cancelled', 'archived'].includes(text(batch.status).toLowerCase());
  });
  const isOwnSubmission = (row: Submission) => !isTrainee || row.traineeId.toLowerCase() === userId.toLowerCase() || row.userId.toLowerCase() === userId.toLowerCase();
  const visibleBatchRefs = new Set(authorizedBatches.flatMap(batchRefs));
  const allSubmissions = [...assessments, ...feedbackRows].filter(row => isTrainee ? isOwnSubmission(row) : role === 'trainer' ? visibleBatchRefs.has(rowBatch(row)) : true).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const statusFor = (form: FormRecord, batch: Row) => {
    const refs = batchRefs(batch);
    const target = form.kind === 'feedback' ? feedbackRows : assessments;
    return target.find(row => row.formId === form.id && refs.includes(rowBatch(row)) && isOwnSubmission(row));
  };
  const taskRows = isTrainee ? forms.flatMap(form => formBatches(form).map(batch => ({ form, batch, submission: statusFor(form, batch) }))).filter(item => {
    const attempts = assessments.concat(feedbackRows).filter(row => row.formId === item.form.id && row.traineeId.toLowerCase() === userId.toLowerCase() && batchRefs(item.batch).includes(rowBatch(row))).length;
    if (attempts >= item.form.attemptLimit) return false;
    const status = text(item.batch.status).toLowerCase();
    if (['cancelled', 'archived'].includes(status)) return false;
    const schedule = batchDates(item.batch);
    const firstDate = schedule[0] ?? '';
    const dayDate = schedule[item.form.day - 1] ?? firstDate;
    const today = businessToday();
    const windowStart = item.form.availableFrom || dayDate;
    const windowEnd = item.form.availableUntil || (item.form.availableFrom ? '' : dayDate);
    if (item.form.stage === 'pre') return today >= windowStart && (today <= windowEnd || !windowEnd);
    if (item.form.stage === 'post' || item.form.stage === 'feedback') return today >= windowStart && (today <= windowEnd || !windowEnd);
    return today >= windowStart && (today <= windowEnd || !windowEnd);
  }) : [];

  function saveForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (formDraft.source !== 'native' && !formDraft.link.trim()) { setError('Provide the document URL, external form link, or integration endpoint.'); return; }
    const questions = formDraft.source === 'native' ? parseQuestions(formDraft.questions, formDraft.kind) : [];
    if (formDraft.source === 'native' && !questions.length) { setError('Add at least one question for a native form.'); return; }
    if (formDraft.source !== 'native' && formDraft.kind === 'assessment' && formDraft.grading === 'graded') { setError('External forms cannot produce a verified grade in this version. Use a non-graded assessment or create a native graded form.'); return; }
    if (formDraft.kind === 'assessment' && formDraft.grading === 'graded' && questions.some(q => q.options.length < 2 || q.correctIndex === undefined || q.correctIndex < 0)) { setError('Every graded native question needs options and a correct answer. Use Prompt | option 1;option 2 | correct answer.'); return; }
    const maxFromQuestions = questions.reduce((sum, q) => sum + q.points, 0);
    const plannedDays = Number(plans.find(plan => text(plan.code) === formDraft.planCode)?.days ?? 0);
    if (plannedDays > 0 && Number(formDraft.day) > plannedDays) { setError(`Day ${formDraft.day} is outside the selected training plan's ${plannedDays}-day duration.`); return; }
    if (formDraft.availableFrom && formDraft.availableUntil && formDraft.availableFrom > formDraft.availableUntil) { setError('The availability end date must be on or after the start date.'); return; }
    if (formDraft.kind === 'assessment' && formDraft.grading === 'graded' && Number(formDraft.passMarks) > maxFromQuestions) { setError(`Pass marks cannot exceed the calculated maximum of ${maxFromQuestions}.`); return; }
    const form: FormRecord = { id: id(), title: formDraft.title.trim(), kind: formDraft.kind, grading: formDraft.kind === 'feedback' ? 'non-graded' : formDraft.grading, source: formDraft.source, link: formDraft.link.trim() || undefined, planCode: formDraft.planCode || '*', day: Math.max(1, Number(formDraft.day) || 1), stage: formDraft.kind === 'feedback' ? 'feedback' : formDraft.stage, maxMarks: formDraft.kind === 'assessment' && formDraft.grading === 'graded' ? (maxFromQuestions || Number(formDraft.maxMarks) || 0) : 0, passMarks: formDraft.kind === 'assessment' && formDraft.grading === 'graded' ? Math.max(0, Number(formDraft.passMarks) || 0) : 0, attemptLimit: Math.max(1, Number(formDraft.attemptLimit) || 1), timeLimit: formDraft.timeLimit ? Number(formDraft.timeLimit) : undefined, availableFrom: formDraft.availableFrom || undefined, availableUntil: formDraft.availableUntil || undefined, allowUnanswered: formDraft.allowUnanswered, mandatory: formDraft.mandatory, comparable: formDraft.comparable, questions, createdAt: new Date().toISOString() };
    const updated = [...forms, form]; setForms(updated); jsonSave(KEY.forms, updated); setDialogOpen(false); setNotice('Form saved to the master repository and linked to its plan and training day.');
    setFormDraft({ title: '', kind: 'assessment', grading: 'graded', source: 'native', link: '', planCode: '', day: '1', stage: 'pre', maxMarks: '0', passMarks: '1', attemptLimit: '1', timeLimit: '', availableFrom: '', availableUntil: '', allowUnanswered: true, mandatory: false, comparable: true, questions: '' });
  }

  function begin(form: FormRecord, batch: Row) { setAnswers({}); setTaskStartedAt(Date.now()); setSelectedFormId(`${form.id}::${text(batch.id ?? batch.batchCode)}`); setError(''); }
  const activeTask = taskRows.find(item => `${item.form.id}::${text(item.batch.id ?? item.batch.batchCode)}` === selectedFormId);
  useEffect(() => {
    if (!activeTask?.form.timeLimit || taskStartedAt === null) { setSecondsLeft(null); return; }
    const refresh = () => setSecondsLeft(Math.max(0, Math.ceil((taskStartedAt + activeTask.form.timeLimit! * 60_000 - Date.now()) / 1000)));
    refresh(); const timer = window.setInterval(refresh, 1000); return () => window.clearInterval(timer);
  }, [activeTask?.form.id, activeTask?.form.timeLimit, taskStartedAt]);
  function submitTask() {
    if (!activeTask) return;
    const { form, batch } = activeTask;
    if (form.timeLimit && taskStartedAt !== null && Date.now() > taskStartedAt + form.timeLimit * 60_000) { setError('The time limit has expired. This attempt was not submitted.'); return; }
    const answered = form.questions.filter(question => (answers[question.id] ?? '').trim());
    if (!form.allowUnanswered && form.source === 'native' && answered.length !== form.questions.length) { setError('Answer every required question before submitting.'); return; }
    const prev = form.kind === 'feedback' ? feedbackRows : assessments;
    const count = prev.filter(row => row.formId === form.id && row.traineeId.toLowerCase() === userId.toLowerCase() && batchRefs(batch).includes(rowBatch(row))).length;
    if (count >= form.attemptLimit) { setError('The attempt limit for this form has been reached.'); return; }
    if (form.source !== 'native' && form.link) { window.open(form.link, '_blank', 'noopener,noreferrer'); }
    let score: number | undefined; let passed: boolean | undefined;
    if (form.kind === 'assessment' && form.grading === 'graded' && form.source === 'native') {
      score = form.questions.reduce((sum, question) => sum + (answers[question.id] === String(question.correctIndex) ? question.points : 0), 0);
      passed = score >= form.passMarks;
    }
    const effectivePlanCode = text(batch.trainingPlanCode ?? batch.planCode) || form.planCode;
    const previousPre = assessments.filter(row => row.traineeId.toLowerCase() === userId.toLowerCase() && batchRefs(batch).includes(rowBatch(row)) && row.planCode === effectivePlanCode && row.stage === 'pre' && row.comparable && form.comparable && row.maxMarks === form.maxMarks && row.score !== undefined).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
    const learningGain = form.stage === 'post' && score !== undefined && previousPre?.score !== undefined ? score - previousPre.score : undefined;
    const registration = ownRegistrations.find(row => batchRefs(batch).includes(rowBatch(row)));
    const submission: Submission = { id: id(), formId: form.id, formTitle: form.title, kind: form.kind, grading: form.grading, comparable: form.comparable, traineeId: userId, userId, registrationId: text(registration?.id) || undefined, batchId: text(batch.id), batchCode: text(batch.batchCode), planCode: effectivePlanCode, day: form.day, stage: normalizeStage(form), submittedAt: new Date().toISOString(), completed: true, status: score === undefined ? 'submitted' : passed ? 'passed' : 'graded', ...(score !== undefined ? { score, maxMarks: form.maxMarks, passed, ...(learningGain !== undefined ? { learningGain } : {}) } : {}), answers };
    const updated = [...prev, submission];
    if (form.kind === 'feedback') { setFeedbackRows(updated); jsonSave(KEY.feedback, updated); }
    else { setAssessments(updated); jsonSave(KEY.assessment, updated); }
    setSelectedFormId(''); setNotice(score === undefined ? 'Submission recorded. No pass/fail result was created.' : `Assessment recorded: ${score}/${form.maxMarks}${passed ? ' (Pass)' : ' (Not passed)'}.${learningGain !== undefined ? ` Learning gain: ${learningGain >= 0 ? '+' : ''}${learningGain} marks.` : ''}`);
  }

  const eligibleFormRows = isTrainee ? taskRows : forms;
  const managerLabel = canCreate ? 'Form master and results' : role === 'trainer' ? 'Assigned batch forms and results' : 'Authorized assessment and feedback results';
  return <div className="app"><Sidebar activePage="Assessments & Feedback" /><main className="main"><Topbar title="Assessments & Feedback" description="Manage form links, complete assigned tasks, and review authorized results." /><Container maxWidth="xl" sx={{ py: 2.5 }}><Stack spacing={2}>
    {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}{error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {activeTask ? <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="h5" fontWeight={800}>{activeTask.form.title}</Typography><Typography color="text.secondary">{text(activeTask.batch.batchCode ?? activeTask.batch.name) || 'Batch'} · {activeTask.form.stage} · Day {activeTask.form.day}</Typography></Box><Stack direction="row" spacing={1} alignItems="center">{secondsLeft !== null && <Chip color={secondsLeft ? 'warning' : 'error'} label={secondsLeft ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} left` : 'Time expired'} />}<Button onClick={() => { setSelectedFormId(''); setTaskStartedAt(null); }}>Close</Button></Stack></Stack>{activeTask.form.source !== 'native' && activeTask.form.link && <Alert severity="info"><a href={activeTask.form.link} target="_blank" rel="noreferrer">Open {activeTask.form.source} form</a>. After completing it, return here and select Submit to record completion.</Alert>}{activeTask.form.questions.map((question, index) => <Paper key={question.id} variant="outlined" sx={{ p: 1.5 }}><Typography fontWeight={700} sx={{ mb: 1 }}>{index + 1}. {question.prompt}{question.required && !activeTask.form.allowUnanswered ? ' *' : ''}</Typography>{question.options.length ? <RadioGroup value={answers[question.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))}>{question.options.map((option, optionIndex) => <FormControlLabel key={optionIndex} value={String(optionIndex)} control={<Radio size="small" />} label={option} />)}</RadioGroup> : <TextField fullWidth multiline minRows={2} value={answers[question.id] ?? ''} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))} placeholder="Type your response" />}</Paper>)}<Stack direction="row" justifyContent="flex-end"><Button variant="contained" disabled={secondsLeft === 0} onClick={submitTask}>Submit {activeTask.form.kind}</Button></Stack></Stack></Paper> : <>
      {isTrainee ? <>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Box><Typography variant="h6" fontWeight={750}>My assigned forms</Typography><Typography variant="body2" color="text.secondary">Forms are matched to your registration, batch, training plan, day, and availability window.</Typography></Box></Stack>{eligibleFormRows.length ? <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Form</TableCell><TableCell>Batch / plan</TableCell><TableCell>Stage</TableCell><TableCell>Rules</TableCell><TableCell /></TableRow></TableHead><TableBody>{taskRows.map(({ form, batch }) => <TableRow key={`${form.id}-${batch.id}`}><TableCell><Typography fontWeight={700}>{form.title}</Typography><Typography variant="caption" color="text.secondary">{form.kind} · {form.grading}</Typography></TableCell><TableCell>{text(batch.batchCode) || 'Batch'}<br />{form.planCode} · Day {form.day}</TableCell><TableCell>{form.stage}</TableCell><TableCell>{form.grading === 'graded' ? `${form.maxMarks} marks · pass ${form.passMarks}` : 'No pass/fail'}<br />{form.attemptLimit} attempt(s){form.mandatory ? ' · mandatory' : ''}</TableCell><TableCell><Button variant="contained" size="small" onClick={() => begin(form, batch)}>Open form</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer> : <Alert severity="info">No forms are currently available for your assigned batches. Check the assigned day and availability dates with your trainer.</Alert>}</Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>My submission history</Typography><SubmissionTable rows={allSubmissions} /></Paper>
      </> : <>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}><Box><Typography variant="h6" fontWeight={750}>{managerLabel}</Typography><Typography variant="body2" color="text.secondary">{canCreate ? 'Create native forms or link documents and external or integrated forms to a plan and day.' : 'View results available to your role and assigned batches.'}</Typography></Box>{canCreate && <Button variant="contained" onClick={() => setDialogOpen(true)}>Create form</Button>}</Stack>{forms.length ? <TableContainer sx={{ mt: 1.5 }}><Table size="small"><TableHead><TableRow><TableCell>Form</TableCell><TableCell>Type</TableCell><TableCell>Linked plan / day</TableCell><TableCell>Stage</TableCell><TableCell>Rules</TableCell><TableCell>Source</TableCell></TableRow></TableHead><TableBody>{forms.map(form => <TableRow key={form.id}><TableCell><Typography fontWeight={700}>{form.title}</Typography><Typography variant="caption" color="text.secondary">{form.questions.length} native question(s)</Typography></TableCell><TableCell>{form.kind} · {form.grading}</TableCell><TableCell>{form.planCode === '*' ? 'All plans' : form.planCode}<br />Day {form.day}</TableCell><TableCell>{form.stage}</TableCell><TableCell>{form.grading === 'graded' ? `${form.maxMarks} max / ${form.passMarks} pass` : 'No pass/fail'}<br />{form.attemptLimit} attempt(s){form.mandatory ? ' · mandatory' : ''}</TableCell><TableCell>{form.source}{form.link && <> · <a href={form.link} target="_blank" rel="noreferrer">Open</a></>}</TableCell></TableRow>)}</TableBody></Table></TableContainer> : <Typography color="text.secondary" sx={{ mt: 1.5 }}>No forms have been created yet.</Typography>}</Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Typography variant="h6" fontWeight={750}>Submission results</Typography><Chip size="small" label={`${allSubmissions.length} submission(s)`} /></Stack><SubmissionTable rows={allSubmissions} /></Paper>
      </>}
      </>}
  </Stack></Container><Footer /></main>
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth><Box component="form" onSubmit={saveForm}><DialogTitle>Create assessment or feedback form</DialogTitle><DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}>
      <TextField required label="Form title" value={formDraft.title} onChange={event => setFormDraft({ ...formDraft, title: event.target.value })} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}><TextField select label="Form type" value={formDraft.kind} onChange={event => setFormDraft({ ...formDraft, kind: event.target.value as 'assessment' | 'feedback', stage: event.target.value === 'feedback' ? 'feedback' : 'pre' })}><MenuItem value="assessment">Assessment</MenuItem><MenuItem value="feedback">Feedback</MenuItem></TextField><TextField select label="Form source" value={formDraft.source} onChange={event => setFormDraft({ ...formDraft, source: event.target.value as FormRecord['source'] })}><MenuItem value="native">Native form</MenuItem><MenuItem value="document">Uploaded document link</MenuItem><MenuItem value="external">External form link</MenuItem><MenuItem value="integrated">Integrated platform</MenuItem></TextField><TextField select label="Training plan" value={formDraft.planCode} onChange={event => setFormDraft({ ...formDraft, planCode: event.target.value })}><MenuItem value="*">All plans</MenuItem>{plans.map(plan => <MenuItem key={text(plan.id)} value={text(plan.code)}>{text(plan.name)} · {text(plan.code)}</MenuItem>)}</TextField></Stack>
      {formDraft.source !== 'native' && <TextField required label={formDraft.source === 'document' ? 'Document URL' : formDraft.source === 'integrated' ? 'Integration form URL' : 'External form URL'} type="url" value={formDraft.link} onChange={event => setFormDraft({ ...formDraft, link: event.target.value })} />}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}><TextField select label="Training stage" value={formDraft.kind === 'feedback' ? 'feedback' : formDraft.stage} disabled={formDraft.kind === 'feedback'} onChange={event => setFormDraft({ ...formDraft, stage: event.target.value as FormRecord['stage'] })}><MenuItem value="pre">Pre-assessment</MenuItem><MenuItem value="post">Post-assessment</MenuItem><MenuItem value="daily">Training day</MenuItem><MenuItem value="feedback">Feedback</MenuItem></TextField><TextField type="number" label="Training day number" inputProps={{ min: 1 }} value={formDraft.day} onChange={event => setFormDraft({ ...formDraft, day: event.target.value })} /><TextField select label="Grading" value={formDraft.kind === 'feedback' ? 'non-graded' : formDraft.grading} disabled={formDraft.kind === 'feedback'} onChange={event => setFormDraft({ ...formDraft, grading: event.target.value as 'graded' | 'non-graded' })}><MenuItem value="graded">Graded</MenuItem><MenuItem value="non-graded">Non-graded</MenuItem></TextField></Stack>
      {formDraft.kind === 'assessment' && formDraft.grading === 'graded' && <TextField type="number" label="Pass marks" inputProps={{ min: 0 }} value={formDraft.passMarks} onChange={event => setFormDraft({ ...formDraft, passMarks: event.target.value })} />}
      {formDraft.source === 'native' && <TextField multiline minRows={5} label="Questions (one per line: Question | option A;option B | correct option)" helperText="For feedback or non-graded forms, options and correct answers are optional. Graded questions are 1 mark each." value={formDraft.questions} onChange={event => setFormDraft({ ...formDraft, questions: event.target.value })} />}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}><TextField type="date" label="Available from (optional)" InputLabelProps={{ shrink: true }} value={formDraft.availableFrom} onChange={event => setFormDraft({ ...formDraft, availableFrom: event.target.value })} /><TextField type="date" label="Available until (optional)" InputLabelProps={{ shrink: true }} value={formDraft.availableUntil} onChange={event => setFormDraft({ ...formDraft, availableUntil: event.target.value })} /><TextField type="number" label="Attempt limit" inputProps={{ min: 1 }} value={formDraft.attemptLimit} onChange={event => setFormDraft({ ...formDraft, attemptLimit: event.target.value })} /><TextField type="number" label="Time limit (minutes, optional)" inputProps={{ min: 1 }} value={formDraft.timeLimit} onChange={event => setFormDraft({ ...formDraft, timeLimit: event.target.value })} /></Stack>
      <Stack direction="row" useFlexGap flexWrap="wrap"><FormControlLabel control={<input type="checkbox" checked={!formDraft.allowUnanswered} onChange={event => setFormDraft({ ...formDraft, allowUnanswered: !event.target.checked })} />} label="Require answers" /><FormControlLabel control={<input type="checkbox" checked={formDraft.mandatory} onChange={event => setFormDraft({ ...formDraft, mandatory: event.target.checked })} />} label="Mandatory for completion" /><FormControlLabel control={<input type="checkbox" checked={formDraft.comparable} onChange={event => setFormDraft({ ...formDraft, comparable: event.target.checked })} />} label="Comparable scale for learning gain" /></Stack>
    </Stack></DialogContent><DialogActions><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save form</Button></DialogActions></Box></Dialog>
  </div>;
}

function SubmissionTable({ rows }: { rows: Submission[] }) {
  return rows.length ? <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Form</TableCell><TableCell>Trainee</TableCell><TableCell>Batch</TableCell><TableCell>Plan / day</TableCell><TableCell>Submitted</TableCell><TableCell>Result</TableCell></TableRow></TableHead><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell>{row.formTitle}<br /><Typography variant="caption" color="text.secondary">{row.kind} · {row.stage}</Typography></TableCell><TableCell>{row.traineeId}</TableCell><TableCell>{row.batchCode || row.batchId}</TableCell><TableCell>{row.planCode} · Day {row.day}</TableCell><TableCell>{new Date(row.submittedAt).toLocaleString()}</TableCell><TableCell>{row.score !== undefined ? `${row.score}/${row.maxMarks} · ${row.passed ? 'Pass' : 'Not passed'}` : <Chip size="small" variant="outlined" label="Submitted · non-graded" />}</TableCell></TableRow>)}</TableBody></Table></TableContainer> : <Typography variant="body2" color="text.secondary">No submissions recorded yet.</Typography>;
}
