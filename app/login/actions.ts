"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/allowlist";
import { adminClient } from "@/lib/accounts";

/** Case, spacing and a stray full stop should never be the thing that keeps her out. */
function normalise(answer: string): string {
  return answer.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const WRONG = { error: "That's not it." };

export async function signIn(_prev: { error: string } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const answer = String(formData.get("answer") ?? "");

  // Two people and a sentence they both know: slow guessing down rather than lock it.
  await new Promise((resolve) => setTimeout(resolve, 700));

  if (!isAllowed(email)) return WRONG;

  const admin = adminClient();
  const { data: expected } = await admin.from("sign_in").select("answer").maybeSingle();
  if (!expected || normalise(answer) !== normalise(expected.answer)) return WRONG;

  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link.properties) return WRONG;

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) return WRONG;

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
