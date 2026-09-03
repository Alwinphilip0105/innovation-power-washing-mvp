import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { Logo } from "@/components/marketing/logo";
import { Alert } from "@/components/ui/alert";
import { devCredentials, getAuthContext, supabaseAuthConfigured } from "@/lib/auth";
import { bootstrap } from "@/lib/bootstrap";
import { isProduction } from "@/lib/env";

export const metadata: Metadata = {
  title: "Staff Login",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  bootstrap();

  const existing = await getAuthContext();
  if (existing) redirect("/dashboard");

  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  // In development, prefill the seeded credentials so the demo is one click.
  const usingSupabase = supabaseAuthConfigured();
  const demo = !usingSupabase && !isProduction ? devCredentials() : null;

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="flex justify-center">
            <Logo />
          </Link>

          <div className="mt-8 rounded-lg border border-line bg-surface p-6 shadow-card sm:p-8">
            <h1 className="font-display text-2xl font-extrabold text-ink-900">Staff sign in</h1>
            <p className="mt-1 text-sm text-body-muted">
              {usingSupabase
                ? "Use your Supabase account for this business."
                : "Development sign-in - the credentials below are pre-filled."}
            </p>

            <div className="mt-6">
              <LoginForm next={next} demo={demo} />
            </div>

            {demo ? (
              <Alert tone="info" className="mt-6" title="Demo account">
                <p className="font-mono text-xs">{demo.email}</p>
                <p className="font-mono text-xs">{demo.password}</p>
                <p className="mt-2">
                  Set SUPABASE_URL and SUPABASE_ANON_KEY to switch to real Supabase Auth.
                </p>
              </Alert>
            ) : null}
          </div>

          <p className="mt-6 text-center text-sm text-body-muted">
            <Link href="/" className="font-semibold text-brand-600 hover:underline">
              Back to the website
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
