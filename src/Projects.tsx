import { useMemo, useState, type FormEvent } from 'react';
import { Box, Checkbox, CssBaseline, FormControlLabel, ThemeProvider, createTheme } from '@mui/material';
import { Footer, Sidebar, Topbar } from './components/DashboardParts';
import { getSession } from './auth';
import { locations } from './data/locations';

type PhaseStatus = 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';
type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed';
type Phase = { id: string; name: string; sequence: number; startDate: string; endDate: string; status: PhaseStatus };
type OdooProject = { id: string; name: string; reference: string; sponsor: string };
type TrainingPlanDefinition = { id: string; code: string; name: string; beneficiaries?: string[]; status: 'Draft' | 'Active' | 'Inactive' };
type ProjectPlanAssociation = { id: string; projectId: string; trainingPlanId: string; status: 'Active' | 'Inactive'; createdAt: string; updatedAt: string };
type BatchPlanUse = { id: string; batchId: string; projectPlanAssociationId: string; createdAt: string };
type Project = {
  id: string; odooId: string; odooReference: string; name: string; code: string; sponsor: string;
  startDate: string; endDate: string; description: string; states: string[]; assignedUsers: string[];
  status: ProjectStatus; phases: Phase[]; trainingPlans: string[]; selectedTrainingPlanIds?: string[];
};
const PROJECTS_KEY = 'teacher-training-projects';
const CATALOG_KEY = 'teacher-training-odoo-project-catalog';
const TRAINING_PLANS_KEY = 'teacher-training-plans';
const PROJECT_PLAN_ASSOCIATIONS_KEY = 'teacher-training-project-plan-associations';
const BATCH_PLAN_USES_KEY = 'teacher-training-batch-plan-uses';
const users = ['Demo1', 'Demo2', 'Demo3', 'Demo4', 'Demo5', 'Demo6', 'Demo7', 'Demo8'];
const sampleCatalog: OdooProject[] = [
  { id: 'ODOO-PRJ-001', name: 'Teacher Training', reference: 'TT-2026', sponsor: 'ERNET India' },
  { id: 'ODOO-PRJ-002', name: 'Digital Classrooms', reference: 'DC-2026', sponsor: 'Schoolnet India' },
];
const emptyProject = (source: OdooProject): Project => ({
  id: crypto.randomUUID(), odooId: source.id, odooReference: source.reference, name: source.name, code: '', sponsor: source.sponsor,
  startDate: '', endDate: '', description: '', states: [], assignedUsers: [], status: 'Planning', phases: [], trainingPlans: [],
});
const statusOptions: PhaseStatus[] = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
function readJson<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function currentPhase(project: Project): Phase | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return [...project.phases].filter(phase => phase.status === 'In Progress' && phase.startDate <= today && phase.endDate >= today)
    .sort((a, b) => a.sequence - b.sequence)[0];
}

