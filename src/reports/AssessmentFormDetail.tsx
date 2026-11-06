import { Fragment, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Popover, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { PhaseSelectionSummary, ReportFilterPanel, type FilterSpec, type ReportFilters } from './ReportComponents';
import { formatDate, formatDateTime } from '../dateFormat';
import { batchCodeForRecord, batchIdentifiers } from '../batchCodes';
import { kgbvSchools } from '../data/kgbvSchools';
import { downloadExcelWorkbook } from './exportExcel';
import { ReportBarChart, ReportViewToggle, type ReportView } from './ReportCharts';
import { useSelector } from 'react-redux';
import { getSession } from '../auth';
import type { RootState } from '../store';

type Row = Record<string, any>;
type FormQuestion = { id: string; prompt: string; options?: string[]; correctIndex?: number; points?: number; selection?: 'multiple' };
type FormRecord = { id: string; title: string; kind: string; stage: string; planCode?: string; day?: number; questions: FormQuestion[] };
type Submission = Row & { id: string; formId?: string; formTitle?: string; traineeId?: string; userId?: string; registrationId?: string; batchId?: string; batchCode?: string; planCode?: string; submittedAt?: string; score?: number; maxMarks?: number; passed?: boolean; answers?: Record<string, string> };
const text = (value: unknown) => typeof value === 'string' ? value : '';
const hiddenFeedbackPrompts = new Set(['name of the school', 'name of the teacher', 'contact number']);
const visibleQuestions = (form: FormRecord) => form.kind === 'feedback'
  ? form.questions.filter(question => !hiddenFeedbackPrompts.has(question.prompt.trim().replace(/\s*\*$/, '').toLowerCase()))
  : form.stage === 'pre' ? form.questions.slice(5) : form.questions;
const read = (key: string): Row[] => { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as Row[] : []; } catch { return []; } };
const refs = (row: Row) => [...new Set([text(row.id), ...batchIdentifiers(row)])].filter(Boolean);
const identityRefs = (row: Row) => [row.traineeId, row.userId, row.participantId, row.studentId, row.id].map(value => text(value).trim().toLowerCase()).filter(Boolean);
const getBatchPlanCode = (batch: Row, plan: Row | undefined) => text(batch.trainingPlanCode ?? batch.planCode ?? plan?.code);
function findAnswerIndex(question: FormQuestion, raw: unknown) {
  const value = text(raw);
  if (!value) return -1;
  const index = Number(value);
  return Number.isInteger(index) && question.options?.[index] !== undefined ? index : question.options?.findIndex(option => option === value) ?? -1;
}
function optionPercent(count: number, total: number) { return total ? `${(count / total * 100).toFixed(1)}%` : '0.0%'; }

