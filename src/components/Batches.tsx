import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Popover, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { formatDate } from '../dateFormat';
import { getSession, getUsers } from '../auth';
import { kgbvSchools } from '../data/kgbvSchools';
import { locations } from '../data/locations';
import { trainerAvailability, trainerAvailabilityConflict, trainerProfiles } from '../trainerStore';
import { calculateAttendance } from '../attendanceMetrics';
import { batchIdentifiers, batchMatchesRecord, batchStateCode, createBatchCode } from '../batchCodes';
import { ReportFilterPanel, type FilterSpec } from '../reports/ReportComponents';
import { downloadExcelWorkbook } from '../reports/exportExcel';

type Project = { id: string; name: string; code: string; status?: string; assignedUsers: string[]; startDate: string; endDate: string; phases?: { id: string; name: string; sequence: number }[]; batchImportPolicy?: 'valid-rows' | 'all-or-nothing' };
type Plan = { id: string; code: string; name: string; type: 'Classroom' | 'Online' | 'Hybrid'; status: 'Draft' | 'Active' | 'Inactive' };
type Association = { id: string; projectId: string; trainingPlanId: string; status: 'Active' | 'Inactive' };
type BatchStatus = 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled' | 'Archived';
type Batch = {
  id: string; batchCode: string; uniqueId?: string; projectId: string; projectPlanAssociationId: string; name: string;
  phaseId?: string; trainingCycle?: string; batchType?: string; deliveryMode?: string; schoolUdiseVenue?: string; state?: string; district?: string; block?: string; location?: string; pinCode?: string;
  trainingPlanCode?: string; trainingStartDate?: string; trainingDuration?: number; trainingDurationUnit?: 'Training Days' | 'Calendar Days'; weeklyOffDays?: number[]; trainingEndAuto?: string; trainingDates?: string[];
  trainingStartTime?: string; trainingEndTime?: string; trainerCode?: string; trainerProfileCode?: string; trainerName?: string; expectedTraineeCount?: number; openRegistration?: boolean; registrationCapacity?: number; participantCapacity?: number; capacity?: number; onlinePlatform?: string; meetingUrl?: string; meetingId?: string; meetingPassword?: string; registrationWindowBeforeDays?: number; registrationWindowAfterDays?: number;
  createdAt: string; createdBy: string; status?: BatchStatus; warnings?: string[]; registrationCount?: number; attendanceCount?: number; assessmentCount?: number; dependentRecordCount?: number; legacyBatchCodes?: string[];
};
type DraftRow = { Batch_UniqueID: string; Project_Code: string; Project_Phase: string; Training_Cycle: string; Delivery_Mode: string; School_UDISE_Venue: string; State: string; District: string; Location: string; Training_Plan_Code: string; Training_Start_Date: string; Training_Duration: string; Training_End_Auto: string; Training_Start_Time: string; Training_End_Time: string; Trainer_Code: string; Trainer_Name: string; Open_Registration: string };
type ValidationRow = { rowNumber: number; values: DraftRow; batch?: Batch; errors: string[]; warnings: string[] };
type Holiday = { date: string; scope: 'National' | 'State'; state?: string; active?: boolean };
type ApprovedVenue = { code: string; state: string; district: string; location?: string; active?: boolean };
type ManualBatchDraft = { projectId: string; phaseId: string; planCode: string; batchName: string; batchType: string; capacity: string; trainingMode: 'Physical' | 'Online' | 'Hybrid'; startDate: string; duration: string; durationUnit: 'Training Days' | 'Calendar Days'; weeklyOffDays: 'Saturday & Sunday' | 'Sunday' | 'None'; state: string; startTime: string; endTime: string; district: string; block: string; venueName: string; venueUdise: string; pinCode: string; onlinePlatform: string; meetingUrl: string; meetingId: string; meetingPassword: string; trainerCode: string; traineeCount: string; openRegistration: boolean };
const emptyManualDraft: ManualBatchDraft = { projectId: '', phaseId: '', planCode: '', batchName: '', batchType: 'Induction', capacity: '30', trainingMode: 'Physical', startDate: '', duration: '3', durationUnit: 'Training Days', weeklyOffDays: 'Saturday & Sunday', state: '', startTime: '09:30', endTime: '15:30', district: '', block: '', venueName: '', venueUdise: '', pinCode: '', onlinePlatform: 'Microsoft Teams', meetingUrl: '', meetingId: '', meetingPassword: '', trainerCode: '', traineeCount: '10', openRegistration: false };
const PROJECTS_KEY = 'teacher-training-projects';
const PLANS_KEY = 'teacher-training-plans';
const ASSOCIATIONS_KEY = 'teacher-training-project-plan-associations';
const BATCHES_KEY = 'teacher-training-batch-plan-uses';
const HOLIDAYS_KEY = 'teacher-training-holidays';
const AUDIT_KEY = 'teacher-training-audit';
const REGISTRATIONS_KEY = 'teacher-training-registrations';
const ATTENDANCE_KEY = 'teacher-training-attendance-records';
const ATTENDANCE_EXCLUSIONS_KEY = 'teacher-training-attendance-exclusions';
const ASSESSMENTS_KEY = 'teacher-training-assessment-records';
const OTHER_DEPENDENT_KEYS = ['teacher-training-certificates', 'teacher-training-batch-dependent-records'];
const VENUES_KEY = 'teacher-training-approved-venues';
const adminRoles = new Set(['schoolnet-super-admin', 'schoolnet-project-admin', 'state-admin', 'school-admin']);
const headers: (keyof DraftRow)[] = ['Batch_UniqueID', 'Training_Cycle', 'Delivery_Mode', 'School_UDISE_Venue', 'State', 'District', 'Location', 'Training_Plan_Code', 'Training_Start_Date', 'Training_Duration', 'Training_End_Auto', 'Training_Start_Time', 'Training_End_Time', 'Trainer_Code', 'Trainer_Name', 'Open_Registration'];
const requiredHeaders: (keyof DraftRow)[] = ['Batch_UniqueID', 'School_UDISE_Venue', 'State', 'District', 'Training_Plan_Code', 'Training_Start_Date', 'Training_Duration', 'Training_Start_Time', 'Training_End_Time', 'Trainer_Code', 'Open_Registration'];
const blankRow = (): DraftRow => Object.fromEntries(headers.map(header => [header, ''])) as DraftRow;
const fallbackHolidays: Holiday[] = [
  { date: '2027-01-26', scope: 'National', active: true }, { date: '2027-08-15', scope: 'National', active: true },
  { date: '2027-05-01', scope: 'State', state: 'Maharashtra', active: true }, { date: '2027-11-01', scope: 'State', state: 'Karnataka', active: true },
];
function readList<T,>(key: string, fallback: T[] = []): T[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null'); return Array.isArray(value) ? value as T[] : fallback; } catch { return fallback; } }
function excelColumn(index: number) { let value = index + 1, label = ''; while (value) { const remainder = (value - 1) % 26; label = String.fromCharCode(65 + remainder) + label; value = Math.floor((value - 1) / 26); } return label; }
function cellXml(reference: string, value: string) { return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`; }
function escapeXml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }
async function makeTemplate() {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const cells = headers.map((header, index) => cellXml(`${excelColumn(index)}1`, header)).join('');
  const locationHeaders = ['State', 'District', 'School', 'School_UDISE_Venue', 'Block'];
  const locationRows = [locationHeaders, ...kgbvSchools.map(school => [school.state, school.district, school.school, school.udise, school.block])];
  const locationXml = locationRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => cellXml(`${excelColumn(columnIndex)}${rowIndex + 1}`, value)).join('')}</row>`).join('');
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Batches" sheetId="1" r:id="rId1"/><sheet name="Location Master" sheetId="2" r:id="rId2"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cells}</row></sheetData></worksheet>`);
  zip.file('xl/worksheets/sheet2.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${locationXml}</sheetData></worksheet>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
function excelDate(value: string): string | null {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) { const date = new Date(`${text}T00:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null; }
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 0) { const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000); return date.toISOString().slice(0, 10); }
  return null;
}
function excelTime(value: string) {
  const text = value.trim();
  if (/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(text)) return text.length === 4 ? `0${text}` : text;
  const fraction = Number(text);
  if (Number.isFinite(fraction) && fraction >= 0 && fraction < 1) { const mins = Math.round(fraction * 1440); return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; }
  return null;
}
function parseFlag(value: string) { const normalized = value.trim().toLowerCase(); if (['true', 'yes', '1', 'enabled'].includes(normalized)) return true; if (['false', 'no', '0', 'disabled'].includes(normalized)) return false; return null; }
function scheduleDays(start: string, duration: number, holidays: Holiday[], state: string, weeklyOffDays: number[] = [0, 6]) {
  const result: string[] = [];
  const blockedDates = new Set(holidays.filter(item => item.active !== false && (item.scope === 'National' || (item.scope === 'State' && item.state === state))).map(item => item.date));
  const current = new Date(`${start}T12:00:00`);
  for (let checked = 0; checked < 2000 && result.length < duration; checked++, current.setDate(current.getDate() + 1)) {
    const day = current.getDay(); const iso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    if (!weeklyOffDays.includes(day) && !blockedDates.has(iso)) result.push(iso);
  }
  return result;
}
function manualScheduleDays(start: string, duration: number, holidays: Holiday[], state: string, unit: ManualBatchDraft['durationUnit'], weeklyOffDays: ManualBatchDraft['weeklyOffDays']) {
  if (unit === 'Training Days') return scheduleDays(start, duration, holidays, state, weeklyOffDays === 'None' ? [] : weeklyOffDays === 'Sunday' ? [0] : [0, 6]);
  const dates: string[] = []; const date = new Date(`${start}T12:00:00`);
  for (let index = 0; index < duration; index++) { dates.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`); date.setDate(date.getDate() + 1); }
  return dates;
}
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
function downloadCsv(name: string, rows: string[][]) { const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n'); downloadBlob(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), name); }
async function parseWorkbook(file: File): Promise<{ rows: Record<string, string>[]; headers: string[] }> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const workbookText = await zip.file('xl/workbook.xml')?.async('string');
  if (!workbookText) throw new Error('The uploaded file is not a readable Excel workbook. Download a fresh template and try again.');
  const relsText = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  const workbook = new DOMParser().parseFromString(workbookText, 'application/xml');
  const firstSheet = workbook.querySelector('sheet');
  const relationId = firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? firstSheet?.getAttribute('r:id');
  const rels = relsText ? new DOMParser().parseFromString(relsText, 'application/xml') : null;
  const target = Array.from(rels?.getElementsByTagName('Relationship') ?? []).find(item => item.getAttribute('Id') === relationId)?.getAttribute('Target') ?? 'worksheets/sheet1.xml';
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  const sheetText = await zip.file(sheetPath)?.async('string');
  if (!sheetText) throw new Error('The workbook does not contain a readable first worksheet.');
  const sharedText = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared = sharedText ? Array.from(new DOMParser().parseFromString(sharedText, 'application/xml').getElementsByTagName('si')).map(item => item.textContent ?? '') : [];
  const sheet = new DOMParser().parseFromString(sheetText, 'application/xml');
  const matrix = Array.from(sheet.getElementsByTagName('row')).map((row, rowIndex) => {
    const cells = Array.from(row.getElementsByTagName('c'));
    const values: string[] = [];
    for (const cell of cells) {
      const ref = cell.getAttribute('r') ?? ''; const column = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
      let index = 0; for (const letter of column) index = index * 26 + letter.charCodeAt(0) - 64; index--;
      const type = cell.getAttribute('t'); let value = cell.getElementsByTagName('v')[0]?.textContent ?? '';
      if (type === 's') value = shared[Number(value)] ?? '';
      else if (type === 'inlineStr') value = cell.getElementsByTagName('t')[0]?.textContent ?? '';
      values[index] = value;
    }
    return { values, sourceRowNumber: Number(row.getAttribute('r')) || rowIndex + 1 };
  });
  const headerRow = matrix.shift();
  const columnHeaders = (headerRow?.values ?? []).map(value => String(value ?? '').trim());
  const rows = matrix.map(({ values, sourceRowNumber }) => ({ ...Object.fromEntries(columnHeaders.map((header, index) => [header, String(values[index] ?? '').trim()])), __sourceRowNumber: String(sourceRowNumber) }) as Record<string, string>).filter(row => Object.entries(row).some(([key, value]) => key !== '__sourceRowNumber' && Boolean(value)));
  return { rows, headers: columnHeaders };
}
function readDependentRecords(batch: Batch) {
  if ((batch.registrationCount ?? 0) > 0 || (batch.attendanceCount ?? 0) > 0 || (batch.assessmentCount ?? 0) > 0 || (batch.dependentRecordCount ?? 0) > 0) return true;
  const identifiers = new Set(batchIdentifiers(batch));
  const keys = [REGISTRATIONS_KEY, ATTENDANCE_KEY, ASSESSMENTS_KEY, ...OTHER_DEPENDENT_KEYS];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key || key === BATCHES_KEY) continue;
    let value: unknown;
    try { value = JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { continue; }
    const records = Array.isArray(value) ? value : keys.includes(key) ? [] : value && typeof value === 'object' ? [value] : [];
    if (records.some(record => record && typeof record === 'object' && ['batchId', 'batchCode', 'batchUniqueId'].some(field => identifiers.has(String((record as Record<string, unknown>)[field] ?? ''))))) return true;
  }
  return false;
}

