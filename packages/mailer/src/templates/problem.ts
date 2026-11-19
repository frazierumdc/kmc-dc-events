// The Problem email (AN-4), as in the approved mock-up
// (docs/design/mockups/emails/email-problem-phone.png): what happened, what it means for
// app users, and what to do; and "Schedule copying works again" after the next good copy.

import { ACCENT, esc, link, longWhen, p, page, textPage, titleCase, type Email } from "./layout.ts";

export type ProblemInput =
  | {
      kind: "failed";
      /** The update job's reason, e.g. `Unreadable: The feed refused the token (403). …`. */
      problem: string;
      failedAt: string;
      /** When the schedule phones have was published; null before the first, absent when unknown. */
      lastPublishedAt?: string | null;
      /** The Update schedule job's page in the Google Cloud console: its runs, and Execute. */
      jobUrl: string;
      /** The repository on GitHub, for the runbook's link: `https://github.com/<owner>/<name>`. */
      repositoryUrl: string;
    }
  | {
      kind: "behind";
      /** Since when the app's schedule has differed from the website (NT-8). */
      since: string;
      jobUrl: string;
      repositoryUrl: string;
    }
  | { kind: "working"; workingAt: string; failingSince: string; jobUrl: string };

/** How to copy the website now (the owner's wording, 18 November 2026). */
const EXECUTE = "Open the Update schedule job in Google Cloud Run and select Execute.";
/** What the link to the job's page is called. */
const JOB_LINK = "Open the Update schedule job";
const JOB_LINE = "The Update schedule job";

const FOOTER_ADMINS = "You get this because you're on the KMC DC app admins list.";

interface Advice {
  /** For the subject: `the feed refused the token`. */
  short: string;
  happened: string;
  steps: string[];
  runbook: { name: string; anchor: string };
}

/** What the reason means and what to do about it. */
function advice(problem: string): Advice {
  const copying = { name: "Copying failed", anchor: "copying-failed" };
  const syncNow = `${EXECUTE} You'll get a "works again" email.`;
  if (/refused the token/i.test(problem))
    return {
      short: "the feed refused the token",
      happened: "couldn't read events from Wix: the Wix feed refused the app's token.",
      steps: [
        "If someone changed KMC_APP_FEED_TOKEN in Wix Secrets Manager, add the same value as a new version of WIX_FEED_TOKEN in Secret Manager in each of the three Google projects.",
        "Otherwise follow the runbook Rotate the feed token (10 minutes).",
        syncNow,
      ],
      runbook: { name: "Rotate the feed token", anchor: "rotate-the-feed-token" },
    };
  if (/no feed at this address/i.test(problem))
    return {
      short: "the website's feed is missing",
      happened: "couldn't find the app's feed on the website (404).",
      steps: [
        "Ask whoever edits the website whether it was published recently: the feed's code in Wix (http-functions.js) may have been removed or unpublished.",
        "Follow the runbook Copying failed.",
        syncNow,
      ],
      runbook: copying,
    };
  if (problem.startsWith("Unreadable"))
    return {
      short: "couldn't read the website",
      happened: "couldn't read events from Wix, after trying four times.",
      steps: [
        "Usually Wix or the network failed for a moment, and the next update works by itself.",
        "If the next email says the same, follow the runbook Copying failed.",
      ],
      runbook: copying,
    };
  if (problem.startsWith("Empty"))
    return {
      short: "the website sent no events",
      happened:
        "got no events from Wix, while the app has a full schedule, so it published nothing.",
      steps: [
        "Check in Wix that the events are still published.",
        "If they are, follow the runbook Copying failed.",
        syncNow,
      ],
      runbook: copying,
    };
  return {
    short: "the website's data looks wrong",
    happened: "got events from Wix that failed the app's checks, so it published nothing.",
    steps: [
      "Look at the failed run's summary: if Wix changed how it sends events, the update job needs a fix.",
      "Follow the runbook Copying failed.",
    ],
    runbook: copying,
  };
}

const button = (url: string, text: string, filled: boolean) =>
  link(
    url,
    text,
    `display:inline-block;font-weight:600;border-radius:8px;padding:10px 16px;margin:4px 8px 16px 0;text-decoration:none;${filled ? `background:${ACCENT};color:#ffffff` : `border:1.5px solid ${ACCENT}`}`,
  );

const panel = (heading: string, html: string, background: string) =>
  `<div style="background:${background};border-radius:10px;padding:12px 14px;margin:0 0 12px"><b style="display:block;margin-bottom:2px">${esc(heading)}</b>${html}</div>`;