export default function Projects() {
  const session = getSession();
  const canConfigure = session?.role === 'schoolnet-super-admin' || session?.role === 'schoolnet-project-admin';
  const isSuperAdmin = session?.role === 'schoolnet-super-admin';
  const [catalog] = useState<OdooProject[]>(() => readJson(CATALOG_KEY, sampleCatalog));
  const [projects, setProjects] = useState<Project[]>(() => readJson(PROJECTS_KEY, []));
  const [trainingPlans] = useState<TrainingPlanDefinition[]>(() => readJson(TRAINING_PLANS_KEY, []));
  const [planAssociations, setPlanAssociations] = useState<ProjectPlanAssociation[]>(() => readJson(PROJECT_PLAN_ASSOCIATIONS_KEY, []));
  const [batchPlanUses] = useState<BatchPlanUse[]>(() => readJson(BATCH_PLAN_USES_KEY, []));
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [editing, setEditing] = useState<Project | null>(null);
  const [allowInactivePlanLinks, setAllowInactivePlanLinks] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const saveProjects = (next: Project[]) => { setProjects(next); localStorage.setItem(PROJECTS_KEY, JSON.stringify(next)); };
  const authorizedProjects = useMemo(() => projects.filter(project => {
    if (isSuperAdmin || session?.role === 'sponsor-admin') return true;
    return Boolean(session && project.assignedUsers.includes(session.userId));
  }), [projects, isSuperAdmin, session]);
  const filteredProjects = authorizedProjects.filter(project => {
    const query = search.trim().toLowerCase();
    return (!query || `${project.name} ${project.code} ${project.sponsor} ${project.odooReference}`.toLowerCase().includes(query))
      && (!phaseFilter || project.phases.some(phase => phase.id === phaseFilter));
  });
  const phaseOptions = [...new Map(authorizedProjects.flatMap(project => project.phases).map(phase => [phase.id, phase])).values()];
  const availableOdooProjects = catalog.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase())
    && !projects.some(project => project.odooId === item.id));

  function beginCreate(event: FormEvent) {
    event.preventDefault();
    const source = catalog.find(item => item.id === selectedSource);
    if (!source) { setFormError('Choose a project from the imported Odoo project table.'); return; }
    if (projects.some(project => project.odooId === source.id)) { setFormError('This Odoo project has already been added to the portal.'); return; }
    setEditing({ ...emptyProject(source), assignedUsers: session?.userId ? [session.userId] : [] }); setFormError(''); setNotice('');
  }
  function beginEdit(project: Project) {
    const linkedIds = planAssociations.filter(item => item.projectId === project.id && item.status === 'Active').map(item => item.trainingPlanId);
    const legacyIds = project.trainingPlans.map(name => trainingPlans.find(plan => plan.name === name || plan.code === name)?.id).filter((id): id is string => Boolean(id));
    setEditing({ ...project, selectedTrainingPlanIds: linkedIds.length ? linkedIds : legacyIds }); setAllowInactivePlanLinks(false); setFormError('');
  }
  function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (!editing.code.trim()) { setFormError('Enter a unique internal project code.'); return; }
    if (projects.some(project => project.code.toLowerCase() === editing.code.trim().toLowerCase() && project.id !== editing.id)) { setFormError('That internal project code is already in use.'); return; }
    if (!editing.startDate || !editing.endDate || editing.endDate < editing.startDate) { setFormError('Enter valid project dates. The end date must be on or after the start date.'); return; }
    if (editing.phases.some(phase => !phase.name.trim() || !phase.startDate || !phase.endDate || phase.endDate < phase.startDate)) { setFormError('Each phase needs a name and valid start and end dates.'); return; }
    if (editing.phases.some((phase, index) => editing.phases.some((other, otherIndex) => index !== otherIndex && phase.sequence === other.sequence))) { setFormError('Phase sequence numbers must be unique within the project.'); return; }
    const exists = projects.some(project => project.id === editing.id);
    const selectedPlanIds = [...new Set(editing.selectedTrainingPlanIds ?? [])].filter(id => trainingPlans.some(plan => plan.id === id && (plan.status !== 'Inactive' || (isSuperAdmin && allowInactivePlanLinks))));
    const timestamp = new Date().toISOString();
    const existingAssociations = planAssociations.filter(item => item.projectId === editing.id);
    const nextAssociations = [...planAssociations];
    for (const planId of selectedPlanIds) {
      const existingAssociation = existingAssociations.find(item => item.trainingPlanId === planId);
      if (existingAssociation) {
        const index = nextAssociations.findIndex(item => item.id === existingAssociation.id);
        nextAssociations[index] = { ...existingAssociation, status: 'Active', updatedAt: timestamp };
      } else nextAssociations.push({ id: crypto.randomUUID(), projectId: editing.id, trainingPlanId: planId, status: 'Active', createdAt: timestamp, updatedAt: timestamp });
    }
    for (const association of existingAssociations) {
      if (!selectedPlanIds.includes(association.trainingPlanId) && association.status === 'Active') {
        const index = nextAssociations.findIndex(item => item.id === association.id);
        nextAssociations[index] = { ...association, status: 'Inactive', updatedAt: timestamp };
      }
    }
    localStorage.setItem(PROJECT_PLAN_ASSOCIATIONS_KEY, JSON.stringify(nextAssociations)); setPlanAssociations(nextAssociations);
    const projectToSave = { ...editing, trainingPlans: [] };
    delete projectToSave.selectedTrainingPlanIds;
    saveProjects(exists ? projects.map(project => project.id === editing.id ? projectToSave : project) : [...projects, projectToSave]);
    setEditing(null); setSelectedSource(''); setFormError(''); setNotice(`${editing.name} ${exists ? 'updated' : 'created'} successfully.`);
  }
  function updateProject<K extends keyof Project>(key: K, value: Project[K]) {
    setEditing(project => project ? { ...project, [key]: value } : project);
  }
  function updatePhase(index: number, key: keyof Phase, value: string | number) {
    setEditing(project => project ? { ...project, phases: project.phases.map((phase, i) => i === index ? { ...phase, [key]: value } : phase) } : project);
  }

  return <ThemeProvider theme={createTheme({ palette: { primary: { main: '#176fba' }, background: { default: '#f4f7fb', paper: '#ffffff' }, text: { primary: '#173553', secondary: '#71839a' } }, typography: { fontFamily: 'Poppins, "Segoe UI", Arial, sans-serif' } })}>
    <CssBaseline />
    <div className="app project-app"><Sidebar activePage="Projects" /><main className="main"><Topbar title="Projects" /><div className="project-content">
      <div className="project-count-row"><div className="project-summary"><strong>{authorizedProjects.length}</strong><span>Authorized projects</span></div></div>
      {canConfigure && <section className="project-panel import-panel"><div className="project-panel-heading"><div><h3>Find an Odoo project</h3><p>Choose an imported project to create its linked portal configuration.</p></div><span className="source-badge">Imported catalog</span></div>
        <form className="odoo-search-form" onSubmit={beginCreate}><label className="project-field"><span>Search project name</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Odoo projects" /></label>
          <label className="project-field"><span>Select project</span><select value={selectedSource} onChange={event => setSelectedSource(event.target.value)}><option value="">Choose a project from Odoo</option>{availableOdooProjects.map(item => <option key={item.id} value={item.id}>{item.name} · {item.reference}</option>)}</select></label>
          <button className="project-primary-button" type="submit" disabled={!selectedSource}>Configure project</button></form>
        <div className="project-table-scroll"><table className="project-table odoo-table"><thead><tr><th>Odoo project name</th><th>Odoo ID</th><th>Odoo reference</th><th>Sponsor</th><th>Portal status</th></tr></thead><tbody>{catalog.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase())).map(item => {
          const imported = projects.some(project => project.odooId === item.id);
          return <tr key={item.id}><td className="project-name-cell">{item.name}</td><td>{item.id}</td><td>{item.reference}</td><td>{item.sponsor}</td><td><span className={`project-tag ${imported ? 'configured' : 'available'}`}>{imported ? 'Configured' : 'Available'}</span></td></tr>;
        })}{catalog.length === 0 && <tr><td colSpan={5} className="project-empty">No imported Odoo projects are available.</td></tr>}</tbody></table></div>
      </section>}

      {notice && <p className="project-notice" role="status">{notice}</p>}
      {editing && <section className="project-panel project-editor"><div className="project-panel-heading"><div><h3>{projects.some(project => project.id === editing.id) ? 'Configure project' : 'Create portal project'}</h3><p>Linked to Odoo project <strong>{editing.name}</strong> · {editing.odooReference}</p></div><button type="button" className="project-cancel-button" onClick={() => { setEditing(null); setFormError(''); }}>Cancel</button></div>
        <form onSubmit={saveProject}>
          <div className="project-form-grid"><label className="project-field"><span>Project name</span><input value={editing.name} onChange={event => updateProject('name', event.target.value)} required /></label>
            <label className="project-field"><span>Odoo reference</span><input value={editing.odooReference} onChange={event => updateProject('odooReference', event.target.value)} required /></label>
            <label className="project-field"><span>Internal project code <b>*</b></span><input value={editing.code} onChange={event => updateProject('code', event.target.value)} placeholder="e.g. EDU-2026-01" required /></label>
            <label className="project-field"><span>Sponsor</span><input value={editing.sponsor} onChange={event => updateProject('sponsor', event.target.value)} required /></label>
            <label className="project-field"><span>Start date</span><input type="date" value={editing.startDate} onChange={event => updateProject('startDate', event.target.value)} required /></label>
            <label className="project-field"><span>End date</span><input type="date" min={editing.startDate || undefined} value={editing.endDate} onChange={event => updateProject('endDate', event.target.value)} required /></label>
            <label className="project-field"><span>Project status</span><select value={editing.status} onChange={event => updateProject('status', event.target.value as ProjectStatus)}>{(['Planning', 'Active', 'On Hold', 'Completed'] as ProjectStatus[]).map(status => <option key={status}>{status}</option>)}</select></label>
            <label className="project-field project-field-wide"><span>Description (optional)</span><textarea rows={2} value={editing.description} onChange={event => updateProject('description', event.target.value)} placeholder="Add a short project description" /></label>
            <fieldset className="project-field project-field-wide project-state-field"><legend>Applicable states and scope</legend><div className="scope-options"><label className="scope-all-option"><input type="checkbox" checked={editing.states.length === locations.length} onChange={event => updateProject('states', event.target.checked ? locations.map(location => location.name) : [])} />All States</label>{locations.map(location => <label key={location.name}><input type="checkbox" checked={editing.states.includes(location.name)} onChange={event => updateProject('states', event.target.checked ? [...editing.states, location.name] : editing.states.filter(state => state !== location.name))} />{location.name}</label>)}</div></fieldset>
            <label className="project-field project-field-wide"><span>Assigned project administrators / authorized users</span><select multiple value={editing.assignedUsers} onChange={event => updateProject('assignedUsers', Array.from(event.target.selectedOptions, option => option.value))}>{users.map(user => <option key={user} value={user}>{user}{session?.userId === user ? ' (you)' : ''}</option>)}</select><small>Hold Ctrl (Windows) or Command (Mac) to select more than one user.</small></label>
            <fieldset className="project-field project-field-wide project-state-field"><legend>Training plans for this project</legend><small>Select reusable plan definitions. The same plan may be linked to multiple projects. Batches reference the project-plan association.</small>{isSuperAdmin && <label><input type="checkbox" checked={allowInactivePlanLinks} onChange={event => setAllowInactivePlanLinks(event.target.checked)} /> Explicitly authorize inactive plan associations</label>}{trainingPlans.filter(plan => plan.status !== 'Inactive' || (isSuperAdmin && allowInactivePlanLinks)).length ? <div className="scope-options">{trainingPlans.filter(plan => plan.status !== 'Inactive' || (isSuperAdmin && allowInactivePlanLinks)).map(plan => {
              const checked = (editing.selectedTrainingPlanIds ?? []).includes(plan.id);
              const category = plan.beneficiaries?.filter(item => item === 'Teacher' || item === 'Student').join(' / ');
              return <FormControlLabel key={plan.id} sx={{ mr: 2 }} control={<Checkbox size="small" checked={checked} onChange={event => updateProject('selectedTrainingPlanIds', event.target.checked ? [...(editing.selectedTrainingPlanIds ?? []), plan.id] : (editing.selectedTrainingPlanIds ?? []).filter(id => id !== plan.id))} />} label={`${plan.name} (${plan.code})${category ? ` · ${category}` : ''}${plan.status === 'Inactive' ? ' · INACTIVE' : ''}`} />;
            })}</div> : <p className="phase-empty">No reusable plans are available. Create a training plan first.</p>}</fieldset>
          </div>
          <div className="phase-editor-heading"><div><h4>Project phases</h4><p>Set sequence and dates. For overlapping in-progress phases, the lowest sequence is current.</p></div><button type="button" className="project-secondary-button" onClick={() => updateProject('phases', [...editing.phases, { id: crypto.randomUUID(), name: '', sequence: editing.phases.length + 1, startDate: '', endDate: '', status: 'Not Started' }])}>+ Add phase</button></div>
          {editing.phases.length > 0 ? <div className="phase-editor-list">{editing.phases.map((phase, index) => <div className="phase-editor-row" key={phase.id}><label className="project-field"><span>Name</span><input value={phase.name} onChange={event => updatePhase(index, 'name', event.target.value)} placeholder="Phase name" /></label><label className="project-field"><span>Sequence</span><input type="number" min="1" value={phase.sequence} onChange={event => updatePhase(index, 'sequence', Number(event.target.value))} /></label><label className="project-field"><span>Start</span><input type="date" value={phase.startDate} onChange={event => updatePhase(index, 'startDate', event.target.value)} /></label><label className="project-field"><span>End</span><input type="date" min={phase.startDate || undefined} value={phase.endDate} onChange={event => updatePhase(index, 'endDate', event.target.value)} /></label><label className="project-field"><span>Status</span><select value={phase.status} onChange={event => updatePhase(index, 'status', event.target.value)}>{statusOptions.map(status => <option key={status}>{status}</option>)}</select></label><button className="phase-remove" type="button" aria-label={`Remove ${phase.name || 'phase'}`} onClick={() => updateProject('phases', editing.phases.filter((_, i) => i !== index))}>×</button></div>)}</div> : <p className="phase-empty">No phases yet. Add a phase to define this project’s schedule.</p>}
          {formError && <p className="project-error" role="alert">{formError}</p>}<div className="project-form-actions"><button type="button" className="project-cancel-button" onClick={() => { setEditing(null); setFormError(''); }}>Cancel</button><button className="project-primary-button" type="submit">Save project</button></div>
        </form>
      </section>}

      <section className="project-panel"><div className="project-panel-heading project-list-heading"><div><h3>Project register</h3><p>Projects you are authorized to access, with their current phase and scope.</p></div><div className="project-list-filters"><input aria-label="Search projects" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search projects" /><select aria-label="Filter by phase" value={phaseFilter} onChange={event => setPhaseFilter(event.target.value)}><option value="">All phases</option>{phaseOptions.map(phase => <option key={phase.id} value={phase.id}>{phase.sequence}. {phase.name}</option>)}</select></div></div>
        <div className="project-table-scroll"><table className="project-table"><thead><tr><th>Project</th><th>Code / Odoo reference</th><th>Scope</th><th>Project dates</th><th>Current phase</th><th>Status / progress</th>{canConfigure && <th>Action</th>}</tr></thead><tbody>{filteredProjects.map(project => {
          const activePhase = currentPhase(project); const complete = project.phases.filter(phase => phase.status === 'Completed').length; const progress = project.phases.length ? Math.round(complete / project.phases.length * 100) : 0;
          const linkedPlans = planAssociations.filter(item => item.projectId === project.id && item.status === 'Active');
          const planNames = linkedPlans.map(association => {
            const plan = trainingPlans.find(item => item.id === association.trainingPlanId);
            const batches = batchPlanUses.filter(item => item.projectPlanAssociationId === association.id).length;
            return plan ? `${plan.name}${batches ? ` · ${batches} batch${batches === 1 ? '' : 'es'}` : ''}` : '';
          }).filter(Boolean);
          return <tr key={project.id}><td><strong className="project-name-cell">{project.name}</strong><small className="project-subline">{project.sponsor} · Odoo {project.odooId}</small><small className="project-subline">Plans: {planNames.join(', ') || 'None linked'}</small></td><td><strong>{project.code}</strong><small className="project-subline">{project.odooReference}</small></td><td>{project.states.length ? project.states.join(', ') : 'Not specified'}</td><td>{project.startDate} – {project.endDate}</td><td>{activePhase ? <><strong>{activePhase.sequence}. {activePhase.name}</strong><small className="project-subline">In Progress</small></> : 'No current phase'}</td><td><span className={`project-tag ${project.status.toLowerCase().replaceAll(' ', '-')}`}>{project.status}</span><div className="project-progress"><i style={{ width: `${progress}%` }} /></div><small>{progress}% phases completed</small></td>{canConfigure && <td><button type="button" className="project-edit-button" onClick={() => beginEdit(project)}>Configure</button></td>}</tr>;
        })}{filteredProjects.length === 0 && <tr><td colSpan={canConfigure ? 7 : 6} className="project-empty">{authorizedProjects.length ? 'No projects match your search or phase filter.' : 'No projects are assigned to this account yet.'}</td></tr>}</tbody></table></div>
      </section>
    </div><Footer /></main></div>
  </ThemeProvider>;
}
