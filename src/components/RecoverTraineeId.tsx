import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from '@mui/material';
import { Footer, Topbar } from './DashboardParts';

const base = import.meta.env.BASE_URL;
const recoveryApi = (import.meta.env as ImportMetaEnv & { VITE_TRAINEE_RECOVERY_API?: string }).VITE_TRAINEE_RECOVERY_API?.replace(/\/$/, '');

export default function RecoverTraineeId() {
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [traineeId, setTraineeId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setTraineeId('');
    if (!recoveryApi) { setError('Trainee ID recovery is not configured yet. Contact your administrator.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`${recoveryApi}/request-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: contact.trim() }) });
      const payload = await response.json();
      if (!response.ok || !payload.requestId) throw new Error(payload.message || 'Could not start verification. Try again later.');
      setRequestId(String(payload.requestId));
      setMessage('If a trainee record matches that contact, a verification code has been sent. Enter it below.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start verification. Try again later.'); }
    finally { setBusy(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setTraineeId('');
    if (!recoveryApi || !requestId) return;
    setBusy(true);
    try {
      const response = await fetch(`${recoveryApi}/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, otp: otp.trim() }) });
      const payload = await response.json();
      if (!response.ok || !payload.verified || !payload.traineeId) throw new Error(payload.message || 'The code could not be verified. Request a new code if it has expired.');
      setTraineeId(String(payload.traineeId)); setOtp('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The code could not be verified.'); }
    finally { setBusy(false); }
  }

  return <Box sx={{ minHeight: '100vh', bgcolor: '#f4f7fb', display: 'flex', flexDirection: 'column' }}><Box sx={{ px: { xs: 2, md: 4 } }}><Topbar title="Recover Trainee ID" logoSrc="/assets/AddingDimensions.png" /></Box><Box sx={{ flex: 1, py: { xs: 3, md: 6 } }}><Container maxWidth="sm"><Card elevation={0} sx={{ border: '1px solid #e2eaf2', borderRadius: 3 }}><CardContent sx={{ p: { xs: 2.5, md: 4 } }}><Typography variant="h4" fontWeight={800} color="#173553">Recover your Trainee ID</Typography><Typography color="text.secondary" sx={{ mt: .75, mb: 3 }}>Verify an email address or mobile number already associated with your trainee record.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{message && <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert>}{traineeId && <Alert severity="success" sx={{ mb: 2 }}>Your Trainee ID is <strong>{traineeId}</strong>. Keep it for future training registrations.</Alert>}
    {!requestId ? <Box component="form" onSubmit={requestCode}><Stack spacing={2}><TextField fullWidth required label="Email address or mobile number" value={contact} onChange={event => setContact(event.target.value)} autoComplete="email tel" /><Button type="submit" variant="contained" disabled={busy}>Send verification code</Button></Stack></Box> : !traineeId && <Box component="form" onSubmit={verifyCode}><Stack spacing={2}><TextField fullWidth required label="One-time verification code" value={otp} onChange={event => setOtp(event.target.value)} inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }} /><Button type="submit" variant="contained" disabled={busy}>Verify and retrieve ID</Button><Button type="button" onClick={() => { setRequestId(''); setOtp(''); setMessage(''); }} disabled={busy}>Use a different contact</Button></Stack></Box>}
    {traineeId && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}><Button href={`${base}register`} variant="contained">Continue to registration</Button><Button href={`${base}login`}>Login</Button></Stack>}
    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 3 }}>Your ID is shown only after the verification service confirms the one-time code. If you no longer have access to the registered contact, ask an authorized administrator to verify your identity.</Typography>
  </CardContent></Card></Container></Box><Footer /></Box>;
}
