import { useMemo, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, Chip, Container, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';
import { createExcelTemplate, readExcelFirstSheet } from '../excelUpload';
import { registrationWindowError } from '../registrationRules';

type Row = Record<string, any>;
const KEYS = { batches: 'teacher-training-batch-plan-uses', projects: 'teacher-training-projects', registrations: 'teacher-training-registrations', audit: 'teacher-training-audit', trainees: 'teacher-training-trainees', plans: 'teacher-training-plans', eligible: 'teacher-training-eligible-participants', eligibleTeachers: 'teacher-training-eligible-teachers', eligibleStudents: 'teacher-training-eligible-students', schoolEligibility: 'teacher-training-school-eligibility' };
const read = <T,>(key: string): T[] => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const txt = (value: unknown) => String(value ?? '').trim();
const active = (row: Row) => !['rejected', 'cancelled', 'withdrawn'].includes(txt(row.status ?? row.registrationStatus).toLowerCase());
const normEmail = (value: unknown) => txt(value).normalize('NFKC').toLowerCase();
const normPhone = (value: unknown) => txt(value).replace(/\D/g, '');
const normName = (value: unknown) => txt(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const uploadHeaders = ['Batch_Code', 'Project_Code', 'School_UDISE', 'Trainee_ID', 'Trainee_Name', 'Email', 'Mobile', 'Beneficiary_Type', 'Consent_Provided', 'Eligibility_Status'];
type UploadResult = { rowNumber: number; value: Row; errors: string[]; traineeId?: string; newTrainee?: Row; imported?: boolean };
const base = import.meta.env.BASE_URL;

export default function RegistrationRequests() {
  const session = getSession();
  const [batches, setBatches] = useState(() => read<Row>(KEYS.batches));
  const [projects] = useState(() => read<Row>(KEYS.projects));
  const [requests, setRequests] = useState(() => read<Row>(KEYS.registrations));
  const [trainees, setTrainees] = useState(() => read<Row>(KEYS.trainees));
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [uploadFile, setUploadFile] = useState('');
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [registrationSettings, setRegistrationSettings] = useState({ open: false, beforeDays: '0', afterDays: '0', capacity: '' });
  const [settingsReason, setSettingsReason] = useState('');
  const [reason, setReason] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const isSuper = session?.role === 'schoolnet-super-admin';
  const isTrainer = session?.role === 'trainer';
  const scopedBatches = useMemo(() => batches.filter(batch => {
    if (isSuper) return true;
    if (isTrainer) return txt(batch.trainerCode).toLowerCase() === txt(session?.userId).toLowerCase();
    const project = projects.find(item => txt(item.id) === txt(batch.projectId));
    return (project?.assignedUsers ?? []).some((id: string) => txt(id).toLowerCase() === txt(session?.userId).toLowerCase());
  }), [batches, projects, isSuper, isTrainer, session?.userId]);
  const batchIds = new Set(scopedBatches.map(batch => txt(batch.id)));
  const selectedBatch = scopedBatches.find(batch => txt(batch.id) === selectedBatchId);
  const readyCount = uploadResults.filter(row => !row.errors.length && !row.imported).length;
  const pending = requests.filter(row => batchIds.has(txt(row.batchId)) && ['pending', 'submitted', 'awaiting approval'].includes(txt(row.status || row.registrationStatus).toLowerCase()));
  function update(row: Row, nextStatus: 'Approved' | 'Rejected' | 'Withdrawn') {
    const batch = scopedBatches.find(item => txt(item.id) === txt(row.batchId));
    if (!batch) return;
    const now = new Date().toISOString();
    const why = txt(reason[txt(row.id)]);
    if ((nextStatus === 'Rejected' || nextStatus === 'Withdrawn') && !why) { setMessage(`Enter a reason before marking a request ${nextStatus.toLowerCase()}.`); return; }
    if (nextStatus === 'Approved') {
      const capacity = Number(batch.registrationCapacity ?? batch.participantCapacity ?? batch.capacity);
      const occupied = requests.filter(item => txt(item.batchId) === txt(batch.id) && active(item)).length;
      if (batch.openRegistration !== true || ['cancelled', 'archived', 'completed'].includes(txt(batch.status).toLowerCase())) { setMessage('This batch is closed. Reopen it before approving registrations.'); return; }
      if (Number.isFinite(capacity) && capacity > 0 && occupied > capacity) { setMessage('Capacity has been reached. This request cannot be approved.'); return; }
    }
    const updated = requests.map(item => txt(item.id) === txt(row.id) ? { ...item, status: nextStatus, registrationStatus: nextStatus, approvalStatus: nextStatus, approved: nextStatus === 'Approved', reviewedBy: session?.userId, reviewedAt: now, ...(why ? { reviewReason: why } : {}) } : item);
    const audit = read<Row>(KEYS.audit);
    audit.push({ id: `AUD-${crypto.randomUUID()}`, entity: 'registration', entityId: txt(row.id), action: nextStatus, originalValue: txt(row.status || row.registrationStatus) || 'Pending', revisedValue: nextStatus, user: session?.userId, timestamp: now, reason: why || undefined });
    localStorage.setItem(KEYS.registrations, JSON.stringify(updated)); localStorage.setItem(KEYS.audit, JSON.stringify(audit)); setRequests(updated); setMessage(`Request ${nextStatus.toLowerCase()}.`);
  }

  async function downloadTraineeTemplate() {
    const blob = await createExcelTemplate('Trainees', uploadHeaders);
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'batch-trainee-upload-template.xlsx'; link.click(); URL.revokeObjectURL(url);
  }

  async function readTraineeUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setUploadFile(file.name); setUploadMessage(''); setUploadResults([]);
    if (!selectedBatch) { setUploadMessage('Select a batch that you are authorized to manage before uploading.'); return; }
    setUploadBusy(true);
    try {
      const workbook = await readExcelFirstSheet(file);
      const missing = uploadHeaders.filter(header => !workbook.headers.includes(header));
      if (missing.length) { setUploadResults([{ rowNumber: 1, value: {}, errors: [`Missing required template column(s): ${missing.join(', ')}.`] }]); setUploadMessage('Use the standard trainee upload template.'); return; }
      if (!workbook.rows.length) { setUploadMessage('The workbook has no trainee rows below its header.'); return; }
      const batch = selectedBatch;
      const project = projects.find(item => txt(item.id) === txt(batch.projectId));
      const plan = read<Row>(KEYS.plans).find(item => txt(item.code) === txt(batch.trainingPlanCode));
      const roster: Row[] = [...read<Row>(KEYS.eligible), ...read<Row>(KEYS.schoolEligibility), ...read<Row>(KEYS.eligibleTeachers).map(row => ({ ...row, eligible: row.eligible ?? true })), ...read<Row>(KEYS.eligibleStudents).map(row => ({ ...row, eligible: row.eligible ?? true }))];
      const scopedRoster = roster.filter(row => (txt(row.batchId) && txt(row.batchId) === txt(batch.id)) || (txt(row.schoolUdise ?? row.udise ?? row.schoolCode) && txt(row.schoolUdise ?? row.udise ?? row.schoolCode) === txt(batch.schoolUdiseVenue)));
      const capacityValue = Number(batch.registrationCapacity ?? batch.participantCapacity ?? batch.capacity);
      let projectedOccupancy = requests.filter(row => (txt(row.batchId) === txt(batch.id) || txt(row.batchCode) === txt(batch.batchCode)) && active(row)).length;
      const seenInFile = new Set<string>();
      const existingIdentityRows = [...trainees, ...requests];
      const validated: UploadResult[] = workbook.rows.map(({ rowNumber, values }) => {
        const value = Object.fromEntries(uploadHeaders.map((header, index) => [header, txt(values[workbook.headers.indexOf(header)])]));
        const errors: string[] = [];
        const name = txt(value.Trainee_Name); const email = normEmail(value.Email); const phone = normPhone(value.Mobile);
        const batchCode = txt(value.Batch_Code); const projectCode = txt(value.Project_Code); const school = txt(value.School_UDISE);
        const category = txt(value.Beneficiary_Type); const suppliedId = txt(value.Trainee_ID);
        const windowError = registrationWindowError(batch);
        if (windowError) errors.push(windowError);
        if (!batchCode) errors.push('Batch_Code is required.'); else if (batchCode.toLowerCase() !== txt(batch.batchCode).toLowerCase()) errors.push(`Batch_Code must match selected batch ${txt(batch.batchCode)}.`);
        if (!projectCode) errors.push('Project_Code is required.'); else if (!project || projectCode.toLowerCase() !== txt(project.code).toLowerCase()) errors.push('Project_Code is not associated with the selected batch.');
        if (!name) errors.push('Trainee_Name is required.');
        if (!email && !phone) errors.push('Provide at least one identity contact: Email or Mobile.');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email is not in a valid format.');
        if (phone && (phone.length < 10 || phone.length > 15)) errors.push('Mobile must contain 10 to 15 digits.');
        if (!category) errors.push('Beneficiary_Type is required.');
        else if (Array.isArray(plan?.beneficiaries) && plan.beneficiaries.length && !plan.beneficiaries.some((item: string) => normName(item) === normName(category))) errors.push(`Beneficiary_Type must be one of the selected plan categories: ${(plan?.beneficiaries ?? []).join(', ')}.`);
        if (batch.schoolUdiseVenue && school !== txt(batch.schoolUdiseVenue)) errors.push(`School_UDISE must match selected batch school ${txt(batch.schoolUdiseVenue)}.`);
        const consentRequired = batch.consentRequired === true || batch.requiresConsent === true || project?.consentRequired === true || plan?.consentRequired === true || plan?.requiresConsent === true;
        const consent = txt(value.Consent_Provided).toLowerCase();
        if (consentRequired && !['yes', 'true', '1'].includes(consent)) errors.push('Consent_Provided must be Yes for this batch.');
        const eligibilityRequired = batch.eligibilityRequired === true || batch.requiresEligibility === true || project?.eligibilityRequired === true || plan?.eligibilityRequired === true || plan?.requiresEligibility === true;
        const eligibility = txt(value.Eligibility_Status).toLowerCase();
        if (eligibilityRequired && !['eligible', 'approved', 'active'].includes(eligibility)) errors.push('Eligibility_Status must be Eligible or Approved for this batch.');

        const emailMatches = email ? existingIdentityRows.filter(row => normEmail(row.email) === email && txt(row.traineeId ?? row.participantId ?? row.userId ?? row.id)) : [];
        const phoneMatches = phone ? existingIdentityRows.filter(row => normPhone(row.phone ?? row.mobile ?? row.mobileNumber) === phone && txt(row.traineeId ?? row.participantId ?? row.userId ?? row.id)) : [];
        const identityId = (row: Row) => txt(row.traineeId ?? row.participantId ?? row.userId ?? row.id);
        const matchedIds = new Set([...emailMatches, ...phoneMatches].map(identityId));
        if (matchedIds.size > 1) errors.push('Email and mobile match different trainee identities. Resolve the identity before uploading.');
        let matched = [...emailMatches, ...phoneMatches].find(row => identityId(row) === [...matchedIds][0]);
        if (suppliedId) {
          const suppliedRecord = existingIdentityRows.find(row => identityId(row).toLowerCase() === suppliedId.toLowerCase());
          if (!suppliedRecord) errors.push('Trainee_ID does not exist in the trainee repository. Leave it blank for a new identity or use the verified existing ID.');
          else if (matchedIds.size && !matchedIds.has(suppliedId)) errors.push('Trainee_ID does not match the identity found from the supplied email/mobile.');
          else { matched = suppliedRecord; matchedIds.add(suppliedId); }
        }
        let traineeId = [...matchedIds][0] || (suppliedId && matched ? suppliedId : undefined);
        const possibleDuplicate = trainees.find(row => normName(row.name ?? row.traineeName) === normName(name) && normName(row.schoolUdise ?? row.schoolCode) === normName(school));
        if (!traineeId && possibleDuplicate) errors.push('Possible duplicate trainee for this name and school. Verify and use the existing Trainee_ID; do not create a second identity.');
        const duplicateRegistration = traineeId ? requests.some(row => (txt(row.batchId) === txt(batch.id) || txt(row.batchCode).toLowerCase() === txt(batch.batchCode).toLowerCase()) && active(row) && identityId(row) === traineeId) : requests.some(row => (txt(row.batchId) === txt(batch.id) || txt(row.batchCode).toLowerCase() === txt(batch.batchCode).toLowerCase()) && active(row) && ((email && normEmail(row.email) === email) || (phone && normPhone(row.phone) === phone)));
        if (duplicateRegistration) errors.push('This trainee already has a pending or active registration in the selected batch.');
        const identityKey = traineeId ? `id:${traineeId.toLowerCase()}` : `contact:${email}|${phone}`;
        if (seenInFile.has(identityKey)) errors.push('Duplicate trainee identity appears more than once in this upload.'); else seenInFile.add(identityKey);
        if (scopedRoster.length) {
          const eligibleMatch = scopedRoster.find(row => (traineeId && identityId(row) === traineeId) || (email && normEmail(row.email) === email) || (phone && normPhone(row.phone ?? row.mobile ?? row.mobileNumber) === phone) || (normName(row.name ?? row.traineeName ?? row.fullName) === normName(name) && (!school || normName(row.schoolUdise ?? row.udise ?? row.schoolCode) === normName(school))));
          if (!eligibleMatch) errors.push('Trainee is not found on the eligibility roster for this school or batch.');
          else if (!(eligibleMatch.eligible === true || ['eligible', 'approved', 'active'].includes(txt(eligibleMatch.eligibilityStatus ?? eligibleMatch.status).toLowerCase()))) errors.push('Trainee is marked ineligible on the roster.');
        }
        if (!errors.length && Number.isFinite(capacityValue) && capacityValue > 0) {
          if (projectedOccupancy >= capacityValue) errors.push('Batch capacity would be exceeded.');
          else projectedOccupancy++;
        }
        const newTrainee = !traineeId ? { id: `TR-${crypto.randomUUID()}`, traineeId: '', name, email, phone, category, schoolUdise: school || txt(batch.schoolUdiseVenue), schoolName: batch.schoolName, projectId: batch.projectId, district: batch.district, state: batch.state, consentProvided: ['yes', 'true', '1'].includes(consent), createdAt: new Date().toISOString(), createdBy: session?.userId } : undefined;
        if (newTrainee) newTrainee.traineeId = newTrainee.id;
        return { rowNumber, value, errors, traineeId: traineeId ?? newTrainee?.id, newTrainee };
      });
      setUploadResults(validated);
      setUploadMessage(`${validated.filter(row => !row.errors.length).length} valid row(s); ${validated.filter(row => row.errors.length).length} row(s) with errors. Valid imports create pending registrations for authorized review.`);
    } catch (error) { setUploadMessage(error instanceof Error ? error.message : 'Could not read this Excel workbook.'); }
    finally { setUploadBusy(false); }
  }

  function importTrainees() {
    if (!session || !selectedBatch) return;
    const batch = selectedBatch;
    const ready = uploadResults.filter(row => !row.errors.length && !row.imported);
    if (!ready.length) return;
    const latestRequests = read<Row>(KEYS.registrations);
    const occupancy = latestRequests.filter(row => (txt(row.batchId) === txt(batch.id) || txt(row.batchCode) === txt(batch.batchCode)) && active(row)).length;
    const latestBatch = read<Row>(KEYS.batches).find(item => txt(item.id) === txt(batch.id)) ?? batch;
    const cap = Number(latestBatch.registrationCapacity ?? latestBatch.participantCapacity ?? latestBatch.capacity);
    if (registrationWindowError(latestBatch) || !latestBatch.openRegistration || (Number.isFinite(cap) && cap > 0 && occupancy + ready.length > cap)) { setUploadMessage('The batch registration window, status, or remaining capacity changed. Upload validation is stale; reload the file and validate again.'); return; }
    const now = new Date().toISOString(); const newTrainees: Row[] = []; const nextRequests = [...latestRequests]; const nextAudit = read<Row>(KEYS.audit);
    const finalResults = uploadResults.map(row => {
      if (!ready.includes(row)) return row;
      const trainee = row.newTrainee ?? trainees.find(item => txt(item.traineeId ?? item.id) === txt(row.traineeId)) ?? requests.find(item => txt(item.traineeId ?? item.participantId ?? item.id) === txt(row.traineeId));
      if (row.newTrainee) newTrainees.push(row.newTrainee);
      const registration = { id: `REG-${crypto.randomUUID()}`, batchId: batch.id, batchCode: batch.batchCode, projectId: batch.projectId, traineeId: row.traineeId, traineeName: txt(row.value.Trainee_Name), name: txt(row.value.Trainee_Name), email: txt(row.value.Email).toLowerCase() || txt(trainee?.email), phone: txt(row.value.Mobile) || txt(trainee?.phone), category: txt(row.value.Beneficiary_Type), consentProvided: ['yes', 'true', '1'].includes(txt(row.value.Consent_Provided).toLowerCase()), status: 'Pending', registrationStatus: 'Pending', approvalStatus: 'Pending', source: 'Excel upload', submittedAt: now, submittedBy: session.userId };
      nextRequests.push(registration);
      nextAudit.push({ id: `AUD-${crypto.randomUUID()}`, entity: 'registration', entityId: registration.id, action: 'Excel registration request created', originalValue: '', revisedValue: 'Pending', user: session.userId, timestamp: now, reason: `Batch ${batch.batchCode}; Excel row ${row.rowNumber}` });
      return { ...row, imported: true };
    });
    const uniqueNew = [...new Map(newTrainees.map(row => [txt(row.id), row])).values()];
    const nextTrainees = [...trainees, ...uniqueNew];
    localStorage.setItem(KEYS.registrations, JSON.stringify(nextRequests)); localStorage.setItem(KEYS.trainees, JSON.stringify(nextTrainees)); localStorage.setItem(KEYS.audit, JSON.stringify(nextAudit));
    setRequests(nextRequests); setTrainees(nextTrainees); setUploadResults(finalResults);
    setUploadMessage(`Upload complete: ${ready.length} trainee registration(s) added as Pending. ${finalResults.filter(row => row.errors.length).length} row(s) still need correction.`);
  }

  function saveRegistrationSettings() {
    if (!session || !selectedBatch) return;
    const before = Number(registrationSettings.beforeDays); const after = Number(registrationSettings.afterDays);
    const capacity = registrationSettings.capacity.trim() ? Number(registrationSettings.capacity) : undefined;
    if (!Number.isInteger(before) || before < 0 || !Number.isInteger(after) || after < 0) { setMessage('Registration window days must be zero or a positive whole number.'); return; }
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1)) { setMessage('Capacity must be a positive whole number or blank for no limit.'); return; }
    const activeCount = requests.filter(row => (txt(row.batchId) === txt(selectedBatch.id) || txt(row.batchCode).toLowerCase() === txt(selectedBatch.batchCode).toLowerCase()) && active(row)).length;
    if (capacity !== undefined && capacity < activeCount) { setMessage(`Capacity cannot be below ${activeCount} current pending or active registrations.`); return; }
    if (registrationSettings.open !== (selectedBatch.openRegistration === true) && !settingsReason.trim()) { setMessage('Enter a reason when manually opening or closing registration.'); return; }
    const now = new Date().toISOString();
    const updated = { ...selectedBatch, openRegistration: registrationSettings.open, registrationWindowBeforeDays: before, registrationWindowAfterDays: after, ...(capacity === undefined ? { registrationCapacity: undefined } : { registrationCapacity: capacity }) };
    const next = batches.map(item => txt(item.id) === txt(selectedBatch.id) ? updated : item);
    const audit = read<Row>(KEYS.audit);
    audit.push({ id: `AUD-${crypto.randomUUID()}`, entity: 'batch-registration-controls', entityId: txt(selectedBatch.id), action: 'Registration controls updated', originalValue: { openRegistration: selectedBatch.openRegistration, registrationWindowBeforeDays: selectedBatch.registrationWindowBeforeDays ?? 0, registrationWindowAfterDays: selectedBatch.registrationWindowAfterDays ?? 0, registrationCapacity: selectedBatch.registrationCapacity ?? null }, revisedValue: { openRegistration: updated.openRegistration, registrationWindowBeforeDays: before, registrationWindowAfterDays: after, registrationCapacity: capacity ?? null }, user: session.userId, timestamp: now, reason: settingsReason.trim() || 'Registration window or capacity updated' });
    localStorage.setItem(KEYS.batches, JSON.stringify(next)); localStorage.setItem(KEYS.audit, JSON.stringify(audit)); setBatches(next); setSettingsReason(''); setMessage('Registration controls saved.');
  }

  return <Box className="app"><Sidebar /><main className="main"><Topbar /><Container maxWidth="xl" sx={{ py: 3 }}><Stack spacing={2}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h4" fontWeight={800}>Registration requests</Typography><Typography color="text.secondary">Review and approve trainees for assigned batches.</Typography></Box><Button href={`${base}batches`} sx={{ textTransform: 'none' }}>Batches</Button></Stack><Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={1.5}><Box><Typography variant="h6" fontWeight={750}>Upload trainees through Excel</Typography><Typography variant="body2" color="text.secondary">Rows are linked to one selected batch and imported with Pending approval.</Typography></Box><Button variant="outlined" onClick={downloadTraineeTemplate}>Download Excel template</Button></Stack><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 2 }}><TextField select fullWidth label="Selected batch" value={selectedBatchId} onChange={event => { const id = event.target.value; const selected = scopedBatches.find(item => txt(item.id) === id); setSelectedBatchId(id); setUploadResults([]); setUploadMessage(''); setSettingsReason(''); setRegistrationSettings({ open: selected?.openRegistration === true, beforeDays: String(selected?.registrationWindowBeforeDays ?? 0), afterDays: String(selected?.registrationWindowAfterDays ?? 0), capacity: selected?.registrationCapacity == null ? '' : String(selected.registrationCapacity) }); }}><MenuItem value="">Choose an assigned batch</MenuItem>{scopedBatches.map(batch => <MenuItem key={txt(batch.id)} value={txt(batch.id)}>{txt(batch.batchCode)} · {txt(batch.projectName || projects.find(item => txt(item.id) === txt(batch.projectId))?.name)}</MenuItem>)}</TextField><Button component="label" variant="contained" disabled={!selectedBatch || uploadBusy} sx={{ minWidth: 190 }}>{uploadBusy ? 'Validating…' : 'Choose .xlsx file'}<input hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={readTraineeUpload} /></Button></Stack>{selectedBatch && <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f8fbff', border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>Registration controls · {txt(selectedBatch.batchCode)}</Typography><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ md: 'center' }}><TextField select label="Registration" size="small" value={registrationSettings.open ? 'open' : 'closed'} onChange={event => setRegistrationSettings(current => ({ ...current, open: event.target.value === 'open' }))} sx={{ minWidth: 170 }}><MenuItem value="open">Open</MenuItem><MenuItem value="closed">Closed</MenuItem></TextField><TextField type="number" label="Days before Day 1" size="small" inputProps={{ min: 0, step: 1 }} value={registrationSettings.beforeDays} onChange={event => setRegistrationSettings(current => ({ ...current, beforeDays: event.target.value }))} /><TextField type="number" label="Days after Day 1" size="small" inputProps={{ min: 0, step: 1 }} value={registrationSettings.afterDays} onChange={event => setRegistrationSettings(current => ({ ...current, afterDays: event.target.value }))} /><TextField type="number" label="Maximum capacity (blank = no limit)" size="small" inputProps={{ min: 1, step: 1 }} value={registrationSettings.capacity} onChange={event => setRegistrationSettings(current => ({ ...current, capacity: event.target.value }))} sx={{ minWidth: 220 }} /></Stack><Typography variant="caption" color="text.secondary" display="block" sx={{ my: 1 }}>Window is anchored to the batch’s first training day. Zero before and zero after means Day 1 only. Settings use {import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || 'Asia/Kolkata'}.</Typography>{registrationSettings.open !== (selectedBatch.openRegistration === true) && <TextField fullWidth size="small" label="Reason for manual open/close" value={settingsReason} onChange={event => setSettingsReason(event.target.value)} sx={{ mb: 1 }} />}<Button variant="outlined" size="small" onClick={saveRegistrationSettings}>Save registration controls</Button></Box>}{uploadFile && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>File: {uploadFile}</Typography>}{uploadMessage && <Alert severity={uploadResults.some(row => row.errors.length) ? 'warning' : 'info'} sx={{ mt: 1.5 }}>{uploadMessage}</Alert>}{uploadResults.length > 0 && <><TableContainer sx={{ mt: 1.5, maxHeight: 360, border: '1px solid #e8eef4', borderRadius: 1 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell>Excel row</TableCell><TableCell>Name</TableCell><TableCell>Email / mobile</TableCell><TableCell>Trainee_ID</TableCell><TableCell>Validation</TableCell></TableRow></TableHead><TableBody>{uploadResults.map(row => <TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell><TableCell>{txt(row.value.Trainee_Name) || '—'}</TableCell><TableCell>{txt(row.value.Email)}{row.value.Mobile ? <><br />{txt(row.value.Mobile)}</> : null}</TableCell><TableCell>{row.traineeId || txt(row.value.Trainee_ID) || 'New ID on import'}</TableCell><TableCell>{row.imported ? <Chip size="small" color="success" label="Imported · Pending" /> : row.errors.length ? row.errors.map((error, index) => <Typography key={index} variant="caption" color="error.main" display="block">{error}</Typography>) : <Chip size="small" color="success" variant="outlined" label="Ready" />}</TableCell></TableRow>)}</TableBody></Table></TableContainer><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}><Typography variant="body2" color="text.secondary">{readyCount} valid row(s) ready · {uploadResults.filter(row => row.errors.length).length} row(s) with errors · {uploadResults.filter(row => row.imported).length} imported</Typography><Button variant="contained" onClick={importTrainees} disabled={!readyCount}>Import valid rows</Button></Stack></>}</Paper>{message && <Alert severity={message.includes('cannot') || message.includes('closed') || message.includes('reason') ? 'warning' : 'success'} onClose={() => setMessage('')}>{message}</Alert>}<Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>Pending review · {pending.length}</Typography>{pending.length ? <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Trainee</TableCell><TableCell>Batch</TableCell><TableCell>Contact</TableCell><TableCell>Category</TableCell><TableCell>Submitted</TableCell><TableCell>Decision</TableCell></TableRow></TableHead><TableBody>{pending.map((row, index) => { const batch = scopedBatches.find(item => txt(item.id) === txt(row.batchId)); return <TableRow key={txt(row.id) || index}><TableCell>{txt(row.traineeName || row.name) || 'Trainee'}</TableCell><TableCell>{txt(batch?.batchCode || row.batchCode)}</TableCell><TableCell>{txt(row.email)}{row.phone ? <><br />{txt(row.phone)}</> : null}</TableCell><TableCell>{txt(row.category) || '—'}</TableCell><TableCell>{txt(row.submittedAt) ? new Date(row.submittedAt).toLocaleDateString() : '—'}</TableCell><TableCell><Stack direction="row" spacing={1} alignItems="center"><TextField size="small" placeholder="Reason if rejecting" value={reason[txt(row.id)] ?? ''} onChange={event => setReason(prev => ({ ...prev, [txt(row.id)]: event.target.value }))} sx={{ width: 180 }} /><Button size="small" variant="contained" onClick={() => update(row, 'Approved')}>Approve</Button><Button size="small" color="error" onClick={() => update(row, 'Rejected')}>Reject</Button></Stack></TableCell></TableRow>; })}</TableBody></Table></TableContainer> : <Typography color="text.secondary">No pending registration requests are available for your assigned batches.</Typography>}</Paper><Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>Approved registrations · withdraw when needed</Typography>{requests.filter(row => batchIds.has(txt(row.batchId)) && ['approved', 'confirmed'].includes(txt(row.status ?? row.registrationStatus).toLowerCase())).length ? <Stack spacing={1}>{requests.filter(row => batchIds.has(txt(row.batchId)) && ['approved', 'confirmed'].includes(txt(row.status ?? row.registrationStatus).toLowerCase())).map(row => <Stack key={txt(row.id)} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} justifyContent="space-between" sx={{ py: .7, borderTop: '1px solid #edf1f5' }}><Typography variant="body2">{txt(row.traineeName || row.name)} · {txt(row.batchCode)} · Approved</Typography><Stack direction="row" spacing={1}><TextField size="small" placeholder="Reason to withdraw" value={reason[txt(row.id)] ?? ''} onChange={event => setReason(prev => ({ ...prev, [txt(row.id)]: event.target.value }))} /><Button size="small" color="warning" onClick={() => update(row, 'Withdrawn')}>Withdraw</Button></Stack></Stack>)}</Stack> : <Typography color="text.secondary">No approved registrations are available to withdraw.</Typography>}</Paper><Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>Recent decisions</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{requests.filter(row => batchIds.has(txt(row.batchId)) && ['approved', 'rejected', 'withdrawn'].includes(txt(row.status || row.registrationStatus).toLowerCase())).slice(-12).reverse().map(row => <Chip key={txt(row.id)} label={`${txt(row.traineeName || row.name)} · ${txt(row.batchCode)} · ${txt(row.status)}`} color={txt(row.status || row.registrationStatus).toLowerCase() === 'approved' ? 'success' : 'default'} variant="outlined" />)}</Stack></Paper></Stack></Container><Footer /></main></Box>;
}
