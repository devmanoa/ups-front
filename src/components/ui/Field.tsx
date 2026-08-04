import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from './cn';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
}

/** Champ texte avec libellé, aligné sur la classe .input-field de la charte. */
export function Field({ label, required, className, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-[--k-muted]">
        {label}
        {required && <span className="text-[--k-danger]"> *</span>}
      </span>
      <input className={cn('input-field', className)} {...props} />
    </label>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
}

export function SelectField({ label, children, className, ...props }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-[--k-muted]">{label}</span>
      <select className={cn('input-field', className)} {...props}>
        {children}
      </select>
    </label>
  );
}
