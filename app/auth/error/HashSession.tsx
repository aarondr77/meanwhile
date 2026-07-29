"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Links minted outside the app (Supabase's admin generate_link, or any implicit-flow
 * mail) deliver the session in the fragment, which the server callback cannot read.
 */
export function HashSession() {
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;

    setSigningIn(true);
    const supabase = createClient();
    void supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) {
        setSigningIn(false);
        return;
      }
      history.replaceState(null, "", "/");
      router.replace("/");
    });
  }, [router]);

  return signingIn ? <p>Signing you in…</p> : null;
}
