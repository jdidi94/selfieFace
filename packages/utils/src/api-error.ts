import type { ApiErrorBody } from '@lumea/types';

export type ParsedApiError = {
  statusCode: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

function legacyMessage(raw: unknown): { message: string; fieldErrors?: Record<string, string[]> } {
  if (raw == null) {
    return { message: 'Request failed' };
  }
  if (typeof raw === 'string') {
    return { message: raw };
  }
  if (Array.isArray(raw)) {
    return {
      message: raw.filter(Boolean).join('; ') || 'Validation failed',
    };
  }
  if (typeof raw === 'object' && ('formErrors' in raw || 'fieldErrors' in raw)) {
    const flatten = raw as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };
    const formErrors = flatten.formErrors ?? [];
    const fieldParts: string[] = [];
    const fieldErrors: Record<string, string[]> = {};
    for (const [field, errors] of Object.entries(flatten.fieldErrors ?? {})) {
      if (!errors?.length) continue;
      fieldErrors[field] = errors;
      for (const e of errors) fieldParts.push(`${field}: ${e}`);
    }
    return {
      message: [...formErrors, ...fieldParts].join('; ') || 'Validation failed',
      fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
    };
  }
  return { message: 'Request failed' };
}

export function parseApiErrorBody(body: unknown, statusCode: number): ParsedApiError {
  const record = (body && typeof body === 'object' ? body : {}) as Partial<ApiErrorBody> &
    Record<string, unknown>;

  const status = record.statusCode ?? statusCode;

  if (typeof record.message === 'string') {
    return {
      statusCode: status,
      message: record.message,
      fieldErrors: record.fieldErrors,
    };
  }

  const legacy = legacyMessage(record.message);
  return {
    statusCode: status,
    message: legacy.message,
    fieldErrors:
      record.fieldErrors && Object.keys(record.fieldErrors).length
        ? record.fieldErrors
        : legacy.fieldErrors,
  };
}

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(parsed: ParsedApiError) {
    super(parsed.message);
    this.name = 'ApiRequestError';
    this.statusCode = parsed.statusCode;
    this.fieldErrors = parsed.fieldErrors;
  }
}

export function throwApiError(body: unknown, statusCode: number): never {
  throw new ApiRequestError(parseApiErrorBody(body, statusCode));
}
