// The running account's Google access token (D63): no library, the same code on GitHub, on
// the developer's Mac and inside a Cloud Run job.

/**
 * GOOGLE_OAUTH_ACCESS_TOKEN where a workflow or the developer supplies one; otherwise from
 * the metadata server, as inside a Cloud Run job.
 */
export async function accessToken(
  env: Record<string, string | undefined> = process.env,
  fetch: typeof globalThis.fetch = globalThis.fetch,
  /** What the token is for, where a service asks for more than Google Cloud's own scope. */
  scopes: readonly string[] = [],
): Promise<string> {
  if (env.GOOGLE_OAUTH_ACCESS_TOKEN) return env.GOOGLE_OAUTH_ACCESS_TOKEN;
  const query = scopes.length > 0 ? `?scopes=${encodeURIComponent(scopes.join(","))}` : "";
  const response = await fetch(
    `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token${query}`,
    { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error(`No Google sign-in (${String(response.status)})`);
  return ((await response.json()) as { access_token: string }).access_token;
}
