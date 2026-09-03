"use server";

import { redirect } from "next/navigation";

import { signIn, signOut } from "@/lib/auth";
import { bootstrap } from "@/lib/bootstrap";
import { rateLimit } from "@/lib/http/rate-limit";
import { loginSchema } from "@/lib/validation/schemas";
import { headers } from "next/headers";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  bootstrap();

  // Sign-in attempts are rate limited per client to blunt credential stuffing.
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`login:${ip}`, 10, 10 * 60_000);
  if (!limit.allowed) {
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter your email address and password." };
  }

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error };

  const next = String(formData.get("next") ?? "/dashboard");
  // Only ever redirect within this app.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}
