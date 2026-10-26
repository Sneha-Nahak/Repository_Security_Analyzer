# AI-Ready Security Scanner (SAST Pipeline)

An ephemeral, privacy-first security analysis pipeline for GitHub repositories.

## Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:3001`

## Debugging

If you see a clean report for all repos:

1. **Check the browser console** - Look for `[API]`, `[SCAN]`, `[SECRET_SCAN]`, `[DEP_SCAN]` logs
2. **Test with a known vulnerable repo**: Visit `http://localhost:3001/api/scan-test` to see diagnostic output
3. **Check Node terminal** - All scan logs are printed to stdout

## Features

- **Ephemeral Processing**: Code is cloned to temp storage, scanned, and immediately purged
- **AI-Independent**: Uses deterministic pattern matching and npm audit for vulnerabilities
- **Privacy-First**: No data is stored long-term
- **Security Focused**: Scans for exposed secrets in all files (.env, .json, .yml, code files)
- **Comprehensive Reporting**: Severity levels, counts, and remediation guidance

## Architecture

### 4-Stage Pipeline

1. **Ingestion & Isolation**: Clone repo to isolated temp directory using `mkdtemp()`
2. **Security Scan**: 
   - Pattern matching for secrets (AWS, GitHub tokens, private keys, etc.)
   - npm audit for dependency vulnerabilities
3. **Scoring**: Calculate security score (0-100) with penalty weights per issue type
4. **Report Generation**: Stream text report directly to browser, then cleanup

### Vulnerability Detection

- **Secrets**: AWS keys, GitHub tokens, private SSH keys, MongoDB URIs
- **Dependencies**: npm audit results showing all severity levels (critical, high, moderate, low)
- **Coverage**: Scans code files (.js, .ts, .py, etc.) AND config files (.env, .json, .yml, .properties)

## Project Structure

```
.
├── app/
│   ├── api/
│   │   ├── scan/route.ts          # Main scan API
│   │   ├── scan-test/route.ts     # Diagnostic test endpoint
│   │   └── test/route.ts          # Health check
│   ├── page.tsx                   # Frontend UI
│   ├── layout.tsx                 # Root layout
│   └── globals.css                # Tailwind styles
├── lib/
│   ├── scanner.ts                 # Core scanning logic (secret + dependency scanning)
│   ├── patterns.ts                # Secret patterns & scoring weights
│   └── pdf-generator.ts           # Report generation
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

## API

### POST /api/scan

Request:
```json
{
  "repoUrl": "https://github.com/user/repo"
}
```

Response: Text file (text/plain) with security report

### GET /api/scan-test

Diagnostic endpoint - scans a known repo and returns JSON results for debugging

## Security Scoring

Starts at 100 points, deductions per unique vulnerability:
- Exposed secrets: -20 to -30 points
- Critical dependencies: -25 points
- High vulnerabilities: -15 points
- Moderate vulnerabilities: -8 points
- Low vulnerabilities: -3 points

## Environment

- Node.js 18+
- Next.js 15+ (App Router)
- No database required (ephemeral in-memory)

## Production Deployment

1. Set `NODE_ENV=production`
2. Run `npm run build && npm start`
3. Ensure `/tmp` or temp directory has sufficient space
4. Consider rate limiting on `/api/scan` endpoint
5. Monitor server logs for scan activity

## Troubleshooting

**All repos show clean reports:**
- Check if the repos actually have vulnerabilities or secrets
- Use `/api/scan-test` to debug
- Check browser and terminal console for error logs

**Timeout errors:**
- Reduce `--depth 1` to clone faster
- Increase timeout in route.ts if needed
- Large repos may take longer

**No dependencies found:**
- Repo must have `package.json` and preferably `package-lock.json`
- npm audit requires npm 6+ installed

