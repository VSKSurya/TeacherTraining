import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatDate, parseDisplayDate } from '../dateFormat';
import { phaseNames } from '../data/reportData';
import { useDispatch, useSelector } from 'react-redux';
import { setPhase, type AppDispatch, type RootState } from '../store';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';

export type FilterOption = { label: string; value: string };
export type FilterSpec = { key: string; label: string; type: 'select' | 'search' | 'date'; placeholder?: string; options?: FilterOption[]; disabled?: boolean };
export type ReportFilters = Record<string, string>;
export function PhaseSelectionSummary({ selectedPhase, selectedFilters = {}, onPhaseChange, className = '' }: { selectedPhase: number | null; selectedFilters?: Record<string, string>; onPhaseChange?: (phase: number | null) => void; className?: string }) {
  const dispatch = useDispatch<AppDispatch>();
  const audience = useSelector((state: RootState) => state.dashboard.audience);
  const options = audience === 'Student' ? ['Cyber Safety and Digital Responsibility', 'Digital Creativity', 'AI Awareness'] : phaseNames;
  const activeFilters = Object.entries(selectedFilters).filter(([, value]) => Boolean(value));
  return <div className={`selected-filter-summary ${className}`.trim()}><strong>Phase</strong><select aria-label="Dashboard phase" value={selectedPhase ?? ''} onChange={event => { const phase = event.target.value ? Number(event.target.value) : null; dispatch(setPhase(phase)); onPhaseChange?.(phase); }}><option value="">All phases</option>{options.map((name, index) => <option value={index + 1} key={name}>{index + 1}: {name}</option>)}</select>{activeFilters.length > 0 && <><strong>Selected Filters:</strong>{activeFilters.map(([key, value]) => <span className="selected-filter-chip" key={key}>{key === 'phase' ? 'Phase filter' : key}: {value}</span>)}</>}</div>;
}
function FilterFieldIcon({ name }: { name: string }) {
  if (name === 'state') return <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>;
  if (name === 'district' || name === 'block') return <path d="M4 20V8l4-4 4 4v12m0-8h8v8M2 20h20M7 10h2m-2 4h2m-2 4h2m9-1h1" />;
  if (name === 'trainer') return <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1H3Zm13-9a3 3 0 1 0 0-6m1 9a5 5 0 0 1 4 5" /></>;
  if (name === 'phase' || name === 'start' || name === 'end') return <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m3 0h2m-7 3h2" /></>;
  if (name === 'status') return <><path d="M8 6h12M8 12h12M8 18h12" /><path d="m3 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2" /></>;
  return <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M8 2v4m8-4v4M4 9h16m-11 4h6m-6 4h4" /></>;
}
function DateFilterInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(() => formatDate(value));
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => setText(formatDate(value)), [value]);
  return <div className="date-filter-control"><input id={id} type="text" placeholder="dd-MMM-yyyy" autoComplete="off" value={text} onChange={event => {
    const next = event.target.value;
    setText(next);
    const normalized = parseDisplayDate(next);
    if (normalized) onChange(normalized);
    else if (!next) onChange('');
  }} /><button type="button" aria-label="Choose date" onClick={() => { const input = picker.current; if (!input) return; if (input.showPicker) input.showPicker(); else input.focus(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></svg></button><input ref={picker} className="native-date-picker" type="date" aria-label={`${id} calendar picker`} value={value} onChange={event => { const next = event.target.value; setText(formatDate(next)); onChange(next); }} /></div>;
}

export function ReportFilterPanel({ fields, values, onChange, onClear, title = 'Filters', dashboardStyle = false }: {
  fields: FilterSpec[]; values: ReportFilters; onChange: (key: string, value: string) => void; onClear: () => void; title?: string; dashboardStyle?: boolean;
}) {
  return <div className="dashboard-controls"><div className="filter-control"><section className={`filters ${dashboardStyle ? 'open participant-dashboard-filters' : 'report-filters'}`} aria-label="Report filters">{!dashboardStyle && <h2>{title}</h2>}<div className="filter-grid">
    {fields.map(field => <div className="filter" key={field.key}><label htmlFor={`filter-${field.key}`}>{dashboardStyle && <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><FilterFieldIcon name={field.key} /></svg>}{field.label}</label>{field.type === 'select'
      ? <select id={`filter-${field.key}`} value={values[field.key] ?? ''} disabled={field.disabled} onChange={event => onChange(field.key, event.target.value)}><option value="">{field.placeholder ?? `All ${field.label.toLowerCase()}`}</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : field.type === 'date' ? <DateFilterInput id={`filter-${field.key}`} value={values[field.key] ?? ''} onChange={value => onChange(field.key, value)} /> : <input id={`filter-${field.key}`} type="search" placeholder={field.placeholder} value={values[field.key] ?? ''} onChange={event => onChange(field.key, event.target.value)} />}</div>)}
  </div>{dashboardStyle ? <div className="filter-footer"><span className="filter-hint">Filters apply to report data</span><button className="clear-filters" type="button" onClick={onClear}>Clear filters</button></div> : <div className="filter-actions"><button type="button" onClick={onClear}>Clear all</button></div>}</section></div></div>;
}

export type TableColumn<T> = { key: keyof T | string; label: string; align?: 'left' | 'center' | 'right'; render?: (row: T, index: number) => ReactNode };
export type ReportPaginationState = { total: number; page: number; pageSize: number; onPageChange: (page: number) => void };
export function ReportTable<T extends object>({ columns, rows, rowKey, emptyMessage, tableClassName = '', pagination }: {
  columns: TableColumn<T>[]; rows: T[]; rowKey: (row: T, index: number) => string | number; emptyMessage: string; tableClassName?: string;
  pagination?: ReportPaginationState;
}) {
  const pageCount = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 0;
  const currentPage = pagination ? Math.min(pagination.page, pageCount) : 0;
  const showPagination = Boolean(pagination && pagination.total > pagination.pageSize);
  const start = pagination && showPagination ? (currentPage - 1) * pagination.pageSize + 1 : 0;
  const end = pagination && showPagination ? Math.min(currentPage * pagination.pageSize, pagination.total) : 0;
  return <><TableContainer className="table-wrap"><Table className={`report-table ${tableClassName}`} size="small" aria-label="Report results">
    <TableHead><TableRow>{columns.map(column => <TableCell key={String(column.key)} align={column.align}>{column.label}</TableCell>)}</TableRow></TableHead>
    <TableBody>{rows.length ? rows.map((row, index) => <TableRow key={rowKey(row, index)}>{columns.map(column => <TableCell key={String(column.key)} align={column.align}>{column.render ? column.render(row, index) : String((row as Record<string, unknown>)[String(column.key)] ?? '')}</TableCell>)}</TableRow>) : <TableRow className="empty-row"><TableCell colSpan={columns.length}>{emptyMessage}</TableCell></TableRow>}</TableBody>
  </Table></TableContainer>{showPagination && pagination && <div className="pagination"><span>Showing {start}-{end} of {pagination.total.toLocaleString()}</span><div><button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => pagination.onPageChange(currentPage - 1)}>Previous</button><span className="pagination-page" aria-live="polite">Page {currentPage} of {pageCount}</span><button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => pagination.onPageChange(currentPage + 1)}>Next</button></div></div>}</>;
}

export function ReportPagination({ total, page, pageSize, onPageChange }: ReportPaginationState) {
  const pageCount = Math.ceil(total / pageSize);
  if (total <= pageSize) return null;
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  return <div className="pagination"><span>Showing {start}-{end} of {total.toLocaleString()}</span><div><button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>Previous</button><span className="pagination-page" aria-live="polite">Page {currentPage} of {pageCount}</span><button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)}>Next</button></div></div>;
}

export function ReportPanel({ title, description, count, actions, children }: { title: string; description: string; count: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="report-panel">{(title || description || count || actions) && <div className="panel-heading">{(title || description) && <div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>}<div className="panel-heading-actions">{actions}{count && <span className="record-count" aria-live="polite">{count}</span>}</div></div>}{children}</section>;
}
