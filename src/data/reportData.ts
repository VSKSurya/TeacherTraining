import { formatDate } from '../dateFormat';
import { locations } from './locations';

export { locations } from './locations';

export const phaseNames = ['Solution Orientation', 'Pedagogical Training', 'Digital and AI Literacy', 'Refresher Training', 'Refresher Training'] as const;
export const trainers = ['Asha Reddy', 'Ravi Kumar', 'Meera Nair', 'Suresh Rao', 'Kavitha Devi', 'Arun Das', 'Neha Sharma', 'Vikram Singh', 'Farah Khan', 'Joseph Mathew', 'Pooja Iyer', 'Mohan Das'] as const;
export type ReportStatus = 'Scheduled' | 'Ongoing' | 'Completed';
export type BatchRecord = {
  index: number; batch: string; udise: string; school: string; state: string; district: string; plan: string; trainer: string;
  startDate: Date; endDate: Date | null; dateText: string; capacity: number; registered: number; attended: number; completed: number;
  attendance: number; status: ReportStatus;
};
export const batchRecords: BatchRecord[] = Array.from({ length: 750 }, (_, index) => {
  const status: ReportStatus = index < 180 ? 'Scheduled' : index < 400 ? 'Ongoing' : 'Completed';
  const place = locations[index % locations.length];
  const district = place.districts[Math.floor(index / locations.length) % place.districts.length];
  const blockIndex = Math.floor(index / (locations.length * 2)) % 2;
  const schoolIndex = Math.floor(index / (locations.length * 4)) % 2;
  const block = `${district} ${blockIndex === 0 ? 'North' : 'South'}`;
  const school = `${block} Government School ${schoolIndex + 1}`;
  const attendance = status === 'Scheduled' ? 0 : status === 'Ongoing' ? 65 + index * 13 % 34 : 83 + index * 11 % 18;
  const completion = status === 'Scheduled' ? 0 : status === 'Ongoing' ? 15 + index * 17 % 76 : 100;
  const day = index % 24 + 1;
  const month = status === 'Scheduled' ? 10 : status === 'Ongoing' ? 9 : 8;
  const startDate = new Date(2026, month, day);
  const dateText = formatDate(startDate);
  const phase = index % phaseNames.length;
  const registered = 110;
  return {
    index, batch: `B-${String(1001 + index).padStart(4, '0')}`, udise: '—', school, state: place.name, district,
    plan: `Phase ${phase + 1} · ${phaseNames[phase]}`, trainer: trainers[index % trainers.length], startDate, endDate: null, dateText,
    capacity: 110, registered, attended: Math.round(110 * attendance / 100), completed: Math.round(110 * completion / 100), attendance, status,
  };
});
export const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
export const statusNames = ['Scheduled', 'Ongoing', 'Completed'] as const;
