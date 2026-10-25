import { useMemo, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Checkbox, Chip, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, OutlinedInput, Paper, Select, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';

type PlanType = 'Classroom' | 'Online' | 'Hybrid';
type PlanStatus = 'Draft' | 'Active' | 'Inactive';
type ResourceAssignment = { id: string; resource: string; fromDay: number; toDay: number; throughProjectEnd: boolean };
type TrainingPlan = { id: string; code: string; name: string; type: PlanType; description: string; days: number; beneficiaries: string[]; resources: string[]; resourceAssignments?: ResourceAssignment[]; status: PlanStatus; createdAt: string };
const STORAGE_KEY = 'teacher-training-plans';
const resourceOptions = ['Pre-training survey', 'Pre-assessment', 'Daily assessment', 'Feedback form', 'Post-assessment', 'Post-training survey'];
const beneficiaryOptions = ['Teacher', 'Student', 'School leader', 'Trainer', 'Other'];
const adminRoles = new Set(['schoolnet-super-admin', 'schoolnet-project-admin', 'state-admin', 'school-admin']);
function loadPlans(): TrainingPlan[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); return Array.isArray(value) ? value as TrainingPlan[] : []; } catch { return []; }
}
function nextCode(plans: TrainingPlan[]) {
  const used = new Set(plans.map(item => item.code));
  let latest = plans.reduce((max, item) => Math.max(max, Number(item.code.match(/(\d+)$/)?.[1] ?? 0)), 0);
  let candidate = '';
  do { candidate = `TP-${String(++latest).padStart(5, '0')}`; } while (used.has(candidate));
  return candidate;
}

