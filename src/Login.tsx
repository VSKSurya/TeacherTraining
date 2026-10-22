import { useState, type FormEvent } from 'react';
import './login.css';
import { signIn } from './auth';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [slide, setSlide] = useState(0);
  const slides = [
    { eyebrow: 'TRAINING PROGRESS', title: 'Every session moves learning forward.', text: 'One connected space for training plans, classroom practice, progress and certification.' },
    { eyebrow: 'CLASSROOM PRACTICE', title: 'Build skills that make a difference.', text: 'Bring learning resources, trainers and every classroom together in one place.' },
    { eyebrow: 'YOUR IMPACT', title: 'See progress take shape.', text: 'Track milestones and celebrate the small wins that lead to lasting change.' },
  ];
  const active = slides[slide];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const identity = String(formData.get('identity') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    if (signIn(identity, password)) {
      window.location.assign(import.meta.env.BASE_URL);
      return;
    }
    setMessage('The user ID or password is incorrect, or this account has been deactivated.');
  }

  return <main className="login-page">
    <section className="login-story" aria-label="About the learning platform">
      <div className="story-orbit orbit-one" /><div className="story-orbit orbit-two" />
      <div className="learning-art" aria-hidden="true">
        <div className="art-card progress-card"><span className="art-label">{active.eyebrow}</span><strong>On track</strong><div className="art-progress"><i /></div><small>Batch 04 · Week 3</small></div>
        <div className="art-card score-card"><div className="score-ring"><span>82%</span></div><small>Learning progress</small></div>
        <div className="art-card milestone-card"><span className="milestone-check">✓</span><strong>Milestone reached</strong><small>Assessment completed</small></div>
      </div>
      <div className="story-copy"><p className="story-kicker">ERNet learning hub</p><h1>{active.title}</h1><p>{active.text}</p>
        <div className="story-dots" aria-label="Choose a story slide">{slides.map((item, index) => <button key={item.eyebrow} type="button" aria-label={`Show slide ${index + 1}`} aria-pressed={slide === index} onClick={() => setSlide(index)} />)}</div>
      </div>
      <img className="adding-dimensions" src="/TeacherTraining/assets/AddingDimensions.png" alt="Adding Dimensions — Enhancing Teaching for Tomorrow" />
    </section>
    <section className="login-panel">
      <div className="login-content">
        <img className="ernet-logo" src="/TeacherTraining/assets/ernet-client-logo.jpeg" alt="ERNet India — Education & Research Network" />
        <h2>Sign in</h2><p className="login-intro">Welcome back. Enter your details to continue.</p>
        <form onSubmit={submit}>
          <label htmlFor="login-identity">Email address or mobile number <span>*</span></label>
          <div className="login-input-wrap"><input id="login-identity" name="identity" type="text" placeholder="you@example.com" autoComplete="username" defaultValue="Demo1" required /><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M5.7 18c1.4-2.6 3.5-3.9 6.3-3.9s4.9 1.3 6.3 3.9"/></svg></div>
          <div className="password-label"><label htmlFor="login-password">Password <span>*</span></label><button type="button" onClick={() => setMessage('Password reset instructions will be sent after you enter your email or mobile number.')}>Forgot password?</button></div>
          <div className="login-input-wrap"><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" defaultValue="demo1@123" required /><button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg></button></div>
          <button className="login-submit" type="submit">Sign in</button>
          {message && <p className="login-message" role="status">{message}</p>}
        </form>
        <p className="register-prompt">Don’t have an account? <a href="mailto:ernet@example.com?subject=ERNet%20registration">Register here</a></p>
      </div>
      <footer className="login-footer"><nav><a href="#privacy">Privacy policy</a><a href="#consent">Consent form</a></nav><span>© 2026 Schoolnet India Limited</span></footer>
    </section>
  </main>;
}
