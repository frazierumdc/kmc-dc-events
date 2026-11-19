// backend/http-functions.js — KMC DC Events app: a read-only feed of the events visitors can
// see on example.org. Source of truth: wix/backend/http-functions.js in the
// your-project-id repository; install and test steps in docs/architecture/wix-feed.md.
//
//   GET https://www.example.org/_functions/appEvents
//       Authorization: Bearer <KMC_APP_FEED_TOKEN>
//
// Returns every published event (status UPCOMING or STARTED) from yesterday to 400 days
// ahead, whatever its category, in the Wix Events V3 REST shape so the app's mapper
// (mapWixEvent) reads them as is. Which events the app shows, and as which kind, is decided
// in the app. Drafts, cancelled and ended events are never returned. Only the fields below
// leave Wix: no guest, order, form, dashboard or online-conferencing data.
//
//   ?raw=1   also returns the first event exactly as Wix gave it, and the first venue's
//            location exactly as Wix gave it (rawLocation), to check field names.
//
//   GET https://www.example.org/_functions/allEvents
//       Authorization: Bearer <KMC_APP_FEED_TOKEN>
//
// The record of the website for the Schedule changes email: every published event in the same
// window whatever its status (upcoming, started, ended or cancelled), in the same shape. The
// app never reads it. Read with elevated permissions, as a visitor isn't shown ended or
// cancelled events; drafts are never returned.
import { forbidden, ok, serverError } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import { wixEventsV2 } from 'wix-events.v2';
import { elevate } from 'wix-auth';

const TOKEN_SECRET = 'KMC_APP_FEED_TOKEN';
const FIELDSETS = ['DETAILS', 'TEXTS', 'URLS', 'REGISTRATION', 'CATEGORIES'];
const LISTED = ['UPCOMING', 'STARTED'];
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const DAY_MS = 86400000;
const WINDOW_DAYS = 400;
const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

export async function get_appEvents(request) {
  if (!(await authorised(request))) {
    return forbidden({ headers: HEADERS, body: { error: 'Not authorised' } });
  }
  try {
    const now = new Date();
    // A day's margin so nothing ending today is missed; the app trims to today in Eastern time.
    const from = new Date(now.getTime() - DAY_MS);
    const to = new Date(now.getTime() + WINDOW_DAYS * DAY_MS);
    const { items, access } = await queryListed(from, to);
    const events = items.filter(isPublished).map(toFeedEvent);
    const body = {
      generatedAt: now.toISOString(),
      window: { from: from.toISOString(), to: to.toISOString() },
      access,
      count: events.length,
      events,
    };
    if (request.query && request.query.raw === '1') {
      body.raw = withoutStaffIds(items[0]);
      const venue = items.find((e) => e.location && e.location.type === 'VENUE');
      body.rawLocation = venue ? venue.location : null;
    }
    return ok({ headers: HEADERS, body });
  } catch (e) {
    console.error('appEvents failed', e);
    return serverError({ headers: HEADERS, body: { error: 'Could not read events', detail: String(e && e.message) } });
  }
}

const RECORDED = ['UPCOMING', 'STARTED', 'ENDED', 'CANCELED'];

export async function get_allEvents(request) {
  if (!(await authorised(request))) {
    return forbidden({ headers: HEADERS, body: { error: 'Not authorised' } });
  }
  try {
    const now = new Date();
    const from = new Date(now.getTime() - DAY_MS);
    const to = new Date(now.getTime() + WINDOW_DAYS * DAY_MS);
    const items = await queryRecorded(from, to);
    const events = items
      .filter((e) => RECORDED.includes(e.status) && Boolean(e.publishedDate))
      .map(toFeedEvent);
    const body = {
      generatedAt: now.toISOString(),
      window: { from: from.toISOString(), to: to.toISOString() },
      access: 'elevated',
      count: events.length,
      events,
    };
    return ok({ headers: HEADERS, body });
  } catch (e) {
    console.error('allEvents failed', e);
    return serverError({ headers: HEADERS, body: { error: 'Could not read events', detail: String(e && e.message) } });
  }
}

// Its own query, so appEvents' stays as it is.
async function queryRecorded(from, to) {
  let result = await elevate(wixEventsV2.queryEvents)({ fields: FIELDSETS })
    .in('status', RECORDED)
    .ge('dateAndTimeSettings.endDate', from)
    .le('dateAndTimeSettings.startDate', to)
    .ascending('dateAndTimeSettings.startDate')
    .limit(PAGE_SIZE)
    .find();
  const items = [...result.items];
  for (let page = 1; result.hasNext(); page++) {
    if (page >= MAX_PAGES) throw new Error(`more than ${MAX_PAGES} pages of events`);
    result = await result.next();
    items.push(...result.items);
  }
  return items;
}

async function authorised(request) {
  try {
    const expected = await getSecret(TOKEN_SECRET);
    const header = request.headers.authorization || request.headers.Authorization || '';
    const given = header.replace(/^Bearer\s+/i, '');
    return Boolean(expected) && given === expected;
  } catch (e) {
    console.error(`appEvents: secret ${TOKEN_SECRET} unavailable`, e);
    return false;
  }
}

