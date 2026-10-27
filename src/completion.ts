import { trainingSessionDates } from './attendanceMetrics';

export type TrainingRow = Record<string, unknown>;
export type CompletionCriteria = { minimumAttendancePercent?: number; mandatoryTrainingDays?: number[]; requireAssessments?: boolean; minimumAssessmentMarks?: number | null; requireFeedback?: boolean; requireExternalCourse?: boolean };
export type CompletionStatus = 'Completed' | 'Not completed' | 'Pending' | 'In progress' | 'Not configured';
export function buildTrainingCompletionRows(registrations: TrainingRow[], batches: TrainingRow[], plans: TrainingRow[], associations: TrainingRow[] = []) {
  const eligible = registrations.filter(row => row.approved === true || ['approved', 'confirmed', 'enrolled'].includes(text(row.status ?? row.registrationStatus ?? row.approvalStatus).toLowerCase()));
  return eligible.map(registration => {
    const ref = batchRef(registration);
    const batch = batches.find(item => [text(item.id), text(item.batchCode), text(item.uniqueId)].filter(Boolean).includes(ref));
    const association = associations.find(item => text(item.id) === text(batch?.projectPlanAssociationId));
    const plan = plans.find(item => text(item.id) === text(association?.trainingPlanId) || (text(item.code) && text(item.code) === text(batch?.trainingPlanCode)));
    return { registration, batch, criteria: (plan?.completionCriteria ?? {}) as CompletionCriteria, userIds: [registration.userId, registration.traineeId, registration.participantId, registration.studentId, registration.beneficiaryId, registration.candidateId].map(text).filter(Boolean), registrationIds: [registration.id, registration.registrationId].map(text).filter(Boolean) };
  });
}
const text = (value: unknown) => typeof value === 'string' ? value : '';
const batchRef = (row: TrainingRow) => text(row.batchId ?? row.batchCode ?? row.batchUniqueId);
const done = (row: TrainingRow) => row.completed === true || ['completed', 'complete', 'submitted', 'graded', 'passed'].includes(text(row.status).toLowerCase());
const attended = (row: TrainingRow) => row.present === true || row.attended === true || ['present', 'attended'].includes(text(row.status).toLowerCase());
const dates = (row: TrainingRow) => text(row.trainingDate ?? row.attendanceDate ?? row.date).slice(0, 10);
function associated(row: TrainingRow, userIds: Set<string>, registrationIds: Set<string>) {
  const ids = [row.userId, row.traineeId, row.participantId, row.studentId, row.beneficiaryId, row.candidateId].map(value => text(value).toLowerCase());
  return ids.some(id => id && userIds.has(id)) || Boolean(text(row.registrationId) && registrationIds.has(text(row.registrationId)));
}
export function isTrainingComplete(args: { registration: TrainingRow; batch?: TrainingRow; criteria?: CompletionCriteria; userIds: string[]; registrationIds: string[]; attendance: TrainingRow[]; assessments: TrainingRow[]; feedback: TrainingRow[]; externalCourses: TrainingRow[]; assessmentForms?: TrainingRow[] }) {
  const { registration, batch, criteria = {}, userIds, registrationIds, attendance, assessments, feedback, externalCourses, assessmentForms = [] } = args;
  if (!batch) return false;
  const batchIds = new Set([text(batch.id), text(batch.batchCode), text(batch.uniqueId)].filter(Boolean));
  const users = new Set(userIds.map(id => id.toLowerCase()).filter(Boolean));
  const regs = new Set(registrationIds.filter(Boolean));
  const inBatch = (row: TrainingRow) => batchIds.has(batchRef(row));
  const own = (rows: TrainingRow[]) => rows.filter(row => associated(row, users, regs) && inBatch(row));
  const attendanceRows = own(attendance);
  const presentDates = new Set(attendanceRows.filter(attended).map(dates).filter(Boolean));
  const sessionDates = Array.isArray(batch.trainingDates) ? batch.trainingDates.map(String) : [text(batch.trainingStartDate).slice(0, 10)].filter(Boolean);
  const attendanceOk = !criteria.minimumAttendancePercent || (sessionDates.length > 0 && presentDates.size / sessionDates.length * 100 >= criteria.minimumAttendancePercent);
  const daysOk = (criteria.mandatoryTrainingDays ?? []).every(day => Boolean(sessionDates[day - 1] && presentDates.has(sessionDates[day - 1])));
  const doneAssessments = own(assessments).filter(done);
  const assessmentOk = !criteria.requireAssessments || doneAssessments.length > 0;
  const marksOk = criteria.minimumAssessmentMarks == null || doneAssessments.some(row => typeof row.score === 'number' && typeof row.maxMarks === 'number' && row.maxMarks > 0 && row.score / row.maxMarks * 100 >= criteria.minimumAssessmentMarks!);
  const feedbackOk = !criteria.requireFeedback || own(feedback).some(row => row.submitted === true || row.completed === true || ['submitted', 'completed', 'complete', 'received'].includes(text(row.status).toLowerCase()));
  const externalOk = !criteria.requireExternalCourse || own(externalCourses).some(done);
  const planCode = text(batch.trainingPlanCode);
  const requiredForms = assessmentForms.filter(form => form.mandatory === true && (text(form.planCode) === '*' || text(form.planCode) === planCode));
  const requiredFormsOk = requiredForms.every(form => [...own(assessments), ...own(feedback)].some(row => text(row.formId) === text(form.id) && done(row)));
  const hasConfiguredRule = Boolean((criteria.minimumAttendancePercent ?? 0) > 0 || (criteria.mandatoryTrainingDays?.length ?? 0) > 0 || criteria.requireAssessments || criteria.minimumAssessmentMarks != null || criteria.requireFeedback || criteria.requireExternalCourse || requiredForms.length > 0);
  return hasConfiguredRule && attendanceOk && daysOk && assessmentOk && marksOk && feedbackOk && externalOk && requiredFormsOk;
}

