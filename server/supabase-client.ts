/** Server-side Supabase access only. Never import this module into the React app. */
export function supabaseAdmin() {
  const rawUrl = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !key)
    throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env first.");
  const base = new URL(rawUrl);
  if (
    base.protocol !== "https:" ||
    !base.hostname.endsWith(".supabase.co") ||
    base.username ||
    base.password
  )
    throw new Error(
      "SUPABASE_URL must be the HTTPS Project URL from Supabase Connect.",
    );
  if (key.startsWith("sb_publishable_"))
    throw new Error(
      "Importing requires a server secret key, not a publishable key.",
    );
  const headers: Record<string, string> = { apikey: key };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  async function request<T>(
    path: string,
    init: RequestInit = {},
    allowed: number[] = [],
    binary = false,
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      let response: Response;
      try {
        response = await fetch(new URL(path, base), {
          ...init,
          headers: { ...headers, ...init.headers },
          signal: AbortSignal.timeout(30_000),
        });
      } catch {
        if (attempt === 3)
          throw new Error(
            "Supabase connection failed. Check the network and Project URL.",
          );
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * 2 ** attempt),
        );
        continue;
      }
      if (allowed.includes(response.status)) {
        await response.body?.cancel();
        return null as T;
      }
      if (response.ok)
        return (
          binary
            ? Buffer.from(await response.arrayBuffer())
            : await response.json()
        ) as T;
      await response.body?.cancel();
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const seconds = Number(response.headers.get("retry-after"));
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(
              30_000,
              Math.max(
                1000 * 2 ** attempt,
                Number.isFinite(seconds) ? seconds * 1000 : 0,
              ),
            ),
          ),
        );
        continue;
      }
      const help =
        response.status === 404
          ? "Apply the Supabase migrations in the SQL Editor first."
          : response.status === 401 || response.status === 403
            ? "Check the server secret key and database grants."
            : "Check Supabase logs for details; rerunning the import is safe.";
      throw new Error(
        `Supabase ${init.method ?? "GET"} ${path.split("?")[0]} failed (HTTP ${response.status}). ${help}`,
      );
    }
    throw new Error("Supabase retries exhausted.");
  }
  const download = (bucket: string, path: string) =>
    request<Buffer>(
      `/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`,
      {},
      [],
      true,
    );
  return { request, download };
}
