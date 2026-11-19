import {
  addDays,
  easternDate,
  easternMidnight,
  formatEasternShort,
  formatTime12,
  hasWebsiteChanges,
  type ScheduleChanges,
  type SnapshotV2,
  type SnapshotV2Event,
} from "@kmcdc/domain";

/** The changes as Markdown, the next 7 days first: the run's summary page. */
export function changesMarkdown(c: ScheduleChanges, after: SnapshotV2, now: Date): string[] {
  if (c.first) return [`First schedule: ${String(after.events.length)} events.`];
  const lines: string[] = [];
  if (!hasWebsiteChanges(c)) lines.push("No changes on the website.");
  if (c.siteChanged) lines.push("Site settings changed (`data/site.json`).");
  if (c.finished > 0) lines.push(`${String(c.finished)} finished events dropped.`);

  const weekEnd = Date.parse(easternMidnight(addDays(easternDate(now), 7)));
  const soon = (...events: SnapshotV2Event[]) => events.some((e) => Date.parse(e.start) < weekEnd);
  const when = (e: SnapshotV2Event) => formatEasternShort(e.start);
  const byStart = <T>(list: T[], start: (t: T) => string) =>
    [...list].sort((x, y) => Date.parse(start(x)) - Date.parse(start(y)));

  for (const [heading, inWindow] of [
    ["Next 7 days", true],
    ["Later", false],
  ] as const) {
    const group = (title: string, items: string[]) => {
      if (items.length > 0) section.push(`**${title}**`, "", ...items, "");
    };
    const section: string[] = [];
    group(
      "New",
      byStart(c.added, (e) => e.start)
        .filter((e) => soon(e) === inWindow)
        .map((e) => `- ${when(e)} · ${e.title}`),
    );
    group(
      "Removed",
      byStart(c.removed, (e) => e.start)
        .filter((e) => soon(e) === inWindow)
        .map((e) => `- ${when(e)} · ${e.title}`),
    );
    group(
      "Date or time changed",
      byStart(c.moved, (m) => m.after.start)
        .filter((m) => soon(m.before, m.after) === inWindow)
        .map(
          (m) =>
            `- ${m.after.title}: ${span(m.before)} → ${span(m.after)}` +
            (m.fields.length > 0 ? ` (also ${m.fields.join(", ")})` : ""),
        ),
    );
    group(
      "Other details changed",
      byStart(c.edited, (m) => m.after.start)
        .filter((m) => soon(m.after) === inWindow)
        .map((m) => `- ${when(m.after)} · ${m.after.title}: ${m.fields.join(", ")}`),
    );
    if (section.length > 0) lines.push("", `### ${heading}`, "", ...trimEnd(section));
  }
  return trimEnd(lines);
}

function span(e: SnapshotV2Event): string {
  if (e.allDay) return `${easternDate(e.start)} all day`;
  if (!e.end) return formatEasternShort(e.start);
  const end =
    easternDate(e.end) === easternDate(e.start) ? formatTime12(e.end) : formatEasternShort(e.end);
  return `${formatEasternShort(e.start)} – ${end}`;
}

function trimEnd(lines: string[]): string[] {
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}
