"use client";

import { useActionState, useState } from "react";
import type { Account } from "@/lib/accounts";
import { signIn } from "./actions";
import styles from "./login.module.css";

export function SignInForm({ accounts, prompt }: { accounts: Account[]; prompt: string }) {
  const [who, setWho] = useState<Account | null>(null);
  const [state, action, pending] = useActionState(signIn, null);

  if (!who) {
    return (
      <div className={styles.who}>
        {accounts.map((account) => (
          <button
            key={account.email}
            type="button"
            className={`chrome ${styles.button}`}
            onClick={() => setWho(account)}
          >
            I&rsquo;m {account.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="email" value={who.email} />

      <p className={styles.sentence}>
        <span>{prompt}</span>
        <input
          name="answer"
          required
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label={prompt}
          className={styles.blank}
        />
      </p>

      <div className={styles.actions}>
        <button type="submit" disabled={pending} className={`chrome ${styles.button}`}>
          {pending ? "…" : "Enter"}
        </button>
        <button type="button" className={`chrome ${styles.back}`} onClick={() => setWho(null)}>
          not {who.name}
        </button>
      </div>

      {state?.error ? <p className={`chrome ${styles.error}`}>{state.error}</p> : null}
    </form>
  );
}
