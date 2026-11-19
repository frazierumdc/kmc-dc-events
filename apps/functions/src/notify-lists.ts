// Joins and leaves a phone's lists in Firebase Cloud Messaging (D65, NT-20): the app sends
// its code and the lists, the function asks the messaging service. Nothing is kept here.

import type { ListsRequest, NotifyList } from "@kmcdc/domain";

/** As much of firebase-admin's Messaging as joining and leaving needs, so tests can stand in. */
export interface TopicManager {
  subscribeToTopic(token: string, topic: string): Promise<TopicResult>;
  unsubscribeFromTopic(token: string, topic: string): Promise<TopicResult>;
}

interface TopicResult {
  failureCount: number;
  errors: { error: { code: string } }[];
}

export interface ListsResult {
  /** The lists that failed, with the service's reason. */
  failed: { list: NotifyList; code: string }[];
  /** The service says the phone's code is no good: the app gets a new one. */
  badToken: boolean;
}

const BAD_TOKEN = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/invalid-argument",
]);

/** Joins and leaves each list for the phone's code; the service takes one list per call. */
export async function changeLists(
  request: ListsRequest,
  topics: TopicManager,
): Promise<ListsResult> {
  const lists = [...request.join, ...request.leave];
  const results = await Promise.allSettled([
    ...request.join.map((list) => topics.subscribeToTopic(request.token, list)),
    ...request.leave.map((list) => topics.unsubscribeFromTopic(request.token, list)),
  ]);
  const failed: ListsResult["failed"] = [];
  results.forEach((result, i) => {
    const list = lists[i] as NotifyList;
    if (result.status === "rejected")
      failed.push({ list, code: (result.reason as { code?: string }).code ?? "unknown" });
    else if (result.value.failureCount > 0)
      failed.push({ list, code: result.value.errors[0]?.error.code ?? "unknown" });
  });
  return { failed, badToken: failed.some(({ code }) => BAD_TOKEN.has(code)) };
}

/** The HTTP status for a result: 200, 410 for a code to replace, 502 when the service failed. */
export function listsStatus(result: ListsResult): number {
  if (result.badToken) return 410;
  return result.failed.length > 0 ? 502 : 200;
}
