// pnpm data:check: data/ holds only site.json, valid against SiteSettings in packages/domain.

import path from "node:path";
import { checkData } from "./check-data.ts";

const DATA = path.resolve(import.meta.dirname, "../../../data");

const { files, errors } = await checkData(DATA);
for (const error of errors) console.error(error);
console.log(`data:check: ${String(files)} files read, ${String(errors.length)} problems.`);
if (errors.length > 0) process.exitCode = 1;
