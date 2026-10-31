/**
 * Every external host the scanner talks to. They are fixed constants in
 * production; tests overwrite them to point at local servers. Nothing here is
 * ever derived from user input.
 */
export const endpoints = {
  /** `${archive}/<owner>/<repo>/archive/HEAD.tar.gz` redirects to codeload.github.com. */
  archive: "https://github.com",
  /** Hosts a redirected archive download may end up on. */
  archiveHosts: ["codeload.github.com"] as string[],
  npmAdvisories: "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
  osv: "https://api.osv.dev",
};

export const limits = {
  maxDownloadBytes: 50 * 1024 * 1024, // compressed archive
  maxUnpackedBytes: 400 * 1024 * 1024, // sum of every entry (zip-bomb guard)
  maxStoredBytes: 40 * 1024 * 1024, // text kept in memory for scanning
  maxFileBytes: 1024 * 1024,
  maxLockfileBytes: 25 * 1024 * 1024,
  maxLineLength: 5000,
  maxFindingsReturned: 300,
  fetchTimeoutMs: 30_000,
  /** Total wall-clock budget for the dependency lookups. */
  advisoryBudgetMs: 25_000,
};