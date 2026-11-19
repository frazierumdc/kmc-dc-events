import { CloudOffIcon } from "../shared/icons.tsx";

export interface CheckNoticeProps {
  /** Since when no check has succeeded, as the reader should see it: `9:41 AM`. */
  since: string | null;
  /** The website to check instead. */
  website: { name: string; href: string };
}

/**
 * Says when the app couldn't check for changes (NT-6): a neutral card above the list, the
 * whole of it a link to the website. The live region is always in the page, so a screen
 * reader says the notice when it arrives; with nothing to say it takes no room.
 */
export function CheckNotice({ since, website }: CheckNoticeProps) {
  return (
    <div role="status">
      {since !== null && (
        <a className="ui-check-notice" href={website.href} target="_blank" rel="noopener">
          <CloudOffIcon />
          <span>
            Couldn’t check for changes since {since}. Before you go, check <u>{website.name}</u>.
          </span>
        </a>
      )}
    </div>
  );
}