export function evaluateTrainingCompletion(args: { registration: TrainingRow; batch?: TrainingRow; criteria?: CompletionCriteria; userIds: string[]; registrationIds: string[]; attendance: TrainingRow[]; assessments: TrainingRow[]; feedback: TrainingRow[]; externalCourses: TrainingRow[]; assessmentForms?: TrainingRow[]; exclusions?: TrainingRow[]; asOf?: string }): CompletionStatus {
  const { registration, batch, criteria = {}, userIds, registrationIds, attendance, assessments, feedback, externalCourses, assessmentForms = [], exclusions = [], asOf = new Date().toISOString().slice(0, 10) } = args;
  if (!batch || ['cancelled', 'archived', 'rejected'].includes(text(batch.status).toLowerCase())) return 'In progress';
  const sessionDates = trainingSessionDates(batch);
  const due = text(batch.status).toLowerCase() === 'completed' || Boolean(sessionDates.length && sessionDates[sessionDates.length - 1] <= asOf);
  if (!due) return 'In progress';
  const batchIds = new Set([text(batch.id), text(batch.batchCode), text(batch.uniqueId)].filter(Boolean));
  const users = new Set(userIds.map(id => id.toLowerCase()).filter(Boolean));
  const regs = new Set(registrationIds.filter(Boolean));
  const own = (rows: TrainingRow[]) => rows.filter(row => associated(row, users, regs) && batchIds.has(batchRef(row)));
  const isExcluded = (day: string) => exclusions.some(row => {
    const states = [row.status, row.decision, row.type, row.reason].map(value => text(value).toLowerCase());
    const approved = row.approved === true || states.includes('approved');
    const excluded = row.excluded === true || row.exempt === true || row.cancelled === true || states.some(value => ['approved', 'excluded', 'exempt', 'cancelled', 'excused', 'training-day-cancelled'].includes(value));
    return approved && excluded && batchIds.has(batchRef(row)) && text(row.trainingDate ?? row.attendanceDate ?? row.date).slice(0, 10) === day && (associated(row, users, regs) || row.allTrainees === true || row.scope === 'batch-day' || text(row.type).toLowerCase() === 'training-day-cancelled');
  });
  const requiredForms = assessmentForms.filter(form => form.mandatory === true && (text(form.planCode) === '*' || text(form.planCode) === text(batch.trainingPlanCode)));
  const configured = Boolean((criteria.minimumAttendancePercent ?? 0) > 0 || (criteria.mandatoryTrainingDays?.length ?? 0) > 0 || criteria.requireAssessments || criteria.minimumAssessmentMarks != null || criteria.requireFeedback || criteria.requireExternalCourse || requiredForms.length);
  if (!configured) return 'Not configured';
  let pending = false;
  let failed = false;
  const marks = own(attendance);
  const attended = (day: string) => marks.some(row => text(row.trainingDate ?? row.attendanceDate ?? row.date).slice(0, 10) === day && (row.present === true || row.attended === true || ['present', 'attended'].includes(text(row.status).toLowerCase())));
  const recorded = (day: string) => marks.some(row => text(row.trainingDate ?? row.attendanceDate ?? row.date).slice(0, 10) === day && ['present', 'attended', 'absent', 'not-present'].includes(text(row.status).toLowerCase()) || (row.present === true || row.present === false) && text(row.trainingDate ?? row.attendanceDate ?? row.date).slice(0, 10) === day);
  const heldDays = [...new Set(sessionDates.filter(day => day <= asOf && !isExcluded(day)))];
  if (criteria.minimumAttendancePercent) {
    if (!heldDays.length || heldDays.some(day => !recorded(day))) pending = true;
    else if (heldDays.filter(attended).length / heldDays.length * 100 < criteria.minimumAttendancePercent) failed = true;
  }
  for (const dayNumber of criteria.mandatoryTrainingDays ?? []) {
    const day = sessionDates[dayNumber - 1];
    if (!day) { pending = true; continue; }
    if (isExcluded(day)) continue;
    if (day > asOf || !recorded(day)) pending = true;
    else if (!attended(day)) failed = true;
  }
  const completedAssessments = own(assessments).filter(done);
  if (criteria.requireAssessments && !completedAssessments.length) pending = true;
  if (criteria.minimumAssessmentMarks != null) {
    if (!completedAssessments.length || !completedAssessments.some(row => typeof row.score === 'number' && typeof row.maxMarks === 'number' && row.maxMarks > 0)) pending = true;
    else if (!completedAssessments.some(row => typeof row.score === 'number' && typeof row.maxMarks === 'number' && row.maxMarks > 0 && row.score / row.maxMarks * 100 >= criteria.minimumAssessmentMarks!)) failed = true;
  }
  if (criteria.requireFeedback && !own(feedback).some(row => row.submitted === true || row.completed === true || ['submitted', 'completed', 'complete', 'received'].includes(text(row.status).toLowerCase()))) pending = true;
  if (criteria.requireExternalCourse && !own(externalCourses).some(done)) pending = true;
  for (const form of requiredForms) if (!own([...assessments, ...feedback]).some(row => text(row.formId) === text(form.id) && done(row))) pending = true;
  if (failed) return 'Not completed';
  return pending ? 'Pending' : 'Completed';
}

