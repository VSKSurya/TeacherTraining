import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';

type Row = Record<string, unknown>;
type Project = Row & { id: string; name: string; code?: string; assignedUsers?: string[] };
type Batch = Row & { id: string; uniqueId?: string; projectId?: string; batchCode?: string; name?: string; trainerCode?: string; trainingDates?: string[]; trainingStartDate?: string; trainingDuration?: number };
type Trainee = Row & { id?: string; traineeId?: string; participantId?: string; userId?: string; name?: string; traineeName?: string; participantName?: string; batchId?: string; batchCode?: string; status?: string };
type Mark = { id: string; projectId: string; batchId: string; batchCode: string; trainingDate: string; traineeId: string; traineeName: string; status: 'Present' | 'Absent'; markedBy: string; markedAt: string; updatedBy?: string; updatedAt?: string };
type Audit = { id: string; entity: 'attendance'; action: 'mark' | 'amend'; projectId: string; batchId: string; trainingDate: string; traineeId: string; originalValue?: string; revisedValue?: string; previousStatus?: string; newStatus: string; reason?: string; changedBy: string; changedAt: string };
type UploadValue = { batchId: string; trainingDate: string; traineeId: string; status: string };
type UploadResult = { rowNumber: number; value: UploadValue; batch?: Batch; trainee?: { id: string; name: string }; status?: 'Present' | 'Absent'; errors: string[]; imported?: boolean };
const PROJECTS_KEY = 'teacher-training-projects';
const BATCHES_KEY = 'teacher-training-batch-plan-uses';
const REGISTRATIONS_KEY = 'teacher-training-registrations';
const ATTENDANCE_KEY = 'teacher-training-attendance-records';
const AUDIT_KEY = 'teacher-training-audit';
const BUSINESS_TIME_ZONE = import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || 'Asia/Kolkata';
const readRows = <T extends Row,>(key: string): T[] => { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as T[] : []; } catch { return []; } };
const text = (value: unknown) => typeof value === 'string' ? value : '';
const idFor = (row: Trainee) => text(row.traineeId || row.participantId || row.userId || row.id);
const nameFor = (row: Trainee) => text(row.traineeName || row.participantName || row.name || row.userId || row.traineeId || row.id) || 'Trainee';
const datesFor = (batch: Batch) => {
  if (Array.isArray(batch.trainingDates) && batch.trainingDates.length) return [...new Set(batch.trainingDates.map(date => text(date).slice(0, 10)).filter(Boolean))].sort();
  const start = text(batch.trainingStartDate).slice(0, 10);
  if (!start) return [];
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const duration = Math.max(1, Math.min(365, Number(batch.trainingDuration) || 1));
  while (dates.length < duration) { if (cursor.getDay() !== 0 && cursor.getDay() !== 6) dates.push(cursor.toISOString().slice(0, 10)); cursor.setDate(cursor.getDate() + 1); }
  return dates;
};
const fmtDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
function excelColumn(index: number) { let value = index + 1, label = ''; while (value) { const remainder = (value - 1) % 26; label = String.fromCharCode(65 + remainder) + label; value = Math.floor((value - 1) / 26); } return label; }
function escapeXml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }
function excelDate(value: string) {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = new Date(`${normalized}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : '';
  }
  const serial = Number(normalized);
  if (Number.isFinite(serial) && serial > 0 && serial <= 2_958_465) return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
  return '';
}
async function makeAttendanceTemplate() {
  const headers = ['Batch_ID', 'Training_Date', 'Trainee_ID', 'Attendance_Status'];
  const cells = headers.map((header, index) => `<c r="${excelColumn(index)}1" t="inlineStr"><is><t>${escapeXml(header)}</t></is></c>`).join('');
  const zip = new (await import('jszip')).default();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Attendance" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cells}</row></sheetData></worksheet>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
async function parseAttendanceWorkbook(file: File) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const workbookText = await zip.file('xl/workbook.xml')?.async('string');
  if (!workbookText) throw new Error('This is not a readable Excel workbook. Download the attendance template and try again.');
  const relsText = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  const workbook = new DOMParser().parseFromString(workbookText, 'application/xml');
  const firstSheet = workbook.querySelector('sheet');
  const relationId = firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? firstSheet?.getAttribute('r:id');
  const rels = relsText ? new DOMParser().parseFromString(relsText, 'application/xml') : null;
  const target = Array.from(rels?.getElementsByTagName('Relationship') ?? []).find(item => item.getAttribute('Id') === relationId)?.getAttribute('Target') ?? 'worksheets/sheet1.xml';
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  const sheetText = await zip.file(sheetPath)?.async('string');
  if (!sheetText) throw new Error('The workbook does not contain a readable attendance worksheet.');
  const sharedText = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared = sharedText ? Array.from(new DOMParser().parseFromString(sharedText, 'application/xml').getElementsByTagName('si')).map(item => item.textContent ?? '') : [];
  const matrix = Array.from(new DOMParser().parseFromString(sheetText, 'application/xml').getElementsByTagName('row')).map((row, index) => {
    const values: string[] = [];
    for (const cell of Array.from(row.getElementsByTagName('c'))) {
      const column = (cell.getAttribute('r') ?? '').match(/^[A-Z]+/)?.[0] ?? 'A';
      let columnIndex = 0; for (const letter of column) columnIndex = columnIndex * 26 + letter.charCodeAt(0) - 64;
      const type = cell.getAttribute('t'); let value = cell.getElementsByTagName('v')[0]?.textContent ?? '';
      if (type === 's') value = shared[Number(value)] ?? '';
      else if (type === 'inlineStr') value = cell.getElementsByTagName('t')[0]?.textContent ?? '';
      values[columnIndex - 1] = value;
    }
    return { values, rowNumber: Number(row.getAttribute('r')) || index + 1 };
  });
  const headers = (matrix.shift()?.values ?? []).map(value => String(value ?? '').trim());
  const rows = matrix.map(({ values, rowNumber }) => ({ rowNumber, value: { batchId: String(values[headers.indexOf('Batch_ID')] ?? '').trim(), trainingDate: excelDate(String(values[headers.indexOf('Training_Date')] ?? '')), traineeId: String(values[headers.indexOf('Trainee_ID')] ?? '').trim(), status: String(values[headers.indexOf('Attendance_Status')] ?? '').trim() } })).filter(item => item.value.batchId || item.value.trainingDate || item.value.traineeId || item.value.status);
  return { headers, rows };
}
function businessDateNow() {
  const getDateInZone = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  try { return getDateInZone(BUSINESS_TIME_ZONE); } catch { return getDateInZone('Asia/Kolkata'); }
}

export default function Attendance() {
  const session = getSession();
  const projects = useMemo(() => readRows<Project>(PROJECTS_KEY), []);
  const batches = useMemo(() => readRows<Batch>(BATCHES_KEY), []);
  const registrations = useMemo(() => readRows<Trainee>(REGISTRATIONS_KEY), []);
  const [records, setRecords] = useState<Mark[]>(() => readRows<Mark>(ATTENDANCE_KEY));
  const [audit, setAudit] = useState<Audit[]>(() => readRows<Audit>(AUDIT_KEY));
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [draft, setDraft] = useState<Record<string, 'Present' | 'Absent'>>({});
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [businessToday, setBusinessToday] = useState(businessDateNow);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setBusinessToday(businessDateNow()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const role = session?.role ?? 'trainee';
  const schoolnetAdmin = role === 'schoolnet-super-admin' || role === 'schoolnet-project-admin';
  const globalAdmin = role === 'schoolnet-super-admin';
  const authorizedProjects = projects.filter(project => globalAdmin || (project.assignedUsers ?? []).includes(session?.userId ?? ''));
  const projectOptions = role === 'trainer' ? projects.filter(project => batches.some(batch => batch.projectId === project.id && text(batch.trainerCode).toLowerCase() === session?.userId.toLowerCase())) : authorizedProjects;
  const projectId = selectedProject || (projectOptions.length === 1 ? projectOptions[0].id : '');
  const projectBatches = batches.filter(batch => batch.projectId === projectId && (role !== 'trainer' || text(batch.trainerCode).toLowerCase() === session?.userId.toLowerCase()));
  const batch = projectBatches.find(item => item.id === selectedBatch) ?? null;
  const trainingDates = batch ? datesFor(batch) : [];
  const trainees = useMemo(() => {
    if (!batch) return [];
    const rows = registrations.filter(row => (text(row.batchId) === batch.id || text(row.batchCode) === batch.batchCode) && !['cancelled', 'rejected', 'withdrawn'].includes(text(row.status).toLowerCase()));
    const seen = new Set<string>();
    return rows.filter(row => { const id = idFor(row); if (!id || seen.has(id)) return false; seen.add(id); return true; }).map(row => ({ id: idFor(row), name: nameFor(row) }));
  }, [batch, registrations]);
  const existingByTrainee = new Map(records.filter(row => row.batchId === batch?.id && row.trainingDate === selectedDate).map(row => [row.traineeId, row]));
  const savedForDate = records.filter(row => row.batchId === batch?.id && row.trainingDate === selectedDate);
  const canMarkBatch = (target: Batch) => Boolean(session && (role === 'schoolnet-super-admin' || (['schoolnet-project-admin', 'state-admin', 'school-admin'].includes(role) && (projects.find(project => project.id === target.projectId)?.assignedUsers ?? []).includes(session.userId)) || (role === 'trainer' && text(target.trainerCode).toLowerCase() === session.userId.toLowerCase())));
  const canEnter = Boolean(batch && canMarkBatch(batch));
  const canUpload = Boolean(session && batches.some(canMarkBatch));
  const isAmendment = (traineeId: string) => Boolean(existingByTrainee.has(traineeId) && draft[traineeId] && draft[traineeId] !== existingByTrainee.get(traineeId)?.status);
  const amendmentsPending = trainees.some(trainee => isAmendment(trainee.id));
  const completedCount = trainees.filter(trainee => existingByTrainee.has(trainee.id)).length;
  const missingCount = Math.max(0, trainees.length - completedCount);
  const presentCount = savedForDate.filter(row => row.status.toLowerCase() === 'present').length;
  const absentCount = savedForDate.filter(row => row.status.toLowerCase() === 'absent').length;
  const importableCount = uploadResults.filter(item => !item.imported && item.errors.length === 0).length;

  function changeProject(value: string) { setSelectedProject(value); setSelectedBatch(''); setSelectedDate(''); setDraft({}); setNotice(''); }
  function changeBatch(value: string) { setSelectedBatch(value); setSelectedDate(''); setDraft({}); setReason(''); setNotice(''); }
  function changeDate(value: string) {
    if (value > businessDateNow()) { setNotice(`Future attendance is not allowed. Today's business date is ${fmtDate(businessDateNow())} (${BUSINESS_TIME_ZONE}).`); return; }
    setSelectedDate(value); setReason(''); setNotice('');
    const current = records.filter(row => row.batchId === selectedBatch && row.trainingDate === value);
    setDraft(Object.fromEntries(current.map(row => [row.traineeId, row.status])));
  }
  function saveAttendance() {
    if (!session || !batch || !selectedDate || !canEnter) return;
    const currentBusinessDate = businessDateNow();
    if (selectedDate > currentBusinessDate) { setNotice(`Future attendance is not allowed. Today's business date is ${fmtDate(currentBusinessDate)} (${BUSINESS_TIME_ZONE}).`); return; }
    if (trainees.some(trainee => !draft[trainee.id] && !existingByTrainee.has(trainee.id))) { setNotice('Mark every trainee Present or Absent before saving.'); return; }
    if (amendmentsPending && (!schoolnetAdmin || !reason.trim())) { setNotice('A Schoolnet Admin must provide an amendment reason to change saved attendance.'); return; }
    const timestamp = new Date().toISOString();
    const nextRecords = [...records];
    const nextAudit = [...audit];
    for (const trainee of trainees) {
      const nextStatus = draft[trainee.id];
      if (!nextStatus) continue;
      const index = nextRecords.findIndex(row => row.batchId === batch.id && row.trainingDate === selectedDate && row.traineeId === trainee.id);
      const previous = index >= 0 ? nextRecords[index] : undefined;
      if (previous?.status === nextStatus) continue;
      if (previous && !schoolnetAdmin) continue;
      const mark: Mark = previous
        ? { ...previous, status: nextStatus, updatedBy: session.userId, updatedAt: timestamp }
        : { id: crypto.randomUUID(), projectId, batchId: batch.id, batchCode: batch.batchCode ?? batch.name ?? batch.id, trainingDate: selectedDate, traineeId: trainee.id, traineeName: trainee.name, status: nextStatus, markedBy: session.userId, markedAt: timestamp };
      if (index >= 0) nextRecords[index] = mark; else nextRecords.push(mark);
      nextAudit.push({ id: crypto.randomUUID(), entity: 'attendance', action: previous ? 'amend' : 'mark', projectId, batchId: batch.id, trainingDate: selectedDate, traineeId: trainee.id, originalValue: previous?.status, revisedValue: nextStatus, previousStatus: previous?.status, newStatus: nextStatus, reason: previous ? reason.trim() : undefined, changedBy: session.userId, changedAt: timestamp });
    }
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(nextRecords));
    localStorage.setItem(AUDIT_KEY, JSON.stringify(nextAudit));
    setRecords(nextRecords); setAudit(nextAudit); setReason(''); setNotice('Attendance saved. All changes have been recorded in the audit history.');
  }

  async function readAttendanceUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setUploadFileName(file.name); setUploadNotice(''); setUploadResults([]);
    if (!canUpload) { setUploadNotice('Your account is not authorized to upload attendance for any batch.'); return; }
    try {
      const workbook = await parseAttendanceWorkbook(file);
      const requiredHeaders = ['Batch_ID', 'Training_Date', 'Trainee_ID', 'Attendance_Status'];
      const missingHeaders = requiredHeaders.filter(header => !workbook.headers.includes(header));
      if (missingHeaders.length) {
        setUploadResults([{ rowNumber: 1, value: { batchId: '', trainingDate: '', traineeId: '', status: '' }, errors: [`Missing required column(s): ${missingHeaders.join(', ')}.`] }]);
        setUploadNotice('The workbook headers do not match the attendance template.'); return;
      }
      if (!workbook.rows.length) { setUploadNotice('The workbook has no attendance rows below its header.'); return; }
      const seen = new Set<string>();
      const validated = workbook.rows.map(({ rowNumber, value }): UploadResult => {
        const errors: string[] = [];
        const batch = batches.find(item => item.id === value.batchId || item.batchCode === value.batchId || item.uniqueId === value.batchId);
        if (!value.batchId) errors.push('Batch_ID is required.');
        else if (!batch) errors.push(`Batch “${value.batchId}” does not exist.`);
        else if (!canMarkBatch(batch)) errors.push('You are not authorized to mark attendance for this batch.');
        if (!value.trainingDate) errors.push('Training_Date must be a valid Excel date or YYYY-MM-DD.');
        else if (value.trainingDate > businessDateNow()) errors.push(`Training date is in the future; today in ${BUSINESS_TIME_ZONE} is ${businessDateNow()}.`);
        else if (batch && !datesFor(batch).includes(value.trainingDate)) errors.push('Training date is outside this batch’s permitted training period.');
        if (!value.traineeId) errors.push('Trainee_ID is required.');
        let trainee: UploadResult['trainee'];
        if (value.traineeId && batch) {
          const registration = registrations.find(row => (text(row.batchId) === batch.id || text(row.batchCode) === batch.batchCode) && idFor(row) === value.traineeId && !['cancelled', 'rejected', 'withdrawn'].includes(text(row.status).toLowerCase()));
          if (!registration) errors.push(`Trainee “${value.traineeId}” is not registered in batch “${batch.batchCode || value.batchId}”.`);
          else trainee = { id: idFor(registration), name: nameFor(registration) };
        }
        const normalizedStatus = value.status.trim().toLowerCase();
        const status = normalizedStatus === 'present' ? 'Present' : normalizedStatus === 'absent' ? 'Absent' : undefined;
        if (!status) errors.push('Attendance_Status must be Present or Absent.');
        if (batch && value.trainingDate && trainee) {
          const key = `${batch.id}|${value.trainingDate}|${trainee.id}`;
          if (seen.has(key)) errors.push('Duplicate attendance record in this upload.');
          else seen.add(key);
          if (records.some(record => record.batchId === batch.id && record.trainingDate === value.trainingDate && record.traineeId === trainee?.id)) errors.push('Attendance record already exists; uploads cannot overwrite saved records.');
        }
        return { rowNumber, value, batch, trainee, status, errors };
      });
      setUploadResults(validated);
      setUploadNotice(`${validated.filter(item => item.errors.length === 0).length} valid row(s); ${validated.filter(item => item.errors.length > 0).length} row(s) need correction.`);
    } catch (error) { setUploadNotice(error instanceof Error ? error.message : 'Could not read this Excel workbook.'); }
  }
  async function downloadAttendanceTemplate() {
    const blob = await makeAttendanceTemplate();
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'attendance-upload-template.xlsx'; link.click(); URL.revokeObjectURL(url);
  }
  function importAttendanceRows() {
    if (!session) return;
    const validRows = uploadResults.filter(item => !item.imported && item.errors.length === 0 && item.batch && item.trainee && item.status);
    if (!validRows.length) return;
    const existingKeys = new Set(records.map(record => `${record.batchId}|${record.trainingDate}|${record.traineeId}`));
    const blocked = new Map<number, string>();
    for (const row of validRows) {
      const key = `${row.batch!.id}|${row.value.trainingDate}|${row.trainee!.id}`;
      if (row.value.trainingDate > businessDateNow()) blocked.set(row.rowNumber, `Training date became future-dated in ${BUSINESS_TIME_ZONE} before import.`);
      else if (existingKeys.has(key)) blocked.set(row.rowNumber, 'Attendance record already exists; uploads cannot overwrite saved records.');
      else existingKeys.add(key);
    }
    if (blocked.size) {
      setUploadResults(current => current.map(item => blocked.has(item.rowNumber) ? { ...item, errors: [...item.errors, blocked.get(item.rowNumber)!] } : item));
      setUploadNotice(`${blocked.size} row(s) need correction before import.`);
      return;
    }
    const timestamp = new Date().toISOString();
    const nextRecords = [...records]; const nextAudit = [...audit];
    for (const row of validRows) {
      const batch = row.batch!; const trainee = row.trainee!; const status = row.status!;
      nextRecords.push({ id: crypto.randomUUID(), projectId: batch.projectId ?? '', batchId: batch.id, batchCode: batch.batchCode ?? batch.uniqueId ?? batch.id, trainingDate: row.value.trainingDate, traineeId: trainee.id, traineeName: trainee.name, status, markedBy: session.userId, markedAt: timestamp });
      nextAudit.push({ id: crypto.randomUUID(), entity: 'attendance', action: 'mark', projectId: batch.projectId ?? '', batchId: batch.id, trainingDate: row.value.trainingDate, traineeId: trainee.id, revisedValue: status, newStatus: status, changedBy: session.userId, changedAt: timestamp });
    }
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(nextRecords)); localStorage.setItem(AUDIT_KEY, JSON.stringify(nextAudit));
    setRecords(nextRecords); setAudit(nextAudit); setUploadResults(current => current.map(item => item.errors.length === 0 ? { ...item, imported: true } : item));
    setUploadNotice(`Imported ${validRows.length} attendance record(s). ${uploadResults.filter(item => item.errors.length > 0).length} row(s) still need correction.`);
  }

  return <div className="app"><Sidebar activePage="Attendance" /><main className="main"><Topbar title="Daily Attendance" description="Record and review attendance for each trainee and training date." />
    <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 3 }}>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: '1px solid #e3ebf3', borderRadius: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="stretch">
          {projectOptions.length > 1 && <TextField select label="Project" value={projectId} onChange={event => changeProject(event.target.value)} fullWidth><MenuItem value="">Select a project</MenuItem>{projectOptions.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>}
          <TextField select label="Batch" value={selectedBatch} onChange={event => changeBatch(event.target.value)} fullWidth disabled={!projectId}><MenuItem value="">Select a batch</MenuItem>{projectBatches.map(item => <MenuItem key={item.id} value={item.id}>{item.batchCode || item.name || item.id}</MenuItem>)}</TextField>
          <TextField select label="Training date" value={selectedDate} onChange={event => changeDate(event.target.value)} fullWidth disabled={!batch} helperText={`Attendance dates through ${fmtDate(businessToday)} · ${BUSINESS_TIME_ZONE}`}><MenuItem value="">Select a training date</MenuItem>{trainingDates.map(date => <MenuItem key={date} value={date} disabled={date > businessToday}>{fmtDate(date)}{date > businessToday ? ' (Future date)' : ''}</MenuItem>)}</TextField>
        </Stack>
        {!projectOptions.length && <Alert severity="info" sx={{ mt: 2 }}>No project or batch is assigned to your account. Ask an administrator to assign your access.</Alert>}
        {batch && trainingDates.length === 0 && <Alert severity="warning" sx={{ mt: 2 }}>This batch has no scheduled training dates. Add training dates to the batch before recording attendance.</Alert>}
        {batch && !canEnter && <Alert severity="error" sx={{ mt: 2 }}>You are not authorized to mark attendance for this batch. Only its assigned trainer or an authorized project user may record attendance.</Alert>}
      </Paper>
      {canUpload && <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: '1px solid #e3ebf3', borderRadius: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5}>
          <Box><Typography variant="h6" sx={{ fontWeight: 750 }}>Upload attendance through Excel</Typography><Typography variant="body2" color="text.secondary">Use Batch_ID, Training_Date, Trainee_ID, and Attendance_Status. Dates must be scheduled for the batch and cannot be future dates.</Typography></Box>
          <Stack direction="row" spacing={1} flexWrap="wrap"><Button variant="outlined" onClick={downloadAttendanceTemplate}>Download template</Button><Button component="label" variant="contained">Choose .xlsx file<input hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={readAttendanceUpload} /></Button></Stack>
        </Stack>
        {uploadFileName && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>File: {uploadFileName}</Typography>}
        {uploadNotice && <Alert severity={uploadResults.some(item => item.errors.length > 0) ? 'warning' : 'info'} sx={{ mt: 1.5 }}>{uploadNotice}</Alert>}
        {uploadResults.length > 0 && <>
          <TableContainer sx={{ mt: 1.5, maxHeight: 360, border: '1px solid #e8eef4', borderRadius: 1 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell sx={{ fontWeight: 750 }}>Excel row</TableCell><TableCell sx={{ fontWeight: 750 }}>Batch_ID</TableCell><TableCell sx={{ fontWeight: 750 }}>Training_Date</TableCell><TableCell sx={{ fontWeight: 750 }}>Trainee_ID</TableCell><TableCell sx={{ fontWeight: 750 }}>Status</TableCell><TableCell sx={{ fontWeight: 750 }}>Validation</TableCell></TableRow></TableHead><TableBody>{uploadResults.map(item => <TableRow key={item.rowNumber} hover><TableCell>{item.rowNumber}</TableCell><TableCell>{item.value.batchId || '—'}</TableCell><TableCell>{item.value.trainingDate || '—'}</TableCell><TableCell>{item.value.traineeId || '—'}</TableCell><TableCell>{item.status || item.value.status || '—'}</TableCell><TableCell>{item.imported ? <Chip size="small" color="success" label="Imported" /> : item.errors.length ? <Typography variant="caption" color="error.main">{item.errors.join(' ')}</Typography> : <Chip size="small" color="success" variant="outlined" label="Ready" />}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}><Typography variant="body2" color="text.secondary">{importableCount} valid row(s) ready · {uploadResults.filter(item => item.errors.length > 0).length} row(s) with errors</Typography><Button variant="contained" onClick={importAttendanceRows} disabled={!importableCount}>Import valid rows</Button></Stack>
        </>}
      </Paper>}
      {batch && selectedDate && canEnter && <>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2 }}>
          <Paper elevation={0} sx={{ p: 1.5, flex: 1, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Trainees</Typography><Typography variant="h5" sx={{ fontWeight: 800 }}>{trainees.length}</Typography></Paper>
          <Paper elevation={0} sx={{ p: 1.5, flex: 1, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Saved records</Typography><Typography variant="h5" sx={{ fontWeight: 800, color: '#078347' }}>{completedCount}</Typography></Paper>
          <Paper elevation={0} sx={{ p: 1.5, flex: 1, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Present</Typography><Typography variant="h5" sx={{ fontWeight: 800, color: '#078347' }}>{presentCount}</Typography></Paper>
          <Paper elevation={0} sx={{ p: 1.5, flex: 1, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Absent</Typography><Typography variant="h5" sx={{ fontWeight: 800, color: '#b54735' }}>{absentCount}</Typography></Paper>
          <Paper elevation={0} sx={{ p: 1.5, flex: 1, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Missing attendance</Typography><Typography variant="h5" sx={{ fontWeight: 800, color: missingCount ? '#c77700' : '#078347' }}>{missingCount}</Typography></Paper>
        </Stack>
        <Paper elevation={0} sx={{ border: '1px solid #e3ebf3', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #e8eef4' }}><Box><Typography variant="h6" sx={{ fontWeight: 750 }}>Trainee attendance</Typography><Typography variant="body2" color="text.secondary">{batch.batchCode || batch.name || batch.id} · {fmtDate(selectedDate)}</Typography></Box><Chip size="small" label={schoolnetAdmin ? 'Schoolnet Admin' : role === 'trainer' ? 'Assigned trainer' : 'Authorized user'} color="primary" variant="outlined" /></Box>
          {trainees.length ? <TableContainer sx={{ maxHeight: 580 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell sx={{ fontWeight: 750 }}>Trainee</TableCell><TableCell sx={{ fontWeight: 750 }}>Trainee ID</TableCell><TableCell sx={{ fontWeight: 750 }}>Attendance</TableCell><TableCell sx={{ fontWeight: 750 }}>Record status</TableCell></TableRow></TableHead><TableBody>{trainees.map(trainee => {
            const saved = existingByTrainee.get(trainee.id);
            const value = draft[trainee.id] ?? saved?.status ?? '';
            const canChange = !saved || (schoolnetAdmin && Boolean(draft[trainee.id]));
            return <TableRow key={trainee.id} hover><TableCell sx={{ fontWeight: 650 }}>{trainee.name}</TableCell><TableCell>{trainee.id}</TableCell><TableCell><Stack direction="row" spacing={.75}><Button size="small" variant={value === 'Present' ? 'contained' : 'outlined'} color="success" disabled={!canChange} onClick={() => setDraft(current => ({ ...current, [trainee.id]: 'Present' }))}>Present</Button><Button size="small" variant={value === 'Absent' ? 'contained' : 'outlined'} color="error" disabled={!canChange} onClick={() => setDraft(current => ({ ...current, [trainee.id]: 'Absent' }))}>Absent</Button></Stack></TableCell><TableCell>{saved ? <Chip size="small" color={isAmendment(trainee.id) ? 'warning' : 'success'} label={isAmendment(trainee.id) ? `Amend ${saved.status} → ${draft[trainee.id]}` : `Saved ${saved.status}`} /> : <Chip size="small" variant="outlined" label="Not saved" />}</TableCell></TableRow>;
          })}</TableBody></Table></TableContainer> : <Alert severity="info" sx={{ m: 2 }}>No active trainee registrations were found for this batch. Add trainees to the batch before marking attendance.</Alert>}
          {amendmentsPending && schoolnetAdmin && <Box sx={{ p: 2, borderTop: '1px solid #e8eef4' }}><TextField label="Amendment reason (required)" value={reason} onChange={event => setReason(event.target.value)} fullWidth multiline minRows={2} inputProps={{ maxLength: 500 }} helperText="The previous value, new value, user, time, and reason are retained in the audit history." /></Box>}
          <Box sx={{ p: 2, borderTop: '1px solid #e8eef4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}><Typography variant="caption" color="text.secondary">Saved records remain linked to this trainee, batch, and date.</Typography><Button variant="contained" onClick={saveAttendance} disabled={!trainees.length || trainees.some(item => !draft[item.id] && !existingByTrainee.has(item.id)) || (amendmentsPending && (!schoolnetAdmin || !reason.trim()))}>Save attendance</Button></Box>
        </Paper>
      </>}
      {notice && <Alert severity={notice.startsWith('Attendance saved') ? 'success' : 'warning'} sx={{ mt: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {selectedBatch && selectedDate && batch && canEnter && <Paper elevation={0} sx={{ p: 2, mt: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="subtitle1" sx={{ fontWeight: 750, mb: 1 }}>Saved attendance review</Typography>{records.filter(item => item.batchId === batch.id && item.trainingDate === selectedDate).length ? <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">{records.filter(item => item.batchId === batch.id && item.trainingDate === selectedDate).map(item => <Chip key={item.id} size="small" variant="outlined" color={item.status === 'Present' ? 'success' : 'default'} label={`${item.traineeName}: ${item.status}`} />)}</Stack> : <Typography variant="body2" color="text.secondary">No saved attendance for this date yet.</Typography>}{missingCount > 0 && <Alert severity="warning" sx={{ mt: 1.5 }}>{missingCount} trainee(s) have no saved attendance: {trainees.filter(item => !existingByTrainee.has(item.id)).map(item => item.name).join(', ')}.</Alert>}
        {schoolnetAdmin && audit.filter(item => item.entity === 'attendance' && item.batchId === batch.id && item.trainingDate === selectedDate).length > 0 && <Box sx={{ mt: 2 }}><Typography variant="subtitle2" sx={{ fontWeight: 750, mb: 1 }}>Attendance audit history</Typography><Stack spacing={.75}>{audit.filter(item => item.entity === 'attendance' && item.batchId === batch.id && item.trainingDate === selectedDate).slice().reverse().map(item => { const original = item.originalValue ?? item.previousStatus; const revised = item.revisedValue ?? item.newStatus; return <Typography key={item.id} variant="caption" color="text.secondary">{item.action === 'amend' ? 'Amended' : 'Marked'} {trainees.find(person => person.id === item.traineeId)?.name ?? item.traineeId}: {original ? `${original} → ` : ''}{revised} by {item.changedBy} · {new Date(item.changedAt).toLocaleString()}{item.reason ? ` · Reason: ${item.reason}` : ''}</Typography>; })}</Stack></Box>}
      </Paper>}
    </Box><Footer /></main></div>;
}
