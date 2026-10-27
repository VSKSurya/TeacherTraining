import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatDate, parseDisplayDate } from '../dateFormat';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';

export type FilterOption = { label: string; value: string };
export type FilterSpec = { key: string; label: string; type: 'select' | 'search' | 'date'; placeholder?: string; options?: FilterOption[] };
export type ReportFilters = Record<string, string>;
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

export function ReportFilterPanel({ fields, values, onChange, onClear, onApply }: {
  fields: FilterSpec[]; values: ReportFilters; onChange: (key: string, value: string) => void; onClear: () => void; onApply: () => void;
}) {
  return <div className="dashboard-controls"><div className="filter-control"><section className="filters report-filters" aria-label="Report filters"><h2>Filters</h2><div className="filter-grid">
    {fields.map(field => <div className="filter" key={field.key}><label htmlFor={`filter-${field.key}`}>{field.label}</label>{field.type === 'select'
      ? <select id={`filter-${field.key}`} value={values[field.key] ?? ''} onChange={event => onChange(field.key, event.target.value)}><option value="">{field.placeholder ?? `All ${field.label.toLowerCase()}`}</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : field.type === 'date' ? <DateFilterInput id={`filter-${field.key}`} value={values[field.key] ?? ''} onChange={value => onChange(field.key, value)} /> : <input id={`filter-${field.key}`} type="search" placeholder={field.placeholder} value={values[field.key] ?? ''} onChange={event => onChange(field.key, event.target.value)} />}</div>)}
  </div><div className="filter-actions"><button type="button" onClick={onClear}>Clear all</button><button className="apply" type="button" onClick={onApply}>Apply filters</button></div></section></div></div>;
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

export function ReportPanel({ title, description, count, children }: { title: string; description: string; count: string; children: ReactNode }) {
  return <section className="report-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div><span className="record-count" aria-live="polite">{count}</span></div>{children}</section>;
}
