"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/allowlist";
import { devLoginEnabled } from "@/lib/devLogin";
import { adminClient } from "@/lib/devAccounts";

export async function requestMagicLink(_prev: { sent: boolean }, formData: FormData) {
  const email = String(formData.get("email") ?? "");

  if (isAllowed(email)) {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || (await headers()).get("origin") || "";
    const supabase = await createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
  }

  // Same response either way — an unknown address learns nothing.
  return { sent: true };
}

export async function devSignIn(formData: FormData) {
  if (!devLoginEnabled()) return;

  const email = String(formData.get("email") ?? "");
  if (!isAllowed(email)) return;

  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties) return;

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) return;

  redirect("/");
}
