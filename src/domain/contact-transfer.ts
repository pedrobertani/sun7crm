export interface TransferContact {
  name: string;
  phone: string;
}
export interface ImportRow extends TransferContact {
  line: number;
  status: 'valid' | 'invalid' | 'duplicate';
  message: string;
}
const ddds = new Set(
  '11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(
    ' ',
  ),
);
/** Canonical Brazilian national number. Optional country code, never infer a DDD. */
export function normalizeContactPhone(value: string): string | null {
  if (!/^[\d\s()+.\-]+$/.test(value.trim())) return null;
  let digits = value.replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55'))
    digits = digits.slice(2);
  if (!ddds.has(digits.slice(0, 2))) return null;
  if (!/^\d{2}(?:[2-5]\d{7}|9\d{8})$/.test(digits)) return null;
  return digits;
}
export function formatContactPhone(value: string): string {
  const phone = normalizeContactPhone(value);
  if (!phone) return value;
  return `(${phone.slice(0, 2)}) ${phone.slice(2, -4)}-${phone.slice(-4)}`;
}
export function previewContacts(
  rows: { line: number; name: string; phone: string }[],
  existing: TransferContact[],
): ImportRow[] {
  const saved = new Set(existing.map((c) => normalizeContactPhone(c.phone)).filter(Boolean));
  const seen = new Set<string>();
  return rows.map((row) => {
    const name = row.name.trim(),
      phone = normalizeContactPhone(row.phone);
    const base = { ...row, name, phone: phone || row.phone };
    if (!name || name.length > 100)
      return { ...base, status: 'invalid', message: 'Informe um nome com até 100 caracteres.' };
    if (!phone)
      return {
        ...base,
        status: 'invalid',
        message: 'Informe telefone brasileiro completo com DDD válido.',
      };
    if (saved.has(phone))
      return {
        ...base,
        status: 'duplicate',
        message: 'Telefone já cadastrado. Não será substituído.',
      };
    if (seen.has(phone))
      return {
        ...base,
        status: 'duplicate',
        message: 'Telefone repetido neste Excel. Será importado apenas uma vez.',
      };
    seen.add(phone);
    return { ...base, status: 'valid', message: 'Pronto para importar' };
  });
}
