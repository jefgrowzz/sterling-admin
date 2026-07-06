"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { supabaseAdmin } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/app/dashboard/lib/dal";

export type LoginState = { error: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("account_role")
    .eq("id", data.user.id)
    .single();

  if (!profile || !(STAFF_ROLES as readonly string[]).includes(profile.account_role)) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have admin dashboard access." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
