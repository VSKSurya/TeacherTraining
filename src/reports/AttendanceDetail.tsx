import { formatDate } from '../dateFormat';
import './attendance-detail.css';

export type AttendancePersonDetail = {
  userId: string;
  name: string;
  mobileMasked: string;
  emailMasked: string;
  days: boolean[];
  daysPresent: number;
};

export type AttendanceBatchDetail = {
  batch: string;
  udise: string;
  school: string;
  state: string;
  district: string;
  block: string;
  trainer: string;
  startDate: Date;
  endDate: Date | null;
  totalTrainingDays: number;
  registered: number;
  presentAllDays: number;
  absentUsers: number;
  attendance: number;
  users: AttendancePersonDetail[];
};

function downloadAttendanceCsv(batch: AttendanceBatchDetail) {
  const headers = ['User Name', 'Name of user', 'Mobile - masked', 'Email - Masked', ...Array.from({ length: batch.totalTrainingDays }, (_, index) => `Day ${index + 1}`), 'Total Days Present'];
  const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const lines = [headers, ...batch.users.map(user => [user.userId, user.name, user.mobileMasked, user.emailMasked, ...user.days.map(present => present ? 'Present' : 'Absent'), user.daysPresent])];
  const blob = new Blob([`\uFEFF${lines.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-${batch.batch}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AttendanceDetail({ batch, onBack }: { batch: AttendanceBatchDetail; onBack: () => void }) {
  const metadata = [
    ['Batch Code', batch.batch], ['Venue UDISE', batch.udise], ['Venue School Name', batch.school],
    ['Venue Address', `${batch.block}, ${batch.district}, ${batch.state}`], ['State', batch.state], ['District', batch.district],
    ['Block', batch.block], ['Trainer Name', batch.trainer], ['Training Start Date', formatDate(batch.startDate)],
    ['Training End Date', batch.endDate ? formatDate(batch.endDate) : '—'], ['Users registered', batch.registered],
    ['No. of users Present all days', batch.presentAllDays], ['No. of users Absent on days', batch.absentUsers],
  ] as const;

  return <section className="attendance-detail" aria-labelledby="attendance-detail-title">
    <div className="attendance-detail-toolbar"><button className="attendance-back-button" type="button" onClick={onBack}>Back to Attendance Reports</button><button className="attendance-back-button" type="button" onClick={() => downloadAttendanceCsv(batch)}>Download CSV</button></div>
    <h2 id="attendance-detail-title">Attendance Details - {batch.batch}</h2>
    <dl className="attendance-detail-meta">{metadata.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="attendance-detail-table-wrap"><table className="attendance-detail-table"><thead><tr><th scope="col">User Name</th><th scope="col">Name of user</th><th scope="col">Mobile - masked</th><th scope="col">Email - Masked</th>{Array.from({ length: batch.totalTrainingDays }, (_, index) => <th scope="col" key={index}>Day {index + 1}</th>)}<th scope="col">Total Days Present</th></tr></thead>
      <tbody>{batch.users.map(user => <tr key={user.userId}><td>{user.userId}</td><td>{user.name}</td><td>{user.mobileMasked}</td><td>{user.emailMasked}</td>{user.days.map((present, index) => <td className={present ? 'attendance-present' : 'attendance-absent'} key={index}>{present ? 'Present' : 'Absent'}</td>)}<td>{user.daysPresent}</td></tr>)}</tbody>
    </table></div>
    <p className="attendance-detail-rate">Attendance: {batch.attendance.toFixed(1)}%</p>
  </section>;
}
