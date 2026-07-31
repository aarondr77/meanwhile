import { accounts, adminClient } from "@/lib/accounts";
import { SignInForm } from "./SignInForm";
import styles from "./login.module.css";

// The names and the prompt are read per request, not baked in at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [people, { data: signIn }] = await Promise.all([
    accounts(),
    adminClient().from("sign_in").select("prompt").maybeSingle(),
  ]);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Meanwhile</h1>
      <SignInForm names={people.map((person) => person.name)} prompt={signIn?.prompt ?? "I love you for"} />
    </main>
  );
}
