// Adaptado de components/ui/button.tsx do StudioPro; tema visual SUN7CRM.
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Tooltip } from './tooltip';
const buttonVariants = cva('btn', {
  variants: {
    variant: {
      default: '',
      outline: 'btn-outline',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
      link: 'btn-link',
    },
    size: { default: '', sm: 'btn-sm', icon: 'btn-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  tooltip?: string;
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, tooltip, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const label = tooltip || (size === 'icon' ? props['aria-label'] || props.title : undefined);
    const control = (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        title={label ? undefined : props.title}
      />
    );
    return label ? <Tooltip label={label}>{control}</Tooltip> : control;
  },
);
Button.displayName = 'Button';
export { Button, buttonVariants };
