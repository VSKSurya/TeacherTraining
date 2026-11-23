import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, IconButton, Snackbar } from '@mui/material';
import { useSelector } from 'react-redux';
import { Sidebar, Topbar, Footer } from './components/DashboardParts';
import type { RootState } from './store';

type Category = 'Presentation' | 'Video' | 'Documents' | 'Forms';
type Resource = { id: string; title: string; file: string; sourceFile?: string; category: Category; format: string; size: string; language: string; tags: string[]; url: string; youtubeId?: string; channel?: string; views?: string; published?: string; text?: string; questions?: FormRow[]; planCode?: string; day?: number };
type FormRow = Record<string, unknown>;
type ContentLibraryApiItem = { id: string; displayName: string; fileName: string; assetPath: string; category: Category; format: string; sizeBytes: number; language: string; tags: string[] };
type VideoSection = { id: string; name: string; videos: Array<{ id: string; title: string; youtubeId: string; channel?: string; views?: string; published?: string; language?: string }> };
type YoutubeResource = Resource & { youtubeId: string };
const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
const categories = ['All', 'Presentation', 'Video', 'Documents', 'Forms'] as const;
const languages = ['All Languages', 'English', 'Hindi', 'Gujarati'];
const formStorageKey = 'teacher-training-assessment-form-master';
function readLibraryForms(): FormRow[] { try { const value: unknown = JSON.parse(localStorage.getItem(formStorageKey) ?? '[]'); return Array.isArray(value) ? value.filter(row => row && typeof row === 'object') as FormRow[] : []; } catch { return []; } }
const resourcesForCategory = (items: Resource[], category: string, extra: Resource[] = []) => [...items, ...extra].filter(resource => resource.category === category);
const languageFilteredVideos = (videos: VideoSection['videos'], language: string) => videos.filter(video => language === 'All Languages' || (video.language || 'English') === language);
const youtubeResource = (video: VideoSection['videos'][number]): YoutubeResource => ({ id: video.id, title: video.title, file: video.channel || 'YouTube', category: 'Video', format: 'YOUTUBE', size: '', language: video.language || 'English', tags: [], url: `https://www.youtube.com/watch?v=${video.youtubeId}`, youtubeId: video.youtubeId, channel: video.channel, views: video.views, published: video.published });
const categoryOf = (resource: Resource) => resource.format === 'FORM' ? 'form' : resource.format === 'PDF' ? 'pdf' : ['MP4', 'MOV', 'WEBM'].includes(resource.format) ? 'video' : ['PPT', 'PPTX', 'PPS', 'PPSX'].includes(resource.format) ? 'presentation' : ['PNG', 'JPG', 'WEBP'].includes(resource.format) ? 'image' : '';
const labelOf = (resource: Resource) => resource.youtubeId || ['MP4', 'MOV', 'WEBM'].includes(resource.format) ? 'Video' : resource.format === 'FORM' ? 'Form' : resource.format === 'PDF' ? 'PDF' : ['PPT', 'PPTX', 'PPS', 'PPSX'].includes(resource.format) ? 'Presentation' : ['PNG', 'JPG', 'WEBP'].includes(resource.format) ? 'Image' : 'Document';

