import { useMemo, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';
import { batchIdentifiers } from '../batchCodes';
import { isTrainingComplete } from '../completion';

type Mode = 'Offline' | 'Online' | 'Hybrid';
type Sponsor = 'ERNET' | 'Adding Dimensions' | 'Schoolnet India' | 'Custom';
type Template = { id: string; mode: Mode; projectId?: string; title: string; sponsorName: string; sponsor: Sponsor; logoData?: string; primary: string; accent: string; wording: string; signatory: string; numberFormat: string; requiredDetails: string[] };
type Row = Record<string, unknown>;
type Certificate = Row & { id: string; certificateNumber: string; traineeId: string; traineeName: string; batchId: string; projectId: string; templateMode: Mode; status: 'Issued' | 'Reissued' | 'Revoked'; issuedAt: string; issuedBy: string; reason?: string; reissueOf?: string };
const KEY = 'teacher-training-certificate-templates';
const CERT_KEY = 'teacher-training-certificates';
const AUDIT_KEY = 'teacher-training-certificate-audit';
const RECORD_KEYS = { registrations: 'teacher-training-registrations', batches: 'teacher-training-batch-plan-uses', attendance: 'teacher-training-attendance-records', assessments: 'teacher-training-assessment-records', feedback: 'teacher-training-feedback-records', external: 'teacher-training-external-course-records', plans: 'teacher-training-plans', projects: 'teacher-training-projects', associations: 'teacher-training-project-plan-associations', forms: 'teacher-training-assessment-form-master' };
const MODES: Mode[] = ['Offline', 'Online', 'Hybrid'];
const DETAILS = ['Trainee name', 'Training plan', 'Training mode', 'Training dates', 'Organization / school', 'Certificate number', 'Issue date'];
const defaultTemplate = (mode: Mode): Template => ({ id: mode.toLowerCase(), mode, title: `${mode} Training Completion Certificate`, sponsorName: 'ERNET India', sponsor: 'ERNET', primary: '#173f68', accent: '#c79535', wording: 'This is to certify that {{traineeName}} has successfully completed {{trainingPlan}} through {{trainingMode}} training held from {{startDate}} to {{endDate}}.', signatory: 'Authorized Signatory', numberFormat: `CERT-${mode.slice(0, 3).toUpperCase()}-{YYYY}-{####}`, requiredDetails: [...DETAILS] });
function load(): Template[] {
  try { const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]'); const rows = Array.isArray(saved) ? saved as Template[] : []; return [...MODES.map(mode => ({ ...defaultTemplate(mode), ...(rows.find(row => row.mode === mode && !row.projectId) ?? {}) })), ...rows.filter(row => Boolean(row.projectId))]; } catch { return MODES.map(defaultTemplate); }
}
function readRows(key: string): Row[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as Row[] : []; } catch { return []; } }
const val = (row: Row | undefined, ...keys: string[]) => { for (const key of keys) if (typeof row?.[key] === 'string' && row[key]) return row[key] as string; return ''; };
const idsOf = (row: Row) => [row.userId, row.traineeId, row.participantId, row.studentId, row.beneficiaryId, row.candidateId].filter((item): item is string => typeof item === 'string' && Boolean(item));
const batchRef = (row: Row) => val(row, 'batchId', 'batchCode', 'batchUniqueId');
function escapeHtml(input: string) { return input.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!); }
function renderCertificate(record: Certificate) {
  const snap = record.templateSnapshot as Template;
  const logo = snap.logoData || (snap.sponsor === 'Schoolnet India' || snap.sponsor === 'Custom' ? '' : logos[snap.sponsor]);
  const fields: Record<string, string> = { traineeName: record.traineeName, trainingPlan: val(record, 'trainingPlanName'), trainingMode: record.templateMode, startDate: val(record, 'trainingStartDate'), endDate: val(record, 'trainingEndDate') };
  const wording = escapeHtml(snap.wording).replace(/\{\{(\w+)\}\}/g, (_match, key: string) => escapeHtml(fields[key] ?? ''));
  const brand = logo ? `<img src="${logo}" alt="${escapeHtml(snap.sponsorName)} logo">` : `<strong>${escapeHtml(snap.sponsorName)}</strong>`;
  const detailValues: Record<string, string> = { 'Training plan': val(record, 'trainingPlanName'), 'Training mode': record.templateMode, 'Training dates': `${val(record, 'trainingStartDate')} – ${val(record, 'trainingEndDate')}`, 'Organization / school': `${val(record, 'projectName')} · ${val(record, 'sponsorName')}`, 'Certificate number': record.certificateNumber, 'Issue date': record.issuedAt.slice(0, 10) };
  const details = [...new Set(['Trainee name', ...(snap.requiredDetails ?? [])])].filter(label => label !== 'Trainee name' && detailValues[label]).map(label => `<p class="meta">${escapeHtml(label)}: ${escapeHtml(detailValues[label])}</p>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(snap.title)}</title><style>body{margin:0;background:#eef2f5;font-family:Georgia,serif;color:#263c50}.certificate{box-sizing:border-box;width:1120px;min-height:790px;margin:30px auto;padding:70px 90px;background:#fff;border:12px double ${snap.accent};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.certificate img{max-width:190px;max-height:80px;object-fit:contain}.brand{font:700 24px Arial;color:${snap.primary}}.eyebrow{margin-top:28px;letter-spacing:4px;color:${snap.accent};font:700 14px Arial}.title{margin:20px 0;color:${snap.primary};font-size:42px}.certificate p{font-size:14px}.name{font:700 14px Georgia;color:${snap.primary};margin:8px}.wording{max-width:830px;font:14px/1.8 Arial;color:#455c70}.meta{font:14px Arial;color:#65798b;margin:6px}.sign{margin-top:55px;padding-top:10px;border-top:1px solid ${snap.accent};min-width:240px;font:16px Arial;color:${snap.primary}}@media print{body{background:white}.certificate{margin:0;width:100vw;height:100vh;min-height:0;page-break-after:avoid}}</style></head><body><main class="certificate"><div class="brand">${brand}</div><div class="eyebrow">CERTIFICATE OF COMPLETION · ${record.templateMode.toUpperCase()}</div><h1 class="title">${escapeHtml(snap.title)}</h1><p class="name">${escapeHtml(record.traineeName)}</p><p class="wording">${wording}</p>${details}<div class="sign"><strong>${escapeHtml(snap.signatory)}</strong><br>${escapeHtml(val(record, 'sponsorName'))}</div></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))</script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
const logos: Record<Exclude<Sponsor, 'Custom' | 'Schoolnet India'>, string> = { ERNET: `${import.meta.env.BASE_URL}assets/ernet-client-logo.jpeg`, 'Adding Dimensions': `${import.meta.env.BASE_URL}assets/AddingDimensions.png` };
const adminRoles = new Set(['sponsor-admin', 'schoolnet-super-admin', 'schoolnet-project-admin']);

export default function CertificateTemplates() {
  const session = getSession();
  const authorized = Boolean(session && adminRoles.has(session.role));
  const [templates, setTemplates] = useState(load);
  const [selectedMode, setSelectedMode] = useState<Mode>('Offline');
  const [templateProjectId, setTemplateProjectId] = useState('');
  const [message, setMessage] = useState('');
  const [certificates, setCertificates] = useState<Certificate[]>(() => readRows(CERT_KEY) as Certificate[]);
  const projects = useMemo(() => readRows(RECORD_KEYS.projects), []);
  const plans = useMemo(() => readRows(RECORD_KEYS.plans), []);
  const associations = useMemo(() => readRows(RECORD_KEYS.associations), []);
  const batches = useMemo(() => readRows(RECORD_KEYS.batches), []);
  const registrations = useMemo(() => readRows(RECORD_KEYS.registrations), []);
  const attendance = useMemo(() => readRows(RECORD_KEYS.attendance), []);
  const assessments = useMemo(() => readRows(RECORD_KEYS.assessments), []);
  const feedback = useMemo(() => readRows(RECORD_KEYS.feedback), []);
  const externalCourses = useMemo(() => readRows(RECORD_KEYS.external), []);
  const forms = useMemo(() => readRows(RECORD_KEYS.forms), []);
  const availableProjects = projects.filter(project => session?.role !== 'schoolnet-project-admin' || (Array.isArray(project.assignedUsers) && project.assignedUsers.includes(session.userId)));
  const projectTemplate = templates.find(item => item.mode === selectedMode && item.projectId === templateProjectId);
  const template = projectTemplate ?? templates.find(item => item.mode === selectedMode && !item.projectId)!;
  const previewLogo = useMemo(() => template.logoData || (template.sponsor === 'Schoolnet India' ? '' : template.sponsor === 'Custom' ? '' : logos[template.sponsor]), [template]);
  const update = (changes: Partial<Template>) => setTemplates(current => {
    const id = templateProjectId ? `${templateProjectId}-${selectedMode.toLowerCase()}` : selectedMode.toLowerCase();
    const existing = current.find(item => item.id === id) ?? { ...defaultTemplate(selectedMode), id, ...(templateProjectId ? { projectId: templateProjectId } : {}) };
    return [...current.filter(item => item.id !== id), { ...existing, ...changes }];
  });
  const save = () => { localStorage.setItem(KEY, JSON.stringify(templates)); setMessage('Certificate templates saved.'); };
  const uploadLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2_000_000) { setMessage('Choose an image smaller than 2 MB.'); return; }
    const reader = new FileReader(); reader.onload = () => update({ logoData: String(reader.result), sponsor: 'Custom' }); reader.readAsDataURL(file);
  };
  const chooseSponsor = (sponsor: Sponsor) => update({ sponsor, sponsorName: sponsor === 'ERNET' ? 'ERNET India' : sponsor === 'Adding Dimensions' ? 'Adding Dimensions' : sponsor === 'Schoolnet India' ? 'Schoolnet India' : template.sponsorName, logoData: sponsor === 'Custom' ? template.logoData : undefined });
  const candidates = useMemo(() => registrations.flatMap(registration => {
    const batchId = batchRef(registration);
    const batch = batches.find(row => batchIdentifiers(row).includes(batchId));
    if (!batch) return [];
    const association = associations.find(row => val(row, 'id') === val(batch, 'projectPlanAssociationId'));
    const plan = plans.find(row => val(row, 'id') === val(association, 'trainingPlanId') || val(row, 'code') === val(batch, 'trainingPlanCode'));
    const project = projects.find(row => val(row, 'id') === val(batch, 'projectId'));
    const isApproved = registration.approved === true || ['approved', 'confirmed', 'enrolled'].includes(val(registration, 'status').toLowerCase());
    const traineeName = val(registration, 'traineeName', 'participantName', 'name');
    const traineeIds = idsOf(registration);
    const complete = isApproved && isTrainingComplete({ registration, batch, criteria: (plan?.completionCriteria ?? {}) as Parameters<typeof isTrainingComplete>[0]['criteria'], userIds: traineeIds, registrationIds: [val(registration, 'id'), val(registration, 'registrationId')], attendance, assessments, feedback, externalCourses, assessmentForms: forms });
    const currentMode = (val(batch, 'deliveryMode') || val(plan, 'type') || 'Offline').toLowerCase();
    const mode: Mode = currentMode.includes('hybrid') ? 'Hybrid' : currentMode.includes('online') ? 'Online' : 'Offline';
    return [{ registration, batch, plan, project, traineeName, traineeId: traineeIds[0] ?? val(registration, 'id'), mode, complete, isApproved }];
  }), [registrations, batches, associations, plans, projects, attendance, assessments, feedback, externalCourses, forms]);
  const visibleCandidates = candidates.filter(candidate => session?.role !== 'schoolnet-project-admin' || Boolean(candidate.project && availableProjects.some(project => val(project, 'id') === val(candidate.project, 'id'))));
  const visibleCertificates = certificates.filter(certificate => session?.role !== 'schoolnet-project-admin' || availableProjects.some(project => val(project, 'id') === certificate.projectId));
  const issueCertificate = (candidate: (typeof candidates)[number], reissue?: Certificate, reissueReason = '') => {
    if (!candidate.complete || !candidate.traineeName) { setMessage('Certificate generation is restricted to approved trainees who meet all saved completion criteria.'); return; }
    const selectedTemplate = templates.find(item => item.mode === candidate.mode && item.projectId === val(candidate.project, 'id')) ?? templates.find(item => item.mode === candidate.mode && !item.projectId) ?? defaultTemplate(candidate.mode);
    const allExisting = readRows(CERT_KEY) as Certificate[];
    const year = new Date().getFullYear();
    let sequence = 1;
    let certificateNumber = '';
    const numberFormat = selectedTemplate.numberFormat.includes('{####}') ? selectedTemplate.numberFormat : `${selectedTemplate.numberFormat}-{####}`;
    do { certificateNumber = numberFormat.replace('{YYYY}', String(year)).replace('{####}', String(sequence++).padStart(4, '0')); } while (allExisting.some(item => item.certificateNumber === certificateNumber));
    const modeDates = (Array.isArray(candidate.batch.trainingDates) ? candidate.batch.trainingDates.map(String).sort() : [val(candidate.batch, 'trainingStartDate'), val(candidate.batch, 'trainingEndAuto')]).filter(Boolean);
    const record: Certificate = { id: crypto.randomUUID(), certificateNumber, traineeId: candidate.traineeId, traineeName: candidate.traineeName, projectId: val(candidate.project, 'id'), projectName: val(candidate.project, 'name'), sponsorName: val(candidate.project, 'sponsor') || selectedTemplate.sponsorName, batchId: val(candidate.batch, 'id'), batchCode: val(candidate.batch, 'batchCode'), trainingPlanName: val(candidate.plan, 'name') || val(candidate.batch, 'trainingPlanName'), trainingStartDate: modeDates[0] ?? '', trainingEndDate: modeDates.at(-1) ?? '', templateMode: candidate.mode, templateSnapshot: { ...selectedTemplate, sponsorName: val(candidate.project, 'sponsor') || selectedTemplate.sponsorName }, status: 'Issued', issuedAt: new Date().toISOString(), issuedBy: session?.userId ?? '', ...(reissue ? { reissueOf: reissue.id, reason: reissueReason } : {}) };
    const updated = [...allExisting.map(item => reissue && item.id === reissue.id ? { ...item, status: 'Reissued' as const } : item), record];
    localStorage.setItem(CERT_KEY, JSON.stringify(updated));
    const history = readRows(AUDIT_KEY); history.unshift({ id: crypto.randomUUID(), certificateId: record.id, certificateNumber, action: reissue ? 'Reissued' : 'Issued', actor: session?.userId ?? '', reason: reissue ? reissueReason : 'Initial issue', at: record.issuedAt }); localStorage.setItem(AUDIT_KEY, JSON.stringify(history));
    setCertificates(updated); setMessage(`${certificateNumber} issued.`); renderCertificate(record);
  };
  const revokeCertificate = (certificate: Certificate) => {
    const reason = window.prompt(`Reason for revoking ${certificate.certificateNumber}:`);
    if (!reason?.trim()) return;
    const updated = certificates.map(item => item.id === certificate.id ? { ...item, status: 'Revoked' as const, revokedAt: new Date().toISOString(), revokedBy: session?.userId ?? '', reason: reason.trim() } : item);
    localStorage.setItem(CERT_KEY, JSON.stringify(updated));
    const history = readRows(AUDIT_KEY); history.unshift({ id: crypto.randomUUID(), certificateId: certificate.id, certificateNumber: certificate.certificateNumber, action: 'Revoked', actor: session?.userId ?? '', reason: reason.trim(), at: new Date().toISOString() }); localStorage.setItem(AUDIT_KEY, JSON.stringify(history)); setCertificates(updated); setMessage(`${certificate.certificateNumber} revoked.`);
  };
  if (!authorized) return <div className="app"><Sidebar /><main className="main certificate-template-main"><Topbar title="Certificate Templates" description="Manage approved certificate designs." /><Alert severity="error">Only authorized administrators can configure certificate templates.</Alert></main></div>;
  return <div className="app"><Sidebar activePage="Certificates" /><main className="main certificate-template-main"><Topbar title="Certificate Templates" description="Configure Offline, Online, and Hybrid completion certificates." />
    <Box sx={{ maxWidth: 1440, width: '100%', mx: 'auto', pb: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}><Stack direction="row" spacing={1}>{MODES.map(mode => <Button key={mode} variant={selectedMode === mode ? 'contained' : 'outlined'} onClick={() => setSelectedMode(mode)}>{mode}</Button>)}</Stack><FormControl size="small" sx={{ minWidth: 240 }}><InputLabel>Template scope</InputLabel><Select label="Template scope" value={templateProjectId} onChange={event => setTemplateProjectId(event.target.value)}><MenuItem value="">Default templates</MenuItem>{availableProjects.map(project => <MenuItem key={val(project, 'id')} value={val(project, 'id')}>{val(project, 'name')}</MenuItem>)}</Select></FormControl></Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(440px,1fr)' }, gap: 2, alignItems: 'start' }}>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack spacing={2}>
          <Box><Typography variant="h6" fontWeight={750}>{selectedMode} template{templateProjectId ? ` · ${val(availableProjects.find(project => val(project, 'id') === templateProjectId), 'name')}` : ''}</Typography><Typography variant="body2" color="text.secondary">A project template overrides the default for that mode. The issued certificate records a snapshot of the approved design.</Typography></Box>
          <TextField label="Certificate title" value={template.title} onChange={e => update({ title: e.target.value })} fullWidth />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}><TextField label="Organization / sponsor name" value={template.sponsorName} onChange={e => update({ sponsorName: e.target.value })} /><FormControl><InputLabel>Brand / logo</InputLabel><Select label="Brand / logo" value={template.sponsor} onChange={e => chooseSponsor(e.target.value as Sponsor)}>{(['ERNET', 'Adding Dimensions', 'Schoolnet India', 'Custom'] as Sponsor[]).map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl></Box>
          <Button component="label" variant="outlined" sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>Upload custom logo<input hidden type="file" accept="image/*" onChange={uploadLogo} /></Button>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}><TextField label="Primary color" type="color" value={template.primary} onChange={e => update({ primary: e.target.value })} /><TextField label="Accent color" type="color" value={template.accent} onChange={e => update({ accent: e.target.value })} /></Box>
          <TextField multiline minRows={3} label="Approved certificate wording" value={template.wording} onChange={e => update({ wording: e.target.value })} helperText="Available fields: {{traineeName}}, {{trainingPlan}}, {{trainingMode}}, {{startDate}}, {{endDate}}" />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}><TextField label="Signatory name / designation" value={template.signatory} onChange={e => update({ signatory: e.target.value })} /><TextField label="Certificate number format" value={template.numberFormat} onChange={e => update({ numberFormat: e.target.value })} helperText="Use {YYYY} and {####}; sequence is enforced as unique." /></Box>
          <Box><Typography variant="subtitle2" fontWeight={700} sx={{ mb: .75 }}>Required trainee and training details</Typography><Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap">{DETAILS.map(detail => { const included = template.requiredDetails.includes(detail); return <Chip key={detail} label={detail} onClick={() => update({ requiredDetails: included ? template.requiredDetails.filter(item => item !== detail) : [...template.requiredDetails, detail] })} color={included ? 'primary' : 'default'} variant={included ? 'filled' : 'outlined'} />; })}</Stack></Box>
          {message && <Alert severity={/saved|issued|revoked/.test(message) ? 'success' : 'warning'}>{message}</Alert>}
          <Button variant="contained" onClick={save} sx={{ alignSelf: 'flex-end', textTransform: 'none' }}>Save template</Button>
        </Stack></Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2, bgcolor: '#eef3f8' }}><Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>LIVE PREVIEW · {selectedMode.toUpperCase()}</Typography>
          <Box sx={{ minHeight: 410, p: { xs: 2, sm: 4 }, bgcolor: '#fff', border: `8px double ${template.accent}`, boxShadow: '0 8px 24px #17355320', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            {previewLogo ? <Box component="img" src={previewLogo} alt={`${template.sponsor} logo`} sx={{ maxWidth: 150, maxHeight: 65, objectFit: 'contain' }} /> : <Typography sx={{ color: template.primary, fontWeight: 900, letterSpacing: 1.3, fontSize: 20 }}>{template.sponsor === 'Schoolnet India' ? 'SCHOOLNET INDIA' : template.sponsorName || 'CUSTOM BRAND'}</Typography>}
            <Typography variant="overline" sx={{ color: template.accent, letterSpacing: 2 }}>CERTIFICATE OF COMPLETION · {selectedMode.toUpperCase()}</Typography>
            <Typography variant="h4" sx={{ color: template.primary, fontFamily: 'Georgia, serif', fontWeight: 700 }}>{template.title || 'Certificate title'}</Typography>
            <Typography sx={{ color: template.primary, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 23 }}>Trainee Name</Typography>
            <Typography sx={{ color: '#455c70', maxWidth: 560, lineHeight: 1.9 }}>{template.wording.replaceAll('{{traineeName}}', 'Trainee Name').replaceAll('{{trainingPlan}}', 'Training Plan').replaceAll('{{trainingMode}}', selectedMode).replaceAll('{{startDate}}', 'Start Date').replaceAll('{{endDate}}', 'End Date')}</Typography>
            <Typography variant="caption" color="text.secondary">Certificate No. {template.numberFormat.replace('{YYYY}', String(new Date().getFullYear())).replace('{####}', '0001')}</Typography>
            <Box sx={{ mt: 3, pt: 1, borderTop: `1px solid ${template.accent}`, minWidth: 190 }}><Typography fontWeight={700} color={template.primary}>{template.signatory || 'Authorized Signatory'}</Typography><Typography variant="caption" color="text.secondary">{template.sponsorName}</Typography></Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>Brand choices use the available ERNET and Adding Dimensions logo assets; Schoolnet India is shown as a text wordmark until an official logo is uploaded.</Typography>
        </Paper>
      </Box>
      <Paper elevation={0} sx={{ mt: 2, p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}>
        <Typography variant="h6" fontWeight={750}>Completion eligible trainees</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Eligibility is calculated from approved registration, saved completion criteria, and saved attendance, assessment, feedback, and external course records. Only the trainee name appears on the certificate; other identifiers remain in the issue record.</Typography>
        <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Trainee</TableCell><TableCell>Batch / plan</TableCell><TableCell>Project / sponsor</TableCell><TableCell>Mode</TableCell><TableCell>Eligibility</TableCell><TableCell>Certificate</TableCell><TableCell>Action</TableCell></TableRow></TableHead><TableBody>{visibleCandidates.map((candidate, index) => {
          const matching = certificates.filter(certificate => certificate.traineeId === candidate.traineeId && certificate.batchId === val(candidate.batch, 'id')).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
          const active = matching.find(certificate => certificate.status === 'Issued');
          return <TableRow key={`${candidate.traineeId}-${val(candidate.batch, 'id')}-${index}`}><TableCell>{candidate.traineeName || 'Name missing'}</TableCell><TableCell>{val(candidate.batch, 'batchCode')}<Typography variant="caption" display="block" color="text.secondary">{val(candidate.plan, 'name') || val(candidate.batch, 'trainingPlanName')}</Typography></TableCell><TableCell>{val(candidate.project, 'name')}<Typography variant="caption" display="block" color="text.secondary">{val(candidate.project, 'sponsor')}</Typography></TableCell><TableCell>{candidate.mode}</TableCell><TableCell><Chip size="small" color={candidate.complete ? 'success' : 'default'} label={candidate.complete ? 'Eligible' : candidate.isApproved ? 'Criteria incomplete' : 'Not approved'} /></TableCell><TableCell>{active ? `${active.certificateNumber} · Issued` : matching[0] ? `${matching[0].certificateNumber} · ${matching[0].status}` : 'Not issued'}</TableCell><TableCell><Stack direction="row" spacing={.5}>{!active && candidate.complete && candidate.traineeName && <Button size="small" onClick={() => issueCertificate(candidate)} sx={{ textTransform: 'none' }}>Generate</Button>}{active && <><Button size="small" onClick={() => { const reason = window.prompt(`Reason for reissuing ${active.certificateNumber}:`); if (reason?.trim()) issueCertificate(candidate, active, reason.trim()); }} sx={{ textTransform: 'none' }}>Reissue</Button><Button size="small" color="error" onClick={() => revokeCertificate(active)} sx={{ textTransform: 'none' }}>Revoke</Button></>}</Stack></TableCell></TableRow>;
        })}{!visibleCandidates.length && <TableRow><TableCell colSpan={7} align="center">No matching registrations are available.</TableCell></TableRow>}</TableBody></Table></TableContainer>
      </Paper>
        <Paper elevation={0} sx={{ mt: 2, p: 2, border: '1px solid #e3ebf3', borderRadius: 2 }}><Typography variant="h6" fontWeight={750} sx={{ mb: 1 }}>Certificate register</Typography><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Number</TableCell><TableCell>Trainee</TableCell><TableCell>Training / project</TableCell><TableCell>Issued</TableCell><TableCell>Status</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>{visibleCertificates.map(certificate => <TableRow key={certificate.id}><TableCell>{certificate.certificateNumber}</TableCell><TableCell>{certificate.traineeName}</TableCell><TableCell>{val(certificate, 'trainingPlanName')}<Typography variant="caption" display="block" color="text.secondary">{val(certificate, 'projectName')}</Typography></TableCell><TableCell>{certificate.issuedAt.slice(0, 10)}</TableCell><TableCell><Chip size="small" label={certificate.status} color={certificate.status === 'Issued' ? 'success' : certificate.status === 'Revoked' ? 'error' : 'default'} /></TableCell><TableCell>{certificate.status === 'Issued' && <Button size="small" color="error" onClick={() => revokeCertificate(certificate)} sx={{ textTransform: 'none' }}>Revoke</Button>}{certificate.status !== 'Revoked' && (certificate.templateSnapshot as Template | undefined) && <Button size="small" onClick={() => renderCertificate(certificate)} sx={{ textTransform: 'none' }}>Print</Button>}<Typography variant="caption" display="block" color="text.secondary">By {certificate.issuedBy}{certificate.reason ? ` · ${certificate.reason}` : ''}</Typography></TableCell></TableRow>)}{!visibleCertificates.length && <TableRow><TableCell colSpan={6} align="center">No certificates have been issued.</TableCell></TableRow>}</TableBody></Table></TableContainer></Paper>
    </Box><Footer /></main></div>;
}
