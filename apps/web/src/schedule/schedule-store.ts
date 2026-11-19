import { openDB, type IDBPDatabase } from "idb";
import { readDownload, type Schedule } from "./schedule.ts";

/**
 * The last good schedule, kept on the phone in IndexedDB so the list shows at once and
 * without a connection (EV-18, NFR-1, NFR-4). It is kept exactly as downloaded and checked
 * against schema 2 each time it's read, so a field an older version of the app didn't know
 * (such as the categories' kinds, D45) is still there for a newer one. Anything broken
 * counts as nothing stored. Copies kept the old way, already checked by an older version,
 * are dropped, so each phone downloads the schedule once more. Storage can be missing or
 * fail (private browsing, full disk): reading then gives null and saving fails quietly.
 */

export interface ScheduleStore {
  read: () => Promise<Schedule | null>;
  write: (schedule: Schedule) => Promise<void>;
}

const DB_NAME = "kmc-dc-events";
const DB_VERSION = 2;
/** Version 1 kept the checked schedule here. */
const OLD_STORE = "schedule";
const STORE = "downloads";
const KEY = "current";

function open(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (db.objectStoreNames.contains(OLD_STORE)) db.deleteObjectStore(OLD_STORE);
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    },
  });
}

export const indexedDbStore: ScheduleStore = {
  async read() {
    try {
      const db = await open();
      const raw: unknown = await db.get(STORE, KEY);
      db.close();
      return parseStored(raw);
    } catch {
      return null;
    }
  },
  async write(schedule) {
    try {
      const db = await open();
      await db.put(STORE, schedule.download, KEY);
      db.close();
    } catch {
      // Not kept this time; the next good load tries again.
    }
  },
};

function parseStored(raw: unknown): Schedule | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { manifest, snapshot } = raw as Record<string, unknown>;
  return readDownload({ manifest, snapshot });
}
