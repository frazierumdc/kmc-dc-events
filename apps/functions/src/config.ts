// What the functions know about their own deployment, in this one module: the project
// Firebase runs them in, the region, the stage's sites and the accounts each function runs
// as. options.ts takes the result. The stage and secrets are Firebase parameters
// (options.ts), which the functions deploy writes; docs/configuration.md lists them.

/** The region of every function, task queue and job. The app builds notifyLists' address from the same name. */
export const REGION = "us-east4";

/**
 * The app's own addresses, one per stage (D27): notifyLists answers them as well as the
 * stage's Hosting addresses. A placeholder host in this copy (docs/configuration.md).
 */
export const APP_ORIGINS = /^https:\/\/events(\.(dev|test))?\.example\.org$/;

export interface FunctionsConfig {
  /** The whole environment, for the Google sign-in. */
  env: Record<string, string | undefined>;
  /** GCLOUD_PROJECT: set by Firebase, both when it deploys a function and when it runs; "" otherwise. */
  project: string;
  region: string;
  /** The stage's own site, where its schedule is published: the check compares with it (D64). */
  site: string;
  /** The origins notifyLists answers: the Hosting addresses and the app's own address (D27). */
  appOrigins: (string | RegExp)[];
  /** An account of the stage's project, in full: the Firebase CLI doesn't expand "name@". */
  serviceAccount: (name: string) => string;
}

/** The deployment `env` describes. Pure. */
export function readFunctionsConfig(env: Record<string, string | undefined>): FunctionsConfig {
  const project = env.GCLOUD_PROJECT ?? "";
  const site = `https://${project}.web.app`;
  return {
    env,
    project,
    region: REGION,
    site,
    appOrigins: [site, `https://${project}.firebaseapp.com`, APP_ORIGINS],
    serviceAccount: (name) => `${name}@${project}.iam.gserviceaccount.com`,
  };
}

/** This process's deployment. */
export function functionsConfig(): FunctionsConfig {
  return readFunctionsConfig(process.env);
}
