import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Popover, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';
import { trainerProfiles } from '../trainerStore';
import { ReportFilterPanel, type FilterSpec, type ReportFilters } from '../reports/ReportComponents';
import { formatDate } from '../dateFormat';
import { phaseNames } from '../data/reportData';
import { kgbvSchools } from '../data/kgbvSchools';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

const EVIDENCE_KEY = 'teacher-training-trainer-evidence';
const BATCHES_KEY = 'teacher-training-batch-plan-uses';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
type Evidence = { id: string; projectName?: string; trainer: string; trainerUserId: string; batch: string; date: string; startDate?: string; trainingPlan?: string; state?: string; district?: string; block?: string; phase?: string; notes: string; reviewNote?: string; submittedBy: string; submittedAt: string; status: 'Pending' | 'Approved' | 'Rejected'; reviewedBy?: string; reviewedAt?: string; files: { name: string; type: string; size: number; data: string; uploadedAt?: string }[] };
type Batch = { id: string; batchCode?: string; name?: string; trainerName?: string; trainerCode?: string; trainingStartDate?: string; trainingPlanName?: string; trainingPlanCode?: string; state?: string; district?: string; block?: string; location?: string; schoolUdiseVenue?: string; schoolName?: string; projectId?: string; phase?: string; phaseName?: string; phaseId?: string };
type Project = { id: string; name?: string; phases?: { id: string; sequence?: number; name: string }[] };
type EvidenceApiRecord = Omit<Evidence, 'files'> & { files: Array<Evidence['files'][number] & { assetPath?: string }> };
const batchKey = (batch: Batch) => (batch.batchCode || batch.name || batch.id).trim().toLowerCase();
const evidenceCode = (value: string) => value.trim().split(/\s+/)[0].toLowerCase();
const matchesBatch = (value: string, batch: Batch) => evidenceCode(value) === batchKey(batch);
function EvidenceFolderIcon() { return <svg width="42" height="36" viewBox="0 0 28 24" fill="none" aria-hidden="true"><path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H11l2.3 2.5h10.2A2.5 2.5 0 0 1 26 8v10.5a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 2 18.5v-13Z" fill="#F4B740"/><path d="M2 9h24v9.5a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 2 18.5V9Z" fill="#FFC94F"/></svg>; }
function EvidenceUploadIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function EvidenceActionIcon({ type }: { type: 'preview' | 'download' }) { return type === 'preview' ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.8"/></svg> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function read<T>(key: string): T[] { try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export default function TrainerEvidence() {
  const session = getSession();
  const isTrainer = session?.role === 'trainer';
  const { selectedPhase, audience } = useSelector((state: RootState) => state.dashboard);
  const dashboardPhaseNames = audience === 'Student' ? ['Cyber Safety and Digital Responsibility', 'Digital Creativity', 'AI Awareness'] : phaseNames;
  const dashboardPhaseLabel = selectedPhase ? `${selectedPhase}: ${dashboardPhaseNames[selectedPhase - 1] || `Phase ${selectedPhase}`}` : 'All phases';
  const ernetLogin = session?.role === 'sponsor-admin';
  const trainers = useMemo(() => trainerProfiles(), []);
  const ownTrainer = trainers.find(item => item.userId?.toLowerCase() === session?.userId.toLowerCase());
  const batches = useMemo(() => read<Batch>(BATCHES_KEY), []);
  const projects = useMemo(() => read<Project>('teacher-training-projects'), []);
  const [records, setRecords] = useState<Evidence[]>(() => read<Evidence>(EVIDENCE_KEY).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
  const [apiRecords, setApiRecords] = useState<Evidence[]>([]);
  const [folderLevel, setFolderLevel] = useState<'projects' | 'batches' | 'files'>('projects');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [folderFilters, setFolderFilters] = useState({ project: '', state: '', district: '', block: '', school: '', batch: '', fromDate: '', toDate: '' });
  const [folderFilterAnchor, setFolderFilterAnchor] = useState<HTMLElement | null>(null);
  const [fileSearch, setFileSearch] = useState('');
  const [fileType, setFileType] = useState('All file types');
  const [previewFile, setPreviewFile] = useState<Evidence['files'][number] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadProject, setUploadProject] = useState('');
  const [trainer, setTrainer] = useState(ownTrainer?.name ?? session?.userId ?? '');
  const [batch, setBatch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ plan: '', batch: '', state: '', district: '', block: '', trainer: '', fromDate: '', toDate: '', status: '' });
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [rejectingRecord, setRejectingRecord] = useState<Evidence | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  useEffect(() => { let active = true; fetch(`${import.meta.env.BASE_URL}api/trainer-evidence.json`).then(response => { if (!response.ok) throw new Error(`Training Evidence API returned ${response.status}`); return response.json() as Promise<{ items?: EvidenceApiRecord[] }>; }).then(payload => { if (active) setApiRecords((payload.items || []).map(item => ({ ...item, files: item.files.map(file => ({ ...file, data: file.data || (file.assetPath ? `${import.meta.env.BASE_URL}${file.assetPath.replace(/^\//, '')}` : '') })) }))); }).catch(error => console.error('Could not load Training Evidence API response.', error)); return () => { active = false; }; }, []);
  const allRecords = useMemo(() => [...records, ...apiRecords].filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index), [apiRecords, records]);
  const visibleRecords = isTrainer ? allRecords.filter(row => row.trainerUserId?.toLowerCase() === session?.userId.toLowerCase()) : allRecords;
  const linkedBatchForEvidence = (row: Evidence) => batches.find(item => matchesBatch(row.batch, item));
  const evidenceProjectName = (row: Evidence) => { const linked = linkedBatchForEvidence(row); return row.projectName || projects.find(project => project.id === linked?.projectId)?.name || linked?.trainingPlanName || row.trainingPlan || 'Training Project'; };
  const projectGroups = useMemo(() => {
    const grouped: Record<string, Batch[]> = {};
    const add = (name: string, item: Batch) => {
      const key = Object.keys(grouped).find(value => value.trim().toLowerCase() === name.trim().toLowerCase()) || name;
      const list = grouped[key] || (grouped[key] = []);
      if (!list.some(existing => batchKey(existing) === batchKey(item))) list.push(item);
    };
    batches.filter(item => !isTrainer || !item.trainerCode || item.trainerCode.toLowerCase() === session?.userId.toLowerCase() || item.trainerName === ownTrainer?.name).forEach(item => {
      const name = projects.find(project => project.id === item.projectId)?.name || item.trainingPlanName || 'Training Project';
      add(name, item);
    });
    visibleRecords.forEach((row, index) => {
      const code = evidenceCode(row.batch);
      const known = batches.find(item => matchesBatch(row.batch, item));
      const name = evidenceProjectName(row);
      add(name, known || { id: `evidence-${row.id}-${index}`, batchCode: code, trainerName: row.trainer, trainingPlanName: row.trainingPlan, phase: row.phase });
    });
    return grouped;
  }, [batches, isTrainer, ownTrainer?.name, projects, session?.userId, visibleRecords]);
  const activeBatches = projectGroups[selectedProject] || [];
  const selectedBatch = activeBatches.find(item => item.id === selectedBatchId);
  const selectedBatchCode = selectedBatch?.batchCode || selectedBatch?.name || selectedBatch?.id || '';
  const batchFiles = visibleRecords.flatMap(row => selectedBatch && matchesBatch(row.batch, selectedBatch) && evidenceProjectName(row).trim().toLowerCase() === selectedProject.trim().toLowerCase() ? row.files.map((file, index) => ({ ...file, key: `${row.id}-${index}`, uploadedAt: file.uploadedAt || row.submittedAt })) : []);
  const shownBatchFiles = batchFiles.filter(file => file.name.toLowerCase().includes(fileSearch.toLowerCase()) && (fileType === 'All file types' || file.name.split('.').pop()?.toLowerCase() === fileType.toLowerCase()));
  const folderFilterFields: FilterSpec[] = [
    { key: 'project', label: 'Project', type: 'select', placeholder: 'All Projects', options: Object.keys(projectGroups).map(value => ({ label: value, value })) },
    { key: 'state', label: 'State', type: 'select', placeholder: 'All States', options: [...new Set(batches.map(item => item.state || '').filter(Boolean))].map(value => ({ label: value, value })) },
    { key: 'district', label: 'District', type: 'select', placeholder: folderFilters.state ? 'All Districts' : 'Select a state first', disabled: !folderFilters.state, options: [...new Set(batches.filter(item => item.state === folderFilters.state).map(item => item.district || '').filter(Boolean))].sort().map(value => ({ label: value, value })) },
    { key: 'block', label: 'Block', type: 'select', placeholder: folderFilters.district ? 'All Blocks' : 'Select a district first', disabled: !folderFilters.district, options: [...new Set(batches.filter(item => item.state === folderFilters.state && item.district === folderFilters.district).map(item => item.block || '').filter(Boolean))].sort().map(value => ({ label: value, value })) },
    { key: 'batch', label: 'Batch', type: 'select', placeholder: 'All Batches', options: [...new Set(batches.map(item => item.batchCode || item.name || item.id))].map(value => ({ label: value, value })) },
    { key: 'fromDate', label: 'From Start Date', type: 'date' },
    { key: 'toDate', label: 'To Start Date', type: 'date' },
  ];
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
      const uploadedAt = new Date().toISOString();
      const attachments = await Promise.all(files.map(file => new Promise<Evidence['files'][number]>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: String(reader.result), uploadedAt }); reader.readAsDataURL(file);
      })));
      const selectedBatch = batches.find(item => item.id === batch);
      const projectName = uploadProject || projects.find(project => project.id === selectedBatch?.projectId)?.name || selectedBatch?.trainingPlanName || '';
      const row: Evidence = { id: crypto.randomUUID(), projectName, trainer, trainerUserId: isTrainer ? session?.userId ?? '' : trainers.find(item => item.name === trainer)?.userId ?? trainer, batch: selectedBatch ? `${selectedBatch.batchCode || selectedBatch.name || selectedBatch.id} | ${selectedBatch.trainingPlanName || 'Training'}` : 'Other / not listed', date, startDate: selectedBatch?.trainingStartDate || date, trainingPlan: selectedBatch?.trainingPlanName || selectedBatch?.trainingPlanCode || '', state: selectedBatch?.state || '', district: selectedBatch?.district || '', block: selectedBatch?.block || '', phase: selectedBatch?.phaseName || selectedBatch?.phase || selectedBatch?.phaseId || '', notes: notes.trim(), submittedBy: session?.userId ?? 'Trainer', submittedAt: uploadedAt, status: 'Pending', files: attachments };
      const existing = selectedBatch && [...records, ...apiRecords].find(item => matchesBatch(item.batch, selectedBatch) && evidenceProjectName(item).trim().toLowerCase() === projectName.trim().toLowerCase());
      const saved = existing ? { ...existing, ...row, id: existing.id, files: [...existing.files, ...attachments], notes: [existing.notes, notes.trim()].filter(Boolean).join('\n'), status: 'Pending' as const, submittedAt: uploadedAt, reviewedBy: undefined, reviewedAt: undefined, reviewNote: undefined } : row;
      const next = existing ? [saved, ...records.filter(item => item.id !== existing.id)] : [row, ...records]; localStorage.setItem(EVIDENCE_KEY, JSON.stringify(next)); setRecords(next); setFiles([]); setNotes(''); setUploadOpen(false); setSuccess('Trainer evidence saved in this browser.');
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

  const changeFolderFilter = (key: string, value: string) => setFolderFilters(previous => ({ ...previous, [key]: value, ...(key === 'project' ? { batch: '' } : {}), ...(key === 'state' ? { district: '', block: '' } : {}), ...(key === 'district' ? { block: '' } : {}) }));
  const resetFolderFilters = () => setFolderFilters({ project: '', state: '', district: '', block: '', school: '', batch: '', fromDate: '', toDate: '' });
  const folderProjectEntries = Object.entries(projectGroups).filter(([name]) => !folderFilters.project || name === folderFilters.project);
  const filteredActiveBatches = activeBatches.filter(item => (!folderFilters.state || item.state === folderFilters.state) && (!folderFilters.district || item.district === folderFilters.district) && (!folderFilters.block || item.block === folderFilters.block) && (!folderFilters.batch || (item.batchCode || item.name || item.id) === folderFilters.batch) && (!folderFilters.fromDate || (item.trainingStartDate || '') >= folderFilters.fromDate) && (!folderFilters.toDate || (item.trainingStartDate || '') <= folderFilters.toDate));

  if (isTrainer || ernetLogin) return <div className="app trainer-evidence-workspace"><Sidebar activePage={isTrainer ? 'Upload Documents' : 'Uploaded Documents'} /><main className="main" id="main-content"><Topbar title="Training Evidence" /><Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1500, mx: 'auto', width: '100%' }}>
    <Box sx={{ mb: 1, width: '100%', display: 'flex', justifyContent: 'flex-end' }}><Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ width: '100%', '& > button': { flex: { xs: 1, sm: 'initial' }, minWidth: 0, whiteSpace: 'nowrap' } }}>
      <Button className="filter-trigger" variant="outlined" aria-expanded={Boolean(folderFilterAnchor)} onClick={event => setFolderFilterAnchor(event.currentTarget)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, minHeight: 41, px: { xs: 1, sm: 1.75 }, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}><span aria-hidden="true">☷</span>Filters{Object.values(folderFilters).filter(Boolean).length > 0 && <span className="filter-count visible">{Object.values(folderFilters).filter(Boolean).length}</span>}</Button>
      {isTrainer && <Button variant="contained" onClick={() => { setError(''); setSuccess(''); setFiles([]); setBatch(''); setUploadProject(folderLevel === 'batches' || folderLevel === 'files' ? selectedProject : ''); setUploadOpen(true); }} sx={{ minHeight: 41, px: { xs: 1, sm: 2 }, fontSize: { xs: 11, sm: 14 }, textTransform: 'none', whiteSpace: 'nowrap' }} startIcon={<EvidenceUploadIcon />}>Upload Evidence</Button>}
    </Stack></Box>
    {folderLevel !== 'projects' && <Paper elevation={0} sx={{ mb: 1.5, px: 1.5, py: 0.75, border: '1px solid #dce7f1', borderRadius: 2 }}><Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Button size="small" onClick={() => { setFolderLevel('projects'); setSelectedProject(''); setSelectedBatchId(''); }} aria-label="Projects" sx={{ minWidth: 30 }}>⌂</Button><Typography color="#9aabc0">›</Typography><Button size="small" onClick={() => { setFolderLevel('batches'); setSelectedBatchId(''); }} sx={{ textTransform: 'none', fontFamily: 'Poppins, Segoe UI, sans-serif', fontSize: 10, fontWeight: 700, color: '#173f68' }}>{selectedProject}</Button>
      {folderLevel === 'files' && <><Typography color="#9aabc0">›</Typography><Typography sx={{ fontFamily: 'Poppins, Segoe UI, sans-serif', fontSize: 10, fontWeight: 700, color: '#173f68', overflowWrap: 'anywhere' }}>{selectedBatchCode}</Typography></>}
    </Stack></Paper>}
    <Popover disablePortal open={Boolean(folderFilterAnchor)} anchorEl={folderFilterAnchor} onClose={() => setFolderFilterAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}><Box className="report-app" sx={{ p: 1 }}><Box className="dashboard-filter-popup" sx={{ width: { xs: 'calc(100vw - 24px)', sm: 900 }, maxWidth: 'calc(100vw - 24px)' }}><ReportFilterPanel fields={folderFilterFields} values={folderFilters} onChange={changeFolderFilter} onClear={resetFolderFilters} onClose={() => setFolderFilterAnchor(null)} dashboardStyle /></Box></Box></Popover>
    <Paper elevation={0} sx={{ border: '1px solid #dce7f1', borderRadius: 2, overflow: 'hidden' }}>
      {folderLevel === 'files' && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ p: 2 }}><TextField size="small" placeholder="Search files" value={fileSearch} onChange={event => setFileSearch(event.target.value)} sx={{ flex: 1 }} /><TextField select size="small" label="File type" value={fileType} onChange={event => setFileType(event.target.value)} sx={{ minWidth: 180 }}>{['All file types', ...Array.from(new Set(batchFiles.map(file => file.name.split('.').pop()?.toLowerCase() || 'file')))].map(type => <MenuItem key={type} value={type}>{type.toUpperCase()}</MenuItem>)}</TextField></Stack>}
      {folderLevel === 'files' ? <TableContainer sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 680 }}><TableHead><TableRow sx={{ bgcolor: '#f3f7fb' }}>{['File Name', 'File Type', 'Uploaded On', 'Actions'].map(label => <TableCell key={label} sx={{ fontWeight: 800 }}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{shownBatchFiles.map(file => <TableRow key={file.key} hover><TableCell sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{file.name}</TableCell><TableCell>{file.name.split('.').pop()?.toUpperCase()}</TableCell><TableCell>{new Date(file.uploadedAt).toLocaleString()}</TableCell><TableCell><IconButton size="small" aria-label={`Preview ${file.name}`} title="Preview" onClick={() => setPreviewFile(file)} sx={{ color: '#24527a', '&:hover': { bgcolor: '#edf5fc' } }}><EvidenceActionIcon type="preview" /></IconButton><IconButton size="small" aria-label={`Download ${file.name}`} title="Download" onClick={() => download(file)} sx={{ color: '#24527a', '&:hover': { bgcolor: '#edf5fc' } }}><EvidenceActionIcon type="download" /></IconButton></TableCell></TableRow>)}{!shownBatchFiles.length && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>No evidence files found in this batch.</TableCell></TableRow>}</TableBody></Table></TableContainer> : <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1.5 }}>{folderLevel === 'projects' ? folderProjectEntries.map(([name, items]) => <Button key={name} onClick={() => { setSelectedProject(name); setFolderLevel('batches'); }} sx={{ minHeight: 150, p: 2, display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'center', border: '1px solid #dce7f1', borderRadius: 2, color: '#173553', bgcolor: '#fff', textTransform: 'none' }}><EvidenceFolderIcon /><Box sx={{ fontWeight: 700, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{name}<Typography component="span" sx={{ display: 'block', fontSize: 13, color: '#6a8097', mt: 0.35 }}>{items.length} batches</Typography></Box></Button>) : filteredActiveBatches.map(item => { const code = item.batchCode || item.name || item.id; const count = visibleRecords.filter(row => matchesBatch(row.batch, item)).reduce((sum, row) => sum + row.files.length, 0); return <Button key={item.id} onClick={() => { setSelectedBatchId(item.id); setFolderLevel('files'); }} sx={{ minHeight: 150, p: 2, display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'center', border: '1px solid #dce7f1', borderRadius: 2, color: '#173553', bgcolor: '#fff', textTransform: 'none' }}><EvidenceFolderIcon /><Box sx={{ fontWeight: 700, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{code}<Typography component="span" sx={{ display: 'block', fontSize: 13, color: '#6a8097', mt: 0.35 }}>{count} files</Typography></Box></Button>; })}{((folderLevel === 'projects' && !folderProjectEntries.length) || (folderLevel === 'batches' && !filteredActiveBatches.length)) && <Typography color="text.secondary" sx={{ p: 3 }}>No folders found.</Typography>}</Box>}
    </Paper>
    {isTrainer && <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} fullWidth maxWidth="sm"><Box component="form" onSubmit={submit}><DialogTitle>Upload Training Evidence</DialogTitle><DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}><TextField select fullWidth label="Project Name" value={uploadProject} onChange={event => { setUploadProject(event.target.value); setBatch(''); }} required>{Object.keys(projectGroups).map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}</TextField><TextField select fullWidth label="Training Batch" value={batch} onChange={event => setBatch(event.target.value)} required disabled={!uploadProject}>{(projectGroups[uploadProject] || []).map(item => <MenuItem key={item.id} value={item.id}>{item.batchCode || item.name || item.id}</MenuItem>)}</TextField><TextField fullWidth type="date" label="Training Date" InputLabelProps={{ shrink: true }} value={date} onChange={event => setDate(event.target.value)} required /><TextField fullWidth multiline minRows={2} label="Notes (optional)" value={notes} onChange={event => setNotes(event.target.value)} /><Box onDragOver={event => { event.preventDefault(); setIsFileDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFileDragging(false); }} onDrop={event => { event.preventDefault(); setIsFileDragging(false); setFiles(current => [...current, ...Array.from(event.dataTransfer.files)]); setError(''); }} sx={{ minHeight: 185, p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.75, border: '2px dashed #7776d3', borderRadius: 2, bgcolor: isFileDragging ? '#e7e9ff' : '#f2f2ff', textAlign: 'center', transition: 'background-color .15s ease, border-color .15s ease', borderColor: isFileDragging ? '#4e4bc0' : '#7776d3' }}>
            <svg width="54" height="48" viewBox="0 0 54 48" fill="none" aria-hidden="true"><path d="M14 39h27a9 9 0 0 0 1-18 16 16 0 0 0-30-3A10 10 0 0 0 14 39Z" stroke="#5754bf" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M27.5 37V20m-7 7 7-7 7 7" stroke="#5754bf" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <Typography variant="body2" sx={{ color: '#4643a7', fontWeight: 600 }}>Drag and Drop Files</Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 150, color: '#80809c', fontSize: 11 }}><Box sx={{ height: '1px', flex: 1, bgcolor: '#cecee5' }} />OR<Box sx={{ height: '1px', flex: 1, bgcolor: '#cecee5' }} /></Stack>
            <Button component="label" variant="contained" sx={{ borderRadius: 6, px: 3, py: 0.5, minWidth: 92, textTransform: 'none', fontSize: 12, bgcolor: '#5754bf', boxShadow: '0 3px 8px #4643a733', '&:hover': { bgcolor: '#4643a7' } }}>Browse<input hidden multiple type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm" onChange={event => { setFiles(current => [...current, ...Array.from(event.target.files ?? [])]); setError(''); event.target.value = ''; }} /></Button>
          </Box>{files.map((file, index) => <Chip key={`${file.name}-${index}`} label={`${file.name} · ${formatSize(file.size)}`} onDelete={() => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))} />)}{error && <Alert severity="error">{error}</Alert>}{success && <Alert severity="success">{success}</Alert>}</Stack></DialogContent><DialogActions><Button onClick={() => setUploadOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={!batch || !files.length}>Submit for review</Button></DialogActions></Box></Dialog>}
    <Dialog open={Boolean(previewFile)} onClose={() => setPreviewFile(null)} maxWidth="md" fullWidth><DialogTitle>{previewFile?.name}</DialogTitle><DialogContent>{previewFile?.type.startsWith('image/') ? <Box component="img" src={previewFile.data} alt={previewFile.name} sx={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', mx: 'auto' }} /> : previewFile?.type === 'application/pdf' ? <Box component="iframe" src={previewFile.data} title={previewFile.name} sx={{ width: '100%', height: '70vh', border: 0 }} /> : <Typography>Preview is unavailable for this file type. Download it to open in a compatible app.</Typography>}</DialogContent><DialogActions><Button onClick={() => setPreviewFile(null)}>Close</Button></DialogActions></Dialog>
  </Box><Footer /></main></div>;

  return <div className="app"><Sidebar activePage={isTrainer ? 'Upload Documents' : 'Uploaded Documents'} /><main className="main" id="main-content"><Topbar title={isTrainer ? 'Training Evidence' : 'Training Evidence'} /><Box sx={{ p: { xs: 1, md: 2 }, pt: { xs: isTrainer ? 1 : 0.5, md: isTrainer ? 2 : 0.5 }, maxWidth: 1500, mx: 'auto', width: '100%' }}>
    <Stack spacing={2}>
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
      {!isTrainer && <Box className="report-app"><Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', px: { xs: 1, md: 2 }, mb: 1 }}><button type="button" className="filter-trigger" aria-expanded={Boolean(filterAnchor)} onClick={event => setFilterAnchor(event.currentTarget)}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="8" cy="6" r="2" fill="white" stroke="currentColor" strokeWidth="1.8"/><circle cx="15" cy="12" r="2" fill="white" stroke="currentColor" strokeWidth="1.8"/></svg>Filters{Object.values(filters).filter(Boolean).length > 0 && <span className="filter-count visible">{Object.values(filters).filter(Boolean).length}</span>}</button></Box><Popover disablePortal open={Boolean(filterAnchor)} anchorEl={filterAnchor} onClose={() => setFilterAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}><Box className="dashboard-filter-popup" sx={{ width: { xs: 'calc(100vw - 24px)', sm: 980 }, maxWidth: 'calc(100vw - 24px)', p: 1 }}><ReportFilterPanel fields={filterFields} values={filters as ReportFilters} onChange={changeEvidenceFilter} onClear={() => setFilters({ plan: '', batch: '', state: '', district: '', block: '', trainer: '', fromDate: '', toDate: '', status: '' })} onClose={() => setFilterAnchor(null)} dashboardStyle /></Box></Popover></Box>}
      <div className="selected-filter-summary trainer-evidence-filter-summary"><strong>Phase</strong><select aria-label="Dashboard phase" value={selectedPhase ?? ''} onChange={() => {}}><option value={selectedPhase ?? ''}>{dashboardPhaseLabel}</option></select></div>
      <Paper elevation={0} sx={{ border: '1px solid #e3ebf3', borderRadius: 2, overflow: 'hidden' }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}><Box><Typography variant="h6" fontWeight={750}>{isTrainer ? 'My submissions' : 'Submitted evidence'}</Typography>{isTrainer && <Typography variant="body2" color="text.secondary">Track review status for files you submitted.</Typography>}</Box><Chip label={`${filteredRecords.length} submission${filteredRecords.length === 1 ? '' : 's'}`} /></Stack>
        {filteredRecords.length ? <TableContainer sx={{ width: '100%', overflowX: 'auto' }}><Table size="small" sx={{ tableLayout: 'fixed', minWidth: 1250 }}><TableHead><TableRow><TableCell sx={{ width: 180, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>Trainer / batch</TableCell><TableCell sx={{ width: 115, whiteSpace: 'normal' }}>School UDISE</TableCell><TableCell sx={{ width: 180, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>School Name</TableCell><TableCell sx={{ width: 170, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>Location</TableCell><TableCell sx={{ width: 125, whiteSpace: 'normal' }}>Training date</TableCell><TableCell sx={{ width: 245, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>Evidence files</TableCell><TableCell sx={{ width: 145, whiteSpace: 'normal' }}>Submitted by</TableCell></TableRow></TableHead><TableBody>{filteredRecords.map(record => { const linkedBatch = batches.find(item => record.batch.startsWith(item.batchCode || item.id)); const school = kgbvSchools.find(item => item.udise === linkedBatch?.schoolUdiseVenue || item.school === linkedBatch?.location); const udise = linkedBatch?.schoolUdiseVenue || school?.udise || ''; const schoolName = linkedBatch?.schoolName || school?.school || linkedBatch?.location || ''; const location = [linkedBatch?.block || school?.block || record.block, linkedBatch?.district || school?.district || record.district, linkedBatch?.state || school?.state || record.state].filter(Boolean).join(', '); return <TableRow key={record.id}><TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}><Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{record.trainer}</Typography><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{record.batch}</Typography></TableCell><TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{udise || '—'}</TableCell><TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{schoolName || '—'}</TableCell><TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{location || '—'}</TableCell><TableCell sx={{ whiteSpace: 'normal' }}>{formatDate(record.date)}</TableCell><TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}><Stack spacing={.5}>{record.files.map(file => <Button key={file.name} size="small" onClick={() => download(file)} sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35, px: .5 }}>{file.name} · {formatSize(file.size)}</Button>)}</Stack></TableCell><TableCell sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{record.submittedBy}<Typography variant="caption" display="block" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{new Date(record.submittedAt).toLocaleString()}</Typography></TableCell></TableRow>; })}</TableBody></Table></TableContainer> : <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>No trainer evidence matches these filters.</Typography>}
      </Paper>
    </Stack>
  </Box><Footer /></main><Dialog open={Boolean(rejectingRecord)} onClose={() => setRejectingRecord(null)} maxWidth="sm" fullWidth><DialogTitle>Reason for rejection</DialogTitle><DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Add a note for the trainer and future reference.</Typography><TextField autoFocus required fullWidth multiline minRows={3} label="Rejection reason" value={rejectReason} onChange={event => setRejectReason(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setRejectingRecord(null)}>Cancel</Button><Button color="error" variant="contained" disabled={!rejectReason.trim()} onClick={rejectEvidence}>Reject evidence</Button></DialogActions></Dialog></div>;
}

