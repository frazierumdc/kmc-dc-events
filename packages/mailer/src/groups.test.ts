import { expect, test } from "vitest";
import { expandGroups, GroupsError } from "./groups.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const member = (id: string, extra: Record<string, string> = {}) => ({
  preferredMemberKey: { id },
  type: "USER",
  ...extra,
});

/** Answers lookups from `groups` (address → members) and records each URL. */
function fakeGroups(groups: Record<string, unknown[][]>) {
  const urls: string[] = [];
  const fetch = (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    urls.push(url.toString());
    const key = url.searchParams.get("groupKey.id");
    if (key !== null) {
      return Promise.resolve(key in groups ? json({ name: `groups/${key}` }) : json({}, 404));
    }
    const name = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const pages = groups[name] ?? [];
    const at = Number(url.searchParams.get("pageToken") ?? "0");
    const next = at + 1 < pages.length ? { nextPageToken: String(at + 1) } : {};
    return Promise.resolve(json({ memberships: pages[at], ...next }));
  };
  return { fetch, urls };
}

const sender = "events@example.org";

test("replaces a group with its members, across pages, without the sender", async () => {
  const { fetch } = fakeGroups({
    "fp@example.org": [[member("a@gmail.com"), member(sender)], [member("b@gmail.com")]],
  });
  expect(await expandGroups(["fp@example.org"], "token", { sender, fetch })).toEqual([
    "a@gmail.com",
    "b@gmail.com",
  ]);
});

test("follows groups inside groups once, and leaves out members set to No email", async () => {
  const { fetch } = fakeGroups({
    "staff@example.org": [
      [
        member("inner@example.org", { type: "GROUP" }),
        member("quiet@gmail.com", { deliverySetting: "NONE" }),
        member("a@gmail.com"),
      ],
    ],
    "inner@example.org": [[member("staff@example.org", { type: "GROUP" }), member("A@gmail.com")]],
  });
  expect(await expandGroups(["staff@example.org"], "token", { sender, fetch })).toEqual([
    "a@gmail.com",
  ]);
});

test("keeps people's addresses, looking up only the center's", async () => {
  const { fetch, urls } = fakeGroups({});
  expect(
    await expandGroups(["me@gmail.com", "person@example.org"], "token", { sender, fetch }),
  ).toEqual(["me@gmail.com", "person@example.org"]);
  expect(urls).toHaveLength(1);
});

test("fails with GroupsError when Google refuses", async () => {
  const fetch = () => Promise.resolve(json({ error: { message: "Forbidden" } }, 403));
  await expect(expandGroups(["fp@example.org"], "token", { sender, fetch })).rejects.toThrow(
    GroupsError,
  );
});
