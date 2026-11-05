import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-opacity active:opacity-75 disabled:opacity-50 disabled:pointer-events-none px-4 py-2 rounded-btn text-sm min-h-[44px] whitespace-nowrap shrink-0",
          variant === 'primary' && 'bg-foreground text-background hover:opacity-90',
          variant === 'secondary' && 'bg-background text-foreground border-2 border-foreground hover:bg-surface',
          variant === 'danger' && 'bg-destructive text-white hover:opacity-90',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
