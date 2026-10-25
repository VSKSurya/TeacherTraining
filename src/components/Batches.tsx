import { useMemo, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { Footer, Sidebar, Topbar } from './DashboardParts';
import { getSession } from '../auth';

type Project = { id: string; name: string; code: string; assignedUsers: string[] };
type Plan = { id: string; code: string; name: string; status: 'Draft' | 'Active' | 'Inactive' };
type Association = { id: string; projectId: string; trainingPlanId: string; status: 'Active' | 'Inactive' };
type Batch = { id: string; batchCode: string; projectId: string; projectPlanAssociationId: string; name: string; createdAt: string; createdBy: string };
const PROJECTS_KEY = 'teacher-training-projects';
const PLANS_KEY = 'teacher-training-plans';
const ASSOCIATIONS_KEY = 'teacher-training-project-plan-associations';
const BATCHES_KEY = 'teacher-training-batch-plan-uses';
const createRoles = new Set(['schoolnet-super-admin', 'schoolnet-project-admin', 'state-admin', 'school-admin']);
function readList<T,>(key: string): T[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value as T[] : []; } catch { return []; } }

export default function Batches() {
  const session = getSession();
  const [projects] = useState<Project[]>(() => readList(PROJECTS_KEY));
  const [plans] = useState<Plan[]>(() => readList(PLANS_KEY));
  const [associations] = useState<Association[]>(() => readList(ASSOCIATIONS_KEY));
  const [batches, setBatches] = useState<Batch[]>(() => readList(BATCHES_KEY));
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [associationId, setAssociationId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [message, setMessage] = useState('');
  const canCreate = Boolean(session && createRoles.has(session.role));
  const canOverrideInactive = session?.role === 'schoolnet-super-admin';
  const authorizedProjects = projects.filter(project => session?.role === 'schoolnet-super-admin' || project.assignedUsers.includes(session?.userId ?? ''));
  const projectAssociations = associations.filter(item => item.projectId === projectId && item.status === 'Active' && authorizedProjects.some(project => project.id === item.projectId));
  const selectableAssociations = projectAssociations.filter(item => {
    const plan = plans.find(candidate => candidate.id === item.trainingPlanId);
    return plan && (plan.status === 'Active' || (canOverrideInactive && includeInactive && plan.status === 'Inactive'));
  });
  const selectedAssociation = selectableAssociations.find(item => item.id === associationId);
  const records = useMemo(() => batches.map(batch => {
    const project = projects.find(item => item.id === batch.projectId);
    const association = associations.find(item => item.id === batch.projectPlanAssociationId);
    const plan = plans.find(item => item.id === association?.trainingPlanId);
    return { ...batch, projectName: project?.name ?? 'Project unavailable', planName: plan?.name ?? 'Plan unavailable' };
  }), [batches, projects, associations, plans]);

  function createBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || !session) { setMessage('Your role cannot create batches.'); return; }
    const project = authorizedProjects.find(item => item.id === projectId);
    const association = selectableAssociations.find(item => item.id === associationId);
    const plan = plans.find(item => item.id === association?.trainingPlanId);
    if (!project || !association || !plan) { setMessage('Choose an authorized project and one of its available plan associations.'); return; }
    if (plan.status === 'Inactive' && !(canOverrideInactive && includeInactive)) { setMessage('Inactive plans require an explicit super admin override.'); return; }
    const batch: Batch = { id: crypto.randomUUID(), batchCode: `B-${Date.now().toString(36).toUpperCase()}`, projectId, projectPlanAssociationId: association.id, name: name.trim(), createdAt: new Date().toISOString(), createdBy: session.userId };
    const next = [batch, ...batches];
    localStorage.setItem(BATCHES_KEY, JSON.stringify(next)); setBatches(next);
    setName(''); setAssociationId(''); setMessage(`${batch.batchCode} created and linked to ${plan.name} for ${project.name}.`);
  }

  return <div className="app"><Sidebar activePage="Batches" /><main className="main"><Topbar title="Batches" description="Create batches from plans associated with authorized projects." />
    <Box sx={{ width: '100%', maxWidth: 1440, mx: 'auto', pb: 3 }}>
      <Stack spacing={2.5}>
        {!canCreate && <Alert severity="info">You can view batch assignments. An authorized administrator is required to create a batch.</Alert>}
        {message && <Alert severity={message.includes('created') ? 'success' : 'error'} onClose={() => setMessage('')}>{message}</Alert>}
        <Paper component="form" onSubmit={createBatch} elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #e3ebf3', borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 750 }}>Create batch</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 2 }}>
            <TextField select required label="Authorized project" value={projectId} onChange={event => { setProjectId(event.target.value); setAssociationId(''); }} disabled={!canCreate}>
              <MenuItem value="">Select a project</MenuItem>
              {authorizedProjects.map(project => <MenuItem key={project.id} value={project.id}>{project.name} · {project.code || project.id}</MenuItem>)}
            </TextField>
            <TextField select required label="Project-plan association" value={associationId} onChange={event => setAssociationId(event.target.value)} disabled={!canCreate || !projectId} helperText="The batch is linked to this project-plan association, not to the reusable plan alone.">
              <MenuItem value="">Select a plan association</MenuItem>
              {selectableAssociations.map(association => { const plan = plans.find(item => item.id === association.trainingPlanId)!; return <MenuItem key={association.id} value={association.id}>{plan.name} · {plan.code}{plan.status === 'Inactive' ? ' (Inactive — override)' : ''}</MenuItem>; })}
            </TextField>
            <TextField required label="Batch name" value={name} onChange={event => setName(event.target.value)} disabled={!canCreate} placeholder="e.g. Pune Teacher Cohort 1" />
            {canOverrideInactive && <Box sx={{ display: 'flex', alignItems: 'center' }}><FormControlLabel control={<Checkbox checked={includeInactive} onChange={event => { setIncludeInactive(event.target.checked); setAssociationId(''); }} />} label="Explicitly authorize inactive plans for this new batch" /></Box>}
          </Box>
          {selectedAssociation && plans.find(plan => plan.id === selectedAssociation.trainingPlanId)?.status === 'Inactive' && <Alert severity="warning" sx={{ mt: 2 }}>This batch will use an inactive plan under the super admin override.</Alert>}
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}><Button type="submit" variant="contained" disabled={!canCreate || !projectId || !associationId} sx={{ textTransform: 'none' }}>Create batch</Button></Stack>
        </Paper>
        <Paper elevation={0} sx={{ border: '1px solid #e3ebf3', borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #e3ebf3' }}><Typography variant="h6" sx={{ fontWeight: 750 }}>Batches</Typography></Box>
          {records.length === 0 ? <Typography sx={{ p: 3, color: '#71839a' }}>No batches have been created.</Typography> : <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 680, '& th': { textAlign: 'left', color: '#71839a', fontSize: 12, p: 1.5, bgcolor: '#f8fbff' }, '& td': { p: 1.5, borderTop: '1px solid #edf1f5' } }}><thead><tr><th>Batch</th><th>Project</th><th>Training plan</th><th>Created by</th><th>Created</th></tr></thead><tbody>{records.filter(record => authorizedProjects.some(project => project.id === record.projectId)).map(record => <tr key={record.id}><td><strong>{record.batchCode}</strong><br />{record.name}</td><td>{record.projectName}</td><td>{record.planName}</td><td>{record.createdBy}</td><td>{new Date(record.createdAt).toLocaleDateString()}</td></tr>)}</tbody></Box></Box>}
        </Paper>
      </Stack>
    </Box><Footer /></main></div>;
}