async function officePreview() { return 'Download this file to open it in a compatible app.'; }
function ResourceCard({ resource, onPreview }: { resource: Resource; onPreview: (resource: Resource) => void }) {
  return <article className="card">
    <div className="card-body">{resource.youtubeId ? <div className="resource-meta-row youtube-resource-row"><div className="youtube-resource-thumb"><img src={`https://img.youtube.com/vi/${resource.youtubeId}/hqdefault.jpg`} alt="" loading="lazy"/><span className="youtube-duration">YouTube</span></div><div className="card-meta"><span>Video</span><span>{resource.channel || 'YouTube'}</span><span>{resource.views || resource.published || resource.language}</span></div></div> : <div className="resource-meta-row"><div className={`file-icon-box ${categoryOf(resource)}`} aria-label={`${resource.format} file`} role="img"><FileTypeIcon format={resource.format} /></div><div className="card-meta"><span>{labelOf(resource)}</span><span>{resource.size}</span><span>{resource.language}</span></div></div>}<h3>{resource.title}</h3><p className="filename">{resource.file}</p>
      <div className="tags resource-tag-actions" aria-label="Tags and resource actions">{resource.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}<span className="resource-action-group">{resource.category !== 'Presentation' && <button className="action tag-action" type="button" title="Preview" aria-label="Preview" onClick={() => onPreview(resource)}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.8"/></svg></button>}{resource.format !== 'FORM' && !resource.youtubeId && <a className="action download tag-action" title="Download" aria-label="Download" href={resource.url} download={resource.file}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></a>}</span></div>
    </div>
  </article>;
}

function YoutubeCarousel({ videos, onPreview }: { videos: YoutubeResource[]; onPreview: (resource: Resource) => void }) {
  const shelfRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: -1 | 1) => shelfRef.current?.scrollBy({ left: direction * Math.max(260, shelfRef.current.clientWidth * .75), behavior: 'smooth' });
  return <div className={`youtube-carousel${videos.length > 3 ? ' has-overflow' : ''}`}><button className="youtube-carousel-arrow previous" type="button" aria-label="Scroll videos left" onClick={() => scroll(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button><div className="youtube-shelf" ref={shelfRef} tabIndex={0} aria-label="YouTube videos">{videos.map(video => <button className="youtube-card" type="button" key={video.id} onClick={() => onPreview(video)}><span className="youtube-thumb"><img src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`} alt="" loading="lazy"/><span className="youtube-duration">YouTube</span></span><span className="youtube-card-copy"><strong>{video.title}</strong><span>{video.channel || 'YouTube'}{video.views ? ` · ${video.views}` : ''}{video.published ? ` · ${video.published}` : ''}</span></span></button>)}</div><button className="youtube-carousel-arrow next" type="button" aria-label="Scroll videos right" onClick={() => scroll(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button></div>;
}

function ResourceGrid({ resources, onPreview }: { resources: Resource[]; onPreview: (resource: Resource) => void }) {
  const shelfRef = useRef<HTMLDivElement>(null);
  const hasOverflow = resources.length > 3;
  const scroll = (direction: -1 | 1) => shelfRef.current?.scrollBy({ left: direction * Math.max(280, shelfRef.current.clientWidth * .75), behavior: 'smooth' });
  return <div className={`resource-card-carousel${hasOverflow ? ' has-overflow' : ''}`}>
    {hasOverflow && <button className="youtube-carousel-arrow previous" type="button" aria-label="Scroll resources left" onClick={() => scroll(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>}
    <div className={`cards resource-card-shelf${hasOverflow ? ' has-overflow' : ''}`} ref={shelfRef}>{resources.map(resource => <ResourceCard key={resource.id} resource={resource} onPreview={onPreview} />)}</div>
    {hasOverflow && <button className="youtube-carousel-arrow next" type="button" aria-label="Scroll resources right" onClick={() => scroll(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>}
  </div>;
}

function AllResourceSections({ resources, videoSections, language, query, onPreview }: { resources: Resource[]; videoSections: VideoSection[]; language: string; query: string; onPreview: (resource: Resource) => void }) {
  const presentations = resources.filter(resource => resource.category === 'Presentation');
  const videos = resources.filter(resource => resource.category === 'Video');
  const documents = resources.filter(resource => resource.category === 'Documents');
  const forms = resources.filter(resource => resource.category === 'Forms');
  const visibleVideos = videoSections.map(section => ({ ...section, videos: languageFilteredVideos(section.videos, language).filter(video => !query.trim() || `${video.title} ${video.channel ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) })).filter(section => section.videos.length);
  const section = (title: string, items: Resource[]) => <section className="library-resource-section" aria-label={title}><div className="library-resource-heading"><h2>{title}</h2><span>{items.length} {items.length === 1 ? 'item' : 'items'}</span></div>{items.length ? <ResourceGrid resources={items} onPreview={onPreview} /> : <p className="library-section-empty">No {title.toLowerCase()} found.</p>}</section>;
  return <div className="all-resource-sections">
    {section('Presentation', presentations)}
    <section className="library-resource-section" aria-label="Videos"><div className="library-resource-heading"><h2>Videos</h2><span>{videos.length + visibleVideos.reduce((total, unit) => total + unit.videos.length, 0)} videos</span></div>{visibleVideos.map(unit => <div className="all-video-unit" key={unit.id}><div className="all-video-unit-heading"><h3>{unit.name}</h3><span>{unit.videos.length} {unit.videos.length === 1 ? 'video' : 'videos'}</span></div><YoutubeCarousel videos={unit.videos.map(youtubeResource)} onPreview={onPreview} /></div>)}{videos.length > 0 && <><div className="all-video-unit-heading"><h3>Uploaded videos</h3><span>{videos.length} {videos.length === 1 ? 'video' : 'videos'}</span></div><ResourceGrid resources={videos} onPreview={onPreview} /></>}{!visibleVideos.length && !videos.length && <p className="library-section-empty">No videos found.</p>}</section>
    {section('Documents', documents)}
    {section('Forms', forms)}
  </div>;
}

function FileTypeIcon({ format }: { format: string }) {
  if (format === 'MP4') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="6" width="25" height="20" rx="3" /><path d="m13 11 8 5-8 5z" /></svg>;
  if (format === 'PDF') return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 3.5h10l7 7v18H8a2 2 0 0 1-2-2v-21a2 2 0 0 1 2-2Z" /><path d="M18 4v7h7M10 23h12M10 19h12" /></svg>;
  if (format === 'PPTX') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="4.5" width="25" height="18" rx="2" /><path d="M16 23v5m-6 0h12M16 8v8h8M16 16l-6-4" /></svg>;
  if (format === 'PNG' || format === 'JPG') return <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="4.5" width="25" height="23" rx="3" /><circle cx="11" cy="12" r="2.5" /><path d="m5 24 8-8 5 5 4-4 6 6" /></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 3.5h10l7 7v18H8a2 2 0 0 1-2-2v-21a2 2 0 0 1 2-2Z" /><path d="M18 4v7h7M11 17h11M11 21h11M11 25h7" /></svg>;
}

export default function ContentLibrary() {
  const audience = useSelector((state: RootState) => state.dashboard.audience);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [videoSections, setVideoSections] = useState<VideoSection[]>([{ id: 'unit-1', name: 'Unit 1', videos: [] }, { id: 'unit-2', name: 'Unit 2', videos: [] }]);
  const [category, setCategory] = useState<string>('All');
  const [selectedVideoUnit, setSelectedVideoUnit] = useState<string | null>(null);
  const [language, setLanguage] = useState('English');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<Resource | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState('');
  const [formRecords, setFormRecords] = useState<FormRow[]>(readLibraryForms);
  const [approvedResources, setApprovedResources] = useState<Resource[]>(() => {
    try {
      const records = JSON.parse(localStorage.getItem('teacher-training-trainer-evidence') ?? '[]') as Array<{ id: string; status: string; trainer: string; batch: string; date: string; reviewedBy?: string; files: Array<{ name: string; type: string; size: number; data: string }> }>;
      return records.filter(record => record.status === 'Approved').flatMap(record => record.files.filter(file => file.name.toLowerCase() !== 'to.docx').map((file, index) => {
        const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
        const category: Category = ['MP4', 'MOV', 'WEBM'].includes(ext) ? 'Video' : ['PPT', 'PPTX', 'PPS', 'PPSX'].includes(ext) ? 'Presentation' : 'Documents';
        const format = ext === 'JPEG' ? 'JPG' : ext;
        return { id: `evidence-${record.id}-${index}`, title: file.name.replace(/\.[^.]+$/, ''), file: file.name, category, format, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, language: 'English', tags: ['Trainer evidence', record.trainer, record.batch, record.date], url: file.data };
      }));
    } catch { return []; }
  });
  useEffect(() => {
    let active = true;
    fetch(publicAsset('/api/content-library.json'))
      .then(response => { if (!response.ok) throw new Error(`Content Library API returned ${response.status}`); return response.json() as Promise<{ items?: ContentLibraryApiItem[]; videoSections?: VideoSection[] }>; })
      .then(payload => {
        if (!active) return;
        setResources((payload.items ?? []).map(item => ({ id: item.id, title: item.displayName, file: item.fileName, category: item.category, format: item.format, size: `${Math.max(1, Math.round(item.sizeBytes / 1024))} KB`, language: item.language, tags: item.tags, url: publicAsset(item.assetPath) })));
        setVideoSections(payload.videoSections?.length ? payload.videoSections : [{ id: 'unit-1', name: 'Unit 1', videos: [] }, { id: 'unit-2', name: 'Unit 2', videos: [] }]);
      })
      .catch(() => { if (active) setToast('Learning materials could not be loaded.'); })
      .finally(() => { if (active) setResourcesLoading(false); });
    return () => { active = false; };
  }, []);
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
  const youtubeResources = useMemo<YoutubeResource[]>(() => videoSections.flatMap(section => section.videos.map(youtubeResource)), [videoSections]);
  const filtered = useMemo(() => {
    if (audience === 'Student') return [];
    const source = category === 'Forms' ? formResources : category === 'All' ? [...resources, ...approvedResources, ...formResources, ...youtubeResources] : resourcesForCategory(resources, category, approvedResources);
    return source.filter(resource => (category === 'Forms' || language === 'All Languages' || resource.language === language) && (!query.trim() || `${resource.title} ${resource.file} ${resource.language} ${resource.tags.join(' ')} ${resource.text ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())));
  }, [approvedResources, audience, category, formResources, language, query, resources, youtubeResources]);
  const counts = useMemo(() => Object.fromEntries(categories.map(item => {
    if (audience === 'Student') return [item, 0];
    const source = item === 'Forms' ? formResources : item === 'All' ? [...resources, ...approvedResources, ...formResources] : resourcesForCategory(resources, item, approvedResources);
    const youtubeCount = item === 'Video' || item === 'All' ? videoSections.reduce((total, section) => total + languageFilteredVideos(section.videos, language).length, 0) : 0;
    return [item, source.filter(resource => item === 'Forms' || language === 'All Languages' || resource.language === language).length + youtubeCount];
  })), [approvedResources, audience, formResources, language, resources, videoSections]);
  const visibleYoutubeCount = videoSections.reduce((total, section) => total + languageFilteredVideos(section.videos, language).filter(video => !query.trim() || `${video.title} ${video.channel ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())).length, 0);
  const visibleCount = category === 'Video'
    ? visibleYoutubeCount + filtered.length
    : category === 'All' ? filtered.length
    : filtered.length;
  const previewResource = useCallback(async (resource: Resource) => {
    setPreview(resource);
    setPreviewAnswers({});
    if (resource.format === 'FORM') setPreviewText(resource.text ?? '');
    else if (resource.format === 'DOCX' || resource.format === 'PPTX') setPreviewText(await officePreview());
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
    const onStorage = (event: StorageEvent) => {
      if (event.key === formStorageKey) setFormRecords(readLibraryForms());
      if (event.key === 'teacher-training-trainer-evidence') {
        try {
          const records = JSON.parse(event.newValue ?? '[]') as Array<{ id: string; status: string; trainer: string; batch: string; date: string; files: Array<{ name: string; type: string; size: number; data: string }> }>;
          setApprovedResources(records.filter(record => record.status === 'Approved').flatMap(record => record.files.filter(file => file.name.toLowerCase() !== 'to.docx').map((file, index) => {
            const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
            const category: Category = ['MP4', 'MOV', 'WEBM'].includes(ext) ? 'Video' : ['PPT', 'PPTX', 'PPS', 'PPSX'].includes(ext) ? 'Presentation' : 'Documents';
            return { id: `evidence-${record.id}-${index}`, title: file.name.replace(/\.[^.]+$/, ''), file: file.name, category, format: ext === 'JPEG' ? 'JPG' : ext, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, language: 'English', tags: ['Trainer evidence', record.trainer, record.batch, record.date], url: file.data };
          })));
        } catch { setApprovedResources([]); }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { document.removeEventListener('click', onClick); window.removeEventListener('storage', onStorage); };
  }, []);
  const showDialog = Boolean(preview);
  const allYoutubeVideos = youtubeResources;
  const selectedVideoSection = videoSections.find(section => section.id === selectedVideoUnit) ?? null;
  const selectedUnitVideos = selectedVideoSection ? languageFilteredVideos(selectedVideoSection.videos, language).filter(video => !query.trim() || `${video.title} ${video.channel ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const selectedUnitResources = selectedUnitVideos.map(youtubeResource);
  const displayedResources = category === 'All' ? filtered.filter(resource => !('youtubeId' in resource && resource.youtubeId)) : filtered;
  return <div className="app content-app" data-sidebar-collapsed={collapsed}>
    <Sidebar activePage="Content Library" />
    <main className="main content-main"><Topbar title="Content Library" description="Browse and access learning resources in one place." />
      <section className="browser" aria-labelledby="browse-heading"><div className="browser-head"><div><h2 id="browse-heading">Browse resources</h2><p>Select a category or search by title, file name, or tag.</p></div>
        <div className="browser-tools"><div className="language-filter"><label htmlFor="content-language">Language</label><select id="content-language" value={language} onChange={event => setLanguage(event.target.value)}>{languages.map(item => <option key={item} value={item}>{item}</option>)}</select></div><div className="search"><label htmlFor="content-search">Search content</label><input id="content-search" type="search" placeholder="Search content" value={query} onChange={event => setQuery(event.target.value)} /></div></div>
      </div>
      <div className="tabs" role="tablist" aria-label="Content categories">{categories.map(item => <button key={item} className="tab" type="button" role="tab" aria-selected={category === item} onClick={() => { if (item === 'Forms') setFormRecords(readLibraryForms()); if (item !== category) setSelectedVideoUnit(null); setCategory(item); }}>{item}<span className="tab-count">{counts[item]}</span></button>)}</div>
      <div className="results"><span role="status" aria-live="polite">{visibleCount} {category === 'Forms' ? (visibleCount === 1 ? 'form' : 'forms') : (visibleCount === 1 ? 'file' : 'files')}</span></div>
      {category === "All" && audience !== "Student" && <AllResourceSections resources={displayedResources} videoSections={videoSections} language={language} query={query} onPreview={previewResource} />}
      {category === 'Video' && audience !== 'Student' && <section className="video-sections video-unit-browser">{selectedVideoUnit === null ? <div className="video-unit-folders" aria-label="Video units">{videoSections.map(section => <button className="video-unit-folder" type="button" key={section.id} onClick={() => setSelectedVideoUnit(section.id)}><span className="video-folder-icon" aria-hidden="true"><svg viewBox="0 0 48 48" width="48" height="48"><path d="M4 12a4 4 0 0 1 4-4h11l5 5h16a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V12Z" fill="#f7c54f"/><path d="M4 18a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V18Z" fill="#ffd05b"/><path d="m21 21 11 6-11 6V21Z" fill="#176fba"/></svg></span><strong>{section.name}</strong><span className="video-unit-count">{languageFilteredVideos(section.videos, language).length} {languageFilteredVideos(section.videos, language).length === 1 ? 'video' : 'videos'}</span></button>)}</div> : <div className="video-unit-detail"><button className="video-back-button" type="button" onClick={() => setSelectedVideoUnit(null)}><span aria-hidden="true">←</span> Back</button><div className="video-unit-detail-heading"><h2>{selectedVideoSection?.name}</h2><span>{languageFilteredVideos(selectedVideoSection?.videos ?? [], language).length} {languageFilteredVideos(selectedVideoSection?.videos ?? [], language).length === 1 ? 'video' : 'videos'}</span></div>{selectedUnitVideos.length ? <YoutubeCarousel videos={selectedUnitResources} onPreview={previewResource} /> : <p className="video-unit-empty">No videos added to this unit yet.</p>}</div>}</section>}
      {(category !== 'All' || audience === 'Student') && <div className="cards">{displayedResources.length ? displayedResources.map(resource => <ResourceCard key={resource.id} resource={resource} onPreview={previewResource} />) : (category === 'Video' || category === 'All') && audience !== 'Student' && visibleYoutubeCount > 0 ? null : category === 'Video' && audience !== 'Student' ? null : audience === 'Student' ? <div className="empty student-empty"><svg className="empty-illustration" viewBox="0 0 220 150" role="img" aria-label="No learning materials found"><rect x="43" y="22" width="116" height="94" rx="12" fill="#eaf4fd"/><path d="M70 53h63M70 68h49M70 83h38" stroke="#8bb9dc" strokeWidth="7" strokeLinecap="round"/><circle cx="157" cy="99" r="30" fill="#fff" stroke="#176fba" strokeWidth="6"/><path d="m178 121 19 19" stroke="#176fba" strokeWidth="8" strokeLinecap="round"/><path d="M96 126h-37" stroke="#b5cfe3" strokeWidth="7" strokeLinecap="round"/></svg><h3>No data found</h3><p>There are no learning materials available for Students yet.</p></div> : <div className="empty"><h3>{resourcesLoading ? 'Loading materials…' : category === 'Forms' ? 'No forms found' : 'No files found'}</h3><p>{category === 'Forms' ? 'Forms created in Assessments & Feedback will appear here.' : resourcesLoading ? 'Fetching the sample Content Library API response.' : 'Try another category or search term.'}</p></div>}</div>}</section>
      <Footer />
    </main>
    <Dialog open={showDialog} onClose={() => setPreview(null)} maxWidth={false} PaperProps={{ className: 'library-preview-paper' }}>
      {preview && <><div className="dialog-head"><h2>{preview.title}</h2><IconButton className="close" aria-label="Close preview" onClick={() => setPreview(null)}>×</IconButton></div><div className="dialog-content">{!preview.youtubeId && <div className="preview-toolbar"><span>{preview.format} · {preview.size}</span>{preview.format !== 'FORM' && <a className="preview-download" href={preview.url} download={preview.file}>Download file</a>}</div>}
        {preview.format === 'FORM' ? <div className="form-preview"><p className="form-preview-meta">{preview.planCode} · Day {preview.day} · {preview.questions?.length ?? 0} question(s)</p><p className="form-preview-note">Preview only. Answers entered here will not be submitted.</p>{preview.questions?.map((question, index) => { const questionId = String(question.id ?? index); const options = Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === 'string') : []; const prompt = typeof question.prompt === 'string' ? question.prompt : `Question ${index + 1}`; return <section className="form-preview-question" key={questionId}><h3>{index + 1}. {prompt}{question.required ? ' *' : ''}</h3>{question.selection === 'multiple' && options.length ? options.map((option, optionIndex) => { let selected: number[] = []; try { selected = JSON.parse(previewAnswers[questionId] ?? '[]'); } catch { /* Empty selection */ } return <label className="form-preview-option" key={optionIndex}><input type="checkbox" checked={selected.includes(optionIndex)} onChange={event => setPreviewAnswers(current => ({ ...current, [questionId]: JSON.stringify(event.target.checked ? [...selected, optionIndex] : selected.filter(item => item !== optionIndex)) }))} />{option}</label>; }) : options.length ? options.map((option, optionIndex) => <label className="form-preview-option" key={optionIndex}><input type="radio" name={`form-preview-${questionId}`} checked={previewAnswers[questionId] === String(optionIndex)} onChange={() => setPreviewAnswers(current => ({ ...current, [questionId]: String(optionIndex) }))} />{option}</label>) : <textarea value={previewAnswers[questionId] ?? ''} onChange={event => setPreviewAnswers(current => ({ ...current, [questionId]: event.target.value }))} placeholder="Type your response" rows={2} />}</section>; })}</div> : preview.youtubeId ? <iframe className="preview-media youtube-preview" src={`https://www.youtube-nocookie.com/embed/${preview.youtubeId}?autoplay=1`} title={`YouTube video: ${preview.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : preview.category === 'Video' ? <video className="preview-video" controls autoPlay src={preview.url} /> : preview.format === 'PDF' ? <iframe className="preview-media" style={{ height: '65vh' }} src={preview.url} title={`Preview: ${preview.title}`} /> : ['PNG', 'JPG', 'WEBP'].includes(preview.format) ? <img className="preview-media" src={preview.url} alt={preview.title} /> : <pre className="preview-text">{previewText || 'Loading preview…'}</pre>}
      </div></>}
    </Dialog>
    <Snackbar open={Boolean(toast)} autoHideDuration={2800} onClose={() => setToast('')} message={toast} />
  </div>;
}
