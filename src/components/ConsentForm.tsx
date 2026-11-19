import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Checkbox, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Link, Paper, Stack, Typography } from '@mui/material';
import { getSession } from '../auth';
import TraineeDashboard from './TraineeDashboard';
import { acceptConsent, CONSENT_DECLARATION, CONSENT_VERSION, fetchConsentStatus, type ConsentRecord } from '../consent';

const base = import.meta.env.BASE_URL;
const TRAINEES_KEY = 'teacher-training-trainees';
const REGISTRATIONS_KEY = 'teacher-training-registrations';
type Row = Record<string, any>;
function readRows(key: string): Row[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
const identity = (row: Row) => String(row.userId ?? row.traineeId ?? row.participantId ?? row.id ?? '').trim().toLowerCase();

export function ConsentAcceptance({ checked, onChange }: { checked: boolean; onChange: (accepted: boolean) => void }) {
  return <Stack spacing={.5}>
    <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
      <Link href={`${base}consent-form`} target="_blank" rel="noreferrer">View complete Consent Form</Link>
      {' · '}
      <Link href={`${base}privacy-policy`} target="_blank" rel="noreferrer">Privacy Policy</Link>
    </Typography>
    <FormControlLabel control={<Checkbox checked={checked} onChange={event => onChange(event.target.checked)} />} label="I have read and agree to the Consent Form." />
  </Stack>;
}

function saveAcceptanceLocally(userId: string, record: ConsentRecord) {
  const trainees = readRows(TRAINEES_KEY).map(row => identity(row) === userId.toLowerCase() || String(row.userId ?? row.traineeId ?? row.id ?? '').toLowerCase() === userId.toLowerCase() || String(row.email ?? '').toLowerCase() === userId.toLowerCase()
    ? { ...row, consentStatus: 'Accepted', consentProvided: true, consentVersion: record.version, consentAcceptedAt: record.acceptedAt }
    : row);
  localStorage.setItem(TRAINEES_KEY, JSON.stringify(trainees));
  const registrations = readRows(REGISTRATIONS_KEY).map(row => String(row.traineeId ?? row.userId ?? '').toLowerCase() === userId.toLowerCase() || String(row.email ?? '').toLowerCase() === userId.toLowerCase()
    ? { ...row, consentStatus: 'Accepted', consentProvided: true, consentVersion: record.version, consentAcceptedAt: record.acceptedAt }
    : row);
  localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(registrations));
}

export function TraineeConsentGate({ children }: { children?: ReactNode }) {
  const session = getSession();
  const userId = session?.userId ?? '';
  const trainee = readRows(TRAINEES_KEY).find(row => identity(row) === userId.toLowerCase() || String(row.userId ?? row.traineeId ?? row.id ?? '').toLowerCase() === userId.toLowerCase() || String(row.email ?? '').toLowerCase() === userId.toLowerCase());
  const requiresConsent = Boolean(trainee && (trainee.consentStatus === 'Pending' || trainee.source === 'Excel upload'));
  const [pending, setPending] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(requiresConsent);
  const [error, setError] = useState('');

  async function checkStatus() {
    if (!requiresConsent || !userId) { setLoading(false); setPending(false); return; }
    setLoading(true); setError('');
    try {
      const record = await fetchConsentStatus(userId);
      const valid = record?.status === 'Accepted' && record.version === CONSENT_VERSION && Boolean(record.acceptedAt);
      if (valid && record) { saveAcceptanceLocally(userId, record); setPending(false); }
      else setPending(true);
    } catch (reason) {
      setPending(true);
      setError(reason instanceof Error ? reason.message : 'Could not check your consent status.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void checkStatus(); }, [userId, requiresConsent]);

  async function accept() {
    if (!checked || !userId) return;
    setBusy(true); setError('');
    try {
      const record = await acceptConsent(userId);
      saveAcceptanceLocally(userId, record);
      setPending(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your consent could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }

  if (!requiresConsent || (!pending && !loading)) return <>{children ?? <TraineeDashboard />}</>;
  return <>
    <Dialog open disableEscapeKeyDown onClose={() => undefined} fullWidth maxWidth="sm" aria-labelledby="trainee-consent-title">
      <DialogTitle id="trainee-consent-title">Consent Form</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography>{CONSENT_DECLARATION}</Typography>
          <Stack direction="row" spacing={2}>
            <Link href={`${base}consent-form`} target="_blank" rel="noreferrer">View complete Consent Form</Link>
            <Link href={`${base}privacy-policy`} target="_blank" rel="noreferrer">Privacy Policy</Link>
          </Stack>
          {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void checkStatus()} disabled={loading}>Retry</Button>}>{error}</Alert>}
          {loading && <Typography role="status" color="text.secondary">Checking your consent status…</Typography>}
          <FormControlLabel control={<Checkbox checked={checked} onChange={event => setChecked(event.target.checked)} disabled={loading} />} label="I have read and agree to the Consent Form and Privacy Policy." />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}><Button variant="contained" onClick={() => void accept()} disabled={!checked || busy || loading}>{busy ? 'Saving…' : 'Accept & Continue'}</Button></DialogActions>
    </Dialog>
  </>;
}

export function ConsentDocument({ privacy = false }: { privacy?: boolean }) {
  const title = privacy ? 'Privacy Policy' : 'Consent Form';
  return <Box sx={{ minHeight: '100vh', bgcolor: '#f4f7fb', display: 'flex', flexDirection: 'column' }}><Box sx={{ flex: 1, py: { xs: 3, md: 6 } }}><Container maxWidth="md"><Paper elevation={0} sx={{ p: { xs: 2.5, md: 4 }, border: '1px solid #e2eaf2', borderRadius: 3 }}><Typography variant="h4" fontWeight={800} color="#173553">{title}</Typography>{privacy ? <Stack spacing={2} sx={{ mt: 2 }}><Typography>This notice explains how the Training Portal uses information needed to provide registration and training services.</Typography><Typography><strong>Information used.</strong> The Portal may process your name, contact details, school and professional profile, registration, attendance, assessment, feedback, and certificate records.</Typography><Typography><strong>Purpose and access.</strong> Information is used to manage registration and deliver, administer, and report on training. It is available to authorized trainers and Portal administrators for those purposes.</Typography><Typography><strong>Questions.</strong> Contact your Training Portal administrator if you have questions about your information or need help with a record.</Typography></Stack> : <Stack spacing={2} sx={{ mt: 2 }}><Typography variant="subtitle1" fontWeight={700}>Consent declaration · Version {CONSENT_VERSION}</Typography><Typography>{CONSENT_DECLARATION}</Typography><Typography>Acceptance is recorded with your account, the consent version, and the time of acceptance. You can review the <Link href={`${base}privacy-policy`}>Privacy Policy</Link> at any time.</Typography></Stack>}<Button href={`${base}#/login`} sx={{ mt: 3 }}>Back to Login</Button></Paper></Container></Box></Box>;
}
