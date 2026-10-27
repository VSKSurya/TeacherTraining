import { formatDate } from '../dateFormat';
import { kgbvSchools } from './kgbvSchools';

export { locations } from './locations';

export const phaseNames = ['Orientation', 'Device & Content Use', 'Digital Skills', 'Refresher I', 'Refresher II'] as const;
export const trainers = ['Asha Reddy', 'Ravi Kumar', 'Meera Nair', 'Suresh Rao', 'Kavitha Devi', 'Arun Das', 'Neha Sharma', 'Vikram Singh', 'Farah Khan', 'Joseph Mathew', 'Pooja Iyer', 'Mohan Das'] as const;
export type ReportStatus = 'Scheduled' | 'Ongoing' | 'Completed';
export type BatchRecord = {
  index: number; batch: string; udise: string; school: string; state: string; district: string; phase: string; trainingPlan: string; participant: 'Teacher' | 'Student'; plan: string; trainer: string;
  dashboardStatus: ReportStatus; dashboardAttendance: number; dashboardCompletion: number; teacherParticipants: number; studentParticipants: number;
  startDate: Date; endDate: Date | null; dateText: string; capacity: number; registered: number; attended: number; completed: number;
  attendance: number; status: ReportStatus;
};
export const batchRecords: BatchRecord[] = Array.from({ length: 750 }, (_, index) => {
  const phase = index % phaseNames.length;
  const status: ReportStatus = phase < 2 ? 'Completed' : phase === 2 ? 'Ongoing' : 'Scheduled';
  const dashboardStatus: ReportStatus = index < 180 ? 'Scheduled' : index < 400 ? 'Ongoing' : 'Completed';
  const dashboardAttendance = dashboardStatus === 'Scheduled' ? 0 : dashboardStatus === 'Ongoing' ? 65 + index * 13 % 34 : 83 + index * 11 % 18;
  const dashboardCompletion = dashboardStatus === 'Scheduled' ? 0 : dashboardStatus === 'Ongoing' ? 15 + index * 17 % 76 : 100;
  const school = kgbvSchools[index % kgbvSchools.length];
  const district = school.district;
  const attendance = status === 'Scheduled' ? 0 : status === 'Ongoing' ? 65 + index * 13 % 34 : 83 + index * 11 % 18;
  const completion = status === 'Scheduled' ? 0 : status === 'Ongoing' ? 15 + index * 17 % 76 : 100;
  const startDate = new Date(2024, phase, 1);
  const endDate = new Date(2024, phase + 1, 0);
  const dateText = formatDate(startDate);
  const registered = 10;
  const attended = Math.round(registered * attendance / 100);
  const completed = Math.round(registered * completion / 100);
  const trainingPlan = phaseNames[phase];
  return {
    index, batch: `B-${String(1001 + index).padStart(4, '0')}`, udise: school.udise, school: school.school, state: school.state, district,
    plan: `Phase ${phase + 1} · ${phaseNames[phase]}`, trainer: trainers[index % trainers.length], startDate, endDate, dateText,
    phase: `Phase ${phase + 1}`, trainingPlan, participant: index % 2 === 0 ? 'Teacher' : 'Student',
    dashboardStatus, dashboardAttendance, dashboardCompletion, teacherParticipants: 10, studentParticipants: 100,
    capacity: 10, registered, attended, completed, attendance: registered ? attended / registered * 100 : 0, status,
  };
});
export const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
export const statusNames = ['Scheduled', 'Ongoing', 'Completed'] as const;
