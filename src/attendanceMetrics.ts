export type AttendanceRow = Record<string, unknown>;
export type AttendanceSummary = { expected: number; present: number; absent: number; pending: number; excluded: number; percentage: number | null };
const value = (row: AttendanceRow, ...fields: string[]) => { for (const field of fields) { const item = row[field]; if (typeof item === 'string' && item) return item; } return ''; };
const ids = (row: AttendanceRow) => [row.userId, row.traineeId, row.participantId, row.studentId, row.beneficiaryId, row.candidateId].map(item => typeof item === 'string' ? item.toLowerCase() : '').filter(Boolean);
const rowBatch = (row: AttendanceRow) => value(row, 'batchId', 'batchCode', 'batchUniqueId');
const rowDate = (row: AttendanceRow) => value(row, 'trainingDate', 'attendanceDate', 'date').slice(0, 10);
const key = (batchId: string, sessionDate: string, traineeId: string) => `${batchId}|${sessionDate}|${traineeId}`;
export function businessToday() {
  const zone = import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || 'Asia/Kolkata';
  const today = (timeZone: string) => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const values = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; };
  try { return today(zone); } catch { return today('Asia/Kolkata'); }
}
export function trainingSessionDates(batch: AttendanceRow): string[] {
  if (Array.isArray(batch.trainingDates)) return [...new Set(batch.trainingDates.map(String).map(item => item.slice(0, 10)).filter(Boolean))].sort();
  const start = value(batch, 'trainingStartDate').slice(0, 10);
  if (!start) return [];
  const durationValue = Number(batch.trainingDuration);
  const duration = Number.isInteger(durationValue) && durationValue > 0 ? Math.min(durationValue, 400) : 1;
  const dates: string[] = [];
  const current = new Date(`${start}T12:00:00`);
  for (let checked = 0; checked < 2000 && dates.length < duration; checked++, current.setDate(current.getDate() + 1)) {
    if (current.getDay() === 0 || current.getDay() === 6) continue;
    dates.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
  }
  return dates;
}
function confirmed(row: AttendanceRow) { return row.approved === true || ['approved', 'confirmed', 'enrolled'].includes(value(row, 'status', 'registrationStatus', 'approvalStatus').toLowerCase()); }
function excluded(record: AttendanceRow) {
  const states = [record.status, record.decision, record.type, record.reason].map(item => typeof item === 'string' ? item.toLowerCase() : '');
  const approvedRecord = record.approved === true || states.includes('approved');
  return approvedRecord && (record.excluded === true || record.exempt === true || record.cancelled === true || states.some(state => ['approved', 'excluded', 'exempt', 'cancelled', 'excused', 'training-day-cancelled'].includes(state)));
}
function summaryFromSlots(expectedSlots: Set<string>, presentSlots: Set<string>, absentSlots: Set<string>, excludedSlots: Set<string>): AttendanceSummary {
  const expected = Math.max(0, expectedSlots.size - excludedSlots.size);
  const present = [...presentSlots].filter(slot => expectedSlots.has(slot) && !excludedSlots.has(slot)).length;
  const absent = [...absentSlots].filter(slot => expectedSlots.has(slot) && !excludedSlots.has(slot) && !presentSlots.has(slot)).length;
  const pending = Math.max(0, expected - present - absent);
  return { expected, present, absent, pending, excluded: excludedSlots.size, percentage: expected ? Math.round(present / expected * 1000) / 10 : null };
}
export function calculateAttendance(batches: AttendanceRow[], registrations: AttendanceRow[], attendance: AttendanceRow[], approvedExclusions: AttendanceRow[] = [], asOf = businessToday()): AttendanceSummary {
  const expectedSlots = new Set<string>(), presentSlots = new Set<string>(), absentSlots = new Set<string>(), excludedSlots = new Set<string>();
  const activeBatches = batches.filter(batch => !['cancelled', 'archived'].includes(value(batch, 'status').toLowerCase()));
  for (const batch of activeBatches) {
    const batchRefs = new Set([value(batch, 'id'), value(batch, 'batchCode'), value(batch, 'uniqueId')].filter(Boolean));
    const id = value(batch, 'id') || value(batch, 'batchCode') || value(batch, 'uniqueId');
    const heldDates = trainingSessionDates(batch).filter(sessionDate => sessionDate <= asOf);
    if (!id || !heldDates.length) continue;
    const roster = registrations.filter(record => batchRefs.has(rowBatch(record)) && confirmed(record) && !['cancelled', 'withdrawn', 'rejected'].includes(value(record, 'status').toLowerCase()));
    const personRefs = new Map<string, AttendanceRow>();
    for (const person of roster) {
      const personIds = ids(person);
      const personId = personIds[0] || value(person, 'id', 'registrationId').toLowerCase();
      if (!personId) continue;
      const registrationRefs = new Set([value(person, 'id'), value(person, 'registrationId')].filter(Boolean));
      const slot = (sessionDate: string) => key(id, sessionDate, personId);
      personRefs.set(personId, person);
      for (const sessionDate of heldDates) expectedSlots.add(slot(sessionDate));
      for (const mark of attendance) {
        const markBatch = rowBatch(mark), markDate = rowDate(mark);
        if (!batchRefs.has(markBatch) || !heldDates.includes(markDate)) continue;
        const markIds = ids(mark);
        const registrationMatches = Boolean(value(mark, 'registrationId') && registrationRefs.has(value(mark, 'registrationId')));
        if (!registrationMatches && !personIds.some(personRef => markIds.includes(personRef))) continue;
        const status = value(mark, 'status').toLowerCase();
        if (excluded(mark)) excludedSlots.add(slot(markDate));
        else if (mark.present === true || mark.attended === true || ['present', 'attended'].includes(status)) presentSlots.add(slot(markDate));
        else if (mark.present === false || ['absent', 'not-present'].includes(status)) absentSlots.add(slot(markDate));
      }
    }
    for (const exclusion of approvedExclusions) {
      if (!excluded(exclusion) || !batchRefs.has(rowBatch(exclusion))) continue;
      const exclusionDate = rowDate(exclusion);
      if (!heldDates.includes(exclusionDate)) continue;
      const exclusionIds = ids(exclusion);
      if (exclusion.allTrainees === true || exclusion.scope === 'batch-day' || value(exclusion, 'type').toLowerCase() === 'training-day-cancelled') {
        for (const personId of personRefs.keys()) excludedSlots.add(key(id, exclusionDate, personId));
      } else {
        const person = roster.find(item => {
          const itemIds = ids(item);
          return itemIds.some(itemId => exclusionIds.includes(itemId)) || Boolean(value(exclusion, 'registrationId') && [value(item, 'id'), value(item, 'registrationId')].includes(value(exclusion, 'registrationId')));
        });
        if (person) {
          const personId = ids(person)[0] || value(person, 'id', 'registrationId').toLowerCase();
          excludedSlots.add(key(id, exclusionDate, personId));
        }
      }
    }
  }
  return summaryFromSlots(expectedSlots, presentSlots, absentSlots, excludedSlots);
}

export function calculateTraineeAttendance(batch: AttendanceRow | undefined, registration: AttendanceRow, attendance: AttendanceRow[], approvedExclusions: AttendanceRow[] = [], asOf = businessToday()) {
  if (!batch) return { expected: 0, present: 0, absent: 0, pending: 0, excluded: 0, percentage: null } satisfies AttendanceSummary;
  return calculateAttendance([batch], [registration], attendance, approvedExclusions, asOf);
}
