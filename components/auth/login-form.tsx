'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { loginSchema, type LoginValues } from '@/components/auth/auth-schemas';
import { AuthDivider, FormAlert } from '@/components/auth/form-alert';
import { GuestButton } from '@/components/auth/guest-button';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { FormField, fieldErrorId } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth-store';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      toast.success('Welcome back!');
      router.replace(next);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not sign in');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-text text-2xl font-bold">Welcome back</h1>
        <p className="text-text-dim mt-1 text-sm">Sign in to your AgriCtec account.</p>
      </div>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {formError && <FormAlert icon={AlertCircle}>{formError}</FormAlert>}

        <FormField label="Email" htmlFor="login-email" error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            error={Boolean(errors.email)}
            aria-describedby={errors.email ? fieldErrorId('login-email') : undefined}
            {...register('email')}
          />
        </FormField>

        <FormField label="Password" htmlFor="login-password" error={errors.password?.message}>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            placeholder="At least 8 characters"
            error={Boolean(errors.password)}
            aria-describedby={errors.password ? fieldErrorId('login-password') : undefined}
            {...register('password')}
          />
        </FormField>

        <Button type="submit" icon={LogIn} loading={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <AuthDivider />
      <GuestButton next={next} />

      <p className="text-text-dim text-center text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-ink-green font-semibold hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
