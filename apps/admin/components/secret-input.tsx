'use client';

import { Input, cn } from '@lumea/ui';
import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes } from 'react';

type SecretInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Password-style input with show/hide for admin API secrets (not hashed). */
export function SecretInput({ className, id, ...props }: SecretInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={inputId}
        type={visible ? 'text' : 'password'}
        className={cn('pe-10', className)}
        {...props}
      />
      <button
        type="button"
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide secret' : 'Show secret'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
