// The stand-alone privacy page, /privacy (NFR-5, IN-9): the words Settings' Privacy page shows,
// as a plain page that needs no script, for anyone with the link and for Google's sign-in
// review. Built with the app (vite.config.ts) as privacy/index.html.

// Its own entry: the build config loads this file without the app's .tsx components.
import { escapeHtml as escape } from "@kmcdc/domain";
import { PRIVACY } from "@kmcdc/ui/privacy";

/** The page's HTML; `icon` is the app icon's address. */
export function privacyPage(icon: string): string {
  const sections = PRIVACY.sections
    .map((s) => `<h2>${escape(s.title)}</h2>\n<p>${escape(s.text)}</p>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escape(PRIVACY.title)} · KMC DC Events</title>
<meta name="description" content="${escape(`${PRIVACY.lead} ${PRIVACY.leadMore}`)}">
<link rel="icon" href="/favicon.ico">
<style>
:root{--bg:#f2f2f7;--text:#1c1c1e;--muted:#6c6c70;--accent:#7a1f2b;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#000;--text:#f2f2f7;--muted:#9a9aa0;--accent:#e0707d}}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:640px;margin:0 auto;padding:max(24px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(40px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left))}
.app{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.app img{border-radius:9px}
.app b{display:block;font-size:1.1rem}
.app a{color:var(--accent);text-decoration:none}
h1{margin:0 0 14px;font-size:1.75rem}
.lead{margin:0 0 22px;font-size:1.05rem}
.lead b{font-weight:600}
h2{margin:0 0 7px;color:var(--muted);font-size:.8rem;font-weight:400;letter-spacing:.02em;text-transform:uppercase}
p{margin:0 0 20px}
a{color:var(--accent)}
.updated{margin-top:28px;color:var(--muted);font-size:.8rem;text-align:center}
</style>
</head>
<body>
<main>
<div class="app"><img src="${escape(icon)}" alt="" width="36" height="36"><div><b>KMC DC Events</b><a href="/">Open the app ›</a></div></div>
<h1>${escape(PRIVACY.title)}</h1>
<p class="lead"><b>${escape(PRIVACY.lead)}</b> ${escape(PRIVACY.leadMore)}</p>
${sections}
<h2>${escape(PRIVACY.questions)}</h2>
<p><a href="mailto:${escape(PRIVACY.contact)}">${escape(PRIVACY.contact)}</a></p>
<p class="updated">${escape(PRIVACY.updated)}</p>
</main>
</body>
</html>
`;
}
