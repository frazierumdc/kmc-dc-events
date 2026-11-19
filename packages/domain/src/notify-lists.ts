// The lists a phone joins in Firebase Cloud Messaging (D65, NT-13, NT-20): one per weekly
// class or other series, one per study program, one per one-time event. Lists, not accounts: the app keeps a phone's
// choices, the messaging service only which lists its code joined. Pure.

import type { ClassId, ProgramMatch } from "./website.ts";

/**
 * Lists no phone joins any more, which a phone that once did may still leave: the event
 * types' lists, before events were only followed one by one (owner, 13 November 2026), the
 * one list the two study programs shared, and the list of every prayer.
 */
export const RETIRED_LISTS = [
  "type-class",
  "type-branch",
  "type-fp",
  "type-ttp",
  "type-special",
  "type-program",
  "type-prayer",
] as const;
export type RetiredList = (typeof RETIRED_LISTS)[number];

/** A list's name, as the messaging service's topic. */
export type NotifyList =
  `class-${ClassId}` | `program-${ProgramMatch["id"]}` | `event-${string}` | RetiredList;

/** A weekly class or other series, every time it is held: every event with its class id (NT-13). */
export const classList = (id: ClassId): NotifyList => `class-${id}`;
/**
 * A study program, every session whatever its day or the form of its title on the website:
 * TTP's Sunday and Tuesday classes are one choice (owner, 13 November 2026).
 */
export const programList = (id: ProgramMatch["id"]): NotifyList => `program-${id}`;
/** One event, whatever its date (NT-13). */
export const eventList = (id: string): NotifyList => `event-${id}`;

const LIST = /^(class-c_[0-9A-HJKMNP-TV-Z]{12}|program-(fp|ttp)|event-[A-Za-z0-9_-]{1,100})$/;

/** Only the app's own list names: nobody can make the service hold anything else. */
export function isNotifyList(name: unknown): name is NotifyList {
  return typeof name === "string" && LIST.test(name);
}

/** A list that can still be left, but not joined. */
export function isRetiredList(name: unknown): name is RetiredList {
  return (RETIRED_LISTS as readonly unknown[]).includes(name);
}

/** The most lists one call joins or leaves: the events a phone follows, and the retired lists. */
export const MAX_LISTS = 100;

/** A phone's code from the messaging service: its own characters, of a sane length. */
const TOKEN = /^[A-Za-z0-9_:-]{20,4096}$/;

/** What a phone asks: join some lists and leave others, for its code. */
export interface ListsRequest {
  token: string;
  join: NotifyList[];
  leave: NotifyList[];
}

/** The request's body as a ListsRequest, or why it isn't one. */
export function parseListsRequest(body: unknown): ListsRequest | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "not an object" };
  const { token, join = [], leave = [] } = body as Record<string, unknown>;
  if (typeof token !== "string" || !TOKEN.test(token)) return { error: "no phone code" };
  if (!Array.isArray(join) || !Array.isArray(leave)) return { error: "join and leave are lists" };
  const names: unknown[] = [...(join as unknown[]), ...(leave as unknown[])];
  if (names.length === 0) return { error: "nothing to join or leave" };
  if (names.length > MAX_LISTS) return { error: `more than ${MAX_LISTS} lists` };
  const bad =
    (join as unknown[]).find((name) => !isNotifyList(name)) ??
    (leave as unknown[]).find((name) => !isNotifyList(name) && !isRetiredList(name));
  if (bad !== undefined)
    return { error: `not a list: ${JSON.stringify(bad).replaceAll('"', "").slice(0, 60)}` };
  const leaving = new Set(leave as NotifyList[]);
  const joining = [...new Set(join as NotifyList[])];
  if (joining.some((name) => leaving.has(name))) return { error: "a list to join and leave" };
  return { token, join: joining, leave: [...leaving] };
}
