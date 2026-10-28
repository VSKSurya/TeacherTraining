import { useMemo, useState, type FormEvent } from 'react';
import { Alert, Autocomplete, Box, Button, Card, CardContent, Checkbox, Chip, Container, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Footer, Topbar } from './DashboardParts';
import { formatDate } from '../dateFormat';
import { batchMatchesRecord, batchMatchesReference } from '../batchCodes';
import { businessDateToday, registrationWindow, registrationWindowError } from '../registrationRules';
import { locations } from '../data/locations';
import { kgbvSchools } from '../data/kgbvSchools';

type Row = Record<string, any>;
type Batch = Row & { id: string; batchCode?: string; name?: string; openRegistration?: boolean; trainingDates?: string[]; trainingStartDate?: string; trainingEndAuto?: string; trainingPlanName?: string };
const BATCHES = 'teacher-training-batch-plan-uses';
const REGISTRATIONS = 'teacher-training-registrations';
const TRAINEES = 'teacher-training-trainees';
const VENUES = 'teacher-training-approved-venues';
const DEMO_OTP = '123456';
const CLASSES = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
const SUBJECTS = ['Languages', 'English', 'Science', 'Mathematics', 'Social Studies', 'Computer-CT', 'Vocational', 'Other'];
const read = <T,>(key: string): T[] => { try { const parsed = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
const clean = (value: unknown) => String(value ?? '').trim();
const normalizedName = (value: unknown) => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizedPhone = (value: unknown) => clean(value).replace(/\D/g, '');
const active = (row: Row) => !['rejected', 'cancelled', 'withdrawn'].includes(clean(row.status ?? row.registrationStatus).toLowerCase());
const base = import.meta.env.BASE_URL;

export default function OpenRegistration() {
  const batches = useMemo(() => read<Batch>(BATCHES), []);
  const [batchRef, setBatchRef] = useState(() => new URLSearchParams(location.search).get('batch') ?? new URLSearchParams(location.search).get('code') ?? '');
  const matchingBatches = batches.filter(item => batchMatchesReference(item, batchRef));
  const batch = matchingBatches.length === 1 ? matchingBatches[0] : undefined;
  const batchVenue = batch ? read<Row>(VENUES).find(item => clean(item.code) === clean(batch.schoolUdiseVenue)) : undefined;
  const batchSchool = batch ? kgbvSchools.find(item => item.udise === clean(batch.schoolUdiseVenue)) : undefined;
  const registrations = read<Row>(REGISTRATIONS);
  const cap = Number(batch?.registrationCapacity ?? batch?.participantCapacity ?? batch?.capacity);
  const occupied = batch ? registrations.filter(row => batchMatchesRecord(batch, row) && active(row)).length : 0;
  const registrationDates = batch ? registrationWindow(batch) : undefined;
  const closedReason = !batch ? '' : registrationWindowError(batch) || (Number.isFinite(cap) && cap > 0 && occupied >= cap ? 'This batch has reached its registration capacity.' : '');
  const [state, setState] = useState(''); const [district, setDistrict] = useState(''); const [block, setBlock] = useState('');
  const [school, setSchool] = useState<(typeof kgbvSchools)[number] | null>(null);
  const [schoolQuery, setSchoolQuery] = useState(''); const [classes, setClasses] = useState<string[]>([]); const [subjects, setSubjects] = useState<string[]>([]);
  const [otpPhone, setOtpPhone] = useState(''); const [otp, setOtp] = useState(DEMO_OTP); const [otpRequested, setOtpRequested] = useState(false); const [phoneVerified, setPhoneVerified] = useState(false); const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const stateDistricts = locations.find(item => item.name === state)?.districts ?? [];
  const blocks = [...new Set(kgbvSchools.filter(item => item.state === state && item.district === district).map(item => item.block))].sort();
  const schoolOptions = useMemo(() => kgbvSchools.filter(item => item.state === state && (!district || item.district === district) && (!block || item.block === block) && (!schoolQuery || `${item.udise} ${item.school}`.toLowerCase().includes(schoolQuery.toLowerCase()))), [state, district, block, schoolQuery]);

  function requestOtp() {
    const phone = clean((document.querySelector('[name="phone"]') as HTMLInputElement | null)?.value);
    if (!/^\+?[\d\s()-]{10,16}$/.test(phone) || normalizedPhone(phone).length < 10) { setError('Enter a valid mobile number before requesting OTP.'); return; }
    setOtpPhone(phone); setOtp(DEMO_OTP); setOtpRequested(true); setPhoneVerified(false); setError(''); setNotice(`Demo OTP 123456 is ready for ${phone}.`);
  }
  function verifyOtp() {
    const phone = clean((document.querySelector('[name="phone"]') as HTMLInputElement | null)?.value);
    if (!otpRequested || normalizedPhone(phone) !== normalizedPhone(otpPhone)) { setError('Request a new OTP for the current mobile number.'); setPhoneVerified(false); return; }
    if (otp.trim() !== DEMO_OTP) { setError('Incorrect OTP. For this demo, enter 123456.'); setPhoneVerified(false); return; }
    setPhoneVerified(true); setError(''); setNotice(`Mobile number ${phone} verified.`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(''); setError('');
    const latestBatch = read<Batch>(BATCHES).find(item => item.id === batch?.id);
    const latestRegistrations = read<Row>(REGISTRATIONS);
    const currentCap = Number(latestBatch?.registrationCapacity ?? latestBatch?.participantCapacity ?? latestBatch?.capacity);
    const currentCount = latestBatch ? latestRegistrations.filter(row => batchMatchesRecord(latestBatch, row) && active(row)).length : 0;
    const latestError = !latestBatch ? 'This batch is no longer available.' : registrationWindowError(latestBatch) || (Number.isFinite(currentCap) && currentCap > 0 && currentCount >= currentCap ? 'This batch has reached its registration capacity.' : '');
    if (!batch || closedReason || latestError) { setError(latestError || closedReason || 'Enter a valid batch code or registration link.'); return; }
    const form = new FormData(event.currentTarget);
    const name = clean(form.get('name')); const email = clean(form.get('email')).toLowerCase(); const phone = clean(form.get('phone'));
    const designation = clean(form.get('designation')); const gender = clean(form.get('gender')); const experience = clean(form.get('experience'));
    if (!state || !district || !block || !school || !name || !phone || !gender || !designation || !classes.length || !subjects.length || !experience) { setError('Complete all required school and teaching profile fields.'); return; }
    if (!phoneVerified || normalizedPhone(phone) !== normalizedPhone(otpPhone)) { setError('Verify your current mobile number with the demo OTP before submitting.'); return; }
    if (!accepted) { setError('Accept the registration confirmation to continue.'); return; }
    const current = latestRegistrations;
    const duplicate = current.some(row => batchMatchesRecord(batch, row) && active(row) && ((email && clean(row.email).toLowerCase() === email) || normalizedPhone(row.phone) === normalizedPhone(phone)));
    if (duplicate) { setError('A registration request for this trainee already exists in this batch.'); return; }
    const people = read<Row>(TRAINEES);
    const byEmail = email ? people.find(person => clean(person.email).toLowerCase() === email) : undefined;
    const byPhone = people.find(person => normalizedPhone(person.phone) === normalizedPhone(phone));
    if (byEmail && byPhone && clean(byEmail.id) !== clean(byPhone.id)) { setError('The email and mobile number match different trainee records. Contact the batch administrator.'); return; }
    const priorEmail = email ? current.find(row => clean(row.email).toLowerCase() === email) : undefined;
    const priorPhone = current.find(row => normalizedPhone(row.phone) === normalizedPhone(phone));
    const priorEmailId = clean(priorEmail?.traineeId ?? priorEmail?.participantId);
    const priorPhoneId = clean(priorPhone?.traineeId ?? priorPhone?.participantId);
    if (priorEmailId && priorPhoneId && priorEmailId !== priorPhoneId) { setError('The email and mobile number match different trainee records. Contact the batch administrator.'); return; }
    const possibleDuplicate = people.find(person => normalizedName(person.name ?? person.traineeName) === normalizedName(name) && normalizedName(person.schoolUdise ?? person.schoolCode) === normalizedName(school.udise));
    if (possibleDuplicate && !byEmail && !byPhone && !priorEmailId && !priorPhoneId) { setError('A possible trainee record already exists for this name and school. Recover the existing Trainee ID with its registered email/mobile or contact an administrator to verify the match.'); return; }
    const existing = byEmail ?? byPhone ?? priorEmail ?? priorPhone;
    const traineeId = clean(byEmail?.id ?? byPhone?.id ?? priorEmail?.traineeId ?? priorEmail?.participantId ?? priorPhone?.traineeId ?? priorPhone?.participantId) || `TR-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const profile = { gender, designation, classesTaught: classes, subjectsTaught: subjects, teachingExperience: experience, state, district, block, schoolName: school.school, schoolUdise: school.udise };
    if (!existing) localStorage.setItem(TRAINEES, JSON.stringify([...people, { id: traineeId, traineeId, name, email, phone, category: 'Teacher', ...profile, status: 'Pending', projectId: batch.projectId, createdAt: now, updatedAt: now }]));
    current.push({ id: `REG-${crypto.randomUUID()}`, batchId: batch.id, batchCode: batch.batchCode, traineeId, traineeName: clean(existing?.name) || name, name: clean(existing?.name) || name, email: email || clean(existing?.email), phone, category: 'Teacher', ...profile, status: 'Pending', registrationStatus: 'Pending', acceptedAt: now, submittedAt: now });
    localStorage.setItem(REGISTRATIONS, JSON.stringify(current));
    setNotice('Registration request submitted. The trainer or administrator must review it before your place is confirmed.');
    event.currentTarget.reset(); setState(''); setDistrict(''); setBlock(''); setSchool(null); setClasses([]); setSubjects([]); setOtpRequested(false); setPhoneVerified(false); setAccepted(false);
  }

  return <Box sx={{ minHeight: '100vh', bgcolor: '#f4f7fb', display: 'flex', flexDirection: 'column' }}><Box sx={{ width: '100%', px: { xs: 2, md: 4 }, bgcolor: '#f4f7fb' }}><Topbar title="Adding Dimensions — Enhancing Teaching for Tomorrow" logoSrc="/assets/AddingDimensions.png" /></Box><Box sx={{ flex: 1, py: { xs: 3, md: 6 } }}><Container maxWidth="md"><Stack spacing={2.5}>
    <Stack direction="row" justifyContent="flex-end" alignItems="center"><Button href={`${base}login`} sx={{ textTransform: 'none' }}>Login</Button></Stack>
    <Card elevation={0} sx={{ border: '1px solid #e2eaf2', borderRadius: 3 }}><CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
      <Typography variant="h4" fontWeight={800} color="#173553">Open registration</Typography><Typography color="text.secondary" sx={{ mt: .5, mb: 3 }}>Enter a batch code to view details and register as a teacher.</Typography>
      <TextField fullWidth label="Batch code" value={batchRef} onChange={event => { setBatchRef(event.target.value); setNotice(''); setError(''); }} placeholder="Enter the shared batch code" />
      {batch && <Card variant="outlined" sx={{ my: 2, bgcolor: '#f8fbff' }}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={750}>{batch.batchCode || batch.name || 'Training batch'}</Typography><Chip size="small" label={closedReason ? 'Closed' : 'Open'} color={closedReason ? 'default' : 'success'} /></Stack><Typography variant="body2" color="text.secondary">{batch.projectName || 'Training project'} · {batch.trainingPlanName || batch.planName || batch.trainingPlanCode || 'Training plan'}</Typography><Typography variant="body2" sx={{ mt: 1 }}>Dates: {(batch.trainingDates ?? [batch.trainingStartDate, batch.trainingEndAuto].filter(Boolean)).map(formatDate).join(', ') || 'To be confirmed'}</Typography><Typography variant="body2">Registration window: {formatDate(registrationDates?.opensOn) || '—'} to {formatDate(registrationDates?.closesOn) || '—'} · Today {formatDate(businessDateToday())} ({import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || 'Asia/Kolkata'})</Typography><Typography variant="body2"><strong>Location / Venue:</strong> {[batch.location || batchVenue?.location || batchSchool?.school || batch.name, batchSchool?.block || batch.block, batch.district || batchVenue?.district || batchSchool?.district, batch.state || batchVenue?.state || batchSchool?.state].filter(Boolean).join(', ') || batch.venue || 'To be confirmed'}{(batch.schoolUdiseVenue || batch.venue) ? ` · UDISE / Venue code: ${batch.schoolUdiseVenue || batch.venue}` : ''}</Typography><Typography variant="body2"><strong>Trainer:</strong> {batch.trainerName || batch.trainerCode || 'To be confirmed'}</Typography>{Number.isFinite(cap) && cap > 0 && <Typography variant="body2" sx={{ mt: .5 }}>Places remaining: {Math.max(0, cap - occupied)}</Typography>}</CardContent></Card>}
      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ my: 2 }}>{notice}</Alert>}
      {batch && !closedReason && <Box component="form" onSubmit={submit} sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2, '& > *': { minWidth: 0 } }}>
        <Typography variant="h6" fontWeight={750} sx={{ gridColumn: '1 / -1' }}>School &amp; Teacher Details</Typography>
        <TextField select required fullWidth label="State" value={state} onChange={event => { setState(event.target.value); setDistrict(''); setBlock(''); setSchool(null); }}><MenuItem value="">Select state</MenuItem>{locations.map(item => <MenuItem key={item.name} value={item.name}>{item.name}</MenuItem>)}</TextField>
        <TextField select required fullWidth label="District" value={district} disabled={!state} onChange={event => { setDistrict(event.target.value); setBlock(''); setSchool(null); }}><MenuItem value="">Select district</MenuItem>{stateDistricts.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
        <TextField select required fullWidth label="Block" value={block} disabled={!district} onChange={event => { setBlock(event.target.value); setSchool(null); }}><MenuItem value="">Select block</MenuItem>{blocks.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
        <Autocomplete options={schoolOptions} value={school} inputValue={schoolQuery} disabled={!state} onInputChange={(_, value) => setSchoolQuery(value)} onChange={(_, value) => setSchool(value)} getOptionLabel={item => `${item.school} — ${item.udise}`} isOptionEqualToValue={(a, b) => a.udise === b.udise} renderInput={params => <TextField {...params} required label="Search school with UDISE / KGBV / School Name" placeholder="Type a school name or UDISE code" />} />
        {school && <TextField fullWidth label="UDISE + Code" value={school.udise} InputProps={{ readOnly: true }} />}
        <TextField required fullWidth name="name" label="Teacher name" />
        <TextField required fullWidth name="phone" label="Mobile number" type="tel" inputProps={{ maxLength: 16 }} onChange={() => { setPhoneVerified(false); setOtpRequested(false); }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start" sx={{ gridColumn: '1 / -1', width: '100%' }}><Button variant="outlined" onClick={requestOtp} sx={{ textTransform: 'none', minHeight: 56 }}>Request OTP</Button>{otpRequested && <TextField fullWidth label="Demo OTP" value={otp} onChange={event => setOtp(event.target.value)} helperText="Demo only: use 123456" inputProps={{ inputMode: 'numeric', maxLength: 6 }} />}{otpRequested && <Button variant="contained" onClick={verifyOtp} sx={{ textTransform: 'none', minHeight: 56 }}>Verify OTP</Button>}</Stack>
        <TextField fullWidth name="email" type="email" label="Email (where applicable)" />
        <Typography variant="h6" fontWeight={750} sx={{ pt: 1, gridColumn: '1 / -1' }}>Teaching Profile</Typography>
        <TextField select required fullWidth name="gender" label="Gender" defaultValue=""><MenuItem value="">Select gender</MenuItem>{['Female', 'Male', 'Prefer not to say', 'Other'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
        <TextField select required fullWidth name="designation" label="Designation Role" defaultValue=""><MenuItem value="">Select designation</MenuItem>{['Teacher', 'Head Teacher', 'Other', 'Warden'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
        <TextField select required SelectProps={{ multiple: true }} fullWidth label="Class Taught" value={classes} onChange={event => setClasses(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}>{CLASSES.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
        <TextField select required SelectProps={{ multiple: true }} fullWidth label="Subject(s) Taught" value={subjects} onChange={event => setSubjects(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}>{SUBJECTS.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
        <TextField select required fullWidth name="experience" label="Total Teaching Experience" defaultValue=""><MenuItem value="">Select experience</MenuItem>{['Less Than 1 Year', '1-5 Years', '6-10 Years', '11-15 Years', 'More than 15 Years'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
        {phoneVerified && <FormControlLabel sx={{ gridColumn: '1 / -1' }} control={<Checkbox checked={accepted} onChange={event => setAccepted(event.target.checked)} />} label="I accept and confirm that the details provided are correct." />}
        <Button variant="contained" type="submit" size="large" disabled={!phoneVerified || !accepted} sx={{ gridColumn: '1 / -1', textTransform: 'none' }}>Accept &amp; Submit Registration</Button>
      </Box>}
      {batch && closedReason && <Alert severity="info" sx={{ mt: 2 }}>{closedReason}</Alert>}
      {!batch && batchRef && <Alert severity="warning" sx={{ mt: 2 }}>{matchingBatches.length > 1 ? 'That previous code matches more than one batch. Ask the trainer or administrator for the current Batch Code.' : 'No batch matches that code. Check the code with the trainer or administrator.'}</Alert>}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3 }}>Demo OTP is fixed at 123456 and is not sent to a mobile device. Submitting a request does not confirm a place; the trainer or an authorized administrator will review it.</Typography>
    </CardContent></Card>
  </Stack></Container></Box><Footer /></Box>;
}
