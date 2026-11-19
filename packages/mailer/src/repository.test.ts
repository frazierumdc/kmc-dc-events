import { expect, test } from "vitest";
import { repositoryFromRemote, repositoryUrl } from "./repository.ts";

test("the repository from GitHub Actions' own settings (D57)", () => {
  expect(repositoryUrl({ GITHUB_REPOSITORY: "center/events-app" }, ".")).toBe(
    "https://github.com/center/events-app",
  );
  expect(
    repositoryUrl(
      { GITHUB_REPOSITORY: "center/events-app", GITHUB_SERVER_URL: "https://git.example.org" },
      ".",
    ),
  ).toBe("https://git.example.org/center/events-app");
});

test.each([
  ["https://github.com/center/events-app.git", "https://github.com/center/events-app"],
  ["https://github.com/center/events-app", "https://github.com/center/events-app"],
  ["git@github.com:center/events-app.git\n", "https://github.com/center/events-app"],
  ["https://gitlab.com/center/events-app.git", null],
  ["", null],
])("a git remote %j is the repository %j", (remote, url) => {
  expect(repositoryFromRemote(remote)).toBe(url);
});
