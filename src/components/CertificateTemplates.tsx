import { useMemo, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';

type Mode = 'Offline' | 'Online' | 'Hybrid';
type Sponsor = 'ERNET' | 'Adding Dimensions' | 'Schoolnet India' | 'Custom';
type Template = { id: string; mode: Mode; title: string; sponsorName: string; sponsor: Sponsor; logoData?: string; primary: string; accent: string; wording: string; signatory: string; numberFormat: string; requiredDetails: string[] };
const KEY = 'teacher-training-certificate-templates';
const MODES: Mode[] = ['Offline', 'Online', 'Hybrid'];
const DETAILS = ['Trainee name', 'Training plan', 'Training mode', 'Training dates', 'Organization / school', 'Certificate number', 'Issue date'];
const defaultTemplate = (mode: Mode): Template => ({ id: mode.toLowerCase(), mode, title: `${mode} Training Completion Certificate`, sponsorName: 'ERNET India', sponsor: 'ERNET', primary: '#173f68', accent: '#c79535', wording: 'This is to certify that {{traineeName}} has successfully completed {{trainingPlan}} through {{trainingMode}} training held from {{startDate}} to {{endDate}}.', signatory: 'Authorized Signatory', numberFormat: `CERT-${mode.slice(0, 3).toUpperCase()}-{YYYY}-{####}`, requiredDetails: [...DETAILS] });
function load(): Template[] {
  try { const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]'); const rows = Array.isArray(saved) ? saved as Template[] : []; return MODES.map(mode => ({ ...defaultTemplate(mode), ...(rows.find(row => row.mode === mode) ?? {}) })); } catch { return MODES.map(defaultTemplate); }
}
const logos: Record<Exclude<Sponsor, 'Custom' | 'Schoolnet India'>, string> = { ERNET: `${import.meta.env.BASE_URL}assets/ernet-client-logo.jpeg`, 'Adding Dimensions': `${import.meta.env.BASE_URL}assets/AddingDimensions.png` };
const adminRoles = new Set(['sponsor-admin', 'schoolnet-super-admin', 'schoolnet-project-admin']);

export default function CertificateTemplates() {
  const session = getSession();
  const authorized = Boolean(session && adminRoles.has(session.role));
  const [templates, setTemplates] = useState(load);
  const [selectedMode, setSelectedMode] = useState<Mode>('Offline');
  const [message, setMessage] = useState('');
  const template = templates.find(item => item.mode === selectedMode)!;
  const previewLogo = useMemo(() => template.logoData || (template.sponsor === 'Schoolnet India' ? '' : template.sponsor === 'Custom' ? '' : logos[template.sponsor]), [template]);
  const update = (changes: Partial<Template>) => setTemplates(current => current.map(item => item.mode === selectedMode ? { ...item, ...changes } : item));
  const save = () => { localStorage.setItem(KEY, JSON.stringify(templates)); setMessage('All three certificate templates saved.'); };
  const uploadLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2_000_000) { setMessage('Choose an image smaller than 2 MB.'); return; }
    const reader = new FileReader(); reader.onload = () => update({ logoData: String(reader.result), sponsor: 'Custom' }); reader.readAsDataURL(file);
  };
  const chooseSponsor = (sponsor: Sponsor) => update({ sponsor, sponsorName: sponsor === 'ERNET' ? 'ERNET India' : sponsor === 'Adding Dimensions' ? 'Adding Dimensions' : sponsor === 'Schoolnet India' ? 'Schoolnet India' : template.sponsorName, logoData: sponsor === 'Custom' ? template.logoData : undefined });
  if (!authorized) return <div className="app"><Sidebar /><main className="main"><Topbar title="Certificate Templates" description="Manage approved certificate designs." /><Alert severity="error">Only authorized administrators can configure certificate templates.</Alert></main></div>;
  return <div className="app"><Sidebar activePage="Certificates" /><main className="main"><Topbar title="Certificate Templates" description="Configure Offline, Online, and Hybrid completion certificates." />
    <Box sx={{ maxWidth: 1440, width: '100%', mx: 'auto', pb: 3 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>{MODES.map(mode => <Button key={mode} variant={selectedMode === mode ? 'contained' : 'outlined'} onClick={() => setSelectedMode(mode)}>{mode}</Button>)}</Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(440px,1fr)' }, gap: 2, alignItems: 'start' }}>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e3ebf3', borderRadius: 2 }}><Stack spacing={2}>
          <Box><Typography variant="h6" fontWeight={750}>{selectedMode} template</Typography><Typography variant="body2" color="text.secondary">The mode-specific template can be branded for the project sponsor or cluster.</Typography></Box>
          <TextField label="Certificate title" value={template.title} onChange={e => update({ title: e.target.value })} fullWidth />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}><TextField label="Organization / sponsor name" value={template.sponsorName} onChange={e => update({ sponsorName: e.target.value })} /><FormControl><InputLabel>Brand / logo</InputLabel><Select label="Brand / logo" value={template.sponsor} onChange={e => chooseSponsor(e.target.value as Sponsor)}>{(['ERNET', 'Adding Dimensions', 'Schoolnet India', 'Custom'] as Sponsor[]).map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl></Box>
          <Button component="label" variant="outlined" sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>Upload custom logo<input hidden type="file" accept="image/*" onChange={uploadLogo} /></Button>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}><TextField label="Primary color" type="color" value={template.primary} onChange={e => update({ primary: e.target.value })} /><TextField label="Accent color" type="color" value={template.accent} onChange={e => update({ accent: e.target.value })} /></Box>
          <TextField multiline minRows={3} label="Approved certificate wording" value={template.wording} onChange={e => update({ wording: e.target.value })} helperText="Available fields: {{traineeName}}, {{trainingPlan}}, {{trainingMode}}, {{startDate}}, {{endDate}}" />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}><TextField label="Signatory name / designation" value={template.signatory} onChange={e => update({ signatory: e.target.value })} /><TextField label="Certificate number format" value={template.numberFormat} onChange={e => update({ numberFormat: e.target.value })} helperText="Use {YYYY} and {####} for year and sequence." /></Box>
          <Box><Typography variant="subtitle2" fontWeight={700} sx={{ mb: .75 }}>Required trainee and training details</Typography><Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap">{DETAILS.map(detail => { const included = template.requiredDetails.includes(detail); return <Chip key={detail} label={detail} onClick={() => update({ requiredDetails: included ? template.requiredDetails.filter(item => item !== detail) : [...template.requiredDetails, detail] })} color={included ? 'primary' : 'default'} variant={included ? 'filled' : 'outlined'} />; })}</Stack></Box>
          {message && <Alert severity={message.includes('saved') ? 'success' : 'warning'}>{message}</Alert>}
          <Button variant="contained" onClick={save} sx={{ alignSelf: 'flex-end', textTransform: 'none' }}>Save all templates</Button>
        </Stack></Paper>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2, bgcolor: '#eef3f8' }}><Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>LIVE PREVIEW · {selectedMode.toUpperCase()}</Typography>
          <Box sx={{ minHeight: 410, p: { xs: 2, sm: 4 }, bgcolor: '#fff', border: `8px double ${template.accent}`, boxShadow: '0 8px 24px #17355320', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            {previewLogo ? <Box component="img" src={previewLogo} alt={`${template.sponsor} logo`} sx={{ maxWidth: 150, maxHeight: 65, objectFit: 'contain' }} /> : <Typography sx={{ color: template.primary, fontWeight: 900, letterSpacing: 1.3, fontSize: 20 }}>{template.sponsor === 'Schoolnet India' ? 'SCHOOLNET INDIA' : template.sponsorName || 'CUSTOM BRAND'}</Typography>}
            <Typography variant="overline" sx={{ color: template.accent, letterSpacing: 2 }}>CERTIFICATE OF COMPLETION · {selectedMode.toUpperCase()}</Typography>
            <Typography variant="h4" sx={{ color: template.primary, fontFamily: 'Georgia, serif', fontWeight: 700 }}>{template.title || 'Certificate title'}</Typography>
            <Typography sx={{ color: '#455c70', maxWidth: 560, lineHeight: 1.9 }}>{template.wording.replaceAll('{{traineeName}}', 'Trainee Name').replaceAll('{{trainingPlan}}', 'Training Plan').replaceAll('{{trainingMode}}', selectedMode).replaceAll('{{startDate}}', 'Start Date').replaceAll('{{endDate}}', 'End Date')}</Typography>
            <Typography variant="caption" color="text.secondary">Certificate No. {template.numberFormat.replace('{YYYY}', String(new Date().getFullYear())).replace('{####}', '0001')}</Typography>
            <Box sx={{ mt: 3, pt: 1, borderTop: `1px solid ${template.accent}`, minWidth: 190 }}><Typography fontWeight={700} color={template.primary}>{template.signatory || 'Authorized Signatory'}</Typography><Typography variant="caption" color="text.secondary">{template.sponsorName}</Typography></Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>Brand choices use the available ERNET and Adding Dimensions logo assets; Schoolnet India is shown as a text wordmark until an official logo is uploaded.</Typography>
        </Paper>
      </Box>
    </Box><Footer /></main></div>;
}
