import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, IconButton, Snackbar } from '@mui/material';
import { Sidebar, Topbar, Footer } from './components/DashboardParts';

type Category = 'Presentation' | 'Video' | 'Documents' | 'Forms';
type Resource = { id: string; title: string; file: string; sourceFile?: string; category: Category; format: string; size: string; language: string; tags: string[]; url: string; text?: string; questions?: FormRow[]; planCode?: string; day?: number };
type FormRow = Record<string, unknown>;
type ContentSample = { filename: string; base64: string };
declare global { interface Window { CONTENT_SAMPLES?: ContentSample[] } }
const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
const resources: Resource[] = [
  { id: 'video', title: 'Digital classroom training', file: 'digital-classroom-training.mp4', sourceFile: 'sample-training-video.mp4', category: 'Video', format: 'MP4', size: '20 KB', language: 'English', tags: ['Training', 'Digital classroom', 'Video'], url: publicAsset('/content-library-assets/sample-training-video.mp4') },
  { id: 'manual', title: 'Teacher training manual', file: 'teacher-training-manual.pdf', sourceFile: 'sample-training-manual.pdf', category: 'Documents', format: 'PDF', size: '2 KB', language: 'English', tags: ['Manual', 'Reference', 'Training'], url: publicAsset('/content-library-assets/sample-training-manual.pdf') },
  { id: 'presentation', title: 'Teacher training presentation', file: 'teacher-training-presentation.pptx', sourceFile: 'sample-training.pptx', category: 'Presentation', format: 'PPTX', size: '28 KB', language: 'English', tags: ['Presentation', 'Training', 'Classroom'], url: publicAsset('/content-library-assets/sample-training.pptx') },
  { id: 'guide', title: 'Teacher training guide', file: 'teacher-training-guide.docx', sourceFile: 'sample-training-guide.docx', category: 'Documents', format: 'DOCX', size: '36 KB', language: 'English', tags: ['Document', 'Guide', 'Training'], url: publicAsset('/content-library-assets/sample-training-guide.docx') },
];
const categories = ['All', 'Presentation', 'Video', 'Documents', 'Forms'] as const;
const languages = ['All Languages', 'English', 'Hindi'];
const formStorageKey = 'teacher-training-assessment-form-master';
function readLibraryForms(): FormRow[] { try { const value: unknown = JSON.parse(localStorage.getItem(formStorageKey) ?? '[]'); return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as FormRow[] : []; } catch { return []; } }
const resourcesForCategory = (category: string) => resources.filter(resource => resource.category === category);
const categoryOf = (resource: Resource) => resource.format === 'FORM' ? 'form' : resource.format === 'PDF' ? 'pdf' : resource.format === 'MP4' ? 'video' : resource.format === 'PPTX' ? 'presentation' : resource.format === 'PNG' || resource.format === 'JPG' ? 'image' : '';
const labelOf = (resource: Resource) => resource.format === 'FORM' ? 'Form' : resource.format === 'PDF' ? 'Manual & PDF' : resource.format === 'PPTX' ? 'Presentation' : resource.format === 'MP4' ? 'Video' : resource.format === 'PNG' || resource.format === 'JPG' ? 'Image' : 'Document';

