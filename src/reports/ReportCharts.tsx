import { Box, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

export type ChartSeries = { label: string; color: string };
export type ChartRow = { label: string; values: number[] };
export type ReportView = 'table' | 'graph';
type ChartType = 'line' | 'cluster' | 'pie' | 'bar';

export function ReportViewToggle({ view, onChange }: { view: ReportView; onChange: (next: ReportView) => void }) {
  return <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, next: ReportView | null) => { if (next) onChange(next); }} aria-label="Choose table or graph representation" sx={{ bgcolor: '#fff', '& .MuiToggleButton-root': { px: 1.75, textTransform: 'none', fontWeight: 700, color: '#49657e', borderColor: '#dce6ef' }, '& .Mui-selected': { color: '#145b91 !important', bgcolor: '#eaf4fc !important' } }}>
    <ToggleButton value="graph" aria-label="Graphical representation">Graph view</ToggleButton>
    <ToggleButton value="table" aria-label="Table representation">Table view</ToggleButton>
  </ToggleButtonGroup>;
}

export function ReportBarChart({ title, description, series, rows, formatter = value => value.toLocaleString(), signed = false, chartType = 'line', showLegend = true }: { title: string; description: string; series: ChartSeries[]; rows: ChartRow[]; formatter?: (value: number) => string; signed?: boolean; chartType?: ChartType; showLegend?: boolean }) {
  const positivePieValues = rows[0]?.values.map(value => Math.max(0, value)) ?? [];
  const pieTotal = positivePieValues.reduce((sum, value) => sum + value, 0);
  const positivePieIndexes = positivePieValues.map((value, index) => value > 0 ? index : -1).filter(index => index >= 0);
  const rawMax = Math.max(0, ...rows.flatMap(row => row.values.map(value => signed ? Math.abs(value) : value)));
  const maxValue = rawMax === 0 ? 1 : rawMax * 1.12;
  const chartWidth = chartType === 'bar' ? 720 : Math.max(420, rows.length * 104 + 76);
  const chartHeight = chartType === 'bar' ? Math.max(220, rows.length * 34 + 46) : 250;
  const plotLeft = chartType === 'bar' ? 230 : 60;
  const plotRight = chartWidth - 18;
  const plotTop = 22;
  const plotBottom = chartType === 'bar' ? chartHeight - 22 : 168;
  const pointX = (index: number) => rows.length < 2 ? (plotLeft + plotRight) / 2 : plotLeft + index * (plotRight - plotLeft) / (rows.length - 1);
  const pointY = (value: number) => signed ? plotTop + (maxValue - value) / (2 * maxValue) * (plotBottom - plotTop) : plotBottom - Math.max(0, value) / maxValue * (plotBottom - plotTop);
  const piePaths = positivePieIndexes.map((index, order) => {
    const value = positivePieValues[index];
    const startAngle = -Math.PI / 2 + Math.PI * 2 * positivePieValues.slice(0, index).reduce((sum, item) => sum + item, 0) / (pieTotal || 1);
    const endAngle = startAngle + Math.PI * 2 * value / (pieTotal || 1);
    const start = [100 + 78 * Math.cos(startAngle), 100 + 78 * Math.sin(startAngle)];
    const end = [100 + 78 * Math.cos(endAngle), 100 + 78 * Math.sin(endAngle)];
    const path = positivePieIndexes.length === 1
      ? ''
      : `M 100 100 L ${start[0]} ${start[1]} A 78 78 0 ${endAngle - startAngle > Math.PI ? 1 : 0} 1 ${end[0]} ${end[1]} Z`;
    return { index, order, value, percentage: value / (pieTotal || 1) * 100, path };
  });
  return <Paper elevation={0} sx={{ p: 2, border: '1px solid #e3ebf3', borderRadius: 2, minWidth: 0 }} role="img" aria-label={`${title}. ${description}`}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={1} sx={{ mb: 1.5 }}><Box><Typography variant="subtitle1" fontWeight={750}>{title}</Typography><Typography variant="caption" color="text.secondary">{description}</Typography></Box>{showLegend && <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">{series.map(item => <Stack key={item.label} direction="row" spacing={.6} alignItems="center"><Box sx={{ width: 9, height: 9, borderRadius: .5, bgcolor: item.color }} /><Typography variant="caption" color="text.secondary">{item.label}</Typography></Stack>)}</Stack>}</Stack>
    {!rows.length || (chartType === 'pie' && pieTotal === 0) || (chartType !== 'pie' && rawMax === 0) ? <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>{rows.length ? 'No responses recorded yet.' : 'No data for the current filters.'}</Typography>
      : chartType === 'pie' ? <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" spacing={2}><svg viewBox="0 0 200 200" role="presentation" style={{ width: 210, maxWidth: '100%', overflow: 'visible', flexShrink: 0 }}>{positivePieIndexes.length === 1 ? <circle cx="100" cy="100" r="78" fill={series[positivePieIndexes[0]]?.color ?? '#8295a8'}><title>{`${series[positivePieIndexes[0]]?.label ?? 'Answer'}: ${formatter(positivePieValues[positivePieIndexes[0]])} (100%)`}</title></circle> : piePaths.map(slice => <path key={slice.index} d={slice.path} fill={series[slice.index]?.color ?? '#8295a8'} stroke="#fff" strokeWidth="2"><title>{`${series[slice.index]?.label ?? 'Answer'}: ${formatter(slice.value)} (${slice.percentage.toFixed(1)}%)`}</title></path>)}<circle cx="100" cy="100" r="48" fill="#fff" /><text x="100" y="96" textAnchor="middle" fontSize="12" fill="#587187">Total</text><text x="100" y="116" textAnchor="middle" fontSize="16" fontWeight="700" fill="#153f68">{formatter(pieTotal)}</text></svg>{showLegend && <Stack spacing={1}>{series.map((item, index) => <Stack key={item.label} direction="row" spacing={1} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} /><Typography variant="body2">{item.label}: <strong>{formatter(positivePieValues[index] ?? 0)}</strong>{pieTotal ? ` (${((positivePieValues[index] ?? 0) / pieTotal * 100).toFixed(1)}%)` : ''}</Typography></Stack>)}</Stack>}</Stack>
      : <Box sx={{ overflowX: 'auto', pb: 1 }}><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="presentation" style={{ display: 'block', width: '100%', minWidth: chartType === 'bar' ? 680 : 420, height: chartHeight }}>
        {chartType === 'bar' ? <>
          {[0, 1, 2, 3, 4].map(step => { const x = plotLeft + step / 4 * (plotRight - plotLeft); return <g key={step}><line x1={x} y1={plotTop} x2={x} y2={plotBottom} stroke="#e7edf3" strokeDasharray="3 4" /><text x={x} y={plotBottom + 14} textAnchor="middle" fontSize="10" fill="#587187">{formatter(rawMax * step / 4)}</text></g>; })}
          {rows.map((row, index) => { const groupHeight = (plotBottom - plotTop) / rows.length; const barHeight = Math.min(20, groupHeight / (series.length + 1)); const centerY = plotTop + groupHeight * (index + .5); return <g key={`${row.label}-${index}`}><text x={plotLeft - 10} y={centerY + 4} textAnchor="end" fontSize="11" fill="#45627a"><title>{row.label}</title>{row.label.length > 28 ? `${row.label.slice(0, 27)}…` : row.label}</text>{series.map((item, seriesIndex) => { const value = Math.max(0, row.values[seriesIndex] ?? 0); const width = value / maxValue * (plotRight - plotLeft); const y = centerY - (series.length * barHeight) / 2 + seriesIndex * barHeight; return <g key={item.label}><rect x={plotLeft} y={y} width={Math.max(0, width)} height={barHeight - 3} rx="3" fill={item.color}><title>{`${row.label} — ${item.label}: ${formatter(value)}`}</title></rect>{value > 0 && <text x={plotLeft + width + 5} y={y + barHeight - 5} fontSize="10" fill="#45627a">{formatter(value)}</text>}</g>; })}</g>; })}
        </> : <>
          {[0, 1, 2, 3, 4].map(step => { const value = signed ? maxValue - step / 4 * 2 * maxValue : maxValue - step / 4 * maxValue; const y = plotTop + step / 4 * (plotBottom - plotTop); return <g key={step}><line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke={signed && step === 2 ? '#93a5b5' : '#e7edf3'} strokeDasharray={signed && step === 2 ? undefined : '3 4'} /><text x={plotLeft - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#587187">{formatter(value)}</text></g>; })}
          {chartType === 'line' ? series.map((item, sIndex) => { const points = rows.map((row, index) => ({ x: pointX(index), y: pointY(row.values[sIndex] ?? 0), value: row.values[sIndex] ?? 0 })); return <g key={item.label}><polyline fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points.map(point => `${point.x},${point.y}`).join(' ')} />{points.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r="4" fill={item.color}><title>{`${rows[index].label}: ${formatter(point.value)}`}</title></circle></g>)}</g>; }) : rows.map((row, index) => { const groupWidth = (plotRight - plotLeft) / rows.length; const columnWidth = Math.min(30, groupWidth / (series.length + 1)); return <g key={`${row.label}-${index}`}>{series.map((item, sIndex) => { const value = Math.max(0, row.values[sIndex] ?? 0); const height = value / maxValue * (plotBottom - plotTop); const x = plotLeft + index * groupWidth + (groupWidth - columnWidth * series.length) / 2 + sIndex * columnWidth; return <g key={item.label}><rect x={x} y={plotBottom - height} width={Math.max(0, columnWidth - 4)} height={height} rx="3" fill={item.color}><title>{`${row.label} — ${item.label}: ${formatter(value)}`}</title></rect></g>; })}</g>; })}
          {rows.map((row, index) => { const x = chartType === 'line' ? pointX(index) : plotLeft + index * ((plotRight - plotLeft) / rows.length) + (plotRight - plotLeft) / rows.length / 2; return <text key={`${row.label}-${index}`} transform={`translate(${x},${plotBottom + 15}) rotate(-38)`} textAnchor="end" fontSize="10" fill="#587187"><title>{row.label}</title>{row.label.length > 26 ? `${row.label.slice(0, 25)}…` : row.label}</text>; })}
        </>}
      </svg></Box>}
  </Paper>;
}
