# AI-Ready Security Scanner

A Next.js application that scans the latest snapshot of a public GitHub repository for exposed secrets and known vulnerable dependencies. Scans run on demand; repository files are processed in memory and are not saved by the application.

## Quick start

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To create and run a production build locally:

```bash
npm run build
npm start
```

No GitHub token or local Git installation is needed for public repositories.

## Use the scanner

1. Paste a repository URL such as `https://github.com/owner/repo`.
2. Select **Scan Repository**. **Test Demo** scans the sample repository configured in the scanner page.
3. Review the score, coverage, checks, findings, and notes.
4. Download the text report or AI-friendly report, or use the HTML preview to download a PDF.

The scanner accepts HTTPS URLs on `github.com` and scans the repository's current default-branch snapshot. It does not inspect commit history, so a secret removed from the latest snapshot may still exist in earlier commits.

## What it checks

### Exposed secrets

Deterministic pattern rules look for credentials such as AWS keys, private keys, GitHub and service tokens, database connection strings, webhooks, and other likely secrets. Generic matches are filtered or assigned lower confidence where appropriate. Finding reports show masked values.

### Dependency vulnerabilities

The scanner reads supported manifests and lockfiles for npm, PyPI, Go, RubyGems, Cargo, Packagist, Maven, and NuGet. It checks pinned package versions against the npm advisory registry or OSV. A manifest without pinned versions may be reported as unresolved; unsupported formats are reported as unchecked.

### Score and coverage

The score is calculated from finding severity, confidence, and dependency scope, with score caps for certain serious findings. The grade mapping is:

| Score | Grade |
| --- | --- |
| 90–100 | A |
| 75–89 | B |
| 60–74 | C |
| 40–59 | D |
| 0–39 | F |

Coverage indicates how much of the applicable scan completed. Treat a provisional score as a lower bound on risk when checks were incomplete.

## Processing limits and privacy

- Only public GitHub repositories are supported.
- The archive limit is 50 MB compressed; the unpacked archive limit is 400 MB.
- Up to 40 MB of selected file text is retained in memory for scanning. Selected source and configuration files are limited to 1 MB each; dependency files, including lockfiles, are limited to 25 MB each.
- Repository content and scan results are not written to disk or persisted by the application. The scanner makes requests to GitHub and to npm or OSV for advisory data; dependency names and versions are included in those advisory lookups.
- The in-memory rate limiter allows up to 6 scan requests per IP in 10 minutes and 3 simultaneous scans per server instance. These limits reset when an instance restarts and are not shared across instances.

## Routes and project layout

- `app/(scanner)/page.tsx`: scanner UI and report downloads.
- `app/api/scan/route.ts`: scan endpoint, request limits, pipeline orchestration, and report response.
- `app/api/test/route.ts`: API health check.
- `lib/github.ts`: GitHub URL validation and bounded archive download.
- `lib/scanner.ts`, `lib/deps.ts`, `lib/patterns.ts`: file selection, secret checks, dependency parsing, advisory lookups, and scoring.
- `lib/report.ts`, `lib/report-ai.ts`, `lib/pdf-converter.ts`: report formats.

For a guided local setup and first scan, see [QUICKSTART.md](QUICKSTART.md).
