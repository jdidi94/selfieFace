import { ApiRequestError } from '@lumea/utils';
import { fieldPathToLabel } from '@lumea/utils';
import type { ZodTypeAny } from 'zod';

export type ClientValidationFailure = {
  ok: false;
  message: string;
  fieldErrors: Record<string, string>;
};

export type ClientValidationSuccess<T> = {
  ok: true;
  data: T;
};

export function validateWithSchema<T = unknown>(
  schema: ZodTypeAny,
  data: unknown,
): ClientValidationSuccess<T> | ClientValidationFailure {
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    return { ok: true, data: parsed.data as T };
  }
  const flat = parsed.error.flatten();
  const fieldErrors: Record<string, string> = {};
  for (const [path, messages] of Object.entries(flat.fieldErrors)) {
    const msgs = messages as string[] | undefined;
    if (!msgs?.length) continue;
    fieldErrors[path] = msgs.join(', ');
  }
  const formParts = (flat.formErrors ?? []).filter(Boolean);
  const fieldParts = Object.entries(fieldErrors).map(
    ([path, msg]) => `${fieldPathToLabel(path)}: ${msg}`,
  );
  const message = [...formParts, ...fieldParts].join('; ') || 'Please fix the highlighted fields';
  return { ok: false, message, fieldErrors };
}

export function submitErrorState(err: unknown): {
  message: string;
  fieldErrors: Record<string, string>;
} {
  if (err instanceof ApiRequestError) {
    const fieldErrors: Record<string, string> = {};
    if (err.fieldErrors) {
      for (const [label, msgs] of Object.entries(err.fieldErrors)) {
        fieldErrors[label] = msgs.join(', ');
      }
    }
    return { message: err.message, fieldErrors };
  }
  return {
    message: err instanceof Error ? err.message : 'Something went wrong',
    fieldErrors: {},
  };
}
