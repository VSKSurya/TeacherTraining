import { useMemo, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Container, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Footer, Topbar } from './DashboardParts';
import { formatDate } from '../dateFormat';
import { businessDateToday, registrationWindow, registrationWindowError } from '../registrationRules';

type Row = Record<string, any>;
type Batch = Row & { id: string; batchCode?: string; name?: string; openRegistration?: boolean; trainingDates?: string[]; trainingStartDate?: string; trainingEndAuto?: string; trainingPlanName?: string };
const BATCHES = 'teacher-training-batch-plan-uses';
const REGISTRATIONS = 'teacher-training-registrations';
const TRAINEES = 'teacher-training-trainees';
const read = <T,>(key: string): T[] => { try { const parsed = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
const clean = (value: unknown) => String(value ?? '').trim();
const normalizedName = (value: unknown) => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizedPhone = (value: unknown) => clean(value).replace(/\D/g, '');
const active = (row: Row) => !['rejected', 'cancelled', 'withdrawn'].includes(clean(row.status ?? row.registrationStatus).toLowerCase());
const base = import.meta.env.BASE_URL;

export default function OpenRegistration() {
  const batches = useMemo(() => read<Batch>(BATCHES), []);
  const [batchRef, setBatchRef] = useState(() => new URLSearchParams(location.search).get('batch') ?? new URLSearchParams(location.search).get('code') ?? '');
  const batch = batches.find(item => [item.id, item.batchCode, item.uniqueId].some(value => clean(value).toLowerCase() === batchRef.trim().toLowerCase()));
  const registrations = read<Row>(REGISTRATIONS);
  const cap = Number(batch?.registrationCapacity ?? batch?.participantCapacity ?? batch?.capacity);
  const occupied = batch ? registrations.filter(row => (clean(row.batchId) === batch.id || clean(row.batchCode).toLowerCase() === clean(batch.batchCode).toLowerCase()) && active(row)).length : 0;
  const window = batch ? registrationWindow(batch) : undefined;
  const closedReason = !batch ? '' : registrationWindowError(batch) || (Number.isFinite(cap) && cap > 0 && occupied >= cap ? 'This batch has reached its registration capacity.' : '');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(''); setError('');
    const latestBatch = read<Batch>(BATCHES).find(item => item.id === batch?.id);
    const latestRegistrations = read<Row>(REGISTRATIONS);
    const currentCap = Number(latestBatch?.registrationCapacity ?? latestBatch?.participantCapacity ?? latestBatch?.capacity);
    const currentCount = latestBatch ? latestRegistrations.filter(row => (clean(row.batchId) === latestBatch.id || clean(row.batchCode).toLowerCase() === clean(latestBatch.batchCode).toLowerCase()) && active(row)).length : 0;
    const latestError = !latestBatch ? 'This batch is no longer available.' : registrationWindowError(latestBatch) || (Number.isFinite(currentCap) && currentCap > 0 && currentCount >= currentCap ? 'This batch has reached its registration capacity.' : '');
    if (!batch || closedReason || latestError) { setError(latestError || closedReason || 'Enter a valid batch code or registration link.'); return; }
    const form = new FormData(event.currentTarget);
    const name = clean(form.get('name')); const email = clean(form.get('email')).toLowerCase(); const phone = clean(form.get('phone')); const category = clean(form.get('category'));
    if (!name || (!email && !phone)) { setError('Enter your name and at least an email address or mobile number.'); return; }
    const current = latestRegistrations;
    const duplicate = current.some(row => (clean(row.batchId) === batch.id || clean(row.batchCode).toLowerCase() === clean(batch.batchCode).toLowerCase()) && active(row) && ((email && clean(row.email).toLowerCase() === email) || (phone && normalizedPhone(row.phone) === normalizedPhone(phone))));
    if (duplicate) { setError('A registration request for this trainee already exists in this batch.'); return; }
    const people = read<Row>(TRAINEES);
    const byEmail = email ? people.find(person => clean(person.email).toLowerCase() === email) : undefined;
    const byPhone = phone ? people.find(person => normalizedPhone(person.phone) === normalizedPhone(phone)) : undefined;
    if (byEmail && byPhone && clean(byEmail.id) !== clean(byPhone.id)) { setError('The email and mobile number match different trainee records. Contact the batch administrator.'); return; }
    const priorEmail = email ? current.find(row => clean(row.email).toLowerCase() === email) : undefined;
    const priorPhone = phone ? current.find(row => normalizedPhone(row.phone) === normalizedPhone(phone)) : undefined;
    const priorEmailId = clean(priorEmail?.traineeId ?? priorEmail?.participantId);
    const priorPhoneId = clean(priorPhone?.traineeId ?? priorPhone?.participantId);
    if (priorEmailId && priorPhoneId && priorEmailId !== priorPhoneId) { setError('The email and mobile number match different trainee records. Contact the batch administrator.'); return; }
    const possibleDuplicate = people.find(person => normalizedName(person.name ?? person.traineeName) === normalizedName(name) && normalizedName(person.schoolUdise ?? person.schoolCode) === normalizedName(batch.schoolUdiseVenue ?? batch.schoolUdise));
    if (possibleDuplicate && !byEmail && !byPhone && !priorEmailId && !priorPhoneId) { setError('A possible trainee record already exists for this name and school. Recover the existing Trainee ID with its registered email/mobile or contact an administrator to verify the match.'); return; }
    const existing = byEmail ?? byPhone ?? priorEmail ?? priorPhone;
    const traineeId = clean(byEmail?.id ?? byPhone?.id ?? priorEmail?.traineeId ?? priorEmail?.participantId ?? priorPhone?.traineeId ?? priorPhone?.participantId) || `TR-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    if (!byEmail && !byPhone) localStorage.setItem(TRAINEES, JSON.stringify([...people, { id: traineeId, traineeId, name, email, phone, category, status: 'Pending', schoolUdise: batch.schoolUdiseVenue ?? batch.schoolUdise, schoolName: batch.schoolName, district: batch.district, state: batch.state, projectId: batch.projectId, createdAt: now, updatedAt: now }]));
    current.push({ id: `REG-${crypto.randomUUID()}`, batchId: batch.id, batchCode: batch.batchCode, traineeId, traineeName: clean(existing?.name) || name, name: clean(existing?.name) || name, email: email || clean(existing?.email), phone: phone || clean(existing?.phone), category, status: 'Pending', registrationStatus: 'Pending', submittedAt: now });
    localStorage.setItem(REGISTRATIONS, JSON.stringify(current));
    setNotice('Registration request submitted. The trainer or administrator must review it before your place is confirmed.');
    (event.currentTarget as HTMLFormElement).reset();
  }

  return <Box sx={{ minHeight: '100vh', bgcolor: '#f4f7fb', display: 'flex', flexDirection: 'column' }}><Box sx={{ width: '100%', px: { xs: 2, md: 4 }, bgcolor: '#f4f7fb' }}><Topbar title="Adding Dimensions — Enhancing Teaching for Tomorrow" logoSrc="/assets/AddingDimensions.png" /></Box><Box sx={{ flex: 1, py: { xs: 3, md: 6 } }}><Container maxWidth="sm"><Stack spacing={2.5}>
    <Stack direction="row" justifyContent="flex-end" alignItems="center"><Button href={`${base}login`} sx={{ textTransform: 'none' }}>Login</Button></Stack>
    <Card elevation={0} sx={{ border: '1px solid #e2eaf2', borderRadius: 3 }}><CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
      <Typography variant="h4" fontWeight={800} color="#173553">Open registration</Typography><Typography color="text.secondary" sx={{ mt: .5, mb: 3 }}>Enter a batch code to view details and request a place.</Typography>
      <TextField fullWidth label="Batch code" value={batchRef} onChange={event => { setBatchRef(event.target.value); setNotice(''); setError(''); }} placeholder="Enter the shared batch code" />
      {batch && <Card variant="outlined" sx={{ my: 2, bgcolor: '#f8fbff' }}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={750}>{batch.batchCode || batch.name || 'Training batch'}</Typography><Chip size="small" label={closedReason ? 'Closed' : 'Open'} color={closedReason ? 'default' : 'success'} /></Stack><Typography variant="body2" color="text.secondary">{batch.projectName || 'Training project'} · {batch.trainingPlanName || batch.planName || batch.trainingPlanCode || 'Training plan'}</Typography><Typography variant="body2" sx={{ mt: 1 }}>Dates: {(batch.trainingDates ?? [batch.trainingStartDate, batch.trainingEndAuto].filter(Boolean)).map(formatDate).join(', ') || 'To be confirmed'}</Typography><Typography variant="body2">Registration window: {formatDate(window?.opensOn) || "—"} to {formatDate(window?.closesOn) || "—"} · Today {formatDate(businessDateToday())} ({import.meta.env.VITE_BUSINESS_TIME_ZONE?.trim() || "Asia/Kolkata"})</Typography><Typography variant="body2">Venue: {batch.schoolUdiseVenue || batch.venue || 'To be confirmed'} · Trainer: {batch.trainerName || batch.trainerCode || 'To be confirmed'}</Typography>{Number.isFinite(cap) && cap > 0 && <Typography variant="body2" sx={{ mt: .5 }}>Places remaining: {Math.max(0, cap - occupied)}</Typography>}</CardContent></Card>}
      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ my: 2 }}>{notice}</Alert>}
      {batch && !closedReason && <Box component="form" onSubmit={submit}><Stack spacing={2} sx={{ mt: 2 }}><TextField required fullWidth name="name" label="Full name" /><TextField fullWidth name="email" type="email" label="Email address" /><TextField fullWidth name="phone" label="Mobile number" /><TextField select fullWidth name="category" label="Participant category" defaultValue="Teacher"><MenuItem value="Teacher">Teacher</MenuItem><MenuItem value="Student">Student</MenuItem><MenuItem value="Other">Other</MenuItem></TextField><Button variant="contained" type="submit" size="large" sx={{ textTransform: 'none' }}>Submit registration request</Button></Stack></Box>}
      {batch && closedReason && <Alert severity="info" sx={{ mt: 2 }}>{closedReason}</Alert>}
      {!batch && batchRef && <Alert severity="warning" sx={{ mt: 2 }}>No batch matches that code. Check the code with the trainer or administrator.</Alert>}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3 }}>Submitting a request does not confirm a place. Your trainer or an authorized administrator will review it.</Typography>
    </CardContent></Card>
  </Stack></Container></Box><Footer /></Box>;
}
