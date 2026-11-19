export const CONSENT_VERSION = '2026-01';
export const CONSENT_DECLARATION = 'I consent to the use of my personal and training information to register me for training and to administer training activities, including attendance, assessments, feedback, and certificates, as described in the Privacy Policy.';
export const CONSENT_RECORDS_KEY = 'teacher-training-consent-records';
const api = (import.meta.env as ImportMetaEnv & { VITE_CONSENT_API?: string }).VITE_CONSENT_API?.replace(/\/$/, '');

export type ConsentRecord = { userId: string; status: 'Accepted' | 'Pending'; version: string; acceptedAt?: string; source?: string };

function localRecords(): ConsentRecord[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(CONSENT_RECORDS_KEY) ?? '[]'); return Array.isArray(value) ? value as ConsentRecord[] : []; } catch { return []; }
}
export function saveLocalConsent(record: ConsentRecord) {
  const rows = localRecords().filter(item => item.userId.toLowerCase() !== record.userId.toLowerCase());
  localStorage.setItem(CONSENT_RECORDS_KEY, JSON.stringify([...rows, record]));
}

export async function fetchConsentStatus(userId: string): Promise<ConsentRecord | null> {
  if (!api) {
    if (!import.meta.env.DEV) throw new Error('Consent service is not configured. Contact your administrator.');
    return localRecords().find(item => item.userId.toLowerCase() === userId.toLowerCase()) ?? null;
  }
  const response = await fetch(`${api}/status?userId=${encodeURIComponent(userId)}`, { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Could not check your consent status. Try again.');
  const record = payload.record ?? payload;
  return { userId, status: record.status === 'Accepted' || record.accepted === true ? 'Accepted' : 'Pending', version: String(record.version ?? record.consentVersion ?? ''), acceptedAt: record.acceptedAt ? String(record.acceptedAt) : undefined, source: 'backend' };
}

export async function acceptConsent(userId: string): Promise<ConsentRecord> {
  const record: ConsentRecord = { userId, status: 'Accepted', version: CONSENT_VERSION, acceptedAt: new Date().toISOString() };
  if (!api) {
    if (!import.meta.env.DEV) throw new Error('Consent service is not configured. Your consent was not saved.');
    saveLocalConsent({ ...record, source: 'development' });
    return record;
  }
  const response = await fetch(`${api}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(record) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !(payload.accepted === true || payload.success === true)) throw new Error(payload.message || 'Your consent could not be saved. Please try again.');
  const saved = { ...record, acceptedAt: String(payload.acceptedAt ?? payload.record?.acceptedAt ?? record.acceptedAt), source: 'backend' };
  saveLocalConsent(saved);
  return saved;
}
