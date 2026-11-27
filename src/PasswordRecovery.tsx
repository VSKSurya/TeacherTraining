import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import './login.css';
import './login-scroll.css';
import { getUsers, passwordWasRecentlyUsed, saveUsers, updateUserPassword } from './auth';
import { trainerProfiles } from './trainerStore';

type Step = 'identity' | 'otp' | 'password' | 'success' | 'username-email' | 'username-otp' | 'username-list';
const base = import.meta.env.BASE_URL;
const api = (import.meta.env as ImportMetaEnv & { VITE_PASSWORD_RECOVERY_API?: string }).VITE_PASSWORD_RECOVERY_API?.replace(/\/$/, '');

export default function PasswordRecovery() {
  const [step, setStep] = useState<Step>('identity');
  const [identity, setIdentity] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '']);
  const [requestId, setRequestId] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordBlurred, setPasswordBlurred] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [usernameEmail, setUsernameEmail] = useState('');
  const [usernameCandidates, setUsernameCandidates] = useState<string[]>([]);
  const otpInputs = useRef<Array<HTMLInputElement | null>>([]);

  function findUsernamesForEmail(email: string) {
    const users = getUsers().filter(user => user.active);
    const emailKey = email.trim().toLowerCase();
    const matches = new Set<string>();
    const add = (row: Record<string, unknown>) => {
      const rowEmail = String(row.email ?? row.emailAddress ?? '').trim().toLowerCase();
      if (rowEmail !== emailKey) return;
      for (const candidate of [row.userId, row.traineeId, row.participantId]) {
        if (typeof candidate !== 'string' || !candidate.trim()) continue;
        const account = users.find(user => user.userId.toLowerCase() === candidate.trim().toLowerCase());
        if (account) matches.add(account.userId);
      }
    };
    users.forEach(user => { if (user.email?.trim().toLowerCase() === emailKey) matches.add(user.userId); });
    try {
      for (const key of ['teacher-training-trainees', 'teacher-training-registrations']) {
        const rows: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
        if (Array.isArray(rows)) rows.forEach(row => { if (row && typeof row === 'object') add(row as Record<string, unknown>); });
      }
    } catch { /* Ignore malformed local profile data. */ }
    trainerProfiles().forEach(profile => {
      if (profile.email.trim().toLowerCase() !== emailKey || !profile.userId) return;
      const account = users.find(user => user.userId.toLowerCase() === profile.userId?.toLowerCase());
      if (account) matches.add(account.userId);
    });
    return [...matches].sort((a, b) => a.localeCompare(b));
  }

  function startUsernameRecovery() {
    setError(''); setNotice(''); setOtp(['', '', '', '']); setUsernameCandidates([]); setStep('username-email');
  }

  function requestUsernameOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const email = usernameEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return; }
    const candidates = findUsernamesForEmail(email);
    if (!candidates.length) { setError('No active usernames are associated with this email address.'); return; }
    setUsernameCandidates(candidates); setOtp(['', '', '', '']); setStep('username-otp');
    setNotice(`Demo OTP 1111 is ready for ${email}.`);
  }

  function verifyUsernameOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    if (otp.join('') !== '1111') { setError('That OTP is incorrect. Enter 1111.'); return; }
    setStep('username-list');
  }

  function selectUsername(userId: string) {
    setIdentity(userId); setStep('identity'); setOtp(['', '', '', '']); setError(''); setNotice('Username found. You can now reset your password.');
  }

  function updateOtpDigit(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    if (digits.length > 1) {
      const next = [...otp];
      digits.slice(0, 4 - index).split('').forEach((digit, offset) => { next[index + offset] = digit; });
      setOtp(next);
      otpInputs.current[Math.min(index + digits.length, 3)]?.focus();
      return;
    }
    const next = [...otp];
    next[index] = digits;
    setOtp(next);
    if (digits && index < 3) otpInputs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) otpInputs.current[index - 1]?.focus();
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); otpInputs.current[index - 1]?.focus(); }
    if (event.key === 'ArrowRight' && index < 3) { event.preventDefault(); otpInputs.current[index + 1]?.focus(); }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (digits) { event.preventDefault(); setOtp([...digits, ...Array(4 - digits.length).fill('')]); otpInputs.current[Math.min(digits.length, 3)]?.focus(); }
  }

  async function post(endpoint: string, body: Record<string, string>) {
    const response = await fetch(`${api}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'The request could not be completed. Please try again.');
    return payload;
  }
  async function sendOtp(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setError(''); setNotice('');
    if (!identity.trim()) { setError('Enter your registered Email Address or User ID.'); return; }
    if (!api && import.meta.env.DEV) {
      const user = getUsers().find(item => item.userId.toLowerCase() === identity.trim().toLowerCase());
      if (!user) { setError('No demo account matches that User ID. Try Demo1 through Demo8.'); return; }
      setRequestId(`demo-${user.userId}`); setStep('otp'); setNotice('Demo mode: enter sample OTP 1234 to continue.'); return;
    }
    if (!api) { setError('Password recovery is not configured. Contact your administrator.'); return; }
    setBusy(true);
    try { const result = await post('request-otp', { identity: identity.trim() }); if (!result.requestId) throw new Error(result.message || 'Could not start verification.'); setRequestId(String(result.requestId)); setStep('otp'); setNotice('If an account matches those details, an OTP has been sent to its registered contact.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start verification.'); } finally { setBusy(false); }
  }
  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const otpCode = otp.join('');
    if (!/^\d{4}$/.test(otpCode)) { setError('Enter the four-digit OTP.'); return; }
    if (!api && import.meta.env.DEV) {
      if (otpCode !== '1234') { setError('That demo OTP is incorrect. Enter 1234.'); return; }
      setResetToken(`demo-reset-${requestId}`); setStep('password'); return;
    }
    setBusy(true);
    try { const result = await post('verify-otp', { requestId, otp: otpCode }); if (!result.verified || !result.resetToken) throw new Error(result.message || 'The OTP could not be verified. Check it or request a new one.'); setResetToken(String(result.resetToken)); setStep('password'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The OTP could not be verified.'); } finally { setBusy(false); }
  }
  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!passwordValid) { setError('Your password does not meet all the requirements shown beside the New Password label.'); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    if (!api && import.meta.env.DEV) {
      const userId = requestId.slice('demo-'.length);
      const users = getUsers();
      const account = users.find(user => user.userId.toLowerCase() === userId.toLowerCase());
      if (account && passwordWasRecentlyUsed(account, password)) { setError('Choose a password you have not used among your last three passwords.'); return; }
      saveUsers(users.map(user => user.userId.toLowerCase() === userId.toLowerCase() ? updateUserPassword(user, password) : user));
      setStep('success'); return;
    }
    setBusy(true);
    try { const result = await post('reset-password', { resetToken, newPassword: password }); if (result.success !== true) throw new Error(result.message || 'Your password could not be reset. Try again.'); setStep('success'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Your password could not be reset.'); } finally { setBusy(false); }
  }
  const steps: Step[] = step.startsWith('username-') ? ['username-email', 'username-otp', 'username-list'] : ['identity', 'otp', 'password', 'success'];
  const stepIndex = steps.indexOf(step);
  const passwordValid = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9\s]/.test(password) && !/\s/.test(password);
  const title = step === 'identity' ? 'Forgot password?' : step === 'otp' || step === 'username-otp' ? 'Verify your identity' : step === 'password' ? 'Create a new password' : step === 'success' ? 'Password reset complete' : step === 'username-email' ? 'Forgot username?' : step === 'username-list' ? 'Select your username' : 'Forgot username?';

  return <main className="login-page">
    <section className="login-story" aria-label="About the learning platform"><div className="story-orbit orbit-one"/><div className="story-orbit orbit-two"/><img className="learning-art" src={`${base}assets/empowering-education-learning-cards.png`} alt="Empowering teachers, transforming classrooms"/><div className="story-copy"><h1>Empowering Teachers, Transforming Classrooms</h1><p>One connected platform to plan training, build teaching skills, track progress, and recognize achievements through certification.</p></div><img className="adding-dimensions" src={`${base}assets/AddingDimensions.png`} alt="Adding Dimensions"/></section>
    <section className="login-panel"><div className="login-content recovery-content"><img className="ernet-logo" src={`${base}assets/ernet-client-logo.jpeg`} alt="ERNet India — Education & Research Network"/><h2>{title}</h2>{step !== 'identity' && <p className="login-intro">{step === 'otp' || step === 'username-otp' ? 'Enter the four-digit code sent to your email address.' : step === 'password' ? 'Choose a strong password for your account.' : step === 'success' ? 'Your new password is ready to use.' : step === 'username-email' ? 'Enter the email address linked to your account.' : step === 'username-list' ? 'Select a username to continue to password recovery.' : ''}</p>}
      <div className="recovery-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>{steps.map((item, i) => <span key={item} className={i <= stepIndex ? 'active' : ''}/>)}</div>
      {error && <p className="login-message recovery-error" role="alert">{error}</p>}{notice && <p className="login-message" role="status">{notice}</p>}
      {step === 'identity' && <form onSubmit={sendOtp}><label htmlFor="recovery-identity">Email Address or User ID <span>*</span></label><div className="login-input-wrap"><input id="recovery-identity" autoComplete="username" value={identity} onChange={e => setIdentity(e.target.value)} required/></div><button className="login-submit" disabled={busy}>{busy ? 'Sending OTP…' : 'Send OTP'}</button></form>}
      {step === 'identity' && <div className="recovery-links"><button type="button" onClick={startUsernameRecovery}>Forgot Username?</button></div>}
      {step === 'username-email' && <form onSubmit={requestUsernameOtp}><label htmlFor="username-email">Email Address <span>*</span></label><div className="login-input-wrap"><input id="username-email" type="email" autoComplete="email" value={usernameEmail} onChange={event => setUsernameEmail(event.target.value)} required /></div><button className="login-submit">Verify OTP</button></form>}
      {step === 'otp' && <form onSubmit={verifyOtp}><label id="recovery-otp-label">Four-digit OTP <span>*</span></label><div className="otp-inputs" role="group" aria-labelledby="recovery-otp-label" onPaste={handleOtpPaste}>{Array.from({ length: 4 }, (_, index) => <input key={index} ref={element => { otpInputs.current[index] = element; }} type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} aria-label={`OTP digit ${index + 1} of 4`} value={otp[index]} onChange={event => updateOtpDigit(index, event.target.value)} onKeyDown={event => handleOtpKeyDown(index, event)} required />)}</div><button className="login-submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify OTP'}</button><div className="recovery-links"><button type="button" disabled={busy} onClick={() => { void sendOtp(); }}>Resend OTP</button></div></form>}
      {step === 'username-otp' && <form onSubmit={verifyUsernameOtp}><label id="username-otp-label">Four-digit OTP <span>*</span></label><div className="otp-inputs" role="group" aria-labelledby="username-otp-label" onPaste={handleOtpPaste}>{Array.from({ length: 4 }, (_, index) => <input key={index} ref={element => { otpInputs.current[index] = element; }} type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} aria-label={`OTP digit ${index + 1} of 4`} value={otp[index]} onChange={event => updateOtpDigit(index, event.target.value)} onKeyDown={event => handleOtpKeyDown(index, event)} required />)}</div><button className="login-submit">Verify OTP</button></form>}
      {step === 'username-list' && <div className="username-options" role="list" aria-label="Usernames associated with this email">{usernameCandidates.map(userId => <button key={userId} type="button" className="username-option" onClick={() => selectUsername(userId)}>{userId}</button>)}</div>}
      {step === 'password' && <form onSubmit={resetPassword}><div className="password-policy-label"><label htmlFor="new-password">New Password <span>*</span></label><span className="password-policy-help"><button className="password-policy-icon" type="button" aria-label="Show password requirements" aria-describedby="password-policy-tooltip">i</button><span className="password-policy-tooltip" id="password-policy-tooltip" role="tooltip"><strong>Password requirements</strong><ul><li>Minimum 8 characters in length.</li><li>Must contain at least one uppercase letter (A–Z).</li><li>Must contain at least one lowercase letter (a–z).</li><li>Must contain at least one number (0–9).</li><li>Must contain at least one special character (e.g., !, @, #, $, %).</li><li>Do not use spaces in the password.</li></ul></span></span></div><div className="login-input-wrap"><input id="new-password" type={visible ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} onBlur={() => setPasswordBlurred(true)} aria-invalid={passwordBlurred && !passwordValid} required/><button className="password-toggle" type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></div>{passwordBlurred && !passwordValid && <p className="password-policy-error" role="status">Your password does not meet all the required criteria. Please review the password requirements and try again.</p>}<label htmlFor="confirm-password">Confirm New Password <span>*</span></label><div className="login-input-wrap"><input id="confirm-password" type={visible ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} disabled={!passwordValid} required/></div><button className="login-submit" disabled={busy || !passwordValid}>{busy ? 'Resetting…' : 'Reset Password'}</button></form>}
      {step === 'success' && <div className="recovery-success"><div className="recovery-check" aria-hidden="true">✓</div><p>Your password has been reset successfully.</p><a className="login-submit recovery-login-button" href={`${base}#/login`}>Back to Login</a></div>}
      {step !== 'success' && (step.startsWith('username-') ? <p className="register-prompt"><button type="button" className="recovery-back-link" onClick={() => { setStep('identity'); setError(''); setNotice(''); }}>Back to Forgot Password</button></p> : <p className="register-prompt"><a href={`${base}#/login`}>Back to Login</a></p>)}
    </div><footer className="login-footer"><nav aria-label="Policies"><a href={`${base}#/privacy-policy`}>Privacy policy</a></nav><span>© 2026 Schoolnet India Limited</span></footer></section>
  </main>;
}
