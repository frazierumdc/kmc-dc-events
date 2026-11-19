// pnpm mail:authorize <project-id> [--from <sending address>] [--new-client]
//
// Signs the stage's sending account in to Google once and stores the sign-in in that
// stage's own Google project, in Secret Manager (D60, docs/architecture/email.md
// §Setup). Nothing is written to a file and nothing is printed:
//
// - The project is named on the command line: the stage's own, where its jobs run.
// - The sending account is the send-email job's own MAIL_FROM setting, read from Cloud Run;
//   before the job exists, name it with --from. Nothing is read from GitHub (D57).
// - The sign-in client is read from the project's GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET;
//   with --new-client (or when they are empty) it asks for them, the secret in a hidden
//   prompt, and stores them there.
// - Google is told to expect that sending account, and a sign-in
//   by any other account is refused and stores nothing.
// - The refresh token is added as a new version of GMAIL_REFRESH_TOKEN; older versions are
//   disabled.
//
// Needs gcloud signed in with access to the project's secrets and its Cloud Run jobs.
// Run it in zsh, not through `!`: it asks for input. The secrets are made by
// scripts/setup-mail-secrets.sh.

import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { GMAIL_SCOPE, TOKEN_URL } from "./gmail.ts";
import { GROUPS_SCOPE } from "./groups.ts";
import {
  ask,
  describeJobArgs,
  jobSetting,
  parseAuthorizeArgs,
  SEND_EMAIL_JOB,
  sendingAddress,
  signedInAs,
} from "./authorize-args.ts";

const args = parseAuthorizeArgs(process.argv.slice(2));
if ("error" in args) {
  console.error(args.error);
  process.exit(2);
}
const { project } = args;

// The job's own setting; a job that isn't there yet, or can't be read, gives none.
const mailFrom =
  args.from ??
  jobSetting(await run("gcloud", describeJobArgs(project)).catch(() => ""), "MAIL_FROM");
const account = sendingAddress(mailFrom);
if (!account) {
  console.error(
    `The job ${SEND_EMAIL_JOB} in ${project} has no MAIL_FROM setting, or can't be read. Set it on the job (Cloud Run → Jobs → ${SEND_EMAIL_JOB} → Edit), or name the sending account with --from.`,
  );
  process.exit(2);
}
console.log(`Google project ${project}, sending account ${account}`);

let clientId = args.newClient ? "" : await readSecret("GMAIL_CLIENT_ID");
let clientSecret = args.newClient ? "" : await readSecret("GMAIL_CLIENT_SECRET");
if (!clientId || !clientSecret) {
  console.log("The sign-in client (Google Auth Platform → Clients, Desktop app):");
  clientId = (await ask("Client ID: ")).trim();
  clientSecret = (await ask("Client secret (hidden): ", { hidden: true })).trim();
  if (!clientId || !clientSecret) {
    console.error("Both the client ID and the client secret are needed.");
    process.exit(2);
  }
}

// PKCE and state, so only this run can use the code Google sends back.
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = randomBytes(16).toString("base64url");

const code = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const error = url.searchParams.get("error");
    const received = url.searchParams.get("code");
    const ok = !error && received && url.searchParams.get("state") === state;
    res.writeHead(ok ? 200 : 400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(ok ? "Signed in. You can close this tab." : `Sign-in failed: ${error ?? "bad state"}`);
    server.close();
    if (ok) resolve({ code: received, redirectUri });
    else reject(new Error(`Sign-in failed: ${error ?? "the reply didn't match this request"}`));
  });
  let redirectUri = "";
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No port");
    redirectUri = `http://127.0.0.1:${address.port}`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      // openid and email: Google says which account signed in, checked below.
      scope: `openid email ${GMAIL_SCOPE} ${GROUPS_SCOPE}`,
      login_hint: account,
      access_type: "offline",
      prompt: "consent",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    }).toString();
    console.log(`Opening Google sign-in. Sign in as ${account}; allow sending and viewing groups.`);
    console.log("If Google picks another account, open the link below in a private window.");
    console.log(`If no browser opens, visit:\n${authUrl.toString()}\n`);
    execFile("open", [authUrl.toString()], () => undefined);
  });
});

const response = await fetch(TOKEN_URL, {
  method: "POST",
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code.code,
    code_verifier: verifier,
    redirect_uri: code.redirectUri,
    grant_type: "authorization_code",
  }),
});
const body = (await response.json()) as {
  refresh_token?: string;
  id_token?: string;
  error?: string;
};
if (!response.ok || !body.refresh_token) {
  console.error(`Google didn't return a refresh token (${body.error ?? response.status}).`);
  process.exit(1);
}
const signedIn = signedInAs(body.id_token);
if (signedIn !== account) {
  console.error(
    `Signed in as ${signedIn ?? "an unknown account"}, but ${project} sends as ${account}. Nothing stored: run it again and sign in as ${account}, in a private window if Google picks another account.`,
  );
  process.exit(1);
}

if (args.newClient || !(await readSecret("GMAIL_CLIENT_ID"))) {
  await storeSecret("GMAIL_CLIENT_ID", clientId);
  await storeSecret("GMAIL_CLIENT_SECRET", clientSecret);
}
await storeSecret("GMAIL_REFRESH_TOKEN", body.refresh_token);
console.log(`Stored the sign-in in ${project}'s Secret Manager (not shown).`);

/** The secret's latest version, or "" when it has none. */
async function readSecret(name: string): Promise<string> {
  try {
    return await run("gcloud", [
      "secrets",
      "versions",
      "access",
      "latest",
      "--secret",
      name,
      "--project",
      project,
    ]);
  } catch {
    return "";
  }
}

/** Adds the value as the secret's newest version, read from stdin, and disables the older ones. */
async function storeSecret(name: string, value: string) {
  const added = await run(
    "gcloud",
    [
      "secrets",
      "versions",
      "add",
      name,
      "--data-file=-",
      "--project",
      project,
      "--format=value(name)",
    ],
    value,
  );
  const newest = added.trim().split("/").at(-1);
  const enabled = await run("gcloud", [
    "secrets",
    "versions",
    "list",
    name,
    "--project",
    project,
    "--filter=state:ENABLED",
    "--format=value(name)",
  ]);
  for (const version of enabled.split("\n").map((v) => v.trim().split("/").at(-1))) {
    if (!version || version === newest) continue;
    await run("gcloud", [
      "secrets",
      "versions",
      "disable",
      version,
      "--secret",
      name,
      "--project",
      project,
      "--quiet",
    ]);
  }
}

/** Runs a command; the value, if any, goes to its stdin, never its command line. */
function run(command: string, argv: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (status) => {
      if (status === 0) resolve(out);
      else reject(new Error(`${command} ${argv.slice(0, 3).join(" ")} failed: ${err.trim()}`));
    });
    child.stdin.end(input ?? "");
  });
}
