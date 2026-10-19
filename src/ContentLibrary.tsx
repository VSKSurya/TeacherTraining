import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, IconButton, Snackbar } from '@mui/material';
import { Sidebar, Topbar, Footer } from './components/DashboardParts';

type Category = 'Presentation' | 'Videos' | 'Images' | "Manuals & PDF's" | 'Others';
type Resource = { id: string; title: string; file: string; category: Category; format: string; size: string; tags: string[]; url: string; text?: string };
type ContentSample = { filename: string; base64: string };
declare global { interface Window { CONTENT_SAMPLES?: ContentSample[] } }
const workflowText = `{
  "workflow": "Educator onboarding",
  "steps": [
    { "step": 1, "name": "Register educator", "owner": "Project team" },
    { "step": 2, "name": "Assign training batch", "owner": "Coordinator" },
    { "step": 3, "name": "Complete learning modules", "owner": "Educator" },
    { "step": 4, "name": "Record attendance and completion", "owner": "Trainer" },
    { "step": 5, "name": "Review outcomes", "owner": "Project sponsor" }
  ]
}`;
const workflowUrl = URL.createObjectURL(new Blob([workflowText], { type: 'application/json' }));
const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
const resources: Resource[] = [
  { id: 'video', title: 'Digital classroom training', file: 'sample-training-video.mp4', category: 'Videos', format: 'MP4', size: '20 KB', tags: ['Training', 'Digital classroom', 'Video'], url: publicAsset('/content-library-assets/sample-training-video.mp4') },
  { id: 'manual', title: 'Teacher training manual', file: 'sample-training-manual.pdf', category: "Manuals & PDF's", format: 'PDF', size: '2 KB', tags: ['Manual', 'Reference', 'Training'], url: publicAsset('/content-library-assets/sample-training-manual.pdf') },
  { id: 'presentation', title: 'Teacher training presentation', file: 'sample-training.pptx', category: 'Presentation', format: 'PPTX', size: '28 KB', tags: ['Presentation', 'Training', 'Classroom'], url: publicAsset('/content-library-assets/sample-training.pptx') },
  { id: 'guide', title: 'Teacher training guide', file: 'sample-training-guide.docx', category: 'Others', format: 'DOCX', size: '36 KB', tags: ['Document', 'Guide', 'Training'], url: publicAsset('/content-library-assets/sample-training-guide.docx') },
  { id: 'workflow', title: 'Educator onboarding workflow', file: 'educator-onboarding-workflow.json', category: 'Others', format: 'WORKFLOW', size: '2 KB', tags: ['Workflow', 'Onboarding', 'Process'], url: workflowUrl, text: workflowText },
  { id: 'image-class', title: 'Classroom reflection image', file: 'sample-png.png', category: 'Images', format: 'PNG', size: '22 KB', tags: ['Image', 'Classroom', 'Reflection'], url: publicAsset('/content-library-assets/sample-png.png') },
  { id: 'image-session', title: 'Training session photograph', file: 'sample-jpg.jpg', category: 'Images', format: 'JPG', size: '26 KB', tags: ['Image', 'Training', 'Session'], url: publicAsset('/content-library-assets/sample-jpg.jpg') },
];
const categories = ['All', 'Presentation', 'Videos', 'Images', "Manuals & PDF's", 'Others'] as const;
const categoryOf = (resource: Resource) => resource.category === "Manuals & PDF's" ? 'pdf' : resource.category === 'Videos' ? 'video' : resource.category === 'Presentation' ? 'presentation' : resource.category === 'Images' ? 'image' : resource.format === 'WORKFLOW' ? 'workflow' : '';
const labelOf = (resource: Resource) => resource.category === "Manuals & PDF's" ? 'Manual & PDF' : resource.category === 'Presentation' ? 'Presentation' : resource.category === 'Videos' ? 'Video' : resource.category === 'Images' ? 'Image' : resource.format === 'WORKFLOW' ? 'Workflow' : 'Document';

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
    const sample = samples.find(item => item.filename === resource.file);
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
    <div className="card-body"><div className={`file-icon-box ${categoryOf(resource)}`} aria-label={`${resource.format} file`} role="img"><FileTypeIcon format={resource.format} /></div><div className="card-meta"><span>{labelOf(resource)}</span><span>{resource.size}</span></div><h3>{resource.title}</h3><p className="filename">{resource.file}</p>
      <div className="tags" aria-label="Tags">{resource.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><div className="scope">Schoolnet learning resource</div>
      <div className="actions"><button className="action" type="button" onClick={() => onPreview(resource)}>Preview</button><a className="action download" href={resource.url} download={resource.file}>Download</a></div>
    </div>
  </article>;
}

