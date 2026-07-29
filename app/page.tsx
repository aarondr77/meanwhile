import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Journal } from "@/components/Journal";
import type { Profile } from "@/lib/database.types";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("profiles").select("*").order("display_name");
  const profiles = (data ?? []) as Profile[];
  const me = profiles.find((profile) => profile.id === user.id);

  if (!me) {
    return (
      <main style={{ maxWidth: 420, margin: "0 auto", padding: "20vh 24px 0" }}>
        <p>This account has no profile yet.</p>
      </main>
    );
  }

  return <Journal me={me} profiles={profiles} />;
}
