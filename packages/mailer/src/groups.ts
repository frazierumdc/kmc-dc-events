// Reads a Google Group's members through the Cloud Identity Groups API (D47), so each email
// goes to the members themselves, in Bcc, rather than through the group: mail delivered by a
// group carries mailing-list headers, and Gmail files it under Forums.
// Scope: cloud-identity.groups.readonly. The sending account manages every group, so it can
// read their members.

export const GROUPS_SCOPE = "https://www.googleapis.com/auth/cloud-identity.groups.readonly";
const API = "https://cloudidentity.googleapis.com/v1";

export interface GroupsOptions {
  /** The sending account, left out of the members. */
  sender: string;
  timeoutMs?: number;
  /** Injected for tests. */
  fetch?: typeof globalThis.fetch;
}

/** Why the members couldn't be read; the caller sends to the groups instead. */
export class GroupsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroupsError";
  }
}

interface Membership {
  preferredMemberKey?: { id?: string };
  type?: string;
  deliverySetting?: string;
}

/** A member whose group email isn't set to No email. */
const takesEmail = (m: Membership) =>
  m.deliverySetting !== "NONE" && m.deliverySetting !== "DISABLED";

/**
 * The people behind the addresses: each group at the sender's domain is replaced by its
 * members (groups within it too), and every other address is kept.
 * Members whose group email is set to No email are left out, and so is the sender.
 */
export async function expandGroups(
  addresses: readonly string[],
  accessToken: string,
  options: GroupsOptions,
): Promise<string[]> {
  const { fetch = globalThis.fetch, timeoutMs = 30_000 } = options;
  const sender = options.sender.toLowerCase();
  const domain = sender.split("@")[1] ?? "";
  const seen = new Set<string>();
  const people = new Set<string>();

  const get = async (url: string) => {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
      error?: { message?: string };
    };
    return { status: response.status, body };
  };

  const visit = async (address: string): Promise<void> => {
    const key = address.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (!domain || !key.endsWith(`@${domain}`)) {
      people.add(key);
      return;
    }
    const name = await groupName(key);
    if (name === null) {
      people.add(key);
      return;
    }
    for await (const m of members(key, name)) {
      const id = m.preferredMemberKey?.id?.toLowerCase();
      if (!id || id === sender || !takesEmail(m)) continue;
      if (m.type === "GROUP") await visit(id);
      else people.add(id);
    }
  };

  /** The group's resource name; null when the address is no group. */
  const groupName = async (key: string): Promise<string | null> => {
    const lookup = await get(`${API}/groups:lookup?groupKey.id=${encodeURIComponent(key)}`);
    if (lookup.status === 404) return null;
    const name = lookup.body.name;
    if (lookup.status !== 200 || typeof name !== "string") {
      throw new GroupsError(
        `Couldn't look up ${key} (${String(lookup.status)}): ${lookup.body.error?.message ?? "no detail"}`,
      );
    }
    return name;
  };

  /** Every member of a group; the next page is asked for only once this one is done. */
  const members = async function* (key: string, name: string): AsyncGenerator<Membership> {
    let pageToken = "";
    do {
      const query = new URLSearchParams({ view: "FULL", pageSize: "500" });
      if (pageToken) query.set("pageToken", pageToken);
      const page = await get(`${API}/${name}/memberships?${query.toString()}`);
      if (page.status !== 200) {
        throw new GroupsError(
          `Couldn't read ${key}'s members (${String(page.status)}): ${page.body.error?.message ?? "no detail"}`,
        );
      }
      yield* (page.body.memberships ?? []) as Membership[];
      pageToken = typeof page.body.nextPageToken === "string" ? page.body.nextPageToken : "";
    } while (pageToken);
  };

  for (const address of addresses) await visit(address);
  people.delete(sender);
  return [...people];
}
