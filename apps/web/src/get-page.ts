// The page for people new to the app, /get-app (IN-10): apps/web/get-app/index.html, a page of the
// build of its own (vite.config.ts) with src/get-main.tsx. The build fills in the site's own
// address, its QR code and the link preview's picture, the app's icon.

export interface GetPageSite {
  /** The site's own address, such as https://events.example.org. */
  site: string;
  /** The QR code for the site's /get-app, as an <svg> element. */
  qr: string;
}

/** The page's HTML with the site's address, QR code and link preview filled in. */
export function fillGetPage(html: string, { site, qr }: GetPageSite): string {
  const page = new URL("/get-app", site).href;
  return html
    .replaceAll("%GET_URL%", page)
    .replaceAll("%GET_PREVIEW%", new URL("/pwa-512x512.png", site).href)
    .replaceAll("%GET_HOST%", new URL(site).host)
    .replaceAll("%GET_QR%", qr);
}
