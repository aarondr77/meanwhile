/**
 * The only two addresses that can ever sign in. Server-side only: anything else
 * gets the same "check your email" response and no email is sent.
 */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string): boolean {
  return allowedEmails().includes(email.trim().toLowerCase());
}