function FileTypeIcon({ format }: { format: string }) {
  if (format === 'MP4') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="6" width="25" height="20" rx="3" /><path d="m13 11 8 5-8 5z" /></svg>;
  if (format === 'PDF') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 3.5h10l7 7v18H8a2 2 0 0 1-2-2v-21a2 2 0 0 1 2-2Z" /><path d="M18 4v7h7M10 23h12M10 19h12" /></svg>;
  if (format === 'PPTX') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="4.5" width="25" height="18" rx="2" /><path d="M16 23v5m-6 0h12M16 8v8h8M16 16l-6-4" /></svg>;
  if (format === 'WORKFLOW') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="8" height="7" rx="2" /><rect x="20" y="21" width="8" height="7" rx="2" /><rect x="20" y="4" width="8" height="7" rx="2" /><path d="M12 7.5h8M24 11v5a5 5 0 0 1-5 5h-3m0 0 3-3m-3 3 3 3" /></svg>;
  if (format === 'PNG' || format === 'JPG') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="4.5" width="25" height="23" rx="3" /><circle cx="11" cy="12" r="2.5" /><path d="m5 24 8-8 5 5 4-4 6 6" /></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 3.5h10l7 7v18H8a2 2 0 0 1-2-2v-21a2 2 0 0 1 2-2Z" /><path d="M18 4v7h7M11 17h11M11 21h11M11 25h7" /></svg>;
}

export default function ContentLibrary() {
  const [category, setCategory] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<Resource | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState('');
  const filtered = useMemo(() => resources.filter(resource => (category === 'All' || resource.category === category) && (!query.trim() || `${resource.title} ${resource.file} ${resource.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))), [category, query]);
  const counts = useMemo(() => Object.fromEntries(categories.map(item => [item, resources.filter(resource => item === 'All' || resource.category === item).length])), []);
  const previewResource = useCallback(async (resource: Resource) => {
    setPreview(resource);
    if (resource.format === 'WORKFLOW') setPreviewText(resource.text ?? '');
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
    return () => document.removeEventListener('click', onClick);
  }, []);
  const showDialog = Boolean(preview);
  return <div className="app content-app" data-sidebar-collapsed={collapsed}>
    <Sidebar activePage="Content Library" />
    <main className="main content-main"><Topbar title="Content Library" description="Browse and access learning resources in one place." />
      <section className="browser" aria-labelledby="browse-heading"><div className="browser-head"><div><h2 id="browse-heading">Browse resources</h2><p>Select a category or search by title, file name, or tag.</p></div>
        <div className="search"><label htmlFor="content-search">Search content</label><input id="content-search" type="search" placeholder="Search content" value={query} onChange={event => setQuery(event.target.value)} /></div>
      </div>
      <div className="tabs" role="tablist" aria-label="Content categories">{categories.map(item => <button key={item} className="tab" type="button" role="tab" aria-selected={category === item} onClick={() => setCategory(item)}>{item}<span className="tab-count">{counts[item]}</span></button>)}</div>
      <div className="results"><span role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'file' : 'files'}</span><span>Preview or download any file</span></div>
      <div className="cards">{filtered.length ? filtered.map(resource => <ResourceCard key={resource.id} resource={resource} onPreview={previewResource} />) : <div className="empty"><h3>No files found</h3><p>Try another category or search term.</p></div>}</div></section>
      <Footer />
    </main>
    <Dialog open={showDialog} onClose={() => setPreview(null)} maxWidth={false} PaperProps={{ className: 'library-preview-paper' }}>
      {preview && <><div className="dialog-head"><h2>{preview.title}</h2><IconButton className="close" aria-label="Close preview" onClick={() => setPreview(null)}>×</IconButton></div><div className="dialog-content"><div className="preview-toolbar"><span>{preview.format} · {preview.size}</span><a className="preview-download" href={preview.url} download={preview.file}>Download file</a></div>
        {preview.format === 'MP4' ? <video className="preview-video" controls autoPlay src={preview.url} /> : preview.format === 'PDF' ? <iframe className="preview-media" style={{ height: '65vh' }} src={preview.url} title={`Preview: ${preview.title}`} /> : preview.format === 'PNG' || preview.format === 'JPG' ? <img className="preview-media" src={preview.url} alt={preview.title} /> : <pre className="preview-text">{previewText || 'Loading preview…'}</pre>}
      </div></>}
    </Dialog>
    <Snackbar open={Boolean(toast)} autoHideDuration={2800} onClose={() => setToast('')} message={toast} />
  </div>;
}
