const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_INDEX = new Map(MONTHS.map((month, index) => [month.toLowerCase(), index]));

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  let year: number, month: number, day: number;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    year = value.getFullYear(); month = value.getMonth(); day = value.getDate();
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) { year = Number(match[1]); month = Number(match[2]) - 1; day = Number(match[3]); }
    else {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return value;
      year = parsed.getFullYear(); month = parsed.getMonth(); day = parsed.getDate();
    }
  }
  if (month < 0 || month > 11 || day < 1 || day > 31) return '';
  return `${String(day).padStart(2, '0')}-${MONTHS[month]}-${year}`;
}

export function parseDisplayDate(value: string): string | null {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]), month = MONTH_INDEX.get(match[2].toLowerCase()), year = Number(match[3]);
  if (month === undefined) return null;
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${formatDate(date)} ${time}`;
}
