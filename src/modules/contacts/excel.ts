import type { CellValue } from 'exceljs';
import { formatContactPhone, type TransferContact } from '../../domain/contact-transfer';
export const MAX_IMPORT_ROWS = 1000;
function cellText(value: CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  // Formulas, links, errors and dates are never evaluated or used as contacts.
  throw Error('Use apenas texto ou números nas colunas Nome e Contato; remova fórmulas e links.');
}
export async function readContactsExcel(file: File) {
  if (!/\.xlsx$/i.test(file.name)) throw Error('Selecione um arquivo Excel .xlsx.');
  if (file.size > 2 * 1024 * 1024) throw Error('O arquivo deve ter até 2 MB.');
  const { Workbook } = await import('exceljs');
  const book = new Workbook();
  try {
    await book.xlsx.load(await file.arrayBuffer());
  } catch {
    throw Error('Não foi possível abrir o Excel. Salve como .xlsx e tente novamente.');
  }
  const sheet = book.worksheets[0];
  if (!sheet) throw Error('O Excel está vazio.');
  if (sheet.rowCount > MAX_IMPORT_ROWS + 1)
    throw Error(`Importe até ${MAX_IMPORT_ROWS} linhas por arquivo.`);
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const label = cellText(cell.value).trim().toLocaleLowerCase('pt-BR');
    if (label === 'nome' || label === 'contato') {
      if (headers.has(label)) throw Error(`A coluna ${label} está repetida.`);
      headers.set(label, col);
    }
  });
  if (!headers.has('nome') || !headers.has('contato'))
    throw Error('A primeira linha deve conter os títulos Nome e Contato.');
  const rows: { line: number; name: string; phone: string }[] = [];
  for (let line = 2; line <= sheet.rowCount; line++) {
    const row = sheet.getRow(line);
    let name: string, phone: string;
    try {
      name = cellText(row.getCell(headers.get('nome')!).value);
      phone = cellText(row.getCell(headers.get('contato')!).value);
    } catch {
      rows.push({ line, name: '', phone: 'Célula inválida: remova fórmulas ou links' });
      continue;
    }
    if (name.trim() || phone.trim()) rows.push({ line, name, phone });
  }
  if (!rows.length) throw Error('Não há contatos preenchidos neste arquivo.');
  return rows;
}
export async function contactsWorkbook(contacts: TransferContact[]) {
  const { Workbook } = await import('exceljs');
  const book = new Workbook();
  const sheet = book.addWorksheet('Contatos');
  sheet.columns = [
    { header: 'Nome', key: 'name', width: 36 },
    { header: 'Contato', key: 'phone', width: 24 },
  ];
  contacts.forEach((c) => sheet.addRow({ name: c.name, phone: formatContactPhone(c.phone) }));
  sheet.getColumn(2).numFmt = '@';
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return book.xlsx.writeBuffer();
}
export async function prepareContactsDownload(
  contacts: TransferContact[],
  filename = 'sun7crm-contatos.xlsx',
) {
  const buffer = await contactsWorkbook(contacts);
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return { url: URL.createObjectURL(blob), filename };
}
