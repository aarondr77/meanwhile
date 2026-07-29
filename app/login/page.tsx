import { devLoginEnabled } from "@/lib/devLogin";
import { devAccounts } from "@/lib/devAccounts";
import { devSignIn } from "./actions";
import { MagicLinkForm } from "./MagicLinkForm";
import styles from "./login.module.css";

export default async function LoginPage() {
  const devLogin = devLoginEnabled();
  const accounts = devLogin ? await devAccounts() : [];

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Meanwhile</h1>

      {devLogin ? (
        <form action={devSignIn} className={styles.devForm}>
          <p className={`chrome ${styles.label}`}>Staging — sign in as</p>
          {accounts.map(({ email, name }) => (
            <button
              key={email}
              type="submit"
              name="email"
              value={email}
              className={`chrome ${styles.button}`}
            >
              {name}
            </button>
          ))}
        </form>
      ) : (
        <MagicLinkForm />
      )}
    </main>
  );
}
