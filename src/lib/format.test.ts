import { describe, it, expect } from 'vitest';
import { shiftDate, currency } from './format';
import { formatCurrencyInput } from '../components/currency-input';
describe('datas e valores', () => {
  it('calcula intervalos passando por mês e ano', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('usa centavos no domínio e reais no campo monetário', () => {
    expect(currency(19990)).toContain('199,90');
    expect(formatCurrencyInput('1234.56')).toBe('1.234,56');
    expect(formatCurrencyInput('')).toBe('');
  });
});
