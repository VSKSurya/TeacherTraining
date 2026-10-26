import { getUsers } from './auth';

export type TrainerProfile = {
  id: string;
  trainerCode: string;
  userId?: string;
  name: string;
  category: 'Employee' | 'Consultant';
  email: string;
  phone: string;
  languages: string[];
  competencies: string[];
  certifications: string;
  experienceYears?: number;
  state: string;
  district: string;
  serviceArea: string;
  active: boolean;
};
export type TrainerAvailability = {
  id: string;
  trainerCode: string;
  date: string;
  startTime?: string;
  endTime?: string;
  status: 'Available' | 'Unavailable';
  remarks?: string;
  createdBy: string;
  updatedBy?: string;
  updatedAt: string;
};
export const TRAINER_PROFILES_KEY = 'teacher-training-trainer-profiles';
export const TRAINER_AVAILABILITY_KEY = 'teacher-training-trainer-availability';
export const TRAINER_AUDIT_KEY = 'teacher-training-trainer-audit';

function read<T>(key: string): T[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value as T[] : []; } catch { return []; } }
export function trainerProfiles(): TrainerProfile[] {
  const records = read<TrainerProfile>(TRAINER_PROFILES_KEY);
  const trainers = getUsers().filter(user => user.role === 'trainer');
  let sequence = records.reduce((max, item) => Math.max(max, Number(item.trainerCode?.match(/(\d+)$/)?.[1] ?? 0)), 0);
  let changed = false;
  for (const trainer of trainers) {
    if (records.some(item => item.userId?.toLowerCase() === trainer.userId.toLowerCase())) continue;
    records.push({ id: crypto.randomUUID(), trainerCode: `TR-${String(++sequence).padStart(5, '0')}`, userId: trainer.userId, name: trainer.userId, category: 'Employee', email: '', phone: '', languages: [], competencies: [], certifications: '', state: '', district: '', serviceArea: '', active: trainer.active });
    changed = true;
  }
  if (changed) localStorage.setItem(TRAINER_PROFILES_KEY, JSON.stringify(records));
  return records;
}
export function trainerAvailability(): TrainerAvailability[] { return read<TrainerAvailability>(TRAINER_AVAILABILITY_KEY); }
export function businessToday() {
  const zone = import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || 'Asia/Kolkata';
  const dateAt = (timeZone: string) => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const values = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; };
  try { return dateAt(zone); } catch { return dateAt('Asia/Kolkata'); }
}
export function batchDates(batch: Record<string, any>) {
  if (Array.isArray(batch.trainingDates) && batch.trainingDates.length) return batch.trainingDates.map(String);
  if (!batch.trainingStartDate) return [];
  const result: string[] = []; const date = new Date(`${batch.trainingStartDate}T12:00:00`); const duration = Math.max(1, Number(batch.trainingDuration) || 1);
  for (let checked = 0; checked < 1000 && result.length < duration; checked++, date.setDate(date.getDate() + 1)) {
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    result.push(iso);
  }
  return result;
}
function overlapsTime(startA?: string, endA?: string, startB?: string, endB?: string) {
  if (!startA || !endA || !startB || !endB) return true;
  return startA < endB && startB < endA;
}
export function trainerAvailabilityConflict(trainerCode: string, dates: string[], startTime?: string, endTime?: string, records = trainerAvailability()) {
  const matching = records.filter(item => item.trainerCode.toLowerCase() === trainerCode.toLowerCase());
  const conflicts: string[] = []; const undeclared: string[] = [];
  for (const date of dates) {
    const dayRecords = matching.filter(item => item.date === date);
    if (!dayRecords.length) { undeclared.push(date); continue; }
    const unavailable = dayRecords.filter(item => item.status === 'Unavailable' && overlapsTime(startTime, endTime, item.startTime, item.endTime));
    if (unavailable.length) conflicts.push(`${date}: trainer marked unavailable${unavailable[0].remarks ? ` (${unavailable[0].remarks})` : ''}`);
    const available = dayRecords.filter(item => item.status === 'Available');
    if (available.length && !available.some(item => (!item.startTime || !item.endTime || (startTime && endTime && item.startTime <= startTime && item.endTime >= endTime)))) conflicts.push(`${date}: batch time falls outside declared availability`);
  }
  return { conflicts, undeclared };
}
