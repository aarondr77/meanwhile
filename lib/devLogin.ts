/** Staging-only shortcut past the magic-link mail: never enabled in production. */
export function devLoginEnabled(): boolean {
  return process.env.DEV_LOGIN === "1" && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
