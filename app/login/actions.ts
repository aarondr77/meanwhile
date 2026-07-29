"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/allowlist";

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
