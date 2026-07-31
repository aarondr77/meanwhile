const API = "https://api.devin.ai/v3";

export interface SessionState {
  status: string;
  statusDetail: string | null;
  structuredOutput: Record<string, unknown> | null;
}

function key(): string {
  const value = process.env.DEVIN_API_KEY;
  if (!value) throw new Error("DEVIN_API_KEY is not set");
  return value;
}

function org(): string {
  const value = process.env.DEVIN_ORG_ID;
  if (!value) throw new Error("DEVIN_ORG_ID is not set");
  return value;
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API}/organizations/${org()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Devin API ${path} failed: ${response.status}`);
  return response.json();
}

export function devinConfigured(): boolean {
  return Boolean(process.env.DEVIN_API_KEY && process.env.DEVIN_ORG_ID);
}

/**
 * Fail loudly on credentials that will not draw. The app treats a refusing Devin as a
 * day without a mark, which is right on a request path and useless to someone warming
 * the pool from a terminal, so this asks the API whether the key and org actually work.
 */
export async function assertDevinCredentials(): Promise<void> {
  if (!devinConfigured()) throw new Error("DEVIN_API_KEY and DEVIN_ORG_ID are required");
  try {
    await call("/sessions?limit=1");
  } catch (error) {
    throw new Error(`Devin credentials rejected (${(error as Error).message}): check the cog_ key and its org`);
  }
}

export async function createSession(
  prompt: string,
  options: { title: string; schema: unknown; maxAcu?: number; tags?: string[] },
): Promise<string> {
  const data = (await call("/sessions", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      title: options.title,
      structured_output_schema: options.schema,
      max_acu_limit: options.maxAcu ?? 5,
      tags: options.tags ?? [],
      unlisted: true,
      idempotent: true,
      // A mark is drawn once and read from the database forever, so the VM is disposable.
      resumable: false,
    }),
  })) as { session_id: string };
  return data.session_id;
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const data = (await call(`/sessions/${sessionId}`)) as {
    status?: string | null;
    status_detail?: string | null;
    structured_output?: Record<string, unknown> | null;
  };
  return {
    status: data.status ?? "unknown",
    statusDetail: data.status_detail ?? null,
    structuredOutput: data.structured_output ?? null,
  };
}

/**
 * A session that will draw nothing more, whether or not it answered. A finished
 * session still reads as running for a while, so the detail settles it.
 */
export function isTerminal(session: SessionState): boolean {
  if (["exit", "error", "suspended"].includes(session.status)) return true;
  return session.status === "running" && session.statusDetail === "finished";
}
