import {
  AddHomeIcon,
  BackIcon,
  BookmarkIcon,
  BookPlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  CopyIcon,
  FindIcon,
  GlassesIcon,
  StarIcon,
  MoreIcon,
  PageIcon,
  PageMenuIcon,
  ReloadIcon,
  ShareIcon,
  TabsIcon,
} from "../shared/icons.tsx";

/**
 * The bottom of Safari as iOS 27 or 26 draws it, the button to tap ringed: Back, the
 * address bar, then Tabs (27) or ⋯ (26).
 */
export function BarPicture({ guide, ring = true }: { guide: "ios27" | "ios26"; ring?: boolean }) {
  const host = typeof location === "undefined" ? "" : location.host;
  return (
    <span className="ui-picture" aria-hidden="true">
      <span className="ui-pic-round">
        <BackIcon />
      </span>
      <span className="ui-pic-address">
        <span className="ui-pic-glyph" data-ring={(ring && guide === "ios27") || undefined}>
          {guide === "ios27" ? <PageMenuIcon /> : <PageIcon />}
        </span>
        <span className="ui-pic-host">{host}</span>
        <ReloadIcon />
      </span>
      <span className="ui-pic-round" data-ring={(ring && guide === "ios26") || undefined}>
        {guide === "ios27" ? <TabsIcon /> : <MoreIcon />}
      </span>
    </span>
  );
}

/** Safari's menu from step 1, Share at its top ringed (iOS 27's ≡ or iOS 26's ⋯). */
export function MenuPicture({ guide }: { guide: "ios27" | "ios26" }) {
  return (
    <span className="ui-picture ui-shot" aria-hidden="true">
      <span className="ui-pic-menu">
        <span className="ui-pic-item">
          <ShareIcon />
          Share
        </span>
        {guide === "ios27" && (
          <span className="ui-pic-row">
            <BookmarkIcon />
            Add to Bookmarks
          </span>
        )}
        <span className="ui-pic-row">
          <BookPlusIcon />
          Add Bookmark to…
        </span>
        <span className="ui-pic-row" data-dim>
          {guide === "ios27" ? <FindIcon /> : <ReloadIcon />}
          {guide === "ios27" ? "Find on Page" : "New Tab"}
        </span>
      </span>
    </span>
  );
}

/** The round buttons under the apps: Copy, Add to Bookmarks, Add to Reading List, then the fourth. */
export function RoundButtons({ open }: { open: boolean }) {
  return (
    <span className="ui-pic-rounds">
      <span>
        <i>
          <CopyIcon />
        </i>
        Copy
      </span>
      <span>
        <i>
          <BookmarkIcon />
        </i>
        Add to Bookmarks
      </span>
      <span>
        <i>
          <GlassesIcon />
        </i>
        Add to Reading List
      </span>
      <span data-ring={!open || undefined}>
        <i>{open ? <ChevronUpIcon /> : <ChevronDownIcon />}</i>
        {open ? "View Less" : "View More"}
      </span>
    </span>
  );
}

/** The Share sheet as it opens: the page, a row of apps, the round buttons; View More ringed. */
export function SharePicture({ icon }: { icon: string }) {
  const host = typeof location === "undefined" ? "" : location.host;
  return (
    <span className="ui-picture ui-shot" aria-hidden="true">
      <span className="ui-pic-menu">
        <span className="ui-pic-page">
          <img src={icon} alt="" width={36} height={36} />
          <span>
            <b>KMC DC Events</b>
            {host}
          </span>
        </span>
        <span className="ui-pic-apps">
          <i data-app="airdrop" />
          <i data-app="messages" />
          <i data-app="mail" />
          <i />
        </span>
        <RoundButtons open={false} />
      </span>
    </span>
  );
}

/** After View More: the list, Add to Home Screen ringed. */
export function ListPicture() {
  return (
    <span className="ui-picture ui-shot" aria-hidden="true">
      <span className="ui-pic-menu">
        <RoundButtons open />
        <span className="ui-pic-list">
          <span className="ui-pic-row">
            <BookPlusIcon />
            Add Bookmark to…
          </span>
          <span className="ui-pic-row">
            <StarIcon />
            Add to Favorites
          </span>
          <span className="ui-pic-row">
            <FindIcon />
            Find on Page
          </span>
          <span className="ui-pic-item">
            <AddHomeIcon />
            Add to Home Screen
          </span>
        </span>
      </span>
    </span>
  );
}

/** The Add to Home Screen screen: ✕, its title, Add ringed; the app; Open as Web App on. */
export function AddPicture({ icon }: { icon: string }) {
  const host = typeof location === "undefined" ? "" : location.host;
  return (
    <span className="ui-picture ui-shot" aria-hidden="true">
      <span className="ui-pic-menu">
        <span className="ui-pic-dialog-top">
          <i>
            <CloseIcon />
          </i>
          <b>Add to Home Screen</b>
          <span className="ui-pic-add">Add</span>
        </span>
        <span className="ui-pic-page ui-pic-field">
          <img src={icon} alt="" width={30} height={30} />
          <span>
            KMC DC Events
            <small>https://{host}/</small>
          </span>
        </span>
        <span className="ui-pic-field ui-pic-toggle">
          Open as Web App
          <span className="ui-switch" />
        </span>
      </span>
    </span>
  );
}
