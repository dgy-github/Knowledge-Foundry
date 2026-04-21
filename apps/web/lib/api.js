export const apiBase =
  window.localStorage.getItem("knowledge-foundry.apiBase") ||
  `${window.location.origin}/api`;

export async function fetchJson(path, options) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { accept: "application/json", ...(options?.headers ?? {}) },
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {}

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }

  return payload;
}

export async function fetchOptionalJson(path, options) {
  try {
    return await fetchJson(path, options);
  } catch {
    return null;
  }
}
