import { describe, expect, it, vi } from 'vitest';
import { Workbook } from 'exceljs';
import { contactsWorkbook, downloadPreparedContacts, readContactsExcel } from './excel';
async function file(rows: unknown[][], name = 'contatos.xlsx') {
  const book = new Workbook();
  book.addWorksheet('Contatos').addRows(rows);
  const bytes = await book.xlsx.writeBuffer();
  return new File([new Uint8Array(bytes)], name);
}
describe('Leitura e exportação XLSX', () => {
  it('inicia download direto pelo link, usando o nome correto e removendo o elemento temporário', () => {
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const anchor = { href: '', download: '', style: { display: '' }, click, remove };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild },
    });
    try {
      downloadPreparedContacts({
        url: 'blob:test-modelo',
        filename: 'sun7crm-modelo-contatos.xlsx',
      });
      expect(anchor.href).toBe('blob:test-modelo');
      expect(anchor.download).toBe('sun7crm-modelo-contatos.xlsx');
      expect(anchor.style.display).toBe('none');
      expect(appendChild).toHaveBeenCalledWith(anchor);
      expect(click).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('exporta texto, preserva nomes e permite reimportação', async () => {
    const bytes = await contactsWorkbook([{ name: '=Não é fórmula', phone: '14996732848' }]);
    const rows = await readContactsExcel(new File([new Uint8Array(bytes)], 'contatos.xlsx'));
    expect(rows).toEqual([{ line: 2, name: '=Não é fórmula', phone: '(14) 99673-2848' }]);
  });
  it('aceita colunas invertidas, telefone numérico e linhas vazias', async () => {
    expect(
      await readContactsExcel(
        await file([['Contato', 'Nome'], [14996732848, 'Teste'], [], ['(11) 98888-7777', 'Outro']]),
      ),
    ).toEqual([
      { line: 2, name: 'Teste', phone: '14996732848' },
      { line: 4, name: 'Outro', phone: '(11) 98888-7777' },
    ]);
  });
  it('rejeita títulos ausentes, repetidos, arquivo inválido e extensão antiga', async () => {
    await expect(
      readContactsExcel(
        await file([
          ['Nome', 'Telefone'],
          ['Teste', '14996732848'],
        ]),
      ),
    ).rejects.toThrow('títulos');
    await expect(readContactsExcel(await file([['Nome', 'Contato', 'Nome']]))).rejects.toThrow(
      'repetida',
    );
    await expect(readContactsExcel(new File(['invalid'], 'contatos.xlsx'))).rejects.toThrow(
      'abrir',
    );
    await expect(readContactsExcel(await file([], 'contatos.xls'))).rejects.toThrow('.xlsx');
  });
  it('não executa fórmulas nem importa seu resultado em cache', async () => {
    const rows = await readContactsExcel(
      await file([
        ['Nome', 'Contato'],
        ['Teste', { formula: '1+1', result: 14996732848 }],
      ]),
    );
    expect(rows[0].name).toBe('');
    expect(rows[0].phone).toContain('inválida');
  });
  it('limita tamanho e quantidade de linhas', async () => {
    await expect(
      readContactsExcel(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.xlsx')),
    ).rejects.toThrow('2 MB');
    await expect(
      readContactsExcel(
        await file([
          ['Nome', 'Contato'],
          ...Array.from({ length: 1001 }, () => ['Teste', '14996732848']),
        ]),
      ),
    ).rejects.toThrow('1.000'.replace('.', ''));
  });
});