export function problemEmail(input: ProblemInput): Email {
  if (input.kind === "working") {
    const heading = "Schedule copying works again";
    const body = `The update at ${longWhen(input.workingAt)} copied the schedule again, after failing since ${longWhen(input.failingSince)}. Changes made in Wix meanwhile are in the app now.`;
    return {
      subject: titleCase(heading),
      text: textPage(heading, [body, `${JOB_LINE}: ${input.jobUrl}`], [FOOTER_ADMINS]),
      html: page(heading, [p(esc(body)), p(link(input.jobUrl, JOB_LINK))].join("\n"), [
        FOOTER_ADMINS,
      ]),
    };
  }

  if (input.kind === "behind") return behindEmail(input);

  const a = advice(input.problem);
  const heading = "Schedule copy failed";
  const happened = `The update at ${longWhen(input.failedAt)} ${a.happened}`;
  const last = input.lastPublishedAt;
  const means =
    last === null
      ? "No schedule has been published yet, so the app has none to show."
      : `Nothing has changed. The app still shows ${last === undefined ? "the last schedule published" : `the schedule published ${longWhen(last)}`}. New changes in Wix won't reach the app until this is fixed.`;
  const runbookUrl = `${input.repositoryUrl}/blob/main/docs/runbooks.md#${a.runbook.anchor}`;
  const footer = [
    `Technical detail: ${input.problem}`,
    "You'll get at most one email a day about this problem.",
    FOOTER_ADMINS,
  ];

  const html = [
    panel("What happened", esc(happened), "#fbe9e7"),
    panel("What it means for app users", esc(means), "#f6f6f8"),
    `<b>What to do</b>`,
    `<ol style="margin:4px 0 12px;padding-left:20px">${a.steps.map((s) => `<li style="margin-bottom:4px">${esc(s)}</li>`).join("")}</ol>`,
    `<div>${button(runbookUrl, `Open the runbook: ${a.runbook.name}`, true)}${button(input.jobUrl, JOB_LINK, false)}</div>`,
  ];
  const text = [
    `What happened: ${happened}`,
    `What it means for app users: ${means}`,
    `What to do:\n${a.steps.map((s, i) => `  ${String(i + 1)}. ${s}`).join("\n")}`,
    `The runbook ${a.runbook.name}: ${runbookUrl}\n${JOB_LINE}: ${input.jobUrl}`,
  ];
  return {
    subject: titleCase(`Schedule copy failed: ${a.short}`),
    text: textPage(heading, text, footer),
    html: page(heading, html.join("\n"), footer),
  };
}

/** "The app is behind the website" (NT-8): the site has differed from it for 15 minutes. */
function behindEmail(input: Extract<ProblemInput, { kind: "behind" }>): Email {
  const heading = "The app is behind the website";
  const happened = `Since about ${longWhen(input.since)} the app's schedule has differed from the website: an event was added, cancelled or moved in Wix, and the change hasn't been published to the app.`;
  const means =
    "The app still shows the last schedule published. People may see a cancelled event, or an old date or time.";
  const steps = [
    "Look at the Update schedule job's runs in Google Cloud Run: the newest run's log says what failed.",
    `${EXECUTE} You'll get a "works again" email when the app matches the website.`,
    "If that run succeeds and this email comes again, follow the runbook.",
  ];
  const runbook = "The app is behind the website";
  const runbookUrl = `${input.repositoryUrl}/blob/main/docs/runbooks.md#the-app-is-behind-the-website`;
  const footer = ["You'll get at most one email a day about this problem.", FOOTER_ADMINS];
  const html = [
    panel("What happened", esc(happened), "#fbe9e7"),
    panel("What it means for app users", esc(means), "#f6f6f8"),
    `<b>What to do</b>`,
    `<ol style="margin:4px 0 12px;padding-left:20px">${steps.map((s) => `<li style="margin-bottom:4px">${esc(s)}</li>`).join("")}</ol>`,
    `<div>${button(runbookUrl, `Open the runbook: ${runbook}`, true)}${button(input.jobUrl, JOB_LINK, false)}</div>`,
  ];
  const text = [
    `What happened: ${happened}`,
    `What it means for app users: ${means}`,
    `What to do:\n${steps.map((s, i) => `  ${String(i + 1)}. ${s}`).join("\n")}`,
    `The runbook ${runbook}: ${runbookUrl}\n${JOB_LINE}: ${input.jobUrl}`,
  ];
  return {
    subject: titleCase(`The app is behind the website since ${longWhen(input.since)}`),
    text: textPage(heading, text, footer),
    html: page(heading, html.join("\n"), footer),
  };
}
