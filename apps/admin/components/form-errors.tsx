'use client';

type Props = {
  message?: string | null;
  fieldErrors?: Record<string, string>;
  field: string;
};

export function FormErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

/** Inline error for a specific Zod path key (e.g. `name`, `translations`). */
export function FieldError({ fieldErrors, field }: Props) {
  const text = fieldErrors?.[field];
  if (!text) return null;
  return <p className="text-xs text-destructive">{text}</p>;
}
