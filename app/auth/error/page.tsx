import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "20vh 24px 0" }}>
      <h1 style={{ fontSize: 40, lineHeight: 1.1, fontWeight: 400, margin: "0 0 1.4em" }}>That link expired.</h1>
      <p>
        <Link href="/login">Ask for another one.</Link>
      </p>
    </main>
  );
}
