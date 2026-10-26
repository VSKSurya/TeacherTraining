export type ExcelRow = { rowNumber: number; values: string[] };

export async function readExcelFirstSheet(file: File): Promise<{ headers: string[]; rows: ExcelRow[] }> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const workbookText = await zip.file('xl/workbook.xml')?.async('string');
  if (!workbookText) throw new Error('This is not a readable Excel workbook. Download the template and try again.');
  const relsText = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  const workbook = new DOMParser().parseFromString(workbookText, 'application/xml');
  const sheet = workbook.querySelector('sheet');
  const relId = sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? sheet?.getAttribute('r:id');
  const rels = relsText ? new DOMParser().parseFromString(relsText, 'application/xml') : null;
  const target = Array.from(rels?.getElementsByTagName('Relationship') ?? []).find(item => item.getAttribute('Id') === relId)?.getAttribute('Target') ?? 'worksheets/sheet1.xml';
  const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  const xml = await zip.file(path)?.async('string');
  if (!xml) throw new Error('The workbook does not contain a readable first worksheet.');
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared = sharedXml ? Array.from(new DOMParser().parseFromString(sharedXml, 'application/xml').getElementsByTagName('si')).map(item => item.textContent ?? '') : [];
  const matrix: ExcelRow[] = Array.from(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('row')).map((row, index) => {
    const values: string[] = [];
    for (const cell of Array.from(row.getElementsByTagName('c'))) {
      const column = (cell.getAttribute('r') ?? '').match(/^[A-Z]+/)?.[0] ?? 'A';
      let columnIndex = 0; for (const letter of column) columnIndex = columnIndex * 26 + letter.charCodeAt(0) - 64;
      const type = cell.getAttribute('t'); let value = cell.getElementsByTagName('v')[0]?.textContent ?? '';
      if (type === 's') value = shared[Number(value)] ?? '';
      else if (type === 'inlineStr') value = cell.getElementsByTagName('t')[0]?.textContent ?? '';
      values[columnIndex - 1] = value;
    }
    return { rowNumber: Number(row.getAttribute('r')) || index + 1, values };
  });
  const headers = (matrix.shift()?.values ?? []).map(value => String(value ?? '').trim());
  return { headers, rows: matrix.filter(row => row.values.some(value => String(value ?? '').trim())), };
}

export async function createExcelTemplate(sheetName: string, headers: string[]) {
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  const column = (index: number) => { let n = index + 1, label = ''; while (n) { const rem = (n - 1) % 26; label = String.fromCharCode(65 + rem) + label; n = Math.floor((n - 1) / 26); } return label; };
  const cells = headers.map((header, index) => `<c r="${column(index)}1" t="inlineStr"><is><t>${escape(header)}</t></is></c>`).join('');
  const JSZip = (await import('jszip')).default; const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cells}</row></sheetData></worksheet>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
