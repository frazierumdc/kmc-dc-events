import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { SiteSettings, storyPath, thumbnailPath } from "@kmcdc/domain";

/** The center and its website (D36): `data/site.json`, edited by pull request (D42). */
export const SITE_FILE = "site.json";

/**
 * Other centers' events' pictures (D67), kept in the repository as their files on the site:
 * each event's thumbnail and story picture, as JPEG.
 */
export const PICTURES_DIR = "pictures";

export interface DataCheck {
  files: number;
  errors: string[];
}

/**
 * Checks `dataDir` (docs/architecture/data-model.md): it holds `site.json` and `pictures/`
 * and nothing else (the schedule is never in the repository, D38), `site.json` matches
 * `SiteSettings`, and `pictures/` holds both pictures of each other center's event with one,
 * as JPEG, and nothing else.
 */
export async function checkData(dataDir: string): Promise<DataCheck> {
  const errors: string[] = [];
  const entries: string[] = await readdir(dataDir).catch(() => []);
  for (const name of entries
    .filter((n) => n !== SITE_FILE && n !== PICTURES_DIR && !n.startsWith("."))
    .sort())
    errors.push(`${name}: not a data file; data/ holds only ${SITE_FILE} and ${PICTURES_DIR}/`);
  if (!entries.includes(SITE_FILE))
    return { files: 0, errors: [...errors, `${SITE_FILE}: missing`] };

  let json: unknown;
  try {
    json = JSON.parse(await readFile(path.join(dataDir, SITE_FILE), "utf8"));
  } catch (error) {
    return { files: 1, errors: [...errors, `${SITE_FILE}: ${(error as Error).message}`] };
  }
  const parsed = SiteSettings.safeParse(json);
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      const where = i.path.map(String).join(".");
      errors.push(`${SITE_FILE}${where ? ` ${where}` : ""}: ${i.message}`);
    }
    return { files: 1, errors };
  }

  // Each other center's event's two pictures, and nothing else.
  const dir = path.join(dataDir, PICTURES_DIR);
  const stored = (await readdir(dir).catch(() => [] as string[])).filter((n) => !n.startsWith("."));
  const wanted = new Map<string, string>();
  for (const e of parsed.data.otherCenterEvents)
    if (e.picture)
      for (const file of [thumbnailPath(e.picture), storyPath(e.picture)])
        wanted.set(path.basename(file), e.id);
  let files = 1;
  for (const [name, id] of wanted) {
    if (!stored.includes(name)) {
      errors.push(`${PICTURES_DIR}/${name}: missing; ${id}'s picture is kept here (D67)`);
      continue;
    }
    files += 1;
    const head = (await readFile(path.join(dir, name))).subarray(0, 3);
    if (!(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff))
      errors.push(`${PICTURES_DIR}/${name}: not a JPEG`);
  }
  for (const name of stored.filter((n) => !wanted.has(n)).sort())
    errors.push(
      `${PICTURES_DIR}/${name}: no other center's event in ${SITE_FILE} has this picture`,
    );
  return { files, errors };
}
