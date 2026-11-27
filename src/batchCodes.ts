export const BATCH_STORAGE_KEY = 'teacher-training-batch-plan-uses';
const PROJECT_STORAGE_KEY = 'teacher-training-projects';
const BATCH_CODE_PATTERN = /^[A-Z0-9]{2}\d{7}$/;
const STATE_CODES: Record<string, string> = {
  'Andhra Pradesh': '28', 'Arunachal Pradesh': '12', Assam: '18', Chhattisgarh: '22', Gujarat: '24',
  Haryana: '06', Jharkhand: '20', Karnataka: '29', Manipur: '14', Rajasthan: '08', Sikkim: '11',
  Telangana: '36', 'Uttar Pradesh': '09',
};

export type BatchIdentity = {
  id?: unknown;
  batchCode?: unknown;
  uniqueId?: unknown;
  legacyBatchCodes?: unknown;
  projectId?: unknown;
};

const value = (input: unknown) => String(input ?? '').trim();

export function batchIdentifiers(batch: BatchIdentity): string[] {
  const legacy = Array.isArray(batch.legacyBatchCodes) ? batch.legacyBatchCodes.map(value) : [];
  return [...new Set([value(batch.id), value(batch.batchCode), value(batch.uniqueId), ...legacy].filter(Boolean))];
}

export function batchCodeForReference(reference: unknown, batches: BatchIdentity[]): string {
  const ref = value(reference).toLowerCase();
  if (!ref) return '';
  const matches = batches.filter(batch => batchIdentifiers(batch).some(item => item.toLowerCase() === ref));
  return matches.length === 1 ? value(matches[0].batchCode) : value(reference);
}

export function batchMatchesReference(batch: BatchIdentity, reference: unknown): boolean {
  const ref = value(reference).toLowerCase();
  return Boolean(ref && batchIdentifiers(batch).some(item => item.toLowerCase() === ref));
}

export function batchMatchesRecord(batch: BatchIdentity, record: Record<string, unknown>): boolean {
  return [record.batchId, record.batchCode, record.batchUniqueId].some(reference => batchMatchesReference(batch, reference));
}

export function batchCodeForRecord(record: Record<string, unknown>, batches: BatchIdentity[]): string {
  const references = [record.batchId, record.batchCode, record.batchUniqueId].map(value).filter(Boolean);
  let matches = batches.filter(batch => batchIdentifiers(batch).some(ref => references.some(item => item.toLowerCase() === ref.toLowerCase())));
  const idMatch = matches.find(batch => value(record.batchId) && value(batch.id) === value(record.batchId));
  if (idMatch) return value(idMatch.batchCode);
  if (value(record.projectId)) matches = matches.filter(batch => value(batch.projectId) === value(record.projectId));
  return matches.length === 1 ? value(matches[0].batchCode) : value(record.batchCode || record.batchId || record.batchUniqueId);
}

function projectPrefix(projectCode: unknown): string {
  return value(projectCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2).padEnd(2, '0');
}

export function batchStateCode(state: unknown, schoolUdiseVenue?: unknown): string {
  const udisePrefix = value(schoolUdiseVenue).match(/^(\d{2})/);
  return udisePrefix?.[1] ?? STATE_CODES[value(state)] ?? '00';
}

export function createBatchCode(projectCode: unknown, stateCode: unknown, reserved: Iterable<string> = []): string {
  const prefix = `${projectPrefix(projectCode)}${/^\d{2}$/.test(value(stateCode)) ? value(stateCode) : '00'}`;
  const used = new Set([...reserved].map(item => value(item).toUpperCase()).filter(Boolean));
  const pattern = new RegExp(`^${prefix}(\\d{5})$`);
  let sequence = 0;
  for (const code of used) { const match = code.match(pattern); if (match) sequence = Math.max(sequence, Number(match[1])); }
  while (sequence < 99999) {
    sequence++;
    const code = `${prefix}${String(sequence).padStart(5, '0')}`;
    if (!used.has(code)) return code;
  }
  throw new Error(`Could not generate a unique Batch ID for ${prefix}.`);
}

function readArray(key: string): Record<string, unknown>[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : [];
  } catch {
    return [];
  }
}

/**
 * Standardizes visible Batch Codes once while leaving historical rows and all
 * immutable IDs untouched. Prior codes remain as aliases on their batch.
 */
export function standardizeStoredBatchCodes(): void {
  if (typeof window === 'undefined') return;
  const batches = readArray(BATCH_STORAGE_KEY) as (Record<string, unknown> & BatchIdentity)[];
  const projects = readArray(PROJECT_STORAGE_KEY);
  if (!batches.length) return;

  const projectCodes = new Map(projects.map(project => [value(project.id), project.code]));
  const reserved = new Set(batches.flatMap(batch => batchIdentifiers(batch).map(item => item.toUpperCase())));
  const claimed = new Set<string>();
  let changed = false;
  const standardized = batches.map(batch => {
    const currentCode = value(batch.batchCode);
    let code = currentCode.toUpperCase();
    if (!BATCH_CODE_PATTERN.test(code.toUpperCase()) || claimed.has(code.toUpperCase())) {
      const projectCode = projectCodes.get(value(batch.projectId));
      code = createBatchCode(projectCode, batchStateCode(batch.state, batch.schoolUdiseVenue), [...reserved, ...claimed]);
      changed = true;
    }
    claimed.add(code.toUpperCase());
    const priorAliases = Array.isArray(batch.legacyBatchCodes) ? batch.legacyBatchCodes.map(value).filter(Boolean) : [];
    const aliases = [...new Set([...priorAliases, currentCode, value(batch.uniqueId)].filter(item => item && item.toUpperCase() !== code.toUpperCase()))];
    if (JSON.stringify(aliases) !== JSON.stringify(priorAliases)) changed = true;
    if (value(batch.batchCode) !== code) changed = true;
    return { ...batch, batchCode: code, ...(aliases.length ? { legacyBatchCodes: aliases } : {}) };
  });

  if (changed) localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(standardized));

}