export default function TrainingPlanPage() {
  const session = getSession();
  const [plans, setPlans] = useState(loadPlans);
  const [name, setName] = useState('');
  const [type, setType] = useState<PlanType>('Classroom');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState('1');
  const [beneficiaries, setBeneficiaries] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<ResourceAssignment[]>([]);
  const [status, setStatus] = useState<PlanStatus>('Draft');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const authorized = Boolean(session && adminRoles.has(session.role));
  const totals = useMemo(() => ({ active: plans.filter(plan => plan.status === 'Active').length, drafts: plans.filter(plan => plan.status === 'Draft').length }), [plans]);
  const dayCount = Math.max(1, Number(days) || 1);

  function changeDays(value: string) {
    setDays(value);
    const updatedDuration = Number(value);
    if (Number.isInteger(updatedDuration) && updatedDuration > 0) {
      setAssignments(current => current.map(item => item.throughProjectEnd ? { ...item, toDay: updatedDuration } : item));
    }
  }
  function updateAssignment(id: string, changes: Partial<ResourceAssignment>) {
    setAssignments(current => current.map(item => item.id === id ? { ...item, ...changes } : item));
  }

  function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const duration = Number(days);
    if (!Number.isInteger(duration) || duration < 1 || duration > 365) { setNotice('Training duration must be between 1 and 365 days.'); return; }
    if (assignments.some(item => !item.resource || item.fromDay < 1 || item.fromDay > duration || item.toDay < item.fromDay || item.toDay > duration)) { setNotice('Each resource must have a valid training day range within the plan duration.'); return; }
    const existing = editingId ? plans.find(item => item.id === editingId) : undefined;
    const record: TrainingPlan = { ...existing, id: existing?.id ?? crypto.randomUUID(), code: existing?.code ?? nextCode(plans), name: name.trim(), type, description: description.trim(), days: duration, beneficiaries, resources: existing?.resources ?? [], resourceAssignments: assignments.map(item => ({ ...item })), status, createdAt: existing?.createdAt ?? new Date().toISOString() };
    const updated = existing ? plans.map(item => item.id === existing.id ? record : item) : [record, ...plans];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPlans(updated); setEditingId(null); setName(''); setType('Classroom'); setDescription(''); setDays('1'); setBeneficiaries([]); setAssignments([]); setStatus('Draft');
    setNotice(`${record.code} ${existing ? 'updated' : 'created'} successfully. Existing attendance and assessment records were left unchanged.`);
  }
  function editPlan(plan: TrainingPlan) {
    setEditingId(plan.id); setName(plan.name); setType(plan.type); setDescription(plan.description); setDays(String(plan.days)); setBeneficiaries([...plan.beneficiaries]);
    setAssignments((plan.resourceAssignments ?? []).map(item => ({ ...item }))); setStatus(plan.status);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() {
    setEditingId(null); setName(''); setType('Classroom'); setDescription(''); setDays('1'); setBeneficiaries([]); setAssignments([]); setStatus('Draft');
  }

  return <div className="app"><Sidebar activePage="Training Plans" /><main className="main"><Topbar title="Training Plans" description="Create and manage structured learning programs." />
    <Box sx={{ maxWidth: 1440, width: '100%', mx: 'auto', pb: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2} sx={{ mb: 2.5 }}>
        <Box><Typography variant="h5" sx={{ color: '#12365c', fontWeight: 750 }}>Training plan registry</Typography><Typography variant="body2" sx={{ color: '#71839a', mt: .4 }}>Set the delivery format, audience, duration, and learning resources.</Typography></Box>
        <Stack direction="row" spacing={1}><Chip label={`${plans.length} total plans`} variant="outlined" /><Chip color="success" label={`${totals.active} active`} /><Chip color="warning" label={`${totals.drafts} drafts`} /></Stack>
      </Stack>
      {!authorized && <Alert severity="error" sx={{ mb: 2 }}>Only authorized administrators can create training plans.</Alert>}
      <Paper component="form" onSubmit={createPlan} elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #e3ebf3', borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Box><Typography variant="h6" sx={{ fontWeight: 750, color: '#173553' }}>Plan details</Typography><Typography variant="body2" sx={{ color: '#71839a' }}>The system assigns a unique plan code when you save.</Typography></Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 2 }}>
            <TextField required fullWidth label="Training plan name" value={name} onChange={e => setName(e.target.value)} inputProps={{ maxLength: 120 }} placeholder="e.g. Foundational Literacy Workshop" />
            <FormControl fullWidth><InputLabel>Training plan type</InputLabel><Select label="Training plan type" value={type} onChange={e => setType(e.target.value as PlanType)}>{(['Classroom', 'Online', 'Hybrid'] as const).map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
            <TextField required fullWidth type="number" label="Number of training days" value={days} onChange={e => changeDays(e.target.value)} inputProps={{ min: 1, max: 365 }} />
            <FormControl fullWidth><InputLabel>Beneficiary category</InputLabel><Select multiple value={beneficiaries} onChange={e => setBeneficiaries(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)} input={<OutlinedInput label="Beneficiary category" />} renderValue={selected => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5 }}>{selected.map(item => <Chip size="small" key={item} label={item} />)}</Box>}>{beneficiaryOptions.map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
            <Box sx={{ gridColumn: { md: '1 / -1' }, p: 2, border: '1px solid #e3ebf3', borderRadius: 2, bgcolor: '#fbfdff' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
                <Box><Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Day-linked resources</Typography><Typography variant="caption" color="text.secondary">Assign each form a valid availability range. Multiple resources can share a day.</Typography></Box>
                <Button type="button" size="small" variant="outlined" onClick={() => setAssignments(items => [...items, { id: crypto.randomUUID(), resource: '', fromDay: 1, toDay: 1, throughProjectEnd: false }])} sx={{ textTransform: 'none' }}>Add resource</Button>
              </Stack>
              {assignments.length === 0 && <Typography variant="body2" color="text.secondary">No resources assigned yet.</Typography>}
              <Stack spacing={1.5}>{assignments.map((item, index) => <Box key={item.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr auto', md: 'minmax(220px,2fr) minmax(100px,1fr) minmax(100px,1fr) auto' }, gap: 1.25, alignItems: 'center', p: 1.25, border: '1px solid #e8eef4', borderRadius: 1.5, bgcolor: '#fff' }}>
                <FormControl fullWidth sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}><InputLabel id={`plan-resource-${item.id}`}>Resource</InputLabel><Select labelId={`plan-resource-${item.id}`} label="Resource" value={item.resource} onChange={e => updateAssignment(item.id, { resource: e.target.value })}><MenuItem value="" disabled>Select a resource</MenuItem>{resourceOptions.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}</Select></FormControl>
                <TextField fullWidth type="number" label="From day" value={item.fromDay} onChange={e => updateAssignment(item.id, { fromDay: Number(e.target.value) })} inputProps={{ min: 1, max: dayCount }} error={item.fromDay < 1 || item.fromDay > dayCount} helperText={item.fromDay > dayCount ? `Maximum Day ${dayCount}` : ''} />
                <TextField fullWidth type="number" label="To day" value={item.throughProjectEnd ? dayCount : item.toDay} disabled={item.throughProjectEnd} onChange={e => updateAssignment(item.id, { toDay: Number(e.target.value) })} inputProps={{ min: item.fromDay, max: dayCount }} error={!item.throughProjectEnd && (item.toDay < item.fromDay || item.toDay > dayCount)} helperText={!item.throughProjectEnd && item.toDay > dayCount ? `Maximum Day ${dayCount}` : ''} />
                <IconButton aria-label={`Remove resource assignment ${index + 1}`} color="error" onClick={() => setAssignments(items => items.filter(assignment => assignment.id !== item.id))} sx={{ gridColumn: { xs: '3', md: 'auto' } }}>×</IconButton>
                <FormControlLabel sx={{ gridColumn: '1 / -1', m: 0 }} control={<Checkbox size="small" checked={item.throughProjectEnd} onChange={e => updateAssignment(item.id, { throughProjectEnd: e.target.checked, toDay: e.target.checked ? dayCount : item.fromDay })} />} label={<Typography variant="caption">Keep available through the end of the project (Day {dayCount})</Typography>} />
              </Box>)}</Stack>
              {assignments.some(item => item.fromDay > dayCount || item.toDay > dayCount || item.toDay < item.fromDay) && <Alert severity="error" sx={{ mt: 1.5 }}>Resource day ranges must remain within Day 1 through Day {dayCount}, and To day cannot come before From day.</Alert>}
            </Box>
            <TextField fullWidth multiline minRows={3} label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} inputProps={{ maxLength: 1000 }} sx={{ gridColumn: { md: '1 / -1' } }} placeholder="Describe the learning objectives or intended outcomes." />
            <FormControl fullWidth><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={e => setStatus(e.target.value as PlanStatus)}>{(['Draft', 'Active', 'Inactive'] as const).map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, borderRadius: 1, bgcolor: '#f4f8fc' }}><Typography variant="body2" sx={{ color: '#71839a' }}>Training_Plan_Code</Typography><Typography sx={{ ml: 'auto', fontWeight: 750, color: '#176fba' }}>{nextCode(plans)} <Typography component="span" variant="caption" color="text.secondary">(assigned on save)</Typography></Typography></Box>
          </Box>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>{editingId && <Button type="button" onClick={cancelEdit} sx={{ textTransform: 'none' }}>Cancel edit</Button>}<Button type="submit" variant="contained" disabled={!authorized} sx={{ px: 3, py: 1.1, textTransform: 'none', fontWeight: 700 }}>{editingId ? 'Save plan changes' : 'Create training plan'}</Button></Stack>
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ mt: 2.5, border: '1px solid #e3ebf3', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e3ebf3' }}><Typography variant="h6" sx={{ fontWeight: 750 }}>Saved training plans</Typography></Box>
        {plans.length === 0 ? <Typography sx={{ p: 3, color: '#71839a' }}>No plans created yet. Complete the form above to add the first plan.</Typography> : <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 820, '& th': { textAlign: 'left', color: '#71839a', fontSize: 12, fontWeight: 700, p: 1.5, bgcolor: '#f8fbff' }, '& td': { p: 1.5, borderTop: '1px solid #edf1f5', color: '#34516d', verticalAlign: 'top' } }}><thead><tr><th>Plan / Code</th><th>Type</th><th>Duration</th><th>Beneficiaries</th><th>Resources by day</th><th>Status</th><th>Action</th></tr></thead><tbody>{plans.map(plan => <tr key={plan.id}><td><strong>{plan.name}</strong><Typography variant="caption" display="block" color="text.secondary">{plan.code}</Typography>{plan.description && <Typography variant="caption" display="block" color="text.secondary">{plan.description}</Typography>}</td><td>{plan.type}</td><td>{plan.days} {plan.days === 1 ? 'day' : 'days'}</td><td>{plan.beneficiaries.join(', ') || '—'}</td><td>{(plan.resourceAssignments?.length ?? 0) > 0 ? plan.resourceAssignments!.map(item => <Typography key={item.id} variant="caption" display="block">{item.resource}: Day {item.fromDay}{item.toDay > item.fromDay ? `–${item.toDay}` : ''}{item.throughProjectEnd ? ' (through project end)' : ''}</Typography>) : plan.resources.join(', ') || '—'}</td><td><Chip size="small" label={plan.status} color={plan.status === 'Active' ? 'success' : plan.status === 'Draft' ? 'warning' : 'default'} /></td><td><Button size="small" onClick={() => editPlan(plan)} disabled={!authorized} sx={{ textTransform: 'none' }}>Edit</Button></td></tr>)}</tbody></Box></Box>}
      </Paper>
    </Box><Footer /></main><Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice('')} message={notice} />
  </div>;
}