export default function Batches() {
  const session = getSession();
  const [projects] = useState<Project[]>(() => readList(PROJECTS_KEY));
  const [plans] = useState<Plan[]>(() => readList(PLANS_KEY));
  const [associations] = useState<Association[]>(() => readList(ASSOCIATIONS_KEY));
  const [batches, setBatches] = useState<Batch[]>(() => readList(BATCHES_KEY));
  const registrations = useMemo(() => readList<Record<string, unknown>>(REGISTRATIONS_KEY), []);
  const attendanceRecords = useMemo(() => readList<Record<string, unknown>>(ATTENDANCE_KEY), []);
  const attendanceExclusions = useMemo(() => readList<Record<string, unknown>>(ATTENDANCE_EXCLUSIONS_KEY), []);
  const [holidays] = useState<Holiday[]>(() => readList(HOLIDAYS_KEY, fallbackHolidays));
  const [venues] = useState<ApprovedVenue[]>(() => readList(VENUES_KEY));
  const trainerDirectory = useMemo(() => trainerProfiles(), []);
  const trainers = useMemo(() => getUsers().filter(user => user.active && user.role === 'trainer' && trainerDirectory.some(profile => profile.active && profile.userId?.toLowerCase() === user.userId.toLowerCase())), [trainerDirectory]);
  const [fileName, setFileName] = useState('');
  const [uploadProjectId, setUploadProjectId] = useState('');
  const [uploadPhaseId, setUploadPhaseId] = useState('');
  const [manualBatchOpen, setManualBatchOpen] = useState(false);
  const [manualEditingBatch, setManualEditingBatch] = useState<Batch | null>(null);
  const [manualViewingBatch, setManualViewingBatch] = useState(false);
  const [manualStep, setManualStep] = useState(0);
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualBatchDraft>(emptyManualDraft);
  const [manualError, setManualError] = useState('');
  const [validation, setValidation] = useState<ValidationRow[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [confirmImport, setConfirmImport] = useState(false);
  const [filter, setFilter] = useState({ query: '', project: '', phase: '', state: '', district: '', school: '', plan: '', trainer: '', from: '', to: '', status: '' });
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [viewBatch, setViewBatch] = useState<Batch | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [editError, setEditError] = useState('');
  const canImport = Boolean(session && adminRoles.has(session.role));
  const sponsorAdmin = session?.role === 'sponsor-admin';
  const authorizedProjects = projects.filter(project => session?.role === 'schoolnet-super-admin' || session?.role === 'sponsor-admin' || project.assignedUsers.includes(session?.userId ?? ''));

  function validateRows(rawRows: Record<string, string>[], uploadedHeaders: string[]) {
    const rows: ValidationRow[] = [];
    const uploadedIds = new Set<string>();
    const reservedBatchCodes = new Set(batches.flatMap(batch => batchIdentifiers(batch).map(item => item.toUpperCase())));
    const prior = [...batches];
    const allProjects = projects;
    const userList = getUsers();
    const trainerDirectory = trainerProfiles();
    const availabilityRecords = trainerAvailability();
    for (let index = 0; index < rawRows.length; index++) {
      const source = rawRows[index]; const selectedProject = projects.find(item => item.id === uploadProjectId); const selectedPhase = selectedProject?.phases?.find(item => item.id === uploadPhaseId);
      const values = { ...blankRow(), ...source, Project_Code: selectedProject?.code ?? '', Project_Phase: selectedPhase?.name ?? '' } as DraftRow;
      const rowNumber = Number(source.__sourceRowNumber) || index + 2; const errors: string[] = []; const warnings: string[] = [];
      const missing = requiredHeaders.filter(header => !uploadedHeaders.includes(header));
      if (missing.length) errors.push(`Missing mandatory column(s): ${missing.join(', ')}.`);
      const uniqueId = values.Batch_UniqueID.trim(); const projectCode = values.Project_Code.trim();
      const project = allProjects.find(item => item.code.toLowerCase() === projectCode.toLowerCase());
      const canAccess = Boolean(project && authorizedProjects.some(item => item.id === project.id));
      if (!uniqueId) errors.push('Batch_UniqueID is required.');
      const key = `${project?.id ?? projectCode.toLowerCase()}|${uniqueId.toLowerCase()}`;
      if (uniqueId && uploadedIds.has(key)) errors.push(`Batch_UniqueID “${uniqueId}” is duplicated in this upload for the project.`);
      if (uniqueId) uploadedIds.add(key);
      if (project && batches.some(item => item.projectId === project.id && batchIdentifiers(item).some(identifier => identifier.toLowerCase() === uniqueId.toLowerCase()))) errors.push(`Batch_UniqueID “${uniqueId}” already exists in this project.`);
      if (!project) errors.push(`Project_Code “${projectCode || '(blank)'}” does not match a project.`);
      else if (!canAccess) errors.push(`Project “${projectCode}” is not accessible to your account.`);
      const plan = plans.find(item => item.code.toLowerCase() === values.Training_Plan_Code.trim().toLowerCase());
      const association = project && plan ? associations.find(item => item.projectId === project.id && item.trainingPlanId === plan.id && item.status === 'Active') : undefined;
      if (!values.Training_Plan_Code.trim()) errors.push('Training_Plan_Code is required.');
      else if (!plan) errors.push(`Training_Plan_Code “${values.Training_Plan_Code}” was not found.`);
      else if (!association) errors.push(`Training plan ${plan.code} is not actively linked to project ${projectCode}.`);
      else if (plan.status !== 'Active') errors.push(`Training plan ${plan.code} is ${plan.status.toLowerCase()}; an active plan is required.`);
      const venueRef = values.School_UDISE_Venue.trim();
      const school = kgbvSchools.find(item => item.udise === venueRef);
      const venue = venues.find(item => item.code === venueRef && item.active !== false);
      if (!venueRef) errors.push('School_UDISE_Venue is required.');
      else if (!school && !venue) errors.push(`School_UDISE_Venue “${venueRef}” is not a known UDISE school or active approved venue.`);
      const venueState = school?.state ?? venue?.state; const venueDistrict = school?.district ?? venue?.district;
      if (!values.State.trim()) errors.push('State is required.');
      if (!values.District.trim()) errors.push('District is required.');
      if (venueState && values.State.trim().toLowerCase() !== venueState.toLowerCase()) errors.push(`State “${values.State}” does not match venue master data (${venueState}).`);
      if (venueDistrict && values.District.trim().toLowerCase() !== venueDistrict.toLowerCase()) errors.push(`District “${values.District}” does not match venue master data (${venueDistrict}).`);
      const stateDistrictExists = kgbvSchools.some(item => item.state.toLowerCase() === values.State.trim().toLowerCase() && item.district.toLowerCase() === values.District.trim().toLowerCase()) || venues.some(item => item.active !== false && item.state.toLowerCase() === values.State.trim().toLowerCase() && item.district.toLowerCase() === values.District.trim().toLowerCase());
      if (values.State && values.District && !stateDistrictExists) errors.push(`District “${values.District}” is not listed under state “${values.State}” in the available UDISE/venue master data.`);
      const startDate = excelDate(values.Training_Start_Date);
      if (!startDate) errors.push('Training_Start_Date must be a valid Excel date or YYYY-MM-DD.');
      if (startDate) {
        const startHoliday = holidays.find(item => item.active !== false && item.date === startDate && (item.scope === 'National' || (item.scope === 'State' && item.state?.toLowerCase() === values.State.trim().toLowerCase())));
        if (startHoliday) errors.push(`Training_Start_Date ${formatDate(startDate)} is an active ${startHoliday.scope.toLowerCase()} holiday; choose a scheduled training day.`);
      }
      const duration = Number(values.Training_Duration);
      if (!values.Training_Duration || !Number.isInteger(duration) || duration <= 0 || duration > 365) errors.push('Training_Duration must be a positive whole number from 1 to 365.');
      const startTime = excelTime(values.Training_Start_Time); const endTime = excelTime(values.Training_End_Time);
      if (!startTime) errors.push('Training_Start_Time must use HH:mm format.');
      if (!endTime) errors.push('Training_End_Time must use HH:mm format.');
      if (startTime && endTime && startTime >= endTime) errors.push('Training_End_Time must be later than Training_Start_Time.');
      const openRegistration = parseFlag(values.Open_Registration);
      if (openRegistration === null) errors.push('Open_Registration must be Yes/No, True/False, or 1/0.');
      const suppliedTrainerCode = values.Trainer_Code.trim();
      const trainerProfile = trainerDirectory.find(item => item.trainerCode.toLowerCase() === suppliedTrainerCode.toLowerCase() || item.userId?.toLowerCase() === suppliedTrainerCode.toLowerCase());
      const trainerCode = trainerProfile?.userId ?? suppliedTrainerCode;
      const trainer = userList.find(item => item.userId.toLowerCase() === trainerCode.toLowerCase());
      if (!suppliedTrainerCode) errors.push('Trainer_Code is required.');
      else if (!trainerProfile) errors.push(`Trainer_Code “${suppliedTrainerCode}” was not found in the trainer repository.`);
      else if (!trainerProfile.active || !trainer || !trainer.active || trainer.role !== 'trainer') errors.push(`Trainer ${trainerProfile.trainerCode} is inactive or is not linked to an active trainer account.`);
      if (trainerProfile && values.Trainer_Name.trim() && values.Trainer_Name.trim().toLowerCase() !== trainerProfile.name.toLowerCase()) warnings.push(`Trainer_Name was changed to the trainer repository name (${trainerProfile.name}).`);
      const projectRules = project as (Project & Record<string, unknown>) | undefined;
      const permittedTrainers = Array.isArray(projectRules?.eligibleTrainerCodes) ? projectRules.eligibleTrainerCodes : Array.isArray(projectRules?.eligibleTrainerIds) ? projectRules.eligibleTrainerIds : Array.isArray(projectRules?.eligibleTrainers) ? projectRules.eligibleTrainers : [];
      if (trainerProfile && permittedTrainers.length && !permittedTrainers.some(value => String(value).toLowerCase() === trainerProfile.trainerCode.toLowerCase() || String(value).toLowerCase() === trainerCode.toLowerCase())) errors.push(`Trainer ${trainerProfile.trainerCode} is not eligible for project ${projectCode}.`);
      const requiredCompetencies = Array.isArray(projectRules?.requiredTrainerCompetencies) ? projectRules.requiredTrainerCompetencies : [];
      if (trainerProfile && requiredCompetencies.some(value => !trainerProfile.competencies.some(competency => competency.toLowerCase() === String(value).toLowerCase()))) errors.push(`Trainer ${trainerProfile.trainerCode} does not meet all competencies required by project ${projectCode}.`);
      let phaseId: string | undefined;
      if (values.Project_Phase.trim()) {
        const phase = project?.phases?.find(item => item.id === values.Project_Phase.trim() || item.name.toLowerCase() === values.Project_Phase.trim().toLowerCase());
        if (!phase) errors.push(`Project_Phase “${values.Project_Phase}” is not a phase of project ${projectCode}.`); else phaseId = phase.id;
      }
      let deliveryMode = values.Delivery_Mode.trim();
      if (deliveryMode && !['Classroom', 'Online', 'Hybrid'].includes(deliveryMode)) errors.push('Delivery_Mode must be Classroom, Online, or Hybrid.');
      if (deliveryMode && plan && deliveryMode !== plan.type) errors.push(`Delivery_Mode ${deliveryMode} does not match training plan type ${plan.type}.`);
      if (plan && !deliveryMode) deliveryMode = plan.type;
      let trainingDates: string[] = []; let calculatedEnd = '';
      if (startDate && Number.isInteger(duration) && duration > 0 && values.State) {
        trainingDates = scheduleDays(startDate, duration, holidays, values.State.trim());
        calculatedEnd = trainingDates[trainingDates.length - 1] ?? '';
        if (trainingDates[0] && trainingDates[0] !== startDate) errors.push(`Training_Start_Date ${formatDate(startDate)} is a non-training day; the first available weekday is ${formatDate(trainingDates[0])}.`);
        if (!calculatedEnd) errors.push('Could not calculate an end date for this training duration.');
        if (values.Training_End_Auto.trim()) {
          const suppliedEnd = excelDate(values.Training_End_Auto);
          if (!suppliedEnd) errors.push('Training_End_Auto must be a valid Excel date or YYYY-MM-DD.');
          else if (suppliedEnd !== calculatedEnd) errors.push(`Training_End_Auto is ${suppliedEnd}, but the approved weekday/holiday rule calculates ${calculatedEnd}.`);
        }
        if (project && (startDate < project.startDate || calculatedEnd > project.endDate)) errors.push(`Training dates ${formatDate(startDate)} to ${formatDate(calculatedEnd)} fall outside the project period ${formatDate(project.startDate)} to ${formatDate(project.endDate)}.`);
        if (trainerProfile?.active && trainerProfile.userId) {
          const availability = trainerAvailabilityConflict(trainerCode, trainingDates, startTime ?? '', endTime ?? '', availabilityRecords);
          if (availability.conflicts.length) errors.push(`Trainer availability conflict: ${availability.conflicts.join('; ')}.`);
          if (availability.undeclared.length) warnings.push(`No declared availability for ${trainerProfile.name} on ${availability.undeclared.join(', ')}; confirm availability before scheduling.`);
        }
        const plannedConflict = [...prior, ...rows.flatMap(item => item.batch ? [item.batch] : [])].find(item => item.status !== 'Cancelled' && item.status !== 'Archived' && item.trainerCode?.toLowerCase() === trainerCode.toLowerCase() && (item.trainingDates ?? (item.trainingStartDate ? scheduleDays(item.trainingStartDate, item.trainingDuration ?? 1, holidays, item.state ?? '') : [])).some(date => trainingDates.includes(date)) && timesOverlap(startTime ?? '', endTime ?? '', item.trainingStartTime ?? '', item.trainingEndTime ?? ''));
        if (plannedConflict) errors.push(`Trainer ${trainerCode} has an overlapping booking (${plannedConflict.batchCode}) on one or more training days.`);
      }
      if (startDate && duration > 0 && Number.isInteger(duration)) {
        for (const date of trainingDates) {
          const holiday = holidays.find(item => item.active !== false && item.date === date && (item.scope === 'National' || (item.scope === 'State' && item.state === values.State)));
          if (holiday) errors.push(`Training day ${date} conflicts with an active ${holiday.scope.toLowerCase()} holiday.`);
        }
      }
      const batchCode = errors.length === 0 ? createBatchCode(project?.code, batchStateCode(values.State, values.School_UDISE_Venue), reservedBatchCodes) : '';
      if (batchCode) reservedBatchCodes.add(batchCode);
      const batch: Batch | undefined = errors.length === 0 && project && association && plan && startDate && calculatedEnd && startTime && endTime && openRegistration !== null ? {
        id: crypto.randomUUID(), batchCode, uniqueId, legacyBatchCodes: [uniqueId], projectId: project.id, projectPlanAssociationId: association.id, name: values.Location || `Batch ${uniqueId}`,
        phaseId, trainingCycle: values.Training_Cycle.trim(), deliveryMode, schoolUdiseVenue: venueRef, state: values.State.trim(), district: values.District.trim(), location: values.Location.trim(),
        trainingPlanCode: plan.code, trainingStartDate: startDate, trainingDuration: duration, trainingEndAuto: calculatedEnd, trainingDates, trainingStartTime: startTime, trainingEndTime: endTime,
        trainerCode, trainerProfileCode: trainerProfile?.trainerCode, trainerName: trainerProfile?.name ?? values.Trainer_Name.trim(), openRegistration, registrationWindowBeforeDays: 0, registrationWindowAfterDays: 0, createdAt: new Date().toISOString(), createdBy: session?.userId ?? '', status: 'Scheduled', warnings: [...warnings],
      } : undefined;
      rows.push({ rowNumber, values, batch, errors: [...new Set(errors)], warnings });
    }
    return rows;
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!uploadProjectId || !uploadPhaseId) { setMessage('Select a project and phase before choosing an Excel file.'); event.target.value = ''; return; }
    setFileName(file.name); setMessage(''); setValidation([]);
    try {
      const workbook = await parseWorkbook(file); setFileHeaders(workbook.headers);
      const result = validateRows(workbook.rows, workbook.headers);
      setValidation(result);
      if (!workbook.rows.length) setMessage('The workbook has no batch rows. Add at least one row below the header.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read this Excel workbook.'); }
    event.target.value = '';
  }
  function validateManualStep(step: number) {
    const project = projects.find(item => item.id === manualDraft.projectId);
    const phase = project?.phases?.find(item => item.id === manualDraft.phaseId);
    const plan = plans.find(item => item.code === manualDraft.planCode);
    const linkedPlan = Boolean(project && plan && associations.some(item => item.projectId === project.id && item.trainingPlanId === plan.id && item.status === 'Active'));
    if (step === 0 && (!project || !phase || !linkedPlan || !manualDraft.batchName.trim() || !manualDraft.batchType || Number(manualDraft.capacity) < 1)) { setManualError('Choose an active project, phase, linked training plan, batch code, type, and a positive batch capacity.'); return false; }
    if (step === 1) {
      const duration = Number(manualDraft.duration);
      if (!manualDraft.startDate || !manualDraft.state || !Number.isInteger(duration) || duration < 1 || manualDraft.startTime >= manualDraft.endTime) { setManualError('Enter a start date, state holiday calendar, valid duration, and an end time later than the start time.'); return false; }
      const dates = manualScheduleDays(manualDraft.startDate, duration, holidays, manualDraft.state, manualDraft.durationUnit, manualDraft.weeklyOffDays);
      if (!dates.length || (manualDraft.durationUnit === 'Training Days' && dates[0] !== manualDraft.startDate)) { setManualError(`Choose a valid training day. The next available date is ${dates[0] ?? 'unavailable'}.`); return false; }
      if (project && (manualDraft.startDate < project.startDate || dates.at(-1)! > project.endDate)) { setManualError('Training dates must fall within the project dates.'); return false; }
    }
    if (step === 2 && manualDraft.trainingMode !== 'Online' && (!manualDraft.state || !manualDraft.district || !manualDraft.block || !manualDraft.venueUdise)) { setManualError('Select a state, district, block, and training centre / venue with a School UDISE code.'); return false; }
    if (step === 2 && manualDraft.trainingMode !== 'Physical' && (!manualDraft.onlinePlatform || !/^https?:\/\//i.test(manualDraft.meetingUrl.trim()))) { setManualError('Select an online platform and enter a valid meeting URL.'); return false; }
    if (step === 3) {
      const trainerProfile = trainerDirectory.find(item => item.userId?.toLowerCase() === manualDraft.trainerCode.toLowerCase());
      const traineeCount = Number(manualDraft.traineeCount);
      if (!trainerProfile?.active || !trainers.some(item => item.userId === trainerProfile.userId) || !Number.isInteger(traineeCount) || traineeCount < 0 || traineeCount > Number(manualDraft.capacity)) { setManualError('Select an active trainer and enter a trainee count within the batch capacity.'); return false; }
    }
    setManualError(''); return true;
  }
  function saveManualDraft() {
    localStorage.setItem('teacher-training-batch-drafts', JSON.stringify({ ...manualDraft, savedAt: new Date().toISOString() }));
    setManualError('Draft saved in this browser. You can continue editing.');
  }
  function saveManualBatch() {
    if (![0, 1, 2, 3].every(validateManualStep)) return;
    const project = projects.find(item => item.id === manualDraft.projectId)!;
    const phase = project.phases?.find(item => item.id === manualDraft.phaseId)!;
    const plan = plans.find(item => item.code === manualDraft.planCode)!;
    const association = associations.find(item => item.projectId === project.id && item.trainingPlanId === plan.id && item.status === 'Active')!;
    const trainerProfile = trainerDirectory.find(item => item.userId?.toLowerCase() === manualDraft.trainerCode.toLowerCase())!;
    const duration = Number(manualDraft.duration);
    const weeklyOffDays = manualDraft.weeklyOffDays === 'None' ? [] : manualDraft.weeklyOffDays === 'Sunday' ? [0] : [0, 6];
    const dates = manualScheduleDays(manualDraft.startDate, duration, holidays, manualDraft.state, manualDraft.durationUnit, manualDraft.weeklyOffDays);
    const end = dates.at(-1)!;
    const conflict = trainerAvailabilityConflict(trainerProfile.userId || trainerProfile.trainerCode, dates, manualDraft.startTime, manualDraft.endTime);
    if (conflict.conflicts.length) { setManualStep(3); setManualError(`Trainer availability conflict: ${conflict.conflicts.join('; ')}.`); return; }
    const school = kgbvSchools.find(item => item.udise === manualDraft.venueUdise);
    const reserved = batches.filter(batch => batch.id !== manualEditingBatch?.id).flatMap(batch => batchIdentifiers(batch));
    const batchCode = manualEditingBatch?.batchCode ?? createBatchCode(project.code, batchStateCode(manualDraft.state, school?.udise), reserved);
    const uniqueId = manualEditingBatch?.uniqueId ?? `MANUAL-${crypto.randomUUID()}`;
    const batch: Batch = { ...manualEditingBatch, id: manualEditingBatch?.id ?? crypto.randomUUID(), batchCode, uniqueId, legacyBatchCodes: manualEditingBatch?.legacyBatchCodes ?? [uniqueId], projectId: project.id, projectPlanAssociationId: association.id, name: manualDraft.batchName.trim(), batchType: manualDraft.batchType, phaseId: phase.id, trainingCycle: manualEditingBatch?.trainingCycle ?? '', deliveryMode: manualDraft.trainingMode, schoolUdiseVenue: school?.udise ?? '', state: manualDraft.state, district: manualDraft.district, block: manualDraft.block, location: manualDraft.venueName.trim(), pinCode: manualDraft.pinCode.trim(), trainingPlanCode: plan.code, trainingStartDate: manualDraft.startDate, trainingDuration: duration, trainingDurationUnit: manualDraft.durationUnit, weeklyOffDays, trainingEndAuto: end, trainingDates: dates, trainingStartTime: manualDraft.startTime, trainingEndTime: manualDraft.endTime, trainerCode: trainerProfile.userId ?? trainerProfile.trainerCode, trainerProfileCode: trainerProfile.trainerCode, trainerName: trainerProfile.name, expectedTraineeCount: Number(manualDraft.traineeCount), registrationCapacity: Number(manualDraft.capacity), openRegistration: manualDraft.openRegistration, registrationWindowBeforeDays: manualEditingBatch?.registrationWindowBeforeDays ?? 0, registrationWindowAfterDays: manualEditingBatch?.registrationWindowAfterDays ?? 0, onlinePlatform: manualDraft.trainingMode !== 'Physical' ? manualDraft.onlinePlatform : undefined, meetingUrl: manualDraft.trainingMode !== 'Physical' ? manualDraft.meetingUrl.trim() : undefined, meetingId: manualDraft.meetingId.trim() || undefined, meetingPassword: manualDraft.meetingPassword || undefined, createdAt: manualEditingBatch?.createdAt ?? new Date().toISOString(), createdBy: manualEditingBatch?.createdBy ?? session?.userId ?? '', status: manualEditingBatch?.status ?? 'Scheduled' };
    const next = manualEditingBatch ? batches.map(item => item.id === manualEditingBatch.id ? batch : item) : [batch, ...batches]; localStorage.setItem(BATCHES_KEY, JSON.stringify(next)); setBatches(next); localStorage.removeItem('teacher-training-batch-drafts'); setManualBatchOpen(false); setManualStep(0); setManualDraft(emptyManualDraft); setManualEditingBatch(null); setPage(0);
  }
  function openManualWizard() {
    setManualEditingBatch(null);
    setManualViewingBatch(false);
    setManualError(''); setManualStep(0);
    try { const saved = JSON.parse(localStorage.getItem('teacher-training-batch-drafts') ?? 'null'); setManualDraft(saved && typeof saved === 'object' ? { ...emptyManualDraft, ...saved } : emptyManualDraft); } catch { setManualDraft(emptyManualDraft); }
    setManualBatchOpen(true);
  }
  function openEditWizard(batch: Batch) {
    setManualViewingBatch(false);
    setManualEditingBatch(batch);
    setManualError(''); setManualStep(0);
    const trainingMode = (batch.deliveryMode === 'Online' || batch.deliveryMode === 'Hybrid' ? batch.deliveryMode : 'Physical') as ManualBatchDraft['trainingMode'];
    const school = kgbvSchools.find(item => item.udise === batch.schoolUdiseVenue);
    const weeklyOffDays: ManualBatchDraft['weeklyOffDays'] = batch.weeklyOffDays?.length === 0 ? 'None' : batch.weeklyOffDays?.length === 1 ? 'Sunday' : 'Saturday & Sunday';
    setManualDraft({ ...emptyManualDraft, projectId: batch.projectId, phaseId: batch.phaseId ?? '', planCode: batch.trainingPlanCode ?? '', batchName: batch.name ?? '', batchType: batch.batchType ?? 'Induction', capacity: String(batch.registrationCapacity ?? batch.participantCapacity ?? batch.capacity ?? 30), trainingMode, startDate: batch.trainingStartDate ?? '', duration: String(batch.trainingDuration ?? 3), durationUnit: batch.trainingDurationUnit ?? 'Training Days', weeklyOffDays, state: batch.state ?? school?.state ?? '', startTime: batch.trainingStartTime ?? '09:30', endTime: batch.trainingEndTime ?? '15:30', district: batch.district ?? school?.district ?? '', block: batch.block ?? school?.block ?? '', venueName: batch.location ?? school?.school ?? '', venueUdise: batch.schoolUdiseVenue ?? '', pinCode: batch.pinCode ?? '', onlinePlatform: batch.onlinePlatform ?? 'Microsoft Teams', meetingUrl: batch.meetingUrl ?? '', meetingId: batch.meetingId ?? '', meetingPassword: batch.meetingPassword ?? '', trainerCode: batch.trainerCode ?? '', traineeCount: String(batch.expectedTraineeCount ?? registeredTrainees(batch)), openRegistration: batch.openRegistration ?? false });
    setManualBatchOpen(true);
  }
  function openViewWizard(batch: Batch) {
    openEditWizard(batch);
    setManualViewingBatch(true);
    setManualStep(0);
  }
  async function downloadTemplate() {
    const blob = await makeTemplate(); downloadBlob(blob, 'training-batch-upload-template.xlsx');
  }
  function downloadErrors() {
    const failed = validation.filter(row => row.errors.length || row.warnings.length);
    downloadCsv('training-batch-upload-errors.csv', [['Row_Number', 'Batch_UniqueID', 'Errors', 'Warnings'], ...failed.map(row => [String(row.rowNumber), row.values.Batch_UniqueID, row.errors.join(' | '), row.warnings.join(' | ')])]);
  }
  function importValidRows() {
    const selected = rowsForImport;
    const next = [...selected.map(row => row.batch!), ...batches];
    localStorage.setItem(BATCHES_KEY, JSON.stringify(next)); setBatches(next);
    const audit = readList<Record<string, unknown>>(AUDIT_KEY);
    audit.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: session?.userId ?? '', action: 'Batch spreadsheet import', detail: `${fileName}: imported ${selected.length} batch row(s).` });
    localStorage.setItem(AUDIT_KEY, JSON.stringify(audit.slice(0, 100)));
    setMessage(`Imported ${selected.length} row(s). ${validation.filter(row => row.errors.length).length} invalid row(s) were excluded${selected.length < validation.filter(row => row.batch).length ? '; all-or-nothing project policy excluded other rows for affected projects' : ''}.`);
    setValidation([]); setFileName(''); setConfirmImport(false);
  }
  function saveEditedBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editBatch) return;
    const start = editBatch.trainingStartDate ?? ''; const days = editBatch.trainingDuration ?? 0; const startTime = editBatch.trainingStartTime ?? ''; const endTime = editBatch.trainingEndTime ?? '';
    const dates = editBatch.trainingDurationUnit === 'Calendar Days' ? manualScheduleDays(start, days, holidays, editBatch.state ?? '', 'Calendar Days', 'None') : scheduleDays(start, days, holidays, editBatch.state ?? '', editBatch.weeklyOffDays ?? [0, 6]); const end = dates.at(-1) ?? '';
    if (!start || !end || days <= 0 || startTime >= endTime) { setEditError('Enter a valid start date, positive duration, and end time later than start time.'); return; }
    if (dates[0] !== start) { setEditError(`The start date is not a training day. Choose an available weekday such as ${dates[0] ?? 'a later date'}.`); return; }
    const editTrainerProfile = trainerDirectory.find(item => item.userId?.toLowerCase() === (editBatch.trainerCode ?? '').toLowerCase());
    if (!editTrainerProfile?.active || !trainers.some(item => item.userId.toLowerCase() === (editBatch.trainerCode ?? '').toLowerCase())) { setEditError('The assigned trainer is inactive, unlinked, or no longer eligible.'); return; }
    const availabilityCheck = trainerAvailabilityConflict(editTrainerProfile.userId || editTrainerProfile.trainerCode, dates, startTime, endTime);
    if (availabilityCheck.conflicts.length) { setEditError(`Trainer availability conflict: ${availabilityCheck.conflicts.join('; ')}.`); return; }
    const projectRules = projects.find(item => item.id === editBatch.projectId) as (Project & Record<string, unknown>) | undefined;
    const permittedTrainers = Array.isArray(projectRules?.eligibleTrainerCodes) ? projectRules.eligibleTrainerCodes : Array.isArray(projectRules?.eligibleTrainerIds) ? projectRules.eligibleTrainerIds : Array.isArray(projectRules?.eligibleTrainers) ? projectRules.eligibleTrainers : [];
    if (permittedTrainers.length && !permittedTrainers.some(value => String(value).toLowerCase() === editTrainerProfile.trainerCode.toLowerCase() || String(value).toLowerCase() === editTrainerProfile.userId?.toLowerCase())) { setEditError('The assigned trainer is not eligible for this project.'); return; }
    const requiredCompetencies = Array.isArray(projectRules?.requiredTrainerCompetencies) ? projectRules.requiredTrainerCompetencies : [];
    if (requiredCompetencies.some(value => !editTrainerProfile.competencies.some(competency => competency.toLowerCase() === String(value).toLowerCase()))) { setEditError('The assigned trainer does not meet the project competency requirements.'); return; }
    const activeRegistrations = readList<Record<string, unknown>>(REGISTRATIONS_KEY).filter(row => String(row.batchId ?? '') === editBatch.id && !['rejected', 'cancelled', 'withdrawn'].includes(String(row.status ?? '').toLowerCase())).length;
    if (editBatch.registrationCapacity !== undefined && (!Number.isInteger(editBatch.registrationCapacity) || editBatch.registrationCapacity < 1)) { setEditError('Registration capacity must be a positive whole number, or leave it blank for no limit.'); return; }
    if (editBatch.registrationCapacity !== undefined && editBatch.registrationCapacity < activeRegistrations) { setEditError(`Capacity cannot be lower than the ${activeRegistrations} existing active registrations.`); return; }
    const project = projects.find(item => item.id === editBatch.projectId);
    if (project && (start < project.startDate || end > project.endDate)) { setEditError('The calculated training dates must remain within the project period.'); return; }
    const conflict = batches.find(item => item.id !== editBatch.id && item.status !== 'Cancelled' && item.status !== 'Archived' && item.trainerCode?.toLowerCase() === editBatch.trainerCode?.toLowerCase() && (item.trainingDates ?? []).some(date => dates.includes(date)) && timesOverlap(startTime, endTime, item.trainingStartTime ?? '', item.trainingEndTime ?? ''));
    if (conflict) { setEditError(`Trainer booking conflicts with ${conflict.batchCode}.`); return; }
    const updatedBatch = { ...editBatch, trainerProfileCode: editTrainerProfile.trainerCode, trainerName: editTrainerProfile.name, trainingDates: dates, trainingEndAuto: end };
    const next = batches.map(item => item.id === editBatch.id ? updatedBatch : item); localStorage.setItem(BATCHES_KEY, JSON.stringify(next)); setBatches(next); setEditBatch(null); setEditError('');
  }
  function cancelBatch(batch: Batch) {
    const next = batches.map(item => item.id === batch.id ? { ...item, status: 'Cancelled' as const } : item); localStorage.setItem(BATCHES_KEY, JSON.stringify(next)); setBatches(next);
    const audit = readList<Record<string, unknown>>(AUDIT_KEY); audit.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: session?.userId ?? '', action: 'Batch cancelled', detail: batch.batchCode }); localStorage.setItem(AUDIT_KEY, JSON.stringify(audit.slice(0, 100)));
  }
  function deleteBatch(batch: Batch) {
    if (readDependentRecords(batch)) { setMessage(`${batch.batchCode} has dependent registration, attendance, or assessment records; cancel it to preserve history.`); return; }
    const next = batches.filter(item => item.id !== batch.id); localStorage.setItem(BATCHES_KEY, JSON.stringify(next)); setBatches(next);
  }

  const invalidCount = validation.filter(row => row.errors.length).length;
  const warningCount = validation.filter(row => !row.errors.length && row.warnings.length).length;
  const validCount = validation.filter(row => !row.errors.length && !row.warnings.length).length;
  const invalidProjectIds = new Set(validation.filter(row => row.errors.length).map(row => projects.find(project => project.code.toLowerCase() === row.values.Project_Code.trim().toLowerCase() && project.batchImportPolicy === 'all-or-nothing')?.id).filter((id): id is string => Boolean(id)));
  const rowsForImport = validation.filter(row => row.batch && !invalidProjectIds.has(row.batch.projectId));
  const districtOptions = filter.state ? [...new Set(kgbvSchools.filter(school => school.state === filter.state).map(school => school.district))].sort((a, b) => a.localeCompare(b)) : [];
  const schoolOptions = filter.state && filter.district ? kgbvSchools.filter(school => school.state === filter.state && school.district === filter.district) : [];
  const visibleBatches = batches.filter(batch => authorizedProjects.some(project => project.id === batch.projectId)).map(batch => {
    const project = projects.find(item => item.id === batch.projectId); const association = associations.find(item => item.id === batch.projectPlanAssociationId); const plan = plans.find(item => item.id === association?.trainingPlanId);
    return { ...batch, projectName: project?.name ?? 'Unavailable project', planName: plan?.name ?? 'Unavailable plan', hasDependents: readDependentRecords(batch), attendanceSummary: calculateAttendance([batch], registrations, attendanceRecords, attendanceExclusions) };
  }).filter(batch => {
    const q = filter.query.trim().toLowerCase();
    return (!q || `${batch.batchCode} ${batch.uniqueId ?? ''} ${(batch.legacyBatchCodes ?? []).join(' ')} ${batch.name}`.toLowerCase().includes(q)) && (!filter.project || batch.projectId === filter.project) && (!filter.phase || batch.phaseId === filter.phase) && (!filter.state || batch.state === filter.state) && (!filter.district || batch.district === filter.district) && (!filter.school || batch.schoolUdiseVenue === filter.school) && (!filter.plan || batch.trainingPlanCode === filter.plan) && (!filter.trainer || batch.trainerCode === filter.trainer) && (!filter.from || (batch.trainingStartDate ?? '') >= filter.from) && (!filter.to || (batch.trainingStartDate ?? '') <= filter.to) && (!filter.status || (batch.status ?? 'Scheduled') === filter.status);
  });
  const setFilterValue = (key: keyof typeof filter, value: string) => { setPage(0); setFilter(current => ({ ...current, [key]: value, ...(key === 'state' ? { district: '', school: '' } : {}), ...(key === 'district' ? { school: '' } : {}) })); };
  const clearFilters = () => { setPage(0); setFilter({ query: '', project: '', phase: '', state: '', district: '', school: '', plan: '', trainer: '', from: '', to: '', status: '' }); };
  const filterFields: FilterSpec[] = [
    { key: 'query', label: 'Batch ID', type: 'search', placeholder: 'Search batch ID' },
    { key: 'project', label: 'Project', type: 'select', placeholder: 'All projects', options: authorizedProjects.map(project => ({ label: project.name, value: project.id })) },
    { key: 'phase', label: 'Phase', type: 'select', placeholder: 'All phases', options: authorizedProjects.flatMap(project => (project.phases ?? []).map(phase => ({ label: `${project.name}: ${phase.name}`, value: phase.id }))) },
    { key: 'state', label: 'State', type: 'select', placeholder: 'All states', options: locations.map(item => ({ label: item.name, value: item.name })) },
    { key: 'district', label: 'District', type: 'select', placeholder: filter.state ? 'All districts' : 'Select a state first', disabled: !filter.state, options: districtOptions.map(value => ({ label: value, value })) },
    { key: 'school', label: 'School / UDISE', type: 'select', placeholder: filter.district ? 'All schools' : 'Select a district first', disabled: !filter.district, options: schoolOptions.map(item => ({ label: `${item.school} · ${item.udise}`, value: item.udise })) },
    { key: 'plan', label: 'Training Plan', type: 'select', placeholder: 'All training plans', options: plans.map(item => ({ label: item.name, value: item.code })) },
    { key: 'trainer', label: 'Trainer Name', type: 'select', placeholder: 'All trainers', options: trainers.map(item => ({ label: `${trainerDirectory.find(profile => profile.userId?.toLowerCase() === item.userId.toLowerCase())?.name ?? item.userId}`, value: item.userId })) },
    { key: 'from', label: 'From Start Date', type: 'date' }, { key: 'to', label: 'To Start Date', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', placeholder: 'All statuses', options: (['Scheduled', 'Ongoing', 'Completed', 'Cancelled', 'Archived'] as BatchStatus[]).map(value => ({ label: value, value })) },
  ];
  const pageBatches = visibleBatches.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const registeredTrainees = (batch: Batch) => registrations.filter(record => batchMatchesRecord(batch, record) && !['cancelled', 'withdrawn', 'rejected'].includes(String(record.status ?? record.registrationStatus ?? '').toLowerCase())).length;
  const exportBatchRegister = async () => {
    setExporting(true);
    try {
      const rows = visibleBatches.map(batch => {
        const capacity = batch.registrationCapacity ?? batch.participantCapacity ?? batch.capacity;
        const phase = authorizedProjects.flatMap(project => project.phases ?? []).find(item => item.id === batch.phaseId)?.name ?? '';
        return [batch.batchCode, batch.name, batch.projectName, phase, batch.planName, batch.location ?? batch.name, batch.schoolUdiseVenue ?? '', batch.deliveryMode ?? '', batch.trainingStartDate ?? '', batch.trainingEndAuto ?? '', batch.trainingDuration ?? '', batch.trainerName ?? batch.trainerCode ?? '', registeredTrainees(batch), capacity ?? '', batch.status ?? 'Scheduled'];
      });
      await downloadExcelWorkbook(`batch-register-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Batch Register', ['Batch ID', 'Batch Name', 'Project', 'Phase', 'Training Plan', 'Venue', 'Venue UDISE', 'Training Mode', 'Start Date', 'End Date', 'Training Duration', 'Trainer', 'Registered Trainees', 'Batch Capacity', 'Status'], rows);
    } finally { setExporting(false); }
  };
  const draftDates = manualDraft.startDate && Number(manualDraft.duration) > 0 ? manualScheduleDays(manualDraft.startDate, Number(manualDraft.duration), holidays, manualDraft.state, manualDraft.durationUnit, manualDraft.weeklyOffDays) : [];
  const draftEndDate = draftDates.at(-1) ?? '';
    const draftDistricts = locations.find(item => item.name === manualDraft.state)?.districts ?? [];
  const draftDistrictSchools = kgbvSchools.filter(item => item.state === manualDraft.state && item.district === manualDraft.district);
  const draftBlocks = [...new Set(draftDistrictSchools.map(item => item.block))].sort((a, b) => a.localeCompare(b));
  const draftVenues = draftDistrictSchools.filter(item => item.block === manualDraft.block);
  const activeHolidayCount = holidays.filter(item => item.active !== false && (item.scope === 'National' || item.state === manualDraft.state)).length;

  return <div className="app"><Sidebar activePage="Batches" /><main className="main"><Topbar title="Batches" />
    <Box sx={{ width: '100%', maxWidth: 1600, mx: 'auto', pb: 3 }}><Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="flex-end" spacing={1}>
        {canImport && <><Button variant="contained" onClick={openManualWizard} sx={{ textTransform: 'none' }}>+ Add Batch</Button><Button variant="outlined" onClick={() => setUploadPanelOpen(open => !open)} startIcon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>} sx={{ textTransform: 'none' }}>Upload Batch (Excel)</Button></>}
      </Stack>
      <Box className="kpis schoolnet-kpis" sx={{ gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }, gap: 1.25, mt: 0 }}>
        {[
          { label: 'Total Batches', count: visibleBatches.length, detail: 'Batches in current view', color: '#176fba' },
          { label: 'Scheduled', count: visibleBatches.filter(batch => (batch.status ?? 'Scheduled') === 'Scheduled').length, detail: 'Scheduled batches', color: '#176fba' },
          { label: 'Registration Open', count: visibleBatches.filter(batch => batch.openRegistration === true).length, detail: 'Open for registration', color: '#18804b' },
          { label: 'Ongoing', count: visibleBatches.filter(batch => batch.status === 'Ongoing').length, detail: 'Currently in progress', color: '#d65313' },
          { label: 'Completed', count: visibleBatches.filter(batch => batch.status === 'Completed').length, detail: 'Completed batches', color: '#18804b' },
        ].map(card => <Box key={card.label} component="article" className="kpi schoolnet-kpi" sx={{ '& .kpi-value': { color: card.color } }}><div className="kpi-top"><span className="kpi-label">{card.label}</span><button className="info-button schoolnet-kpi-info" type="button" aria-label={`Details for ${card.label}: ${card.detail}`} data-tooltip={card.detail}>i</button></div><div className="kpi-value">{card.count.toLocaleString()}</div><div className="kpi-sub">{card.detail}</div></Box>)}
      </Box>
      {uploadPanelOpen && !sponsorAdmin && <>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #e3ebf3', borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1.5}>
          <Typography variant="h6" sx={{ fontWeight: 750 }}>Upload Batch (Excel)</Typography>
          <Stack direction="row" spacing={1}><Button variant="outlined" onClick={downloadTemplate} sx={{ textTransform: 'none', flexShrink: 0 }}>Download Excel template</Button><Button onClick={() => setUploadPanelOpen(false)} sx={{ textTransform: 'none' }}>Close</Button></Stack>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mt: 2 }}><TextField select required label="Project" value={uploadProjectId} onChange={event => { setUploadProjectId(event.target.value); setUploadPhaseId(''); setValidation([]); setFileName(''); }}><MenuItem value="">Select project</MenuItem>{authorizedProjects.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField><TextField select required label="Select Phase" value={uploadPhaseId} disabled={!uploadProjectId} onChange={event => { setUploadPhaseId(event.target.value); setValidation([]); setFileName(''); }}><MenuItem value="">Select phase</MenuItem>{(authorizedProjects.find(item => item.id === uploadProjectId)?.phases ?? []).map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField></Box>
        <Box sx={{ mt: 1.5, p: 1.5, border: '1px dashed #b9cce0', borderRadius: 2, bgcolor: '#f8fbff' }}><Button component="label" variant="contained" disabled={!canImport || !uploadProjectId || !uploadPhaseId} sx={{ textTransform: 'none' }}>Choose .xlsx file<input hidden type="file" accept=".xlsx" onChange={uploadFile} /></Button><Typography component="span" variant="body2" sx={{ ml: 1.5, color: '#71839a' }}>{fileName || 'Select a project and phase before uploading the template.'}</Typography></Box>
        {message && <Alert severity={message.startsWith('Imported') ? 'success' : 'error'} sx={{ mt: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
      </Paper>

      {validation.length > 0 && <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #e3ebf3', borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={1.5}>
          <Box><Typography variant="h6" sx={{ fontWeight: 750 }}>Upload validation</Typography><Typography variant="body2" color="text.secondary">{validation.length} rows submitted · {validCount} valid · {invalidCount} invalid · {warningCount} warning</Typography></Box>
          <Stack direction="row" spacing={1}><Button variant="outlined" onClick={downloadErrors} disabled={!validation.some(row => row.errors.length || row.warnings.length)} sx={{ textTransform: 'none' }}>Download error report</Button><Button variant="contained" onClick={() => setConfirmImport(true)} disabled={rowsForImport.length === 0 || !canImport} sx={{ textTransform: 'none' }}>Review import ({rowsForImport.length})</Button></Stack>
        </Stack>
        {projects.some(project => project.batchImportPolicy === 'all-or-nothing') && <Alert severity="info" sx={{ mt: 1.5 }}>Projects configured for all-or-nothing imports will have all their rows held if any row for that project is invalid.</Alert>}
        <Box sx={{ mt: 2, overflowX: 'auto' }}><Box component="table" sx={{ minWidth: 900, width: '100%', borderCollapse: 'collapse', '& th': { textAlign: 'left', p: 1, bgcolor: '#f6f9fc', color: '#61778e', fontSize: 12 }, '& td': { p: 1, borderTop: '1px solid #edf1f5', verticalAlign: 'top', fontSize: 12 } }}><thead><tr><th>Row</th><th>Batch Code / Import ID</th><th>Project / Plan</th><th>Training dates</th><th>Result</th><th>Validation details</th></tr></thead><tbody>{validation.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td><strong>{row.batch?.batchCode ?? '—'}</strong><br />Import ID: {row.values.Batch_UniqueID}</td><td>{row.values.Project_Code} / {row.values.Training_Plan_Code}</td><td>{formatDate(row.values.Training_Start_Date)}{row.batch?.trainingEndAuto ? ` → ${formatDate(row.batch.trainingEndAuto)}` : ''}</td><td><Chip size="small" label={row.errors.length ? 'Invalid' : row.warnings.length ? 'Warning' : 'Valid'} color={row.errors.length ? 'error' : row.warnings.length ? 'warning' : 'success'} /></td><td>{[...row.errors, ...row.warnings].map((text, index) => <Typography key={index} variant="caption" display="block" color={row.errors.length ? 'error.main' : 'warning.dark'}>{text}</Typography>)}</td></tr>)}</tbody></Box></Box>
      </Paper>}
      </>}

      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #e3ebf3', borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}><Box><Typography variant="h6" sx={{ fontWeight: 750 }}>Batch register</Typography><Typography variant="caption" color="text.secondary">{visibleBatches.length.toLocaleString()} matching batches</Typography></Box><Stack direction="row" spacing={1} alignItems="center"><Button variant="outlined" onClick={exportBatchRegister} disabled={exporting || !visibleBatches.length} sx={{ textTransform: 'none' }}>{exporting ? 'Exporting…' : 'Export Excel / CSV'}</Button><button type="button" className="filter-trigger" aria-expanded={Boolean(filterAnchor)} onClick={event => setFilterAnchor(event.currentTarget)}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="8" cy="6" r="2" fill="white" stroke="currentColor" strokeWidth="1.8"/><circle cx="15" cy="12" r="2" fill="white" stroke="currentColor" strokeWidth="1.8"/></svg>Filters{Object.values(filter).filter(Boolean).length > 0 && <span className="filter-count visible">{Object.values(filter).filter(Boolean).length}</span>}</button></Stack></Stack>
<Popover disablePortal open={Boolean(filterAnchor)} anchorEl={filterAnchor} onClose={() => setFilterAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}><Box className="report-app"><Box className="dashboard-filter-popup" sx={{ width: { xs: 'calc(100vw - 24px)', sm: 980 }, maxWidth: 'calc(100vw - 24px)', p: 1 }}><ReportFilterPanel fields={filterFields} values={filter} onChange={(key, value) => setFilterValue(key as keyof typeof filter, value)} onClear={clearFilters} onClose={() => setFilterAnchor(null)} dashboardStyle /></Box></Box></Popover>{visibleBatches.length === 0 ? <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No batches match the current filters.</Typography> : <><TableContainer sx={{ maxHeight: 600, border: '1px solid #e3ebf3', borderRadius: 1 }}><Table stickyHeader size="small" sx={{ minWidth: 1500 }}><TableHead><TableRow>{['Batch / ID', 'Project / Phase', 'Training Plan', 'Venue / Mode', 'Schedule', 'Trainer', 'Trainees', 'Status', 'Actions'].map(label => <TableCell key={label} sx={{ bgcolor: '#f3f7fb', color: '#385875', fontWeight: 750, whiteSpace: 'nowrap' }}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{pageBatches.map(batch => { const status = batch.status ?? 'Scheduled'; const statusColor = status === 'Completed' ? 'success' : status === 'Ongoing' ? 'warning' : status === 'Cancelled' || status === 'Archived' ? 'default' : 'info'; const capacity = batch.registrationCapacity ?? batch.participantCapacity ?? batch.capacity; const phase = authorizedProjects.flatMap(project => project.phases ?? []).find(item => item.id === batch.phaseId)?.name; return <TableRow key={batch.id} hover><TableCell sx={{ minWidth: 165 }}><Button size="small" onClick={() => openViewWizard(batch)} sx={{ p: 0, minWidth: 0, justifyContent: 'flex-start', textTransform: 'none', fontWeight: 750 }}>{batch.batchCode}</Button><Typography variant="caption" display="block" color="text.secondary">{batch.name}</Typography></TableCell><TableCell sx={{ minWidth: 170 }}>{batch.projectName}<Typography variant="caption" display="block" color="text.secondary">{phase ?? '—'}</Typography></TableCell><TableCell sx={{ minWidth: 150 }}>{batch.planName}</TableCell><TableCell sx={{ minWidth: 165 }}>{batch.location ?? batch.name}<Typography variant="caption" display="block" color="text.secondary">{batch.schoolUdiseVenue ? `UDISE ${batch.schoolUdiseVenue} · ` : ''}{batch.deliveryMode ?? '—'}</Typography></TableCell><TableCell sx={{ minWidth: 160, whiteSpace: 'nowrap' }}>{formatDate(batch.trainingStartDate) || '—'}<Typography variant="caption" display="block" color="text.secondary">to {formatDate(batch.trainingEndAuto) || '—'} · {batch.trainingDuration ?? '—'} days</Typography></TableCell><TableCell sx={{ minWidth: 140 }}>{batch.trainerName ?? '—'}<Typography variant="caption" display="block" color="text.secondary">{batch.trainerCode ?? ''}</Typography></TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{registeredTrainees(batch)} / {capacity ?? '—'}</TableCell><TableCell><Chip size="small" color={statusColor} label={status} /></TableCell><TableCell sx={{ minWidth: 190 }}><Stack direction="row" spacing={.25} alignItems="center"><Button size="small" onClick={() => openViewWizard(batch)} sx={{ textTransform: 'none' }}>View</Button><Button size="small" disabled={!canImport || status === 'Cancelled' || status === 'Completed'} onClick={() => openEditWizard(batch)} sx={{ textTransform: 'none' }}>Edit</Button>{status !== 'Cancelled' && <Button size="small" onClick={() => cancelBatch(batch)} disabled={!canImport} sx={{ textTransform: 'none' }}>Cancel</Button>}{status !== 'Cancelled' && <Button size="small" color="error" onClick={() => deleteBatch(batch)} disabled={!canImport || batch.hasDependents} sx={{ textTransform: 'none' }}>Delete</Button>}</Stack></TableCell></TableRow>; })}</TableBody></Table></TableContainer><TablePagination component="div" count={visibleBatches.length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={event => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} /></>}</Paper>
    </Stack></Box><Footer /></main>

    <Dialog open={confirmImport} onClose={() => setConfirmImport(false)} maxWidth="sm" fullWidth><DialogTitle>Confirm batch import</DialogTitle><DialogContent><Typography>Import {rowsForImport.length} batch row(s) from {fileName}? Invalid rows will be excluded. Warning rows will be imported with their warnings recorded.</Typography>{invalidProjectIds.size > 0 && <Typography sx={{ mt: 1 }} variant="body2" color="text.secondary">All-or-nothing policy holds every row for {invalidProjectIds.size} project(s) with validation errors.</Typography>}</DialogContent><DialogActions><Button onClick={() => setConfirmImport(false)}>Back</Button><Button variant="contained" onClick={importValidRows}>Import valid rows</Button></DialogActions></Dialog>
    <Dialog open={Boolean(editBatch)} onClose={() => setEditBatch(null)} maxWidth="sm" fullWidth><Box component="form" onSubmit={saveEditedBatch}><DialogTitle>Edit batch schedule</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{editBatch && <><TextField type="date" label="Training start date" InputLabelProps={{ shrink: true }} value={editBatch.trainingStartDate ?? ''} onChange={event => setEditBatch({ ...editBatch, trainingStartDate: event.target.value })} /><TextField type="number" label="Training duration (days)" inputProps={{ min: 1, max: 365 }} value={editBatch.trainingDuration ?? 1} onChange={event => setEditBatch({ ...editBatch, trainingDuration: Number(event.target.value) })} /><TextField type="number" label="Registration capacity (blank = no limit)" inputProps={{ min: 1, step: 1 }} value={editBatch.registrationCapacity ?? ''} onChange={event => setEditBatch({ ...editBatch, registrationCapacity: event.target.value === '' ? undefined : Number(event.target.value) })} /><TextField select label="Open registration" value={editBatch.openRegistration ? 'yes' : 'no'} onChange={event => setEditBatch({ ...editBatch, openRegistration: event.target.value === 'yes' })}><MenuItem value="yes">Open</MenuItem><MenuItem value="no">Closed</MenuItem></TextField><TextField select label="Trainer" value={editBatch.trainerCode ?? ''} onChange={event => setEditBatch({ ...editBatch, trainerCode: event.target.value })}>{trainers.map(item => <MenuItem key={item.userId} value={item.userId}>{trainerDirectory.find(profile => profile.userId?.toLowerCase() === item.userId.toLowerCase())?.trainerCode} · {trainerDirectory.find(profile => profile.userId?.toLowerCase() === item.userId.toLowerCase())?.name}</MenuItem>)}</TextField><TextField type="time" label="Start time" InputLabelProps={{ shrink: true }} value={editBatch.trainingStartTime ?? ''} onChange={event => setEditBatch({ ...editBatch, trainingStartTime: event.target.value })} /><TextField type="time" label="End time" InputLabelProps={{ shrink: true }} value={editBatch.trainingEndTime ?? ''} onChange={event => setEditBatch({ ...editBatch, trainingEndTime: event.target.value })} />{editError && <Alert severity="error">{editError}</Alert>}</>}</Stack></DialogContent><DialogActions><Button type="button" onClick={() => setEditBatch(null)}>Cancel</Button><Button type="submit" variant="contained">Save schedule</Button></DialogActions></Box></Dialog>
    <Dialog open={Boolean(viewBatch)} onClose={() => setViewBatch(null)} maxWidth="sm" fullWidth><DialogTitle>Batch details · {viewBatch?.batchCode}</DialogTitle><DialogContent><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, pt: 1 }}>{[{ label: 'Batch name', value: viewBatch?.name }, { label: 'Project', value: projects.find(item => item.id === viewBatch?.projectId)?.name }, { label: 'Phase', value: authorizedProjects.flatMap(project => project.phases ?? []).find(item => item.id === viewBatch?.phaseId)?.name }, { label: 'Training plan', value: plans.find(item => item.code === viewBatch?.trainingPlanCode)?.name }, { label: 'Venue', value: viewBatch?.location ?? viewBatch?.name }, { label: 'Training mode', value: viewBatch?.deliveryMode }, { label: 'Schedule', value: `${formatDate(viewBatch?.trainingStartDate) || '—'} to ${formatDate(viewBatch?.trainingEndAuto) || '—'} (${viewBatch?.trainingDuration ?? '—'} days)` }, { label: 'Trainer', value: viewBatch?.trainerName ?? viewBatch?.trainerCode }, { label: 'Trainees / Capacity', value: `${viewBatch ? registeredTrainees(viewBatch) : 0} / ${viewBatch?.registrationCapacity ?? viewBatch?.participantCapacity ?? viewBatch?.capacity ?? '—'}` }, { label: 'Status', value: viewBatch?.status ?? 'Scheduled' }].map(item => <Box key={item.label}><Typography variant="caption" color="text.secondary">{item.label}</Typography><Typography variant="body2" fontWeight={650}>{item.value || '—'}</Typography></Box>)}</Box></DialogContent><DialogActions><Button onClick={() => setViewBatch(null)}>Close</Button><Button variant="contained" disabled={!canImport || viewBatch?.status === 'Cancelled' || viewBatch?.status === 'Completed'} onClick={() => { if (viewBatch) openEditWizard(viewBatch); setViewBatch(null); }}>Edit</Button></DialogActions></Dialog>
    <Dialog open={manualBatchOpen} onClose={() => { setManualBatchOpen(false); setManualEditingBatch(null); setManualViewingBatch(false); }} maxWidth="xl" fullWidth PaperProps={{ sx: { width: '96vw', maxWidth: 'none', borderRadius: 2 } }}>
      <DialogTitle sx={{ pb: 1 }}>{manualViewingBatch ? `Batch Details · ${manualEditingBatch?.batchCode ?? ''}` : manualEditingBatch ? 'Edit Batch' : 'Create Batch'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', px: { xs: 2, md: 3 }, pb: 1 }}>
        <Box className="batch-wizard-progress" sx={{ width: '100%', flex: '0 0 100%', height: 'auto', minHeight: 0, mb: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', alignItems: 'end', mb: 1.1 }}>
              {['Project & Plan', 'Schedule', 'Venue', 'Trainer Details', 'Review'].map((label, index) => <Button key={label} size="small" aria-current={index === manualStep ? 'step' : undefined} onClick={() => { if (manualViewingBatch || index < manualStep) { setManualStep(index); setManualError(''); } }} sx={{ minWidth: 0, px: { xs: .25, sm: .75 }, py: .75, color: index < manualStep ? '#18804b' : index === manualStep ? '#174a78' : '#71839a', fontSize: { xs: 10, sm: 12 }, fontWeight: index === manualStep ? 800 : 650, textTransform: 'none', lineHeight: 1.25, whiteSpace: { xs: 'normal', sm: 'nowrap' }, cursor: manualViewingBatch || index < manualStep ? 'pointer' : 'default', '&:hover': { bgcolor: 'transparent', color: index <= manualStep || manualViewingBatch ? '#176fba' : '#71839a' } }}>{index + 1}. {label}</Button>)}
            </Box>
            <Box role="progressbar" aria-label="Batch creation progress" aria-valuemin={1} aria-valuemax={5} aria-valuenow={manualStep + 1} sx={{ height: 8, bgcolor: '#e7edf3', borderRadius: 99, overflow: 'hidden' }}><Box sx={{ height: '100%', width: `${((manualStep + 1) / 5) * 100}%`, bgcolor: '#3b91d1', borderRadius: 99, transition: 'width .25s ease' }} /></Box>
        </Box>
        <Box component="fieldset" disabled={manualViewingBatch} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        {manualStep === 0 && <><Typography variant="h6" sx={{ mb: 1.5 }}>Project and Training Information</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: 1.5 }}>
          <TextField select required label="Project" value={manualDraft.projectId} onChange={event => setManualDraft({ ...manualDraft, projectId: event.target.value, phaseId: '', planCode: '' })}><MenuItem value="">Select project</MenuItem>{authorizedProjects.filter(item => item.status === 'Active').map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
          <TextField select required label="Project Phase" value={manualDraft.phaseId} disabled={!manualDraft.projectId} onChange={event => setManualDraft({ ...manualDraft, phaseId: event.target.value })}><MenuItem value="">Select phase</MenuItem>{(authorizedProjects.find(item => item.id === manualDraft.projectId)?.phases ?? []).map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
          <TextField select required label="Training Plan" value={manualDraft.planCode} disabled={!manualDraft.projectId} onChange={event => setManualDraft({ ...manualDraft, planCode: event.target.value })}><MenuItem value="">Select training plan</MenuItem>{plans.filter(plan => plan.status === 'Active' && associations.some(item => item.projectId === manualDraft.projectId && item.trainingPlanId === plan.id && item.status === 'Active')).map(item => <MenuItem key={item.id} value={item.code}>{item.name}</MenuItem>)}</TextField>
          <TextField required label="Batch Code" placeholder="Enter batch code" value={manualDraft.batchName} onChange={event => setManualDraft({ ...manualDraft, batchName: event.target.value })} />
          <TextField select label="Batch Type" value={manualDraft.batchType} onChange={event => setManualDraft({ ...manualDraft, batchType: event.target.value })}>{['Induction', 'Refresher', 'Capacity Building', 'Other'].map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
          <TextField required type="number" label="Batch Capacity" inputProps={{ min: 1 }} value={manualDraft.capacity} onChange={event => setManualDraft({ ...manualDraft, capacity: event.target.value })} />
          <TextField select required label="Training Mode" value={manualDraft.trainingMode} onChange={event => setManualDraft({ ...manualDraft, trainingMode: event.target.value as ManualBatchDraft['trainingMode'] })}><MenuItem value="Physical">Physical</MenuItem><MenuItem value="Online">Online</MenuItem><MenuItem value="Hybrid">Hybrid</MenuItem></TextField>
        </Box><Alert severity="info" sx={{ mt: 1.5 }}>Phase and training plan selections are linked to the selected project. Only active projects are available for new batches.</Alert></>}
        {manualStep === 1 && <><Typography variant="h6" sx={{ mb: 1.5 }}>Training Schedule</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: 1.5 }}>
          <TextField required type="date" label="Batch Start Date" InputLabelProps={{ shrink: true }} value={manualDraft.startDate} onChange={event => setManualDraft({ ...manualDraft, startDate: event.target.value })} />
          <TextField required type="number" label="Training Duration" inputProps={{ min: 1, max: 365 }} value={manualDraft.duration} onChange={event => setManualDraft({ ...manualDraft, duration: event.target.value })} />
          <TextField select label="Duration Unit" value={manualDraft.durationUnit} onChange={event => setManualDraft({ ...manualDraft, durationUnit: event.target.value as ManualBatchDraft['durationUnit'] })}><MenuItem value="Training Days">Training Days</MenuItem><MenuItem value="Calendar Days">Calendar Days</MenuItem></TextField>
          <TextField select required label="State holiday calendar" value={manualDraft.state} onChange={event => setManualDraft({ ...manualDraft, state: event.target.value, district: '' })}><MenuItem value="">Select state</MenuItem>{locations.map(item => <MenuItem key={item.name} value={item.name}>{item.name}</MenuItem>)}</TextField>
          <TextField select label="Weekly off days" value={manualDraft.weeklyOffDays} onChange={event => setManualDraft({ ...manualDraft, weeklyOffDays: event.target.value as ManualBatchDraft['weeklyOffDays'] })}><MenuItem value="Saturday & Sunday">Saturday & Sunday</MenuItem><MenuItem value="Sunday">Sunday</MenuItem><MenuItem value="None">None</MenuItem></TextField>
          <TextField label="Calculated End Date" value={draftEndDate ? formatDate(draftEndDate) : ''} InputProps={{ readOnly: true }} />
          <TextField required type="time" label="Daily Start Time" InputLabelProps={{ shrink: true }} value={manualDraft.startTime} onChange={event => setManualDraft({ ...manualDraft, startTime: event.target.value })} />
          <TextField required type="time" label="Daily End Time" InputLabelProps={{ shrink: true }} value={manualDraft.endTime} onChange={event => setManualDraft({ ...manualDraft, endTime: event.target.value })} />
        </Box><Alert severity="info" sx={{ mt: 1.5 }}>{draftEndDate ? `Calculated end date: ${formatDate(draftEndDate)}. ` : ''}{activeHolidayCount} active holiday record(s) are configured for {manualDraft.state || 'the selected state'}. Weekly off days are excluded for Training Days.</Alert></>}
        {manualStep === 2 && <><Typography variant="h6" sx={{ mb: 1.5 }}>Venue / Training Location</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: 1.5 }}>
          <TextField select label="Training Mode" value={manualDraft.trainingMode} onChange={event => setManualDraft({ ...manualDraft, trainingMode: event.target.value as ManualBatchDraft['trainingMode'] })}><MenuItem value="Physical">Physical</MenuItem><MenuItem value="Online">Online</MenuItem><MenuItem value="Hybrid">Hybrid</MenuItem></TextField>
          {manualDraft.trainingMode !== 'Online' && <><TextField select required label="State" value={manualDraft.state} onChange={event => setManualDraft({ ...manualDraft, state: event.target.value, district: '', block: '', venueName: '', venueUdise: '', pinCode: '' })}><MenuItem value="">Select state</MenuItem>{locations.map(item => <MenuItem key={item.name} value={item.name}>{item.name}</MenuItem>)}</TextField><TextField select required label="District" value={manualDraft.district} disabled={!manualDraft.state} onChange={event => setManualDraft({ ...manualDraft, district: event.target.value, block: '', venueName: '', venueUdise: '', pinCode: '' })}><MenuItem value="">Select district</MenuItem>{draftDistricts.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField><TextField select required label="Block" value={manualDraft.block} disabled={!manualDraft.district || draftBlocks.length === 0} onChange={event => setManualDraft({ ...manualDraft, block: event.target.value, venueName: '', venueUdise: '', pinCode: '' })}><MenuItem value="">{manualDraft.district ? 'Select block' : 'Select a district first'}</MenuItem>{draftBlocks.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField><TextField select required label="Training Centre / Venue (School UDISE Code)" value={manualDraft.venueUdise} disabled={!manualDraft.block || draftVenues.length === 0} onChange={event => { const venue = draftVenues.find(item => item.udise === event.target.value); setManualDraft({ ...manualDraft, venueUdise: venue?.udise ?? '', venueName: venue?.school ?? '', pinCode: '' }); }}><MenuItem value="">{manualDraft.block ? 'Select a school / venue' : 'Select a block first'}</MenuItem>{draftVenues.map(item => <MenuItem key={item.udise} value={item.udise}>{item.school} · {item.udise}</MenuItem>)}</TextField><TextField label="PIN Code" placeholder="PIN code" inputProps={{ maxLength: 6 }} value={manualDraft.pinCode} onChange={event => setManualDraft({ ...manualDraft, pinCode: event.target.value })} /> </>}
          {manualDraft.trainingMode !== 'Physical' && <><TextField select required label="Online Platform" value={manualDraft.onlinePlatform} onChange={event => setManualDraft({ ...manualDraft, onlinePlatform: event.target.value })}>{['Microsoft Teams', 'Zoom', 'Google Meet', 'Other'].map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField><TextField required type="url" label="Meeting URL" placeholder="https://..." value={manualDraft.meetingUrl} onChange={event => setManualDraft({ ...manualDraft, meetingUrl: event.target.value })} sx={{ gridColumn: { sm: 'span 2' } }} /><TextField label="Meeting ID" value={manualDraft.meetingId} onChange={event => setManualDraft({ ...manualDraft, meetingId: event.target.value })} /><TextField label="Meeting Password" type="password" value={manualDraft.meetingPassword} onChange={event => setManualDraft({ ...manualDraft, meetingPassword: event.target.value })} /></>}
        </Box></>}
        {manualStep === 3 && <><Typography variant="h6" sx={{ mb: 1.5 }}>Trainer Details</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}><TextField select required label="Trainer" value={manualDraft.trainerCode} onChange={event => setManualDraft({ ...manualDraft, trainerCode: event.target.value })}><MenuItem value="">Select trainer</MenuItem>{trainers.map(item => <MenuItem key={item.userId} value={item.userId}>{trainerDirectory.find(profile => profile.userId?.toLowerCase() === item.userId.toLowerCase())?.name} · {item.userId}</MenuItem>)}</TextField><TextField required type="number" label="Expected Trainees" inputProps={{ min: 0, max: Number(manualDraft.capacity) }} value={manualDraft.traineeCount} onChange={event => setManualDraft({ ...manualDraft, traineeCount: event.target.value })} /><FormControlLabel control={<Checkbox checked={manualDraft.openRegistration} onChange={event => setManualDraft({ ...manualDraft, openRegistration: event.target.checked })} />} label="Open trainee registration" /></Box></>}
        {manualStep === 4 && <><Typography variant="h6" sx={{ mb: 1.5 }}>Review Batch Information</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: 1.25 }}>{[{ label: 'Project', value: authorizedProjects.find(item => item.id === manualDraft.projectId)?.name }, { label: 'Phase', value: projects.find(item => item.id === manualDraft.projectId)?.phases?.find(item => item.id === manualDraft.phaseId)?.name }, { label: 'Training Plan', value: plans.find(item => item.code === manualDraft.planCode)?.name }, { label: 'Batch Code', value: manualDraft.batchName }, { label: 'Batch Type', value: manualDraft.batchType }, { label: 'Start Date', value: formatDate(manualDraft.startDate) }, { label: 'End Date', value: formatDate(draftEndDate) }, { label: 'Duration', value: `${manualDraft.duration} ${manualDraft.durationUnit}` }, { label: 'Training Mode', value: manualDraft.trainingMode }, { label: 'Venue', value: manualDraft.trainingMode === 'Online' ? manualDraft.onlinePlatform : manualDraft.venueName }, { label: 'Trainers', value: '1' }, { label: 'Trainees', value: manualDraft.traineeCount }, { label: 'Capacity', value: manualDraft.capacity }].map(item => <Paper key={item.label} elevation={0} sx={{ p: 1.5, bgcolor: '#f5f8fb', borderRadius: 1.5 }}><Typography variant="caption" color="text.secondary">{item.label}</Typography><Typography variant="body2" fontWeight={750}>{item.value || '—'}</Typography></Paper>)}</Box><Alert severity="warning" sx={{ mt: 1.5 }}>Verify all information before creating the batch.</Alert></>}
        </Box>
        {manualError && <Alert severity={manualError.startsWith('Draft saved') ? 'success' : 'error'} sx={{ mt: 1.5 }}>{manualError}</Alert>}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: { xs: 2, md: 3 }, py: 1.5, borderTop: '1px solid #e6edf5' }}><Stack direction="row" spacing={1}>{manualStep > 0 && <Button onClick={() => { setManualError(''); setManualStep(step => step - 1); }}>← Previous</Button>}{!manualEditingBatch && !manualViewingBatch && <Button variant="outlined" onClick={saveManualDraft}>Save as Draft</Button>}</Stack><Stack direction="row" spacing={1}>{manualViewingBatch ? <Button variant="contained" onClick={() => { if (manualStep < 4) setManualStep(step => step + 1); else { setManualBatchOpen(false); setManualEditingBatch(null); setManualViewingBatch(false); } }}>{manualStep < 4 ? 'Continue →' : 'Done'}</Button> : <><Button onClick={() => { setManualBatchOpen(false); setManualEditingBatch(null); setManualViewingBatch(false); }}>Cancel</Button>{manualStep < 4 ? <Button variant="contained" onClick={() => { if (validateManualStep(manualStep)) { setManualError(''); setManualStep(step => step + 1); } }}>Continue →</Button> : <Button variant="contained" onClick={saveManualBatch}>{manualEditingBatch ? 'Save Changes' : 'Create Batch'}</Button>}</>}</Stack></DialogActions>
    </Dialog>
  </div>;
}
function timesOverlap(startA: string, endA: string, startB: string, endB: string) { return Boolean(startA && endA && startB && endB && startA < endB && startB < endA); }
