import { createClient } from "@supabase/supabase-js";
import { allowedEmails } from "@/lib/allowlist";
import type { Database } from "@/lib/database.types";

export function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export interface Account {
  email: string;
  name: string;
}

/**
 * The two people, as the sign-in page offers them. Names come from the profile
 * where there is one; whoever has not signed in yet is known by their address
 * until the first time they do.
 */
export async function accounts(): Promise<Account[]> {
  const admin = adminClient();

  const [{ data: users }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin.from("profiles").select("id, display_name"),
  ]);

  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));

  return allowedEmails().map((email) => {
    const user = users?.users.find((candidate) => candidate.email === email);
    const name = (user && nameById.get(user.id)) || email.split("@")[0];
    return { email, name };
  });
}
