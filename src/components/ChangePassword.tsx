import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Alert, Box, Button, Container, IconButton, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { DEMO_PASSWORD, getSession, getUsers, passwordWasRecentlyUsed, saveUsers, signOut, updateUserPassword } from '../auth';

type Step = 'details' | 'otp' | 'success';
type ChangeOtpResponse = { requestId?: string; emailAddress?: string; maskedEmail?: string; expiresAt?: string; message?: string };
type VerifyOtpResponse = { verified?: boolean; changeToken?: string; expiresAt?: string; message?: string };
const api = (import.meta.env as ImportMetaEnv & { VITE_PASSWORD_RECOVERY_API?: string }).VITE_PASSWORD_RECOVERY_API?.replace(/\/$/, '');
const requirements = [
  { label: 'At least 8 characters', valid: (value: string) => value.length >= 8 },
  { label: 'One uppercase letter (A–Z)', valid: (value: string) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter (a–z)', valid: (value: string) => /[a-z]/.test(value) },
  { label: 'One number (0–9)', valid: (value: string) => /[0-9]/.test(value) },
  { label: 'One special character (for example, ! @ # $ %)', valid: (value: string) => /[^A-Za-z0-9\s]/.test(value) },
  { label: 'No spaces', valid: (value: string) => !/\s/.test(value) },
];
function EyeIcon({ visible }: { visible: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.7"/>{visible && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>}</svg>;
}

export default function ChangePassword() {
  const session = getSession();
  const account = useMemo(() => session ? getUsers().find(user => user.userId.toLowerCase() === session.userId.toLowerCase()) : undefined, [session?.userId]);
  const [step, setStep] = useState<Step>('details');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '']);
  const [requestId, setRequestId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordAttempted, setPasswordAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);
  const passwordRecentlyUsed = Boolean(newPassword && account && passwordWasRecentlyUsed(account, newPassword));
  const passwordValid = useMemo(() => requirements.every(item => item.valid(newPassword)) && !passwordRecentlyUsed, [newPassword, passwordRecentlyUsed]);
  const unmetRequirements = useMemo(() => [...requirements.filter(item => !item.valid(newPassword)).map(item => item.label), ...(passwordRecentlyUsed ? ['Must not reuse any of your last 3 passwords'] : [])], [newPassword, passwordRecentlyUsed]);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  function updateOtpDigit(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    const next = [...otp];
    if (digits.length > 1) digits.slice(0, 4 - index).split('').forEach((digit, offset) => { next[index + offset] = digit; });
    else next[index] = digits;
    setOtp(next);
    if (digits && index < 3) otpInputs.current[Math.min(index + digits.length, 3)]?.focus();
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) otpInputs.current[index - 1]?.focus();
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); otpInputs.current[index - 1]?.focus(); }
    if (event.key === 'ArrowRight' && index < 3) { event.preventDefault(); otpInputs.current[index + 1]?.focus(); }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLDivElement>) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!digits) return;
    event.preventDefault(); setOtp([...digits, ...Array(4 - digits.length).fill('')]); otpInputs.current[Math.min(digits.length, 3)]?.focus();
  }

  useEffect(() => {
    if (!expiresAt || step !== 'otp') return;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, step]);

  const post = async <T,>(endpoint: string, body: Record<string, string>) => {
    if (!api) throw new Error('Email verification is not configured. Contact your administrator.');
    const response = await fetch(`${api}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({})) as T & { message?: string };
    if (!response.ok) throw new Error(payload.message || 'The request could not be completed. Please try again.');
    return payload;
  };

  async function requestOtp(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(''); setNotice('');
    setPasswordAttempted(true);
    if (!session) { setError('Your session has expired. Sign in again to change your password.'); return; }
    if (!currentPassword) { setError('Enter your current password.'); return; }
    if (!passwordValid) { setError(`Your new password does not meet these security criteria: ${unmetRequirements.join('; ')}.`); return; }
    if (!passwordsMatch) { setError('The new password and confirmation do not match.'); return; }
    setBusy(true);
    try {
      let result: ChangeOtpResponse;
      if (!api && import.meta.env.DEV) {
        const user = getUsers().find(item => item.userId.toLowerCase() === session.userId.toLowerCase());
        if (!user || currentPassword !== (user.password ?? DEMO_PASSWORD)) throw new Error('Your current password is incorrect.');
        result = { requestId: `demo-${session.userId}-${crypto.randomUUID()}`, maskedEmail: '', expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
        setNotice('Demo mode: email delivery is disabled. Use 1234 as the verification code.');
      } else {
        result = await post<ChangeOtpResponse>('change-password/request-otp', { userId: session.userId, currentPassword });
        setNotice(`A verification code was sent to ${result.emailAddress || result.maskedEmail || 'your registered email address'}.`);
      }
      if (!result.requestId) throw new Error(result.message || 'Could not start email verification.');
      setRequestId(result.requestId);
      setDeliveryEmail(result.emailAddress || result.maskedEmail || 'your registered email address');
      setMaskedEmail(result.maskedEmail || result.emailAddress || '');
      const expiry = result.expiresAt ? Date.parse(result.expiresAt) : Date.now() + 10 * 60_000;
      setExpiresAt(Number.isFinite(expiry) ? expiry : Date.now() + 10 * 60_000);
      setOtp(['', '', '', '']); setStep('otp');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send the verification code.'); }
    finally { setBusy(false); }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    if (secondsLeft <= 0) { setError('This verification code has expired. Request a new code.'); return; }
    const otpCode = otp.join('');
    if (!/^\d{4}$/.test(otpCode)) { setError('Enter the four-digit verification code.'); return; }
    setBusy(true);
    try {
      let verifiedToken = '';
      if (!api && import.meta.env.DEV) {
        if (otpCode !== '1234') throw new Error('That demo verification code is incorrect.');
        verifiedToken = `demo-change-${requestId}`;
      } else {
        const result = await post<VerifyOtpResponse>('change-password/verify-otp', { requestId, otp: otpCode });
        if (result.verified !== true || !result.changeToken) throw new Error(result.message || 'The verification code is invalid or expired.');
        verifiedToken = result.changeToken;
      }
      if (api) {
        const result = await post<{ success?: boolean }>('change-password/complete', { changeToken: verifiedToken, newPassword });
        if (result.success !== true) throw new Error(result.message || 'Your password could not be changed. Try again.');
      }
      if (session) {
        const users = getUsers();
        saveUsers(users.map(user => user.userId.toLowerCase() === session.userId.toLowerCase() ? updateUserPassword(user, newPassword) : user));
      }
      setStep('success');
      setNotice('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The verification code could not be checked.'); }
    finally { setBusy(false); }
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  return <div className="app"><Sidebar /><main className="main" id="main-content"><Topbar title="Change Password" description="Update your account password securely." /><Container maxWidth="md" sx={{ py: { xs: 2, md: 3 } }}>
    <Paper elevation={0} sx={{ maxWidth: 900, mx: 'auto', overflow: 'hidden', border: '1px solid #dce7f1', borderRadius: 3, boxShadow: '0 8px 28px rgba(23,53,83,.08)' }}>
      <Stack spacing={2} sx={{ p: { xs: 2, sm: 3 } }}>
        {error && <Alert severity="error">{error}</Alert>}{notice && <Alert severity="info">{notice}</Alert>}
        {step === 'details' && <Box component="form" onSubmit={requestOtp}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(260px, .85fr)' }, gap: { xs: 2, md: 3 }, alignItems: 'start' }}><Stack spacing={2}>
          <TextField fullWidth label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
          <TextField fullWidth label="New password" type={showNewPassword ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={event => { setNewPassword(event.target.value); setError(''); }} onBlur={() => setPasswordAttempted(true)} error={passwordAttempted && !passwordValid} helperText={passwordAttempted && !passwordValid ? `Missing: ${unmetRequirements.join('; ')}.` : ' '} required InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} onClick={() => setShowNewPassword(value => !value)} edge="end"><EyeIcon visible={showNewPassword} /></IconButton></InputAdornment> }} />
          <TextField fullWidth label="Confirm new password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} onPaste={event => event.preventDefault()} required error={Boolean(confirmPassword) && !passwordsMatch} helperText={confirmPassword && !passwordsMatch ? 'Passwords do not match.' : 'For security, paste is disabled.'} InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'} onClick={() => setShowConfirmPassword(value => !value)} edge="end"><EyeIcon visible={showConfirmPassword} /></IconButton></InputAdornment> }} />
          <Button type="submit" variant="contained" disabled={busy || !currentPassword || !newPassword || !confirmPassword || !passwordsMatch} sx={{ alignSelf: 'flex-start', minHeight: 42, px: 2.5, borderRadius: 2, textTransform: 'none', fontWeight: 750 }}>{busy ? 'Sending code…' : 'Verify and send OTP'}</Button>
        </Stack><Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2.5, borderColor: '#dce7f1', bgcolor: '#f8fbfe' }}><Typography variant="subtitle1" sx={{ mb: 1.25, color: '#173553', fontWeight: 800 }}>Security Criteria</Typography><Box component="ul" sx={{ display: 'grid', gap: .85, listStyle: 'none', p: 0, m: 0, color: '#63788c', fontSize: 12.5 }}>{requirements.map(item => <Box component="li" key={item.label} sx={{ color: item.valid(newPassword) ? '#078347' : passwordAttempted ? '#b3261e' : '#63788c' }}>{item.valid(newPassword) ? '✓' : passwordAttempted ? '×' : '○'} {item.label}</Box>)}<Box component="li" sx={{ color: passwordRecentlyUsed ? passwordAttempted ? '#b3261e' : '#63788c' : newPassword ? '#078347' : '#63788c' }}>{passwordRecentlyUsed ? passwordAttempted ? '×' : '○' : newPassword ? '✓' : '○'} Cannot reuse any of your last 3 passwords</Box></Box></Paper></Box></Box>}
        {step === 'otp' && <Box component="form" onSubmit={verifyOtp}><Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">Enter the four-digit verification code sent to {deliveryEmail || maskedEmail || 'your registered email address'}.</Typography>
          <Box role="group" aria-label="Four-digit verification code" onPaste={handleOtpPaste} sx={{ display: 'flex', gap: 1, justifyContent: 'flex-start' }}>{Array.from({ length: 4 }, (_, index) => <TextField key={index} autoFocus={index === 0} value={otp[index] || ''} onChange={event => updateOtpDigit(index, event.target.value)} onKeyDown={event => handleOtpKeyDown(index, event)} inputRef={element => { otpInputs.current[index] = element; }} inputProps={{ inputMode: 'numeric', autoComplete: index === 0 ? 'one-time-code' : 'off', maxLength: 1, pattern: '[0-9]', 'aria-label': `Verification code digit ${index + 1} of 4` }} required sx={{ width: { xs: 54, sm: 64 }, '& input': { textAlign: 'center', fontSize: 20, fontWeight: 750, px: 1 } }} />)}</Box>
          <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, bgcolor: secondsLeft > 0 ? '#f5faff' : '#fff8f5', borderColor: secondsLeft > 0 ? '#d6e7f5' : '#f0d5c8' }}><Typography variant="body2" sx={{ color: '#52677d' }}>Code validity</Typography><Typography aria-live="polite" sx={{ ml: 'auto', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: secondsLeft > 0 ? '#176fba' : '#bb4b2a' }}>{secondsLeft > 0 ? `${minutes}:${seconds} remaining` : 'Expired'}</Typography></Paper>
          <Stack direction="row" spacing={1} flexWrap="wrap"><Button type="submit" variant="contained" disabled={busy || secondsLeft === 0 || otp.some(digit => !digit)} sx={{ minHeight: 42, px: 2.5, borderRadius: 2, textTransform: 'none', fontWeight: 750 }}>{busy ? 'Verifying…' : 'Verify code'}</Button><Button type="button" variant="outlined" disabled={busy} onClick={() => { void requestOtp(); }} sx={{ minHeight: 42, borderRadius: 2, textTransform: 'none' }}>Resend code</Button><Button type="button" onClick={() => { setStep('details'); setOtp(['', '', '', '']); setError(''); setNotice(''); }} sx={{ textTransform: 'none' }}>Back</Button></Stack>
        </Stack></Box>}
        {step === 'success' && <Stack spacing={1.5}><Alert severity="success">Password set successfully. Sign in again with your new password.</Alert><Button variant="contained" onClick={() => { signOut(); window.location.assign(`${import.meta.env.BASE_URL}#/login`); }} sx={{ alignSelf: 'flex-start', minHeight: 42, px: 2.5, borderRadius: 2, textTransform: 'none', fontWeight: 750 }}>Sign in with new password</Button></Stack>}
      </Stack>
    </Paper>
  </Container><Footer /></main></div>;
}
