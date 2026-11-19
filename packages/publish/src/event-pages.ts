import type { SnapshotV2 } from "@kmcdc/domain";
import { eventUrl } from "./calendar.ts";
import { eventShare } from "./share.ts";
import { picturePath } from "./share-picture.ts";

/**
 * Each event's own copy of the app's page, `e/{id}/index.html` (event-pages-cli.ts): the
 * same app, whose title, description and link preview tags (Open Graph) name the event and
 * say when and where (share.ts), with the event's share picture (share-picture.ts). Phones
 * and chat apps read these when a link is shared, so a shared event reads as the event, not
 * the app (EV-35, EV-37). Published with each schedule; the page opens the app at the
 * event's panel, as any `/e/{id}` does.
 */

/** The ids an event's address can carry (event-route.ts), so a folder name is always safe. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function eventPages(
  html: string,
  snapshot: SnapshotV2,
  origin: string,
): Map<string, string> {
  return new Map(
    snapshot.events
      .filter((event) => SAFE_ID.test(event.id))
      .map((event) => {
        const { title, text } = eventShare(event, snapshot.site);
        const url = eventUrl(event.id, origin);
        return [
          `e/${event.id}/index.html`,
          withHead(html, {
            title,
            description: text,
            url,
            image: `${origin}${picturePath(event.id)}`,
            siteName: snapshot.site.center.name,
          }),
        ];
      }),
  );
}

interface Head {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName: string;
}

/** The page with the event's title and description, and its preview tags before </head>. */
export function withHead(html: string, head: Head): string {
  const tags = [
    ["og:type", "website"],
    ["og:site_name", head.siteName],
    ["og:title", head.title],
    ["og:description", head.description],
    ["og:url", head.url],
    ["og:image", head.image],
    ["og:image:width", "1200"],
    ["og:image:height", "630"],
    ["og:image:alt", `${head.title}. ${head.description}`],
  ]
    .map(
      ([property, content]) =>
        `    <meta property="${property}" content="${attr(content ?? "")}" />`,
    )
    .concat(
      `    <meta name="twitter:card" content="summary_large_image" />`,
      `    <link rel="canonical" href="${attr(head.url)}" />`,
    )
    .join("\n");
  const page = html
    .replace(/<title>[^<]*<\/title>/, `<title>${text(head.title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${attr(head.description)}" />`,
    )
    .replace("</head>", `${tags}\n  </head>`);
  if (!page.includes(`<title>${text(head.title)}</title>`) || !page.includes('property="og:title"'))
    throw new Error("index.html has no <title> or </head> to fill");
  return page;
}

const text = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s: string) => text(s).replace(/"/g, "&quot;");
