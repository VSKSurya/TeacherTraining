type RegistrationBatch = Record<string, unknown> & { trainingDates?: string[]; trainingStartDate?: string; openRegistration?: boolean; status?: string };
export const BUSINESS_TIME_ZONE = import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || 'Asia/Kolkata';
export function businessDateToday() {
  const inZone = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  try { return inZone(BUSINESS_TIME_ZONE); } catch { return inZone('Asia/Kolkata'); }
}
function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10);
}
export function registrationWindow(batch: RegistrationBatch) {
  const days = Array.isArray(batch.trainingDates) && batch.trainingDates.length ? [...batch.trainingDates].sort() : [String(batch.trainingStartDate ?? '')];
  const firstDay = days.find(Boolean) ?? '';
  const before = Number(batch.registrationWindowBeforeDays ?? 0);
  const after = Number(batch.registrationWindowAfterDays ?? 0);
  return { firstDay, opensOn: firstDay ? addDays(firstDay, -before) : '', closesOn: firstDay ? addDays(firstDay, after) : '', beforeDays: before, afterDays: after };
}
export function registrationWindowError(batch: RegistrationBatch, date = businessDateToday()) {
  if (batch.openRegistration !== true) return 'Registration is manually closed for this batch.';
  if (['cancelled', 'archived', 'completed'].includes(String(batch.status ?? '').toLowerCase())) return 'This batch is no longer accepting registrations.';
  const window = registrationWindow(batch);
  if (!window.firstDay) return 'The batch has no training date configured.';
  if (date < window.opensOn) return `Registration opens on ${window.opensOn} (${BUSINESS_TIME_ZONE}).`;
  if (date > window.closesOn) return `The registration window closed on ${window.closesOn} (${BUSINESS_TIME_ZONE}).`;
  return '';
}
