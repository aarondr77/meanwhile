"use client";

import { useActionState, useState } from "react";
import { signIn } from "./actions";
import styles from "./login.module.css";

/** Names only: the page never carries their addresses, just which of the two you are. */
export function SignInForm({ names, prompt }: { names: string[]; prompt: string }) {
  const [who, setWho] = useState<number | null>(null);
  const [state, action, pending] = useActionState(signIn, null);

  if (who === null) {
    return (
      <div className={styles.who}>
        {names.map((name, index) => (
          <button
            key={name}
            type="button"
            className={`chrome ${styles.button}`}
            onClick={() => setWho(index)}
          >
            I&rsquo;m {name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="who" value={who} />

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
          not {names[who]}
        </button>
      </div>

      {state?.error ? <p className={`chrome ${styles.error}`}>{state.error}</p> : null}
    </form>
  );
}
