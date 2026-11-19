// A Cloud Storage bucket over fetch (D63, docs/architecture/storage.md). Every write names
// the version it read, so it fails when another run wrote first.

/** One file in the bucket, with the version read. */
export interface Stored {
  text: string;
  /** Cloud Storage's generation: changes with every write. */
  generation: string;
  /** When the file was last written, as an instant; absent when the bucket didn't say. */
  updated?: string;
}

export interface Bucket {
  /** The file, or null when there is none. */
  read(name: string): Promise<Stored | null>;
  /**
   * Writes the file if its version is still `generation` ("0": only if there is none);
   * throws WroteFirst otherwise. Returns the new version.
   */
  write(name: string, text: string, generation: string): Promise<string>;
  /** Deletes the file if its version is still `generation`; a file already gone is fine. */
  remove(name: string, generation: string): Promise<void>;
}

/** Another run wrote the file since this one read it. */
export class WroteFirst extends Error {
  constructor(name: string) {
    super(`Another run wrote ${name} first.`);
  }
}

const API = "https://storage.googleapis.com";

export function cloudBucket(options: {
  bucket: string;
  /** A Google access token for the job's account. */
  token: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
}): Bucket {
  const { bucket, token, fetch = globalThis.fetch } = options;
  const call = async (url: string, init: { method?: string; body?: string } = {}) =>
    fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${await token()}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      signal: AbortSignal.timeout(30_000),
    });
  const object = (name: string) => `${API}/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}`;
  return {
    async read(name) {
      const response = await call(`${object(name)}?alt=media`);
      if (response.status === 404) return null;
      if (!response.ok)
        throw new Error(`Could not read ${name} from ${bucket} (${String(response.status)})`);
      const generation = response.headers.get("x-goog-generation");
      if (!generation) throw new Error(`${name} in ${bucket} came without its version`);
      const modified = Date.parse(response.headers.get("last-modified") ?? "");
      return {
        text: await response.text(),
        generation,
        ...(Number.isNaN(modified) ? {} : { updated: new Date(modified).toISOString() }),
      };
    },
    async write(name, text, generation) {
      const query = new URLSearchParams({
        uploadType: "media",
        name,
        ifGenerationMatch: generation,
      });
      const response = await call(`${API}/upload/storage/v1/b/${bucket}/o?${query.toString()}`, {
        method: "POST",
        body: text,
      });
      if (response.status === 412) throw new WroteFirst(name);
      if (!response.ok)
        throw new Error(`Could not write ${name} to ${bucket} (${String(response.status)})`);
      return ((await response.json()) as { generation?: string }).generation ?? "";
    },
    async remove(name, generation) {
      const response = await call(`${object(name)}?ifGenerationMatch=${generation}`, {
        method: "DELETE",
      });
      if (response.status === 412) throw new WroteFirst(name);
      if (!response.ok && response.status !== 404)
        throw new Error(`Could not delete ${name} from ${bucket} (${String(response.status)})`);
    },
  };
}

/** A bucket in memory that keeps Cloud Storage's rule for versions; for tests. */
export function memoryBucket(
  files: Record<string, Stored> = {},
  now: () => number = Date.now,
): Bucket & { files: Record<string, Stored> } {
  const current = (name: string) => files[name]?.generation ?? "0";
  return {
    files,
    read: (name) => Promise.resolve(files[name] ?? null),
    write(name, text, generation) {
      if (current(name) !== generation) return Promise.reject(new WroteFirst(name));
      const next = String(
        Math.max(0, ...Object.values(files).map((f) => Number(f.generation))) + 1,
      );
      files[name] = { text, generation: next, updated: new Date(now()).toISOString() };
      return Promise.resolve(next);
    },
    remove(name, generation) {
      if (!files[name]) return Promise.resolve();
      if (current(name) !== generation) return Promise.reject(new WroteFirst(name));
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete files[name];
      return Promise.resolve();
    },
  };
}