export default function AssessmentFormDetail({ form, submissions, onBack, participantOnly = false }: { form: FormRecord; submissions: Submission[]; onBack: () => void; participantOnly?: boolean }) {
  const selectedPhase = useSelector((state: RootState) => state.dashboard.selectedPhase);
  const ernetLogin = getSession()?.role === 'sponsor-admin';
  const [participant, setParticipant] = useState<Submission | null>(null);
  const [view, setView] = useState<ReportView>('table');
  const [filters, setFilters] = useState<ReportFilters>({ plan: '', batchId: '', udise: '', state: '', district: '', block: '', trainer: '', start: '', end: '', status: '' });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const batches = useMemo(() => read('teacher-training-batch-plan-uses'), []);
  const plans = useMemo(() => read('teacher-training-plans'), []);
  const projects = useMemo(() => read('teacher-training-projects'), []);
  const registrations = useMemo(() => read('teacher-training-registrations'), []);
  const trainees = useMemo(() => read('teacher-training-trainees'), []);
  const associations = useMemo(() => read('teacher-training-project-plan-associations'), []);
  const phaseNumberForBatch = (batch: Row) => {
    const project = projects.find(item => text(item.id) === text(batch.projectId));
    const phases = Array.isArray(project?.phases) ? project.phases : [];
    const phase = phases.find((item: Row) => text(item.id) === text(batch.phaseId));
    return Number(phase?.sequence) || (phase ? phases.indexOf(phase) + 1 : Number(text(batch.phaseName ?? batch.phase).match(/\d+/)?.[0]) || 0);
  };
  const assignedBatches = batches.filter(batch => {
    const association = associations.find(item => text(item.id) === text(batch.projectPlanAssociationId));
    const plan = plans.find(item => text(item.id) === text(batch.trainingPlanId ?? association?.trainingPlanId) || text(item.code) === getBatchPlanCode(batch, undefined));
    const code = getBatchPlanCode(batch, plan);
    const linked = Array.isArray(plan?.resourceAssignments) && plan.resourceAssignments.some((item: Row) => text(item.formId) === form.id);
    const assignedToForm = linked || text(form.planCode) === '*' || (!!text(form.planCode) && (text(form.planCode) === code || text(form.planCode) === text(plan?.code)));
    return assignedToForm && (!ernetLogin || !selectedPhase || phaseNumberForBatch(batch) === selectedPhase);
  });
  const reportBatches = assignedBatches.length ? assignedBatches : batches.filter(batch => submissions.some(row => refs(batch).some(ref => refs(row).includes(ref))) && (!ernetLogin || !selectedPhase || phaseNumberForBatch(batch) === selectedPhase));
  const metadataForBatch = (batch: Row) => {
    const association = associations.find(item => text(item.id) === text(batch.projectPlanAssociationId));
    const plan = plans.find(item => text(item.id) === text(batch.trainingPlanId ?? association?.trainingPlanId) || text(item.code) === getBatchPlanCode(batch, undefined));
    const project = projects.find(item => text(item.id) === text(batch.projectId));
    const phase = Array.isArray(project?.phases) ? project.phases.find((item: Row) => text(item.id) === text(batch.phaseId)) : undefined;
    const school = kgbvSchools.find(item => item.udise === text(batch.schoolUdiseVenue) || item.school === text(batch.location));
    return {
      planCode: getBatchPlanCode(batch, plan), planName: text(plan?.name) || getBatchPlanCode(batch, plan) || text(form.planCode),
      batchId: text(batch.batchCode ?? batch.name ?? batch.id), udise: text(batch.schoolUdiseVenue ?? batch.udise ?? school?.udise),
      state: text(batch.state ?? school?.state), district: text(batch.district ?? school?.district), block: text(batch.block ?? school?.block),
      phase: text(phase?.name ?? batch.phaseName ?? batch.trainingCycle), trainer: text(batch.trainerName ?? batch.trainerCode ?? batch.trainerId),
      startDate: text(batch.trainingStartDate ?? (Array.isArray(batch.trainingDates) ? batch.trainingDates[0] : '')),
      status: text(batch.status) || 'Scheduled',
    };
  };
  const batchMatches = (metadata: ReturnType<typeof metadataForBatch>) =>
    (!filters.plan || metadata.planCode === filters.plan) && (!filters.batchId || metadata.batchId === filters.batchId) &&
    (!filters.udise || metadata.udise === filters.udise) && (!filters.state || metadata.state === filters.state) &&
    (!filters.district || metadata.district === filters.district) && (!filters.block || metadata.block === filters.block) &&
    (!filters.trainer || metadata.trainer === filters.trainer) &&
    (!filters.start || (metadata.startDate && metadata.startDate >= filters.start)) && (!filters.end || (metadata.startDate && metadata.startDate <= filters.end)) &&
    (!filters.status || metadata.status === filters.status);
  const filteredBatches = reportBatches.filter(batch => batchMatches(metadataForBatch(batch)));
  const filteredBatchRefs = new Set(filteredBatches.flatMap(refs));
  const submissionMetadata = submissions.map(row => {
    const rowRefs = refs(row);
    const batch = batches.find(item => refs(item).some(ref => rowRefs.includes(ref)) || (row.batchId && text(item.id) === row.batchId) || (row.batchCode && text(item.batchCode) === row.batchCode));
    const base = batch ? metadataForBatch(batch) : {
      planCode: text(row.planCode) || text(form.planCode), planName: text(row.planCode) || text(form.planCode), batchId: text(row.batchCode ?? row.batchId),
      udise: text(row.schoolUdiseVenue ?? row.udise), state: text(row.state), district: text(row.district), block: text(row.block),
      phase: text(row.phase), trainer: text(row.trainerName ?? row.trainer), startDate: text(row.trainingStartDate), status: text(row.batchStatus) || 'Scheduled',
    };
    return { row, batch, metadata: base };
  });
  const filteredSubmissionEntries = submissionMetadata.filter(({ metadata, batch }) => batchMatches(metadata) && (batch ? filteredBatchRefs.has(text(batch.id)) || refs(batch).some(ref => filteredBatchRefs.has(ref)) : reportBatches.length === 0));
  const filteredSubmissions = filteredSubmissionEntries.map(item => item.row);
  const optionList = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)).map(value => ({ label: value, value }));
  const availableMetadata = reportBatches.map(metadataForBatch);
  const districtOptions = optionList(availableMetadata.filter(item => !filters.state || item.state === filters.state).map(item => item.district));
  const blocks = optionList(availableMetadata.filter(item => (!filters.state || item.state === filters.state) && (!filters.district || item.district === filters.district)).map(item => item.block));
  const trainers = optionList(availableMetadata.filter(item => (!filters.state || item.state === filters.state) && (!filters.district || item.district === filters.district) && (!filters.block || item.block === filters.block)).map(item => item.trainer));
  const filterFields: FilterSpec[] = [
    { key: 'plan', label: 'Training Plan', type: 'select', placeholder: 'All training plans', options: optionList(availableMetadata.map(item => item.planName)).map(option => ({ ...option, value: availableMetadata.find(item => item.planName === option.value)?.planCode ?? option.value })) },
    { key: 'batchId', label: 'Batch Id', type: 'select', placeholder: 'All batches', options: optionList(availableMetadata.map(item => item.batchId)) },
    { key: 'udise', label: 'Venue School UDISE', type: 'select', placeholder: 'All venues', options: optionList(availableMetadata.map(item => item.udise)) },
    { key: 'state', label: 'State', type: 'select', placeholder: 'All states', options: optionList(availableMetadata.map(item => item.state)) },
    { key: 'district', label: 'District', type: 'select', placeholder: 'Select a state first', options: districtOptions, disabled: !filters.state },
    { key: 'block', label: 'Block', type: 'select', placeholder: 'Select a district first', options: blocks, disabled: !filters.district },
    { key: 'trainer', label: 'Trainer Name', type: 'select', placeholder: 'All trainers', options: trainers },
    { key: 'start', label: 'From Start Date', type: 'date' }, { key: 'end', label: 'To Start Date', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', placeholder: 'All statuses', options: optionList(availableMetadata.map(item => item.status)) },
  ];
  const participantFilterFields = filterFields.filter(field => ['plan', 'state', 'district', 'block', 'trainer', 'start', 'end', 'status'].includes(field.key));
  const changeFilter = (key: string, value: string) => setFilters(previous => {
    const next = { ...previous, [key]: value };
    if (key === 'state') { next.district = ''; next.block = ''; }
    if (key === 'district') next.block = '';
    return next;
  });
  const clearFilters = () => setFilters({ plan: '', batchId: '', udise: '', state: '', district: '', block: '', trainer: '', start: '', end: '', status: '' });
  const reportQuestions = visibleQuestions(form);
  const reportQuestionNumber = (index: number) => form.stage === 'pre' ? index + 6 : index + 1;
  const questionStats = reportQuestions.map((question, questionIndex) => {
    const optionCounts = (question.options ?? []).map(() => 0);
    let correct = 0; let incorrect = 0; let skipped = 0;
    const freeText: { value: string; count: number }[] = [];
    filteredSubmissions.forEach(row => {
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
    const answeredCount = filteredSubmissions.length - skipped;
    const questionType = !question.options?.length ? 'Text' : question.selection === 'multiple' ? 'Multiple Choice' : question.options.some(option => /^\s*\d+\s*-/.test(option)) || form.stage === 'feedback' ? 'Rating' : 'Single Choice';
    const answerRows = question.options?.length
      ? question.options.map((option, index) => ({ label: `${String.fromCharCode(65 + index)}. ${option}`, count: optionCounts[index], correct: question.correctIndex === index }))
      : freeText.map(item => ({ label: item.value, count: item.count, correct: false }));
    return { question, questionIndex, optionCounts, correct, incorrect, skipped, answeredCount, freeText, answerRows, questionType };
  });
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
  const exportFilteredResponses = async () => {
    setExporting(true);
    setExportError('');
    try {
      const headers = ['Form Title', 'Training Plan', 'Batch Id', 'Venue School UDISE', 'State', 'District', 'Block', 'Phase', 'Trainer Name', 'Training Start Date', 'Status', 'Participant Id', 'Submission Date', 'Score', 'Maximum Score', 'Submission Status', ...reportQuestions.map(question => question.prompt)];
      const rows = filteredSubmissionEntries.map(({ row, metadata }) => [
        form.title, metadata.planName, metadata.batchId, metadata.udise, metadata.state, metadata.district, metadata.block,
        metadata.phase, metadata.trainer, metadata.startDate, metadata.status, row.traineeId ?? row.userId ?? '',
        row.submittedAt ? formatDate(text(row.submittedAt)) : '', row.score ?? '', row.maxMarks ?? '', text((row as Row).status),
        ...reportQuestions.map(question => answerFor(row, question)),
      ]);
      const filePart = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'feedback-form';
      await downloadExcelWorkbook(`${filePart}-detailed-report-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Filtered Responses', headers, rows);
    } catch {
      setExportError('The Excel file could not be created. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return <Stack spacing={1.5}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        {!participantOnly && <IconButton size="small" aria-label="Back to Submissions Details" title="Back to Submissions Details" onClick={onBack} sx={{ mt: 0.35, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M19 12H5m0 0 7 7m-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></IconButton>}
        <Box>
          <Typography variant="h5" fontWeight={800} sx={form.title === 'Teacher Training Feedback Form' && !participantOnly ? { fontSize: '1.3rem' } : undefined}>{participantOnly ? 'Report - Participant Wise' : form.title === 'Teacher Training Feedback Form' ? 'Detailed Feedback From Report' : form.stage === 'pre' ? 'Pre-Assessment Form - Detailed Report' : `${form.title} - Detailed Report`}</Typography>
          {participantOnly && <Typography variant="body2" color="text.secondary">{filteredSubmissions.length} participant response(s)</Typography>}
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
        {!participantOnly && <ReportViewToggle view={view} onChange={setView} />}
        <button type="button" className="filter-trigger" aria-expanded={Boolean(filterAnchor)} onClick={event => setFilterAnchor(event.currentTarget)}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="8" cy="6" r="2" fill="white" stroke="currentColor" strokeWidth="1.8"/><circle cx="15" cy="12" r="2" fill="white" stroke="currentColor" strokeWidth="1.8"/></svg>Filters{(participantOnly ? participantFilterFields : filterFields).filter(field => Boolean(filters[field.key])).length > 0 && <span className="filter-count visible">{(participantOnly ? participantFilterFields : filterFields).filter(field => Boolean(filters[field.key])).length}</span>}</button>
        <button type="button" className="report-export-button" onClick={exportFilteredResponses} disabled={exporting || !filteredSubmissions.length}>{exporting ? 'Preparing Excel...' : 'Download Excel'}</button>
      </Stack>
    </Stack>
    {ernetLogin && <PhaseSelectionSummary selectedPhase={selectedPhase} selectedFilters={filters} />}
    {exportError && <Alert severity="error" onClose={() => setExportError('')}>{exportError}</Alert>}
    {!filteredSubmissions.length && <Alert severity="info">No submitted responses match the selected filters.</Alert>}
    {!participantOnly && (view === 'graph' ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
      {questionStats.map(({ question, questionIndex, answerRows }) => {
        const isChoiceQuestion = Boolean(question.options?.length);
        const colors = ['#2584b9', '#815bb3', '#16945b', '#e69a32', '#dd6670', '#36a6a0', '#577590', '#b56576'];
        return <ReportBarChart key={question.id} title={`Q${reportQuestionNumber(questionIndex)}: ${question.prompt}`} description="Responses by answer" series={isChoiceQuestion ? answerRows.map((answer, index) => ({ label: answer.label, color: colors[index % colors.length] })) : [{ label: 'Responses', color: '#2584b9' }]} rows={isChoiceQuestion ? [{ label: 'Responses', values: answerRows.map(answer => answer.count) }] : answerRows.map(answer => ({ label: answer.label, values: [answer.count] }))} chartType={isChoiceQuestion ? 'pie' : 'bar'} />;
      })}
    </Box> : <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}>
      <Typography variant="h6" fontWeight={750} sx={{ mb: 1, fontSize: '1.2rem' }}>Question-wise Answer Analysis</Typography>
      <Stack spacing={1.5}>
        {questionStats.map(({ question, questionIndex, answerRows, answeredCount }) => {
          const answerOptions = answerRows.map(answer => answer.label.replace(/^[A-Z]\.\s*/, ''));
          const counts = answerRows.map(answer => answer.count);
          const tableMinWidth = Math.max(700, 220 + answerOptions.length * 145);
          return <TableContainer key={question.id} sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label={`Answer counts and percentages for question ${reportQuestionNumber(questionIndex)}`} sx={{ minWidth: tableMinWidth }}>
              <TableHead>
                <TableRow><TableCell colSpan={answerOptions.length + 1} sx={{ backgroundColor: '#fff', color: '#173c64', fontSize: '14px', fontWeight: 700, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                  Q{reportQuestionNumber(questionIndex)}: {question.prompt}
                </TableCell></TableRow>
                <TableRow>
                  {answerOptions.map((option, index) => <TableCell key={`${question.id}-option-${index}`} align="center" sx={{ minWidth: 145, whiteSpace: 'normal', fontSize: '0.8rem', fontWeight: 600 }}>{option}</TableCell>)}
                  <TableCell align="center" sx={{ minWidth: 90 }}>Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {counts.map((count, index) => <TableCell key={`${question.id}-count-${index}`} align="right">{count}</TableCell>)}
                  <TableCell align="right" sx={{ fontWeight: 750 }}>{answeredCount}</TableCell>
                </TableRow>
                <TableRow>
                  {counts.map((count, index) => <TableCell key={`${question.id}-percentage-${index}`} align="right">{optionPercent(count, answeredCount)}</TableCell>)}
                  <TableCell align="right">{optionPercent(counts.reduce((total, count) => total + count, 0), answeredCount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>;
        })}
      </Stack>
    </Paper>)}
    {participantOnly && <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}>{filteredSubmissions.length ? <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Participant Name</TableCell><TableCell>Participant Unique ID</TableCell><TableCell>School UDISE</TableCell><TableCell>State / District / School</TableCell><TableCell>Batch Code</TableCell><TableCell>Submission Date Time</TableCell><TableCell /></TableRow></TableHead><TableBody>{filteredSubmissions.map(row => { const { registration, trainee, batch } = responseProfile(row); return <TableRow key={row.id}><TableCell>{text(registration?.traineeName ?? registration?.name ?? trainee?.name) || 'Participant'}</TableCell><TableCell>{text(row.traineeId ?? row.userId) || '—'}</TableCell><TableCell>{text(registration?.schoolUdise ?? registration?.udise ?? trainee?.schoolUdise ?? trainee?.udise ?? batch?.schoolUdiseVenue ?? batch?.udise) || '—'}</TableCell><TableCell>{[text(registration?.state ?? trainee?.state ?? batch?.state), text(registration?.district ?? trainee?.district ?? batch?.district), text(registration?.schoolName ?? trainee?.schoolName ?? batch?.schoolName)].filter(Boolean).join(' / ') || '—'}</TableCell><TableCell>{batchCodeForRecord(row, batches) || text(batch?.batchCode) || '—'}</TableCell><TableCell>{row.submittedAt ? formatDateTime(text(row.submittedAt)) : '—'}</TableCell><TableCell><Button size="small" onClick={() => setParticipant(row)}>View answer sheet</Button></TableCell></TableRow>; })}</TableBody></Table></TableContainer> : <Typography color="text.secondary">No participant submissions for this form.</Typography>}</Paper>}
    <Popover disablePortal open={Boolean(filterAnchor)} anchorEl={filterAnchor} onClose={() => setFilterAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}><Box className="dashboard-filter-popup" sx={{ width: { xs: 'calc(100vw - 24px)', sm: 980 }, maxWidth: 'calc(100vw - 24px)', p: 1 }}><ReportFilterPanel fields={participantOnly ? participantFilterFields : filterFields} values={filters} onChange={changeFilter} onClear={clearFilters} dashboardStyle /></Box></Popover>
    <Dialog open={Boolean(participant)} onClose={() => setParticipant(null)} maxWidth="md" fullWidth><DialogTitle>Submitted answer sheet · {text(participant?.traineeId ?? participant?.userId)}</DialogTitle><DialogContent><Stack spacing={1} sx={{ pt: 1 }}>{reportQuestions.map((question, index) => { const raw = participant?.answers?.[question.id]; const selectedIndex = findAnswerIndex(question, raw); const correct = question.correctIndex === undefined ? null : selectedIndex === question.correctIndex; return <Paper key={question.id} variant="outlined" sx={{ p: 1.25 }}><Typography fontWeight={700}>Q{reportQuestionNumber(index)}. {question.prompt}</Typography><Typography variant="body2" sx={{ mt: .5 }}>Selected answer: {answerFor(participant ?? { id: '' }, question)}</Typography>{correct !== null && <Chip size="small" sx={{ mt: .5 }} color={correct ? 'success' : 'error'} label={correct ? 'Correct' : selectedIndex < 0 ? 'Skipped' : 'Incorrect'} />}</Paper>; })}</Stack></DialogContent><DialogActions><Button onClick={() => setParticipant(null)}>Close</Button></DialogActions></Dialog>
  </Stack>;
}
