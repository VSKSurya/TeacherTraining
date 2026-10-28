export const BATCH_STORAGE_KEY = 'teacher-training-batch-plan-uses';
const BATCH_CODE_PATTERN = /^TTB-\d{4}-[A-F0-9]{20}$/;

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

function yearFor(batch: BatchIdentity & { createdAt?: unknown; trainingStartDate?: unknown }): string {
  const created = value(batch.createdAt).slice(0, 4);
  const scheduled = value(batch.trainingStartDate).slice(0, 4);
  const year = /^\d{4}$/.test(created) ? created : /^\d{4}$/.test(scheduled) ? scheduled : String(new Date().getFullYear());
  return year;
}

export function createBatchCode(year = String(new Date().getFullYear()), reserved: Iterable<string> = []): string {
  const used = new Set([...reserved].map(item => value(item).toUpperCase()).filter(Boolean));
  for (let attempt = 0; attempt < 100; attempt++) {
    const random = crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase();
    const code = `TTB-${year}-${random}`;
    if (!used.has(code)) return code;
  }
  throw new Error('Could not generate a unique Batch Code. Try again.');
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
  const batches = readArray(BATCH_STORAGE_KEY) as (Record<string, unknown> & BatchIdentity & { createdAt?: unknown; trainingStartDate?: unknown })[];
  if (!batches.length) return;

  const reserved = new Set(batches.flatMap(batch => batchIdentifiers(batch).map(item => item.toUpperCase())));
  const claimed = new Set<string>();
  let changed = false;
  const standardized = batches.map(batch => {
    const currentCode = value(batch.batchCode);
    let code = currentCode.toUpperCase();
    if (!BATCH_CODE_PATTERN.test(code.toUpperCase()) || claimed.has(code.toUpperCase())) {
      code = createBatchCode(yearFor(batch), [...reserved, ...claimed]);
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
