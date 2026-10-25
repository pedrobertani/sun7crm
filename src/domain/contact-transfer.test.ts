import { describe, expect, it } from 'vitest';
import { normalizeContactPhone, previewContacts, formatContactPhone } from './contact-transfer';
describe('Contatos por Excel', () => {
  it('normaliza máscaras, números e código do Brasil sem adivinhar DDD', () => {
    for (const phone of ['(14) 99673-2848', '14996732848', '+55 (14) 99673-2848', '5514996732848'])
      expect(normalizeContactPhone(phone)).toBe('14996732848');
    expect(normalizeContactPhone('(14) 3322-1234')).toBe('1433221234');
    expect(normalizeContactPhone('(55) 99999-1234')).toBe('55999991234');
    expect(formatContactPhone('5514996732848')).toBe('(14) 99673-2848');
    for (const phone of [
      '996732848',
      '00996732848',
      '20123456789',
      '1499673284',
      '+1 14996732848',
      'telefone14996732848',
      '',
    ])
      expect(normalizeContactPhone(phone)).toBeNull();
  });
  it('ignora duplicados do arquivo e dos cadastros sem substituir o nome', () => {
    const existing = [{ name: 'Original', phone: '+55 (14) 99673-2848' }];
    const result = previewContacts(
      [
        { line: 2, name: 'Outro nome', phone: '14996732848' },
        { line: 3, name: 'Novo', phone: '11988887777' },
        { line: 4, name: 'Novo repetido', phone: '+55 (11) 98888-7777' },
        { line: 5, name: '', phone: '11977776666' },
        { line: 6, name: 'Sem DDD', phone: '988887777' },
      ],
      existing,
    );
    expect(result.map((r) => r.status)).toEqual([
      'duplicate',
      'valid',
      'duplicate',
      'invalid',
      'invalid',
    ]);
    expect(existing[0].name).toBe('Original');
    expect(result.map((r) => r.line)).toEqual([2, 3, 4, 5, 6]);
  });
  it('não perde uma linha válida quando uma linha anterior tem erro', () => {
    expect(
      previewContacts(
        [
          { line: 2, name: '', phone: '14996732848' },
          { line: 3, name: 'Válido', phone: '14996732848' },
        ],
        [],
      ).map((r) => r.status),
    ).toEqual(['invalid', 'valid']);
  });
});