// Reads as a site visitor first, so the feed sees what the public site shows. If Wix refuses
// that, reads with elevated permissions; the status filter and isPublished still apply.
async function queryListed(from, to) {
  try {
    return { items: await queryAll(wixEventsV2.queryEvents, from, to), access: 'visitor' };
  } catch (e) {
    console.warn('appEvents: visitor query refused, trying elevated', e && e.message);
  }
  return { items: await queryAll(elevate(wixEventsV2.queryEvents), from, to), access: 'elevated' };
}

async function queryAll(queryEvents, from, to) {
  let result = await queryEvents({ fields: FIELDSETS })
    .in('status', LISTED)
    .ge('dateAndTimeSettings.endDate', from)
    .le('dateAndTimeSettings.startDate', to)
    .ascending('dateAndTimeSettings.startDate')
    .limit(PAGE_SIZE)
    .find();
  const items = [...result.items];
  for (let page = 1; result.hasNext(); page++) {
    if (page >= MAX_PAGES) throw new Error(`more than ${MAX_PAGES} pages of events`);
    result = await result.next();
    items.push(...result.items);
  }
  return items;
}

function isPublished(e) {
  return LISTED.includes(e.status) && Boolean(e.publishedDate);
}

// Velo names some fields differently from the REST API (_id, _createdDate) and returns Dates;
// this gives the REST names and ISO strings, keeping only what the app reads.
function toFeedEvent(e) {
  const dt = e.dateAndTimeSettings || {};
  const loc = e.location || {};
  const reg = e.registration || {};
  return {
    id: e._id || e.id,
    slug: e.slug,
    title: e.title,
    status: e.status,
    shortDescription: e.shortDescription,
    description: e.description,
    detailedDescription: typeof e.detailedDescription === 'string' ? e.detailedDescription : undefined,
    location: {
      name: loc.name,
      type: loc.type,
      locationTbd: loc.locationTbd,
      address: addressOf(loc.address),
    },
    dateAndTimeSettings: {
      dateAndTimeTbd: dt.dateAndTimeTbd,
      startDate: iso(dt.startDate),
      endDate: iso(dt.endDate),
      timeZoneId: dt.timeZoneId,
      hideEndDate: dt.hideEndDate,
      recurrenceStatus: dt.recurrenceStatus,
      recurringEvents: dt.recurringEvents ? { categoryId: dt.recurringEvents.categoryId } : undefined,
    },
    mainImage: imageOf(e.mainImage),
    eventPageUrl: pageUrlOf(e.eventPageUrl),
    registration: {
      type: reg.type,
      status: reg.status,
      external: reg.external ? { url: reg.external.url } : undefined,
    },
    categories: categoriesOf(e.categories),
    eventDisplaySettings: e.eventDisplaySettings,
    createdDate: iso(e._createdDate || e.createdDate),
    updatedDate: iso(e._updatedDate || e.updatedDate),
    publishedDate: iso(e.publishedDate),
  };
}

// The CATEGORIES fieldset's shape is unconfirmed: a list, or { categories: [...] }.
function categoriesOf(value) {
  const list = Array.isArray(value) ? value : (value && value.categories) || [];
  return list.map((c) => ({ id: c._id || c.id, name: c.name, states: c.states }));
}

// The venue's street address. Velo's names can differ from the REST API's (formatted,
// location, addressLine1, zipCode); this gives the REST names, so the app's mapper reads
// either. A venue address is public: the site shows it on every event page.
function addressOf(a) {
  if (!a || typeof a !== 'object') return undefined;
  const street = a.streetAddress || {};
  const geo = a.geocode || a.location || {};
  return {
    formattedAddress: a.formattedAddress || a.formatted || undefined,
    addressLine: a.addressLine || a.addressLine1 || undefined,
    addressLine2: a.addressLine2 || undefined,
    streetAddress: street.number || street.name ? { number: street.number, name: street.name, apt: street.apt } : undefined,
    city: a.city || undefined,
    subdivision: a.subdivision || undefined,
    postalCode: a.postalCode || a.zipCode || undefined,
    country: a.country || undefined,
    geocode:
      typeof geo.latitude === 'number' && typeof geo.longitude === 'number'
        ? { latitude: geo.latitude, longitude: geo.longitude }
        : undefined,
  };
}

// Velo may give the image as a wix:image:// address, a plain URL, or an object with url or id.
// Wix serves site media publicly at static.wixstatic.com/media/<file id>.
function imageOf(image) {
  if (!image) return undefined;
  const value = typeof image === 'string' ? image : image.url || image.id;
  if (!value) return undefined;
  if (value.startsWith('https://')) return { url: value };
  const match = /^wix:image:\/\/v1\/([^/#]+)/.exec(value);
  const fileId = match ? match[1] : /^[\w-]+~mv2\.\w+$/.test(value) ? value : null;
  return fileId ? { url: `https://static.wixstatic.com/media/${fileId}` } : undefined;
}

// Velo may give the page URL as one string or as { base, path }.
function pageUrlOf(page) {
  if (!page) return undefined;
  if (typeof page === 'string') {
    try {
      const url = new URL(page);
      return { base: url.origin, path: url.pathname };
    } catch (e) {
      return undefined;
    }
  }
  return page.base && page.path ? { base: page.base, path: page.path } : undefined;
}

function withoutStaffIds(e) {
  if (!e) return null;
  const { userId, instanceId, ...rest } = e;
  return rest;
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}
