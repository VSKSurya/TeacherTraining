import { useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Popover, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';
import { trainerProfiles } from '../trainerStore';
import { PhaseSelectionSummary, ReportFilterPanel, type FilterSpec, type ReportFilters } from '../reports/ReportComponents';
import { formatDate } from '../dateFormat';
import { phaseNames } from '../data/reportData';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

const EVIDENCE_KEY = 'teacher-training-trainer-evidence';
const BATCHES_KEY = 'teacher-training-batch-plan-uses';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
type Evidence = { id: string; trainer: string; trainerUserId: string; batch: string; date: string; startDate?: string; trainingPlan?: string; state?: string; district?: string; block?: string; phase?: string; notes: string; reviewNote?: string; submittedBy: string; submittedAt: string; status: 'Pending' | 'Approved' | 'Rejected'; reviewedBy?: string; reviewedAt?: string; files: { name: string; type: string; size: number; data: string }[] };
type Batch = { id: string; batchCode?: string; name?: string; trainerName?: string; trainerCode?: string; trainingStartDate?: string; trainingPlanName?: string; trainingPlanCode?: string; state?: string; district?: string; block?: string; projectId?: string; phase?: string; phaseName?: string; phaseId?: string };
function read<T>(key: string): T[] { try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export default function TrainerEvidence() {
  const session = getSession();
  const isTrainer = session?.role === 'trainer';
  const selectedPhase = useSelector((state: RootState) => state.dashboard.selectedPhase);
  const ernetLogin = session?.role === 'sponsor-admin';
  const trainers = useMemo(() => trainerProfiles(), []);
  const ownTrainer = trainers.find(item => item.userId?.toLowerCase() === session?.userId.toLowerCase());
  const batches = useMemo(() => read<Batch>(BATCHES_KEY), []);
  const projects = useMemo(() => read<{ id: string; phases?: { id: string; sequence?: number; name: string }[] }>('teacher-training-projects'), []);
  const [records, setRecords] = useState<Evidence[]>(() => read<Evidence>(EVIDENCE_KEY).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
  const [trainer, setTrainer] = useState(ownTrainer?.name ?? session?.userId ?? '');
  const [batch, setBatch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ plan: '', batch: '', state: '', district: '', block: '', trainer: '', fromDate: '', toDate: '', status: '' });
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [rejectingRecord, setRejectingRecord] = useState<Evidence | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const visibleRecords = isTrainer ? records.filter(row => row.trainerUserId?.toLowerCase() === session?.userId.toLowerCase()) : records;
  const batchPhaseNumber = (batch: Batch | undefined, evidencePhase = '') => {
    const project = projects.find(item => item.id === batch?.projectId);
    const projectPhase = project?.phases?.find(item => item.id === batch?.phaseId);
    if (projectPhase) return Number(projectPhase.sequence) || (project?.phases?.indexOf(projectPhase) ?? -1) + 1;
    const phaseText = evidencePhase || batch?.phaseName || batch?.phase || '';
    const match = phaseText.match(/\d+/);
    const nameIndex = phaseNames.findIndex(name => name.toLowerCase() === phaseText.toLowerCase());
    return match ? Number(match[0]) : nameIndex >= 0 ? nameIndex + 1 : 0;
  };
  const options = (key: 'trainingPlan' | 'batch' | 'state' | 'district' | 'block' | 'phase' | 'trainer') => [...new Set(records.map(row => row[key]).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
  const filteredRecords = visibleRecords.filter(row => {
    const linkedBatch = batches.find(item => row.batch.startsWith(item.batchCode || item.id));
    const phaseMatches = !ernetLogin || !selectedPhase || batchPhaseNumber(linkedBatch, row.phase) === selectedPhase;
    const matches = phaseMatches && (!filters.plan || row.trainingPlan === filters.plan) && (!filters.batch || row.batch === filters.batch) && (!filters.state || row.state === filters.state) && (!filters.district || row.district === filters.district) && (!filters.block || row.block === filters.block) && (!filters.trainer || row.trainer === filters.trainer) && (!filters.status || row.status === filters.status);
    const startDate = row.startDate || row.date;
    return matches && (!filters.fromDate || startDate >= filters.fromDate) && (!filters.toDate || startDate <= filters.toDate);
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setSuccess('');
    if (!files.length) { setError('Choose at least one evidence file.'); return; }
    if (files.some(file => file.size > MAX_FILE_SIZE)) { setError('Each file must be 5 MB or smaller.'); return; }
    const available = 4.5 * 1024 * 1024 - JSON.stringify(records).length;
    if (files.reduce((total, file) => total + file.size * 1.4, 0) > available) { setError('Browser storage is nearly full. Download or remove older evidence before adding more.'); return; }
    try {
      const attachments = await Promise.all(files.map(file => new Promise<Evidence['files'][number]>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: String(reader.result) }); reader.readAsDataURL(file);
      })));
      const selectedBatch = batches.find(item => item.id === batch);
      const row: Evidence = { id: crypto.randomUUID(), trainer, trainerUserId: isTrainer ? session?.userId ?? '' : trainers.find(item => item.name === trainer)?.userId ?? trainer, batch: selectedBatch ? `${selectedBatch.batchCode || selectedBatch.name || selectedBatch.id} · ${selectedBatch.trainingPlanName || 'Training'}` : 'Other / not listed', date, startDate: selectedBatch?.trainingStartDate || date, trainingPlan: selectedBatch?.trainingPlanName || selectedBatch?.trainingPlanCode || '', state: selectedBatch?.state || '', district: selectedBatch?.district || '', block: selectedBatch?.block || '', phase: selectedBatch?.phaseName || selectedBatch?.phase || selectedBatch?.phaseId || '', notes: notes.trim(), submittedBy: session?.userId ?? 'Trainer', submittedAt: new Date().toISOString(), status: 'Pending', files: attachments };
      const next = [row, ...records]; localStorage.setItem(EVIDENCE_KEY, JSON.stringify(next)); setRecords(next); setFiles([]); setNotes(''); setSuccess('Trainer evidence saved in this browser.');
      const input = document.getElementById('trainer-evidence-files') as HTMLInputElement | null; if (input) input.value = '';
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save the evidence files.'); }
  }
  function download(file: Evidence['files'][number]) { const anchor = document.createElement('a'); anchor.href = file.data; anchor.download = file.name; anchor.click(); }
  function review(row: Evidence, status: 'Approved' | 'Rejected') {
    const next = records.map(item => item.id === row.id ? { ...item, status, reviewedBy: session?.userId ?? 'Admin', reviewedAt: new Date().toISOString() } : item);
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify(next)); setRecords(next);
  }
  function rejectEvidence() {
    if (!rejectingRecord || !rejectReason.trim()) return;
    const reason = rejectReason.trim();
    const next = records.map(item => item.id === rejectingRecord.id ? { ...item, status: 'Rejected' as const, reviewedBy: session?.userId ?? 'Admin', reviewedAt: new Date().toISOString(), reviewNote: reason, notes: [item.notes, `Rejection reason: ${reason}`].filter(Boolean).join('\n') } : item);
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify(next)); setRecords(next); setRejectingRecord(null); setRejectReason('');
  }
  const filterFields: FilterSpec[] = [
    { key: 'plan', label: 'Training Plan', type: 'select', placeholder: 'All Training Plans', options: options('trainingPlan').map(value => ({ label: value, value })) },
    { key: 'batch', label: 'Batch', type: 'select', placeholder: 'All Batches', options: options('batch').map(value => ({ label: value, value })) },
    { key: 'state', label: 'State', type: 'select', placeholder: 'All States', options: options('state').map(value => ({ label: value, value })) },
    { key: 'district', label: 'District', type: 'select', placeholder: 'All Districts', options: options('district').map(value => ({ label: value, value })) },
    { key: 'block', label: 'Block', type: 'select', placeholder: 'All Blocks', options: options('block').map(value => ({ label: value, value })) },
    { key: 'trainer', label: 'Trainer Name', type: 'select', placeholder: 'All Trainers', options: options('trainer').map(value => ({ label: value, value })) },
    { key: 'fromDate', label: 'From Start Date', type: 'date' },
    { key: 'toDate', label: 'To Start Date', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', placeholder: 'All Statuses', options: ['Pending', 'Approved', 'Rejected'].map(value => ({ label: value, value })) },
  ];
  const changeEvidenceFilter = (key: string, value: string) => setFilters(previous => ({ ...previous, [key]: value }));

  return <div className="app"><Sidebar activePage={isTrainer ? 'Upload Documents' : 'Uploaded Documents'} /><main className="main" id="main-content"><Topbar title={isTrainer ? 'Upload Documents' : 'Trainer Uploaded Documents'} /><Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1500, mx: 'auto', width: '100%' }}>
    <Stack spacing={2}>
      {isTrainer && <Box><Typography variant="h5" fontWeight={700}>Upload Documents</Typography><Typography variant="body2" color="text.secondary">Upload training documents, presentations, short videos, photos, and scanned attendance sheets for verification.</Typography></Box>}
      {isTrainer && <Paper component="form" onSubmit={submit} elevation={0} sx={{ p: { xs: 1.25, md: 1.75 }, border: '1px solid #dce7f1', borderRadius: 2, boxShadow: '0 2px 8px rgba(23,53,83,.04)' }}>
        <Stack spacing={1.25}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
            <TextField size="small" label="Trainer" fullWidth value={trainer} InputProps={{ readOnly: true }} />
            <TextField select size="small" label="Training batch" fullWidth value={batch} onChange={event => setBatch(event.target.value)}><MenuItem value="">Other / not listed</MenuItem>{batches.map(item => <MenuItem key={item.id} value={item.id}>{item.batchCode || item.name || item.id} · {item.trainingPlanName || 'Training'}{item.trainerName ? ` · ${item.trainerName}` : ''}</MenuItem>)}</TextField>
            <TextField size="small" type="date" label="Training date" required InputLabelProps={{ shrink: true }} value={date} onChange={event => setDate(event.target.value)} />
          </Box>
          <TextField size="small" multiline minRows={2} label="Notes (optional)" placeholder="Describe the evidence or training session" value={notes} onChange={event => setNotes(event.target.value)} />
          <Box className="trainer-evidence-dropzone" sx={{ p: 1.25, border: '1px dashed #bdcddd', borderRadius: 1.5, bgcolor: '#f8fbfe' }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}><Button size="small" component="label" variant="outlined">Choose files<input id="trainer-evidence-files" hidden multiple type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm" onChange={event => { setFiles(Array.from(event.target.files ?? [])); setError(''); }} /></Button><Typography variant="caption" color="text.secondary">Documents, presentations, videos, photos, and scanned attendance sheets · up to 5 MB per file</Typography></Stack>{files.length > 0 && <Stack direction="row" flexWrap="wrap" gap={.75} sx={{ mt: 1 }}>{files.map(file => <Chip size="small" key={`${file.name}-${file.size}`} label={`${file.name} · ${formatSize(file.size)}`} onDelete={() => setFiles(current => current.filter(item => item !== file))} />)}</Stack>}</Box>
          {error && <Alert severity="error">{error}</Alert>}{success && <Alert severity="success">{success}</Alert>}<Box><Button type="submit" size="small" variant="contained">Submit for review</Button></Box>
        </Stack>
      </Paper>}
      {!isTrainer && <Box className="report-app"><Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', px: { xs: 1, md: 2 }, mb: 1 }}><button type="button" className="filter-trigger" aria-expanded={Boolean(filterAnchor)} onClick={event => setFilterAnchor(event.currentTarget)}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="8" cy="6" r="2" fill="white" stroke="currentColor" strokeWidth="1.8"/><circle cx="15" cy="12" r="2" fill="white" stroke="currentColor" strokeWidth="1.8"/></svg>Filters{Object.values(filters).filter(Boolean).length > 0 && <span className="filter-count visible">{Object.values(filters).filter(Boolean).length}</span>}</button></Box><Popover disablePortal open={Boolean(filterAnchor)} anchorEl={filterAnchor} onClose={() => setFilterAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}><Box className="dashboard-filter-popup" sx={{ width: { xs: 'calc(100vw - 24px)', sm: 980 }, maxWidth: 'calc(100vw - 24px)', p: 1 }}><ReportFilterPanel fields={filterFields} values={filters as ReportFilters} onChange={changeEvidenceFilter} onClear={() => setFilters({ plan: '', batch: '', state: '', district: '', block: '', trainer: '', fromDate: '', toDate: '', status: '' })} dashboardStyle /></Box></Popover></Box>}
      {!isTrainer && ernetLogin && <PhaseSelectionSummary selectedPhase={selectedPhase} selectedFilters={filters} />}
      <Paper elevation={0} sx={{ border: '1px solid #e3ebf3', borderRadius: 2, overflow: 'hidden' }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}><Box><Typography variant="h6" fontWeight={750}>{isTrainer ? 'My submissions' : 'Submitted evidence'}</Typography>{isTrainer && <Typography variant="body2" color="text.secondary">Track review status for files you submitted.</Typography>}</Box><Chip label={`${filteredRecords.length} submission${filteredRecords.length === 1 ? '' : 's'}`} /></Stack>
        {filteredRecords.length ? <TableContainer sx={{ width: '100%', overflowX: 'auto' }}><Table size="small" sx={{ tableLayout: 'fixed', minWidth: 1000 }}><TableHead><TableRow><TableCell sx={{ width: 180, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>Trainer / batch</TableCell><TableCell sx={{ width: 125, whiteSpace: 'normal' }}>Training date</TableCell><TableCell sx={{ width: 245, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>Evidence files</TableCell><TableCell sx={{ width: 145, whiteSpace: 'normal' }}>Submitted by</TableCell><TableCell sx={{ width: 115, whiteSpace: 'normal' }}>Status</TableCell><TableCell sx={{ width: 180, whiteSpace: 'normal' }}>Notes</TableCell>{!isTrainer && <TableCell sx={{ width: 150, whiteSpace: 'normal' }}>Decision</TableCell>}</TableRow></TableHead><TableBody>{filteredRecords.map(record => <TableRow key={record.id}><TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}><Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{record.trainer}</Typography><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{record.batch}</Typography></TableCell><TableCell sx={{ whiteSpace: 'normal' }}>{formatDate(record.date)}</TableCell><TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}><Stack spacing={.5}>{record.files.map(file => <Button key={file.name} size="small" onClick={() => download(file)} sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35, px: .5 }}>{file.name} · {formatSize(file.size)}</Button>)}</Stack></TableCell><TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{record.submittedBy}<Typography variant="caption" display="block" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{new Date(record.submittedAt).toLocaleString()}</Typography></TableCell><TableCell sx={{ whiteSpace: 'normal' }}><Chip size="small" color={record.status === 'Approved' ? 'success' : record.status === 'Rejected' ? 'error' : 'warning'} label={record.status} />{record.reviewedBy && <Typography variant="caption" display="block" sx={{ overflowWrap: 'anywhere' }}>By {record.reviewedBy}</Typography>}</TableCell><TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}><Typography variant="body2" sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{record.notes || '—'}</Typography></TableCell>{!isTrainer && <TableCell sx={{ whiteSpace: 'normal' }}>{record.status === 'Pending' && <Stack direction={{ xs: 'column', lg: 'row' }} spacing={.5}><Button size="small" color="success" onClick={() => review(record, 'Approved')}>Accept</Button><Button size="small" color="error" onClick={() => { setRejectingRecord(record); setRejectReason(''); }}>Reject</Button></Stack>}</TableCell>}</TableRow>)}</TableBody></Table></TableContainer> : <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>No trainer evidence matches these filters.</Typography>}
      </Paper>
    </Stack>
  </Box><Footer /></main><Dialog open={Boolean(rejectingRecord)} onClose={() => setRejectingRecord(null)} maxWidth="sm" fullWidth><DialogTitle>Reason for rejection</DialogTitle><DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Add a note for the trainer and future reference.</Typography><TextField autoFocus required fullWidth multiline minRows={3} label="Rejection reason" value={rejectReason} onChange={event => setRejectReason(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setRejectingRecord(null)}>Cancel</Button><Button color="error" variant="contained" disabled={!rejectReason.trim()} onClick={rejectEvidence}>Reject evidence</Button></DialogActions></Dialog></div>;
}

