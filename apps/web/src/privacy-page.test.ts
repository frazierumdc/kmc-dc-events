import { PRIVACY } from "@kmcdc/ui/privacy";
import { expect, test } from "vitest";
import { privacyPage } from "./privacy-page.ts";

test("the stand-alone privacy page has every section, the contact and no script (NFR-5, IN-9)", () => {
  const html = privacyPage("/apple-touch-icon-180x180.png");
  expect(html).toContain("<title>Privacy · KMC DC Events</title>");
  expect(html).toContain("<b>KMC DC Events collects no data about you.</b>");
  for (const s of PRIVACY.sections) {
    expect(html).toContain(`<h2>${s.title}</h2>`);
    expect(html).toContain(s.text);
  }
  expect(html).toContain('<a href="mailto:contact@example.org">contact@example.org</a>');
  expect(html).toContain('<a href="/">Open the app ›</a>');
  expect(html).not.toContain("<script");
  // Nothing from another company's servers (C-10).
  expect(html.match(/(?:src|href)="https?:/g)).toBeNull();
});
