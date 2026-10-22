// Reaproveitado do StudioPro (components/masked-inputs.tsx), sem o campo de horário.
import { forwardRef, type FocusEvent, type InputHTMLAttributes } from 'react';
type MaskedInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode'
> & { value: string; onValueChange: (value: string) => void };
export const formatCurrencyInput = (value: string) => {
  if (!value) return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
export const CurrencyInput = forwardRef<HTMLInputElement, MaskedInputProps>(function CurrencyInput(
  { value, onValueChange, onFocus, placeholder = '0,00', ...props },
  ref,
) {
  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
    onFocus?.(event);
  };
  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={formatCurrencyInput(value)}
      placeholder={placeholder}
      onFocus={handleFocus}
      onClick={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, '');
        onValueChange(digits ? (Number(digits) / 100).toFixed(2) : '');
      }}
    />
  );
});
