import { fieldPathToLabel } from '@lumea/utils';

export type ZodFlatten = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

export type NormalizedApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

function isZodFlatten(value: unknown): value is ZodFlatten {
  if (!value || typeof value !== 'object') return false;
  return 'formErrors' in value || 'fieldErrors' in value;
}

function humanizeFieldErrors(
  raw: Record<string, string[] | undefined>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [field, errors] of Object.entries(raw)) {
    if (!errors?.length) continue;
    const label = fieldPathToLabel(field);
    out[label] = errors;
  }
  return out;
}

export function normalizeApiErrorPayload(
  rawMessage: string | string[] | Record<string, unknown> | undefined,
): NormalizedApiError {
  if (rawMessage == null) {
    return { message: 'Request failed' };
  }

  if (typeof rawMessage === 'string') {
    return { message: rawMessage };
  }

  if (Array.isArray(rawMessage)) {
    const message = rawMessage.filter(Boolean).join('; ') || 'Validation failed';
    return { message };
  }

  if (isZodFlatten(rawMessage)) {
    const formErrors = rawMessage.formErrors ?? [];
    const fieldErrors = humanizeFieldErrors(rawMessage.fieldErrors ?? {});
    const fieldParts = Object.entries(fieldErrors).flatMap(([label, msgs]) =>
      msgs.map((m) => `${label}: ${m}`),
    );
    const parts = [...formErrors, ...fieldParts];
    const message = parts.join('; ') || 'Validation failed';
    return {
      message,
      fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
    };
  }

  return { message: 'Request failed' };
}
