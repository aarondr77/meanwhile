"use client";

import { useActionState } from "react";
import { requestMagicLink } from "./actions";
import styles from "./login.module.css";

export function MagicLinkForm() {
  const [state, action, pending] = useActionState(requestMagicLink, { sent: false });

  if (state.sent) return <p className={styles.note}>Check your email for a link.</p>;

  return (
    <form action={action} className={styles.form}>
      <label htmlFor="email" className={`chrome ${styles.label}`}>
        Email
      </label>
      <input id="email" name="email" type="email" required autoFocus className={styles.input} />
      <button type="submit" disabled={pending} className={`chrome ${styles.button}`}>
        {pending ? "Sending" : "Send link"}
      </button>
    </form>
  );
}
