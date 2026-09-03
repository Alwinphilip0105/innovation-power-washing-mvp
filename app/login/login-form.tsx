"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { loginAction, type LoginState } from "@/app/login/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="secondary" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Signing in...
        </>
      ) : (
        "Sign in"
      )}
    </Button>
  );
}

export function LoginForm({ next, demo }: { next: string; demo: { email: string; password: string } | null }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}

      <Field label="Email" htmlFor="login-email" required>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={demo?.email}
          required
        />
      </Field>

      <Field label="Password" htmlFor="login-password" required>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue={demo?.password}
          required
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
