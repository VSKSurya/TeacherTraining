export type TrainingRow = Record<string, unknown>;
export type CompletionCriteria = { minimumAttendancePercent?: number; mandatoryTrainingDays?: number[]; requireAssessments?: boolean; minimumAssessmentMarks?: number | null; requireFeedback?: boolean; requireExternalCourse?: boolean };
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
