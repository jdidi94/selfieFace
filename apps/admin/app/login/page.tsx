'use client';

import { FormErrorBanner, FieldError } from '@/components/form-errors';
import { AdminBrandMark } from '@/components/admin-brand-mark';
import { useAuth } from '@/lib/auth-context';
import { submitErrorState, validateWithSchema } from '@/lib/validate-form';
import { loginSchema, type LoginInput } from '@lumea/validation';
import { Button, Input, Label } from '@lumea/ui';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export default function AdminLoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const input = {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    };
    const validated = validateWithSchema<LoginInput>(loginSchema, input);
    if (!validated.ok) {
      setError(validated.message);
      setFieldErrors(validated.fieldErrors);
      return;
    }
    setPending(true);
    try {
      await login(validated.data.email, validated.data.password);
      router.push('/');
    } catch (err) {
      const state = submitErrorState(err);
      setError(state.message);
      setFieldErrors(state.fieldErrors);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 shadow-sm">
        <AdminBrandMark />
        <p className="mt-3 text-xs tracking-[0.18em] text-muted-foreground uppercase">Admin</p>
        <h1 className="font-display mt-2 text-3xl text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Operations dashboard for admin users.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="username" />
            <FieldError fieldErrors={fieldErrors} field="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" />
            <FieldError fieldErrors={fieldErrors} field="password" />
          </div>
          <FormErrorBanner message={error} />
          <Button
            type="submit"
            className="w-full bg-[#381F43] text-[#F7F4EF] shadow-sm hover:bg-[#4A2B56] focus-visible:outline-[#381F43]"
            disabled={pending}
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
