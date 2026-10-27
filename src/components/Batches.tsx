import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { formatDate } from '../dateFormat';
import { getSession, getUsers } from '../auth';
import { kgbvSchools } from '../data/kgbvSchools';
import { locations } from '../data/locations';
import { trainerAvailability, trainerAvailabilityConflict, trainerProfiles } from '../trainerStore';
import { calculateAttendance } from '../attendanceMetrics';

type Project = { id: string; name: string; code: string; assignedUsers: string[]; startDate: string; endDate: string; phases?: { id: string; name: string; sequence: number }[]; batchImportPolicy?: 'valid-rows' | 'all-or-nothing' };
type Plan = { id: string; code: string; name: string; type: 'Classroom' | 'Online' | 'Hybrid'; status: 'Draft' | 'Active' | 'Inactive' };
type Association = { id: string; projectId: string; trainingPlanId: string; status: 'Active' | 'Inactive' };
type BatchStatus = 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled' | 'Archived';
type Batch = {
  id: string; batchCode: string; uniqueId?: string; projectId: string; projectPlanAssociationId: string; name: string;
  phaseId?: string; trainingCycle?: string; deliveryMode?: string; schoolUdiseVenue?: string; state?: string; district?: string; location?: string;
  trainingPlanCode?: string; trainingStartDate?: string; trainingDuration?: number; trainingEndAuto?: string; trainingDates?: string[];
  trainingStartTime?: string; trainingEndTime?: string; trainerCode?: string; trainerProfileCode?: string; trainerName?: string; openRegistration?: boolean; registrationCapacity?: number; registrationWindowBeforeDays?: number; registrationWindowAfterDays?: number;
  createdAt: string; createdBy: string; status?: BatchStatus; warnings?: string[]; registrationCount?: number; attendanceCount?: number; assessmentCount?: number; dependentRecordCount?: number;
};
type DraftRow = { Batch_UniqueID: string; Project_Code: string; Project_Phase: string; Training_Cycle: string; Delivery_Mode: string; School_UDISE_Venue: string; State: string; District: string; Location: string; Training_Plan_Code: string; Training_Start_Date: string; Training_Duration: string; Training_End_Auto: string; Training_Start_Time: string; Training_End_Time: string; Trainer_Code: string; Trainer_Name: string; Open_Registration: string };
type ValidationRow = { rowNumber: number; values: DraftRow; batch?: Batch; errors: string[]; warnings: string[] };
type Holiday = { date: string; scope: 'National' | 'State'; state?: string; active?: boolean };
type ApprovedVenue = { code: string; state: string; district: string; location?: string; active?: boolean };
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
const headers: (keyof DraftRow)[] = ['Batch_UniqueID', 'Project_Code', 'Project_Phase', 'Training_Cycle', 'Delivery_Mode', 'School_UDISE_Venue', 'State', 'District', 'Location', 'Training_Plan_Code', 'Training_Start_Date', 'Training_Duration', 'Training_End_Auto', 'Training_Start_Time', 'Training_End_Time', 'Trainer_Code', 'Trainer_Name', 'Open_Registration'];
const requiredHeaders: (keyof DraftRow)[] = ['Batch_UniqueID', 'Project_Code', 'School_UDISE_Venue', 'State', 'District', 'Training_Plan_Code', 'Training_Start_Date', 'Training_Duration', 'Training_Start_Time', 'Training_End_Time', 'Trainer_Code', 'Open_Registration'];
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
function scheduleDays(start: string, duration: number, holidays: Holiday[], state: string) {
  const result: string[] = [];
  const blockedDates = new Set(holidays.filter(item => item.active !== false && (item.scope === 'National' || (item.scope === 'State' && item.state === state))).map(item => item.date));
  const current = new Date(`${start}T12:00:00`);
  for (let checked = 0; checked < 2000 && result.length < duration; checked++, current.setDate(current.getDate() + 1)) {
    const day = current.getDay(); const iso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    if (day !== 0 && day !== 6 && !blockedDates.has(iso)) result.push(iso);
  }
  return result;
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
  const identifiers = new Set([batch.id, batch.uniqueId, batch.batchCode].filter(Boolean));
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
  const [validation, setValidation] = useState<ValidationRow[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [filter, setFilter] = useState({ query: '', project: '', phase: '', state: '', district: '', school: '', plan: '', trainer: '', from: '', to: '', status: '' });
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [editError, setEditError] = useState('');
  const canImport = Boolean(session && adminRoles.has(session.role));
  const canOverrideInactive = session?.role === 'schoolnet-super-admin';
  const authorizedProjects = projects.filter(project => session?.role === 'schoolnet-super-admin' || project.assignedUsers.includes(session?.userId ?? ''));

  function validateRows(rawRows: Record<string, string>[], uploadedHeaders: string[]) {
    const rows: ValidationRow[] = [];
    const uploadedIds = new Set<string>();
    const prior = [...batches];
    const allProjects = projects;
    const userList = getUsers();
    const trainerDirectory = trainerProfiles();
    const availabilityRecords = trainerAvailability();
    for (let index = 0; index < rawRows.length; index++) {
      const source = rawRows[index]; const values = { ...blankRow(), ...source } as DraftRow;
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
      if (project && batches.some(item => item.projectId === project.id && (item.uniqueId ?? item.batchCode).toLowerCase() === uniqueId.toLowerCase())) errors.push(`Batch_UniqueID “${uniqueId}” already exists in this project.`);
      if (!project) errors.push(`Project_Code “${projectCode || '(blank)'}” does not match a project.`);
      else if (!canAccess) errors.push(`Project “${projectCode}” is not accessible to your account.`);
      const plan = plans.find(item => item.code.toLowerCase() === values.Training_Plan_Code.trim().toLowerCase());
      const association = project && plan ? associations.find(item => item.projectId === project.id && item.trainingPlanId === plan.id && item.status === 'Active') : undefined;
      if (!values.Training_Plan_Code.trim()) errors.push('Training_Plan_Code is required.');
      else if (!plan) errors.push(`Training_Plan_Code “${values.Training_Plan_Code}” was not found.`);
      else if (!association) errors.push(`Training plan ${plan.code} is not actively linked to project ${projectCode}.`);
      else if (plan.status !== 'Active' && !(canOverrideInactive && includeInactive && plan.status === 'Inactive')) errors.push(`Training plan ${plan.code} is ${plan.status.toLowerCase()}; an active plan is required. A super admin may explicitly authorize inactive plans.`);
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
      const batch: Batch | undefined = errors.length === 0 && project && association && plan && startDate && calculatedEnd && startTime && endTime && openRegistration !== null ? {
        id: crypto.randomUUID(), batchCode: uniqueId, uniqueId, projectId: project.id, projectPlanAssociationId: association.id, name: values.Location || `Batch ${uniqueId}`,
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
    setFileName(file.name); setMessage(''); setValidation([]);
    try {
      const workbook = await parseWorkbook(file); setFileHeaders(workbook.headers);
      const result = validateRows(workbook.rows, workbook.headers);
      setValidation(result);
      if (!workbook.rows.length) setMessage('The workbook has no batch rows. Add at least one row below the header.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read this Excel workbook.'); }
    event.target.value = '';
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
    const dates = scheduleDays(start, days, holidays, editBatch.state ?? ''); const end = dates.at(-1) ?? '';
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
    return (!q || `${batch.batchCode} ${batch.uniqueId ?? ''} ${batch.name}`.toLowerCase().includes(q)) && (!filter.project || batch.projectId === filter.project) && (!filter.phase || batch.phaseId === filter.phase) && (!filter.state || batch.state === filter.state) && (!filter.district || batch.district === filter.district) && (!filter.school || batch.schoolUdiseVenue === filter.school) && (!filter.plan || batch.trainingPlanCode === filter.plan) && (!filter.trainer || batch.trainerCode === filter.trainer) && (!filter.from || (batch.trainingStartDate ?? '') >= filter.from) && (!filter.to || (batch.trainingStartDate ?? '') <= filter.to) && (!filter.status || (batch.status ?? 'Scheduled') === filter.status);
  });
  const setFilterValue = (key: keyof typeof filter, value: string) => setFilter(current => ({ ...current, [key]: value }));

  return <div className="app"><Sidebar activePage="Batches" /><main className="main"><Topbar title="Batches" description="Import, schedule, and maintain project batches." />
    <Box sx={{ width: '100%', maxWidth: 1600, mx: 'auto', pb: 3 }}><Stack spacing={2.5}>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #e3ebf3', borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={1.5}>
          <Box><Typography variant="h6" sx={{ fontWeight: 750 }}>Create batches through Excel upload</Typography><Typography variant="body2" color="text.secondary">One row creates one batch. End dates count Monday–Friday training days and skip active national and state holidays.</Typography></Box>
          <Button variant="outlined" onClick={downloadTemplate} sx={{ textTransform: 'none', flexShrink: 0 }}>Download Excel template</Button>
        </Stack>
        {canOverrideInactive && <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={includeInactive} onChange={event => { setIncludeInactive(event.target.checked); setValidation([]); }} />} label="Explicitly authorize inactive plans for this import" />}
        <Box sx={{ mt: 2, p: 1.5, border: '1px dashed #b9cce0', borderRadius: 2, bgcolor: '#f8fbff' }}><Button component="label" variant="contained" disabled={!canImport} sx={{ textTransform: 'none' }}>Choose .xlsx file<input hidden type="file" accept=".xlsx" onChange={uploadFile} /></Button><Typography component="span" variant="body2" sx={{ ml: 1.5, color: '#71839a' }}>{fileName || 'Use the standard template; validation runs before import.'}</Typography></Box>
        {message && <Alert severity={message.startsWith('Imported') ? 'success' : 'error'} sx={{ mt: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
      </Paper>

      {validation.length > 0 && <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #e3ebf3', borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={1.5}>
          <Box><Typography variant="h6" sx={{ fontWeight: 750 }}>Upload validation</Typography><Typography variant="body2" color="text.secondary">{validation.length} rows submitted · {validCount} valid · {invalidCount} invalid · {warningCount} warning</Typography></Box>
          <Stack direction="row" spacing={1}><Button variant="outlined" onClick={downloadErrors} disabled={!validation.some(row => row.errors.length || row.warnings.length)} sx={{ textTransform: 'none' }}>Download error report</Button><Button variant="contained" onClick={() => setConfirmImport(true)} disabled={rowsForImport.length === 0 || !canImport} sx={{ textTransform: 'none' }}>Review import ({rowsForImport.length})</Button></Stack>
        </Stack>
        {projects.some(project => project.batchImportPolicy === 'all-or-nothing') && <Alert severity="info" sx={{ mt: 1.5 }}>Projects configured for all-or-nothing imports will have all their rows held if any row for that project is invalid.</Alert>}
        <Box sx={{ mt: 2, overflowX: 'auto' }}><Box component="table" sx={{ minWidth: 900, width: '100%', borderCollapse: 'collapse', '& th': { textAlign: 'left', p: 1, bgcolor: '#f6f9fc', color: '#61778e', fontSize: 12 }, '& td': { p: 1, borderTop: '1px solid #edf1f5', verticalAlign: 'top', fontSize: 12 } }}><thead><tr><th>Row</th><th>Batch ID</th><th>Project / Plan</th><th>Training dates</th><th>Result</th><th>Validation details</th></tr></thead><tbody>{validation.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.values.Batch_UniqueID}</td><td>{row.values.Project_Code} / {row.values.Training_Plan_Code}</td><td>{formatDate(row.values.Training_Start_Date)}{row.batch?.trainingEndAuto ? ` → ${formatDate(row.batch.trainingEndAuto)}` : ''}</td><td><Chip size="small" label={row.errors.length ? 'Invalid' : row.warnings.length ? 'Warning' : 'Valid'} color={row.errors.length ? 'error' : row.warnings.length ? 'warning' : 'success'} /></td><td>{[...row.errors, ...row.warnings].map((text, index) => <Typography key={index} variant="caption" display="block" color={row.errors.length ? 'error.main' : 'warning.dark'}>{text}</Typography>)}</td></tr>)}</tbody></Box></Box>
      </Paper>}

      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #e3ebf3', borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}><Typography variant="h6" sx={{ fontWeight: 750 }}>Batch register</Typography><Button href={`${import.meta.env.BASE_URL}registration-requests`} sx={{ textTransform: 'none' }}>Review registration requests</Button></Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5,minmax(0,1fr))' }, gap: 1, mb: 1.5 }}>
          <TextField size="small" label="Search batch" value={filter.query} onChange={event => setFilterValue('query', event.target.value)} />
          <TextField select size="small" label="Project" value={filter.project} onChange={event => setFilterValue('project', event.target.value)}><MenuItem value="">All projects</MenuItem>{authorizedProjects.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>
          <TextField select size="small" label="Phase" value={filter.phase} onChange={event => setFilterValue('phase', event.target.value)}><MenuItem value="">All phases</MenuItem>{authorizedProjects.flatMap(project => (project.phases ?? []).map(phase => <MenuItem key={phase.id} value={phase.id}>{project.name}: {phase.name}</MenuItem>))}</TextField>
          <TextField select size="small" label="State (13 UDISE states)" value={filter.state} onChange={event => setFilter(current => ({ ...current, state: event.target.value, district: '', school: '' }))}><MenuItem value="">All states</MenuItem>{locations.map(item => <MenuItem key={item.name} value={item.name}>{item.name}</MenuItem>)}</TextField>
          <TextField select size="small" label="District" value={filter.district} disabled={!filter.state} onChange={event => setFilter(current => ({ ...current, district: event.target.value, school: '' }))}><MenuItem value="">All districts</MenuItem>{districtOptions.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
          <TextField select size="small" label="School / UDISE" value={filter.school} disabled={!filter.state || !filter.district} onChange={event => setFilterValue('school', event.target.value)}><MenuItem value="">All schools</MenuItem>{schoolOptions.map(item => <MenuItem key={item.udise} value={item.udise}>{item.school} · {item.udise}</MenuItem>)}</TextField>
          <TextField select size="small" label="Training plan" value={filter.plan} onChange={event => setFilterValue('plan', event.target.value)}><MenuItem value="">All plans</MenuItem>{plans.map(item => <MenuItem key={item.id} value={item.code}>{item.name}</MenuItem>)}</TextField>
          <TextField select size="small" label="Trainer" value={filter.trainer} onChange={event => setFilterValue('trainer', event.target.value)}><MenuItem value="">All trainers</MenuItem>{trainers.map(item => <MenuItem key={item.userId} value={item.userId}>{trainerDirectory.find(profile => profile.userId?.toLowerCase() === item.userId.toLowerCase())?.trainerCode} · {trainerDirectory.find(profile => profile.userId?.toLowerCase() === item.userId.toLowerCase())?.name}</MenuItem>)}</TextField>
          <TextField size="small" type="date" label="Start from" InputLabelProps={{ shrink: true }} value={filter.from} onChange={event => setFilterValue('from', event.target.value)} />
          <TextField size="small" type="date" label="Start to" InputLabelProps={{ shrink: true }} value={filter.to} onChange={event => setFilterValue('to', event.target.value)} />
          <TextField select size="small" label="Status" value={filter.status} onChange={event => setFilterValue('status', event.target.value)}><MenuItem value="">All statuses</MenuItem>{(['Scheduled', 'Ongoing', 'Completed', 'Cancelled', 'Archived'] as BatchStatus[]).map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField>
        </Box>
        {visibleBatches.length === 0 ? <Typography color="text.secondary">No batches match the current filters.</Typography> : <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={{ minWidth: 1200, width: '100%', borderCollapse: 'collapse', '& th': { textAlign: 'left', p: 1, bgcolor: '#f6f9fc', color: '#61778e', fontSize: 12 }, '& td': { p: 1, borderTop: '1px solid #edf1f5', verticalAlign: 'top', fontSize: 12 } }}><thead><tr><th>Batch</th><th>Project / phase</th><th>Venue</th><th>Plan / mode</th><th>Schedule</th><th>Trainer</th><th>Registration</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleBatches.map(batch => <tr key={batch.id}><td><strong>{batch.batchCode}</strong><br />{batch.name}<Typography variant="caption" display="block" color="text.secondary">Attendance: {batch.attendanceSummary.percentage === null ? '—' : `${batch.attendanceSummary.percentage}%`} · {batch.attendanceSummary.present}/{batch.attendanceSummary.expected} present · {batch.attendanceSummary.pending} pending</Typography></td><td>{batch.projectName}<br />{batch.phaseId ? authorizedProjects.flatMap(project => project.phases ?? []).find(phase => phase.id === batch.phaseId)?.name : '—'}</td><td>{batch.schoolUdiseVenue ?? '—'}<br />{batch.district}, {batch.state}</td><td>{batch.planName}<br />{batch.deliveryMode ?? '—'}</td><td>{formatDate(batch.trainingStartDate) || '—'} → {formatDate(batch.trainingEndAuto) || '—'}<br />{batch.trainingDuration ?? '—'} days · {batch.trainingStartTime ?? '—'}–{batch.trainingEndTime ?? '—'}</td><td>{batch.trainerCode ?? '—'}{batch.trainerName ? <><br />{batch.trainerName}</> : null}</td><td>{batch.openRegistration ? <><Chip size="small" label="Open" color="success" /><br /><a href={`${import.meta.env.BASE_URL}register?batch=${encodeURIComponent(batch.id)}`} target="_blank" rel="noreferrer">Registration link</a></> : 'Closed'}</td><td><Chip size="small" label={batch.status ?? 'Scheduled'} color={batch.status === 'Cancelled' ? 'default' : 'success'} /></td><td><Stack direction="row" spacing={.5}><Button size="small" disabled={!canImport || batch.status === 'Cancelled' || batch.status === 'Completed'} onClick={() => { setEditBatch({ ...batch }); setEditError(''); }} sx={{ textTransform: 'none' }}>Edit</Button>{batch.status !== 'Cancelled' && <Button size="small" onClick={() => cancelBatch(batch)} disabled={!canImport} sx={{ textTransform: 'none' }}>Cancel</Button>}{batch.status !== 'Cancelled' && <Button size="small" color="error" onClick={() => deleteBatch(batch)} disabled={!canImport || batch.hasDependents} sx={{ textTransform: 'none' }}>Delete</Button>}</Stack>{batch.hasDependents && <Typography variant="caption" color="text.secondary">Records protect deletion</Typography>}</td></tr>)}</tbody></Box></Box>}
      </Paper>
    </Stack></Box><Footer /></main>

    <Dialog open={confirmImport} onClose={() => setConfirmImport(false)} maxWidth="sm" fullWidth><DialogTitle>Confirm batch import</DialogTitle><DialogContent><Typography>Import {rowsForImport.length} batch row(s) from {fileName}? Invalid rows will be excluded. Warning rows will be imported with their warnings recorded.</Typography>{invalidProjectIds.size > 0 && <Typography sx={{ mt: 1 }} variant="body2" color="text.secondary">All-or-nothing policy holds every row for {invalidProjectIds.size} project(s) with validation errors.</Typography>}</DialogContent><DialogActions><Button onClick={() => setConfirmImport(false)}>Back</Button><Button variant="contained" onClick={importValidRows}>Import valid rows</Button></DialogActions></Dialog>
    <Dialog open={Boolean(editBatch)} onClose={() => setEditBatch(null)} maxWidth="sm" fullWidth><Box component="form" onSubmit={saveEditedBatch}><DialogTitle>Edit batch schedule</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{editBatch && <><TextField type="date" label="Training start date" InputLabelProps={{ shrink: true }} value={editBatch.trainingStartDate ?? ''} onChange={event => setEditBatch({ ...editBatch, trainingStartDate: event.target.value })} /><TextField type="number" label="Training duration (days)" inputProps={{ min: 1, max: 365 }} value={editBatch.trainingDuration ?? 1} onChange={event => setEditBatch({ ...editBatch, trainingDuration: Number(event.target.value) })} /><TextField type="number" label="Registration capacity (blank = no limit)" inputProps={{ min: 1, step: 1 }} value={editBatch.registrationCapacity ?? ''} onChange={event => setEditBatch({ ...editBatch, registrationCapacity: event.target.value === '' ? undefined : Number(event.target.value) })} /><TextField select label="Open registration" value={editBatch.openRegistration ? 'yes' : 'no'} onChange={event => setEditBatch({ ...editBatch, openRegistration: event.target.value === 'yes' })}><MenuItem value="yes">Open</MenuItem><MenuItem value="no">Closed</MenuItem></TextField><TextField select label="Trainer" value={editBatch.trainerCode ?? ''} onChange={event => setEditBatch({ ...editBatch, trainerCode: event.target.value })}>{trainers.map(item => <MenuItem key={item.userId} value={item.userId}>{trainerDirectory.find(profile => profile.userId?.toLowerCase() === item.userId.toLowerCase())?.trainerCode} · {trainerDirectory.find(profile => profile.userId?.toLowerCase() === item.userId.toLowerCase())?.name}</MenuItem>)}</TextField><TextField type="time" label="Start time" InputLabelProps={{ shrink: true }} value={editBatch.trainingStartTime ?? ''} onChange={event => setEditBatch({ ...editBatch, trainingStartTime: event.target.value })} /><TextField type="time" label="End time" InputLabelProps={{ shrink: true }} value={editBatch.trainingEndTime ?? ''} onChange={event => setEditBatch({ ...editBatch, trainingEndTime: event.target.value })} />{editError && <Alert severity="error">{editError}</Alert>}</>}</Stack></DialogContent><DialogActions><Button type="button" onClick={() => setEditBatch(null)}>Cancel</Button><Button type="submit" variant="contained">Save schedule</Button></DialogActions></Box></Dialog>
  </div>;
}
function timesOverlap(startA: string, endA: string, startB: string, endB: string) { return Boolean(startA && endA && startB && endB && startA < endB && startB < endA); }
