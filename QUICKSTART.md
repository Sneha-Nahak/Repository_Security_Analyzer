# Quick Start

## Requirements

- Node.js
- npm

The scanner uses GitHub's archive endpoint, so Git does not need to be installed locally. A GitHub token is not required for public repositories.

## Install and run

From the project root:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scan a repository

1. Open the scanner page.
2. Enter a public repository URL, for example `https://github.com/owner/repo`.
3. Click **Scan Repository**. To try the configured sample repository, click **Test Demo**.
4. Review the scan status, score, coverage, findings, and any notes about checks that could not be completed.
5. Download the text or AI-friendly report, or open the HTML report preview and download a PDF.

The scanner fetches the current default-branch archive and analyzes it in memory. It checks selected source/configuration files for secret patterns and supported dependency manifests or lockfiles for known advisories. npm packages are checked against the npm advisory registry; other supported ecosystems use OSV.

## What to expect

- The scan covers the latest snapshot only; it does not inspect Git history.
- Only public GitHub repositories are supported.
- Dependency files without pinned versions and unsupported formats cannot receive a complete vulnerability check. The report explains incomplete coverage.
- Scan requests are limited to 50 MB compressed and 400 MB unpacked. Up to 40 MB of selected text is retained for scanning. Selected source and configuration files are limited to 1 MB each; dependency files, including lockfiles, are limited to 25 MB each.
- The application does not persist repository contents or scan results. It does contact GitHub and advisory services (npm or OSV) during a scan.

For implementation details and the full list of checks, see [README.md](README.md).
