import { expect, test } from "vitest";
import type { ListsRequest } from "@kmcdc/domain";
import { changeLists, listsStatus, type TopicManager } from "./notify-lists.ts";

// The function behind the Notifications screen (D65, NT-20): it asks the messaging service
// to join and leave lists for a phone's code, and says when the code must be replaced.
const TOKEN = "fK3x9AbC_dEf:APA91bH-0123456789abcdefABCDEF";
interface Answer {
  failureCount: number;
  errors: { error: { code: string } }[];
}
const ok: Answer = { failureCount: 0, errors: [] };
const failing = (code: string): Answer => ({ failureCount: 1, errors: [{ error: { code } }] });

function service(answer: (topic: string) => Promise<Answer> = () => Promise.resolve(ok)) {
  const calls: string[] = [];
  const topics: TopicManager = {
    subscribeToTopic: (token, topic) => {
      calls.push(`join ${topic} ${token === TOKEN ? "token" : "?"}`);
      return answer(topic);
    },
    unsubscribeFromTopic: (token, topic) => {
      calls.push(`leave ${topic} ${token === TOKEN ? "token" : "?"}`);
      return answer(topic);
    },
  };
  return { topics, calls };
}

const request: ListsRequest = {
  token: TOKEN,
  join: ["type-class", "class-c_0EP710PSBWX9"],
  leave: ["type-prayer"],
};

test("joins and leaves each list for the phone's code", async () => {
  const { topics, calls } = service();
  const result = await changeLists(request, topics);
  expect(calls).toEqual([
    "join type-class token",
    "join class-c_0EP710PSBWX9 token",
    "leave type-prayer token",
  ]);
  expect(result).toEqual({ failed: [], badToken: false });
  expect(listsStatus(result)).toBe(200);
});

test("a code the service refuses is to be replaced (410)", async () => {
  const { topics } = service(() =>
    Promise.resolve(failing("messaging/registration-token-not-registered")),
  );
  const result = await changeLists(request, topics);
  expect(result.badToken).toBe(true);
  expect(listsStatus(result)).toBe(410);
});

test("a list the service fails is said, and the rest still change (502)", async () => {
  const { topics, calls } = service((topic) =>
    topic === "type-class"
      ? Promise.reject(Object.assign(new Error("down"), { code: "messaging/internal-error" }))
      : Promise.resolve(ok),
  );
  const result = await changeLists(request, topics);
  expect(calls).toHaveLength(3);
  expect(result).toEqual({
    failed: [{ list: "type-class", code: "messaging/internal-error" }],
    badToken: false,
  });
  expect(listsStatus(result)).toBe(502);
});