let sampleScriptPromise: Promise<ContentSample[]> | undefined;
function loadContentSamples(): Promise<ContentSample[]> {
  if (window.CONTENT_SAMPLES) return Promise.resolve(window.CONTENT_SAMPLES);
  if (!sampleScriptPromise) sampleScriptPromise = new Promise(resolve => {
    const script = document.createElement('script');
    script.src = publicAsset('/content-samples.js');
    script.onload = () => resolve(window.CONTENT_SAMPLES ?? []);
    script.onerror = () => resolve([]);
    document.head.appendChild(script);
  });
  return sampleScriptPromise;
}
function xmlText(xml: string, tag: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return [...doc.getElementsByTagName('*')].filter(node => node.localName === tag).map(node => node.textContent).filter(Boolean).join(' ');
}
async function officePreview(resource: Resource) {
  try {
    const samples = await loadContentSamples();
    const sample = samples.find(item => item.filename === (resource.sourceFile ?? resource.file));
    if (!sample) return 'Download this file to open it in a compatible app.';
    const bytes = Uint8Array.from(atob(sample.base64), ch => ch.charCodeAt(0));
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(bytes);
    const isDocx = resource.format === 'DOCX';
    const names = Object.keys(zip.files).filter(name => isDocx ? name === 'word/document.xml' : /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
    const parts: string[] = [];
    for (const name of names.slice(0, 20)) {
      const text = xmlText(await zip.files[name].async('string'), 't');
      if (text) parts.push((isDocx ? '' : `${name.split('/').pop()?.replace('.xml', '').replace('slide', 'Slide ')}\n`) + text);
    }
    return parts.join('\n\n') || 'No readable text was found in this file. Download it to open the full document.';
  } catch { return 'Preview is unavailable for this file. Download it to open the full document in a compatible app.'; }
}
function ResourceCard({ resource, onPreview }: { resource: Resource; onPreview: (resource: Resource) => void }) {
  return <article className="card">
    <div className="card-body"><div className="resource-meta-row"><div className={`file-icon-box ${categoryOf(resource)}`} aria-label={`${resource.format} file`} role="img"><FileTypeIcon format={resource.format} /></div><div className="card-meta"><span>{labelOf(resource)}</span><span>{resource.size}</span><span>{resource.language}</span></div></div><h3>{resource.title}</h3><p className="filename">{resource.file}</p>
      <div className="tags" aria-label="Tags">{resource.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>
      <div className="actions"><button className="action" type="button" onClick={() => onPreview(resource)}>Preview</button>{resource.format !== 'FORM' && <a className="action download" href={resource.url} download={resource.file}>Download</a>}</div>
    </div>
  </article>;
}

function FileTypeIcon({ format }: { format: string }) {
  if (format === 'MP4') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="6" width="25" height="20" rx="3" /><path d="m13 11 8 5-8 5z" /></svg>;
  if (format === 'PDF') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 3.5h10l7 7v18H8a2 2 0 0 1-2-2v-21a2 2 0 0 1 2-2Z" /><path d="M18 4v7h7M10 23h12M10 19h12" /></svg>;
  if (format === 'PPTX') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="4.5" width="25" height="18" rx="2" /><path d="M16 23v5m-6 0h12M16 8v8h8M16 16l-6-4" /></svg>;
  if (format === 'PNG' || format === 'JPG') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="4.5" width="25" height="23" rx="3" /><circle cx="11" cy="12" r="2.5" /><path d="m5 24 8-8 5 5 4-4 6 6" /></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 3.5h10l7 7v18H8a2 2 0 0 1-2-2v-21a2 2 0 0 1 2-2Z" /><path d="M18 4v7h7M11 17h11M11 21h11M11 25h7" /></svg>;
}

export default function ContentLibrary() {
  const [category, setCategory] = useState<string>('All');
  const [language, setLanguage] = useState('All Languages');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<Resource | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState('');
  const [formRecords, setFormRecords] = useState<FormRow[]>(readLibraryForms);
  const formResources = useMemo(() => formRecords.map((form, index) => {
    const questions = Array.isArray(form.questions) ? form.questions as FormRow[] : [];
    const rawTitle = typeof form.title === 'string' ? form.title : 'Untitled form';
    const title = rawTitle.replace(/^Sample\s+/i, '') || rawTitle;
    const kind = typeof form.kind === 'string' ? form.kind : 'Form';
    const stage = typeof form.stage === 'string' ? form.stage : 'Training';
    const planCode = typeof form.planCode === 'string' ? form.planCode : 'All plans';
    const questionText = questions.map((question, questionIndex) => {
      const prompt = typeof question.prompt === 'string' ? question.prompt : `Question ${questionIndex + 1}`;
      const options = Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === 'string') : [];
      return `${questionIndex + 1}. ${prompt}${options.length ? `\n   ${options.join(' · ')}` : ''}`;
    }).join('\n\n');
    const summary = [`Type: ${kind}`, `Stage: ${stage}`, `Training plan: ${planCode}`, `Day: ${String(form.day ?? 1)}`, `${questions.length} question${questions.length === 1 ? '' : 's'}`, questionText].filter(Boolean).join('\n\n');
    return { id: String(form.id ?? `form-${index}`), title, file: `${kind} · ${stage}`, category: 'Forms' as const, format: 'FORM', size: `${questions.length} questions`, language: 'English', tags: [kind, stage, planCode], url: publicAsset('/assessments'), text: summary, questions, planCode, day: Number(form.day) || 1 };
  }), [formRecords]);
  const filtered = useMemo(() => {
    const source = category === 'Forms' ? formResources : category === 'All' ? [...resources, ...formResources] : resourcesForCategory(category);
    return source.filter(resource => (category === 'Forms' || language === 'All Languages' || resource.language === language) && (!query.trim() || `${resource.title} ${resource.file} ${resource.language} ${resource.tags.join(' ')} ${resource.text ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())));
  }, [category, formResources, language, query]);
  const counts = useMemo(() => Object.fromEntries(categories.map(item => {
    const source = item === 'Forms' ? formResources : item === 'All' ? [...resources, ...formResources] : resourcesForCategory(item);
    return [item, source.filter(resource => item === 'Forms' || language === 'All Languages' || resource.language === language).length];
  })), [formResources, language]);
  const previewResource = useCallback(async (resource: Resource) => {
    setPreview(resource);
    setPreviewAnswers({});
    if (resource.format === 'FORM') setPreviewText(resource.text ?? '');
    else if (resource.format === 'DOCX' || resource.format === 'PPTX') setPreviewText(await officePreview(resource));
    else setPreviewText('');
  }, []);
  useEffect(() => {
    if (window.matchMedia('(max-width: 900px) and (min-width: 621px)').matches) { document.querySelector('.app')?.classList.add('is-collapsed'); setCollapsed(true); }
    const app = document.querySelector('.app');
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.collapse')) {
        window.setTimeout(() => {
          const isCollapsed = app?.classList.contains('is-collapsed') ?? false;
          setCollapsed(isCollapsed);
        }, 0);
      } else if (target.closest('#notifications')) setToast('You’re all caught up on dashboard notifications.');
      else if (target.closest('#profile-button')) setToast('Signed in as Project Sponsor.');
    };
    document.addEventListener('click', onClick);
    const onStorage = (event: StorageEvent) => { if (event.key === formStorageKey) setFormRecords(readLibraryForms()); };
    window.addEventListener('storage', onStorage);
    return () => { document.removeEventListener('click', onClick); window.removeEventListener('storage', onStorage); };
  }, []);
  const showDialog = Boolean(preview);
  return <div className="app content-app" data-sidebar-collapsed={collapsed}>
    <Sidebar activePage="Content Library" />
    <main className="main content-main"><Topbar title="Content Library" description="Browse and access learning resources in one place." />
      <section className="browser" aria-labelledby="browse-heading"><div className="browser-head"><div><h2 id="browse-heading">Browse resources</h2><p>Select a category or search by title, file name, or tag.</p></div>
        <div className="browser-tools"><div className="language-filter"><label htmlFor="content-language">Language</label><select id="content-language" value={language} onChange={event => setLanguage(event.target.value)}>{languages.map(item => <option key={item} value={item}>{item}</option>)}</select></div><div className="search"><label htmlFor="content-search">Search content</label><input id="content-search" type="search" placeholder="Search content" value={query} onChange={event => setQuery(event.target.value)} /></div></div>
      </div>
      <div className="tabs" role="tablist" aria-label="Content categories">{categories.map(item => <button key={item} className="tab" type="button" role="tab" aria-selected={category === item} onClick={() => { if (item === 'Forms') setFormRecords(readLibraryForms()); setCategory(item); }}>{item}<span className="tab-count">{counts[item]}</span></button>)}</div>
      <div className="results"><span role="status" aria-live="polite">{filtered.length} {category === 'Forms' ? (filtered.length === 1 ? 'form' : 'forms') : (filtered.length === 1 ? 'file' : 'files')}</span><span>{category === 'Forms' ? 'Preview a form or open form management' : 'Preview or download any file'}</span></div>
      <div className="cards">{filtered.length ? filtered.map(resource => <ResourceCard key={resource.id} resource={resource} onPreview={previewResource} />) : <div className="empty"><h3>{category === 'Forms' ? 'No forms found' : 'No files found'}</h3><p>{category === 'Forms' ? 'Forms created in Assessments & Feedback will appear here.' : 'Try another category or search term.'}</p></div>}</div></section>
      <Footer />
    </main>
    <Dialog open={showDialog} onClose={() => setPreview(null)} maxWidth={false} PaperProps={{ className: 'library-preview-paper' }}>
      {preview && <><div className="dialog-head"><h2>{preview.title}</h2><IconButton className="close" aria-label="Close preview" onClick={() => setPreview(null)}>×</IconButton></div><div className="dialog-content"><div className="preview-toolbar"><span>{preview.format} · {preview.size}</span>{preview.format !== 'FORM' && <a className="preview-download" href={preview.url} download={preview.file}>Download file</a>}</div>
        {preview.format === 'FORM' ? <div className="form-preview"><p className="form-preview-meta">{preview.planCode} · Day {preview.day} · {preview.questions?.length ?? 0} question(s)</p><p className="form-preview-note">Preview only. Answers entered here will not be submitted.</p>{preview.questions?.map((question, index) => { const questionId = String(question.id ?? index); const options = Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === 'string') : []; const prompt = typeof question.prompt === 'string' ? question.prompt : `Question ${index + 1}`; return <section className="form-preview-question" key={questionId}><h3>{index + 1}. {prompt}{question.required ? ' *' : ''}</h3>{question.selection === 'multiple' && options.length ? options.map((option, optionIndex) => { let selected: number[] = []; try { selected = JSON.parse(previewAnswers[questionId] ?? '[]'); } catch { /* Empty selection */ } return <label className="form-preview-option" key={optionIndex}><input type="checkbox" checked={selected.includes(optionIndex)} onChange={event => setPreviewAnswers(current => ({ ...current, [questionId]: JSON.stringify(event.target.checked ? [...selected, optionIndex] : selected.filter(item => item !== optionIndex)) }))} />{option}</label>; }) : options.length ? options.map((option, optionIndex) => <label className="form-preview-option" key={optionIndex}><input type="radio" name={`form-preview-${questionId}`} checked={previewAnswers[questionId] === String(optionIndex)} onChange={() => setPreviewAnswers(current => ({ ...current, [questionId]: String(optionIndex) }))} />{option}</label>) : <textarea value={previewAnswers[questionId] ?? ''} onChange={event => setPreviewAnswers(current => ({ ...current, [questionId]: event.target.value }))} placeholder="Type your response" rows={2} />}</section>; })}</div> : preview.format === 'MP4' ? <video className="preview-video" controls autoPlay src={preview.url} /> : preview.format === 'PDF' ? <iframe className="preview-media" style={{ height: '65vh' }} src={preview.url} title={`Preview: ${preview.title}`} /> : preview.format === 'PNG' || preview.format === 'JPG' ? <img className="preview-media" src={preview.url} alt={preview.title} /> : <pre className="preview-text">{previewText || 'Loading preview…'}</pre>}
      </div></>}
    </Dialog>
    <Snackbar open={Boolean(toast)} autoHideDuration={2800} onClose={() => setToast('')} message={toast} />
  </div>;
}
