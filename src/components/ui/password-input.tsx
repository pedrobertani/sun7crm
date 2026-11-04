import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './input';
import { cn } from '../../lib/utils';

/** Permite visualizar a senha sem alterar o valor, a validação ou o autocomplete. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  function PasswordInput({ className, disabled, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <span className="password-control">
        <Input
          {...props}
          ref={ref}
          disabled={disabled}
          type={visible ? 'text' : 'password'}
          className={cn('password-control-input', className)}
        />
        <button
          type="button"
          className="password-control-toggle"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          title={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </span>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