export function summarizeTrainingCompletion(rows: { registration: TrainingRow; batch?: TrainingRow; criteria?: CompletionCriteria; userIds: string[]; registrationIds: string[] }[], records: { attendance: TrainingRow[]; assessments: TrainingRow[]; feedback: TrainingRow[]; externalCourses?: TrainingRow[]; assessmentForms?: TrainingRow[]; exclusions?: TrainingRow[]; asOf?: string }) {
  const counts = { confirmed: 0, completed: 0, notCompleted: 0, pending: 0, inProgress: 0, notConfigured: 0, eligibleConfirmed: 0 };
  for (const row of rows) {
    counts.confirmed++;
    const status = evaluateTrainingCompletion({ ...row, ...records, externalCourses: records.externalCourses ?? [], assessmentForms: records.assessmentForms ?? [], exclusions: records.exclusions ?? [] });
    if (status === 'In progress') { counts.inProgress++; continue; }
    if (status === 'Not configured') { counts.notConfigured++; continue; }
    counts.eligibleConfirmed++;
    if (status === 'Completed') counts.completed++;
    else if (status === 'Not completed') counts.notCompleted++;
    else counts.pending++;
  }
  return { ...counts, percentage: counts.eligibleConfirmed ? Math.round(counts.completed / counts.eligibleConfirmed * 1000) / 10 : null };
}
