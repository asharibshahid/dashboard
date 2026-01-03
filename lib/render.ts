type RenderServicePayload = {
  type: "web_service";
  name: string;
  ownerId: string;
  repo: string;
  branch: string;
  runtime: "node";
  buildCommand: string;
  startCommand: string;
  envVars: Array<{ key: string; value: string }>;
};

const RENDER_API_BASE = "https://api.render.com/v1";

async function parseRenderError(res: Response) {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return json?.message || json?.error || text || `Render request failed (${res.status})`;
}

export async function createService(apiKey: string, payload: RenderServicePayload) {
  const res = await fetch(`${RENDER_API_BASE}/services`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseRenderError(res));
  }
  return res.json();
}

export async function getService(apiKey: string, serviceId: string) {
  const res = await fetch(`${RENDER_API_BASE}/services/${serviceId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(await parseRenderError(res));
  }
  return res.json();
}

export function extractServiceUrl(payload: any) {
  return (
    payload?.serviceDetails?.url ||
    payload?.service?.serviceDetails?.url ||
    payload?.url ||
    payload?.service?.url ||
    null
  );
}
