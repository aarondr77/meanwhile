const API = "https://api.devin.ai/v1";

interface SessionCreated {
  session_id: string;
}

export interface SessionState {
  status: string;
  structuredOutput: Record<string, unknown> | null;
}

function key(): string {
  const value = process.env.DEVIN_API_KEY;
  if (!value) throw new Error("DEVIN_API_KEY is not set");
  return value;
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
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
  return Boolean(process.env.DEVIN_API_KEY);
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
    }),
  })) as SessionCreated;
  return data.session_id;
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const data = (await call(`/session/${sessionId}`)) as {
    status_enum?: string | null;
    structured_output?: Record<string, unknown> | null;
  };
  return {
    status: data.status_enum ?? "unknown",
    structuredOutput: data.structured_output ?? null,
  };
}

/** Devin keeps working after answering, so a session with output is done for our purposes. */
export const TERMINAL_STATUSES = new Set(["blocked", "finished", "expired", "stopped"]);
