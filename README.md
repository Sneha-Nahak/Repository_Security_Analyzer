# AI-Ready Security Scanner (SAST Pipeline)

An ephemeral, privacy-first security analysis pipeline for GitHub repositories.

## 🚀 Quick Start (Local Development)

```bash
npm install
npm run dev
```

Visit `http://localhost:3001`

## 🌐 Vercel Deployment (Production)

### Prerequisites
1. GitHub account with personal access token
2. Vercel account (free tier is fine)

### Setup Steps

1. **Generate GitHub Token**
   - Go to https://github.com/settings/tokens/new
   - Select scope: `repo`
   - Copy the token

2. **Deploy to Vercel**
   ```bash
   npm install -g vercel
   vercel
   ```

3. **Add Environment Variable**
   - In Vercel Dashboard → Project Settings → Environment Variables
   - Name: `GITHUB_TOKEN`
   - Value: Your GitHub token
   - Redeploy

### How It Works on Vercel

✅ **Uses GitHub API** (no git/npm required)
- Fetches repository files via GitHub REST API
- Scans for exposed secrets
- Checks against known vulnerable packages
- Generates security report

### Testing

- **Test Demo**: Works immediately without GitHub token
- **Scan Repository**: Enter any public GitHub URL

---

## Features

- **Ephemeral Processing**: Code is analyzed via GitHub API, no storage
- **AI-Independent**: Deterministic pattern matching + vulnerability database
- **Privacy-First**: No data is stored
- **Security Focused**: Scans for exposed secrets
- **Comprehensive Reporting**: Severity levels, security score (0-100)

## Secret Detection

Detects:
- AWS Access Keys (AKIA...)
- AWS Secret Keys
- GitHub Tokens
- MongoDB Connection URIs
- Private SSH Keys

## Vulnerability Detection

- **Known Vulnerable Packages**: lodash, moment, request, debug, etc.
- **Dependency Analysis**: Via GitHub API (public repos)
- **Severity Levels**: Critical, High, Moderate, Low

## Project Structure

```
.
├── app/
│   ├── api/
│   │   ├── scan/route.ts          # Main scan API (GitHub API based)
│   │   ├── scan-local/route.ts    # Test Demo endpoint
│   │   └── test/route.ts          # Health check
│   └── page.tsx                   # Frontend UI (light theme)
├── lib/
│   ├── scanner.ts                 # Original scanner (local dev)
│   ├── patterns.ts                # Secret patterns
│   └── pdf-generator.ts           # Report generation
├── test-repo/                     # Test files for demo
├── package.json
├── vercel.json                    # Vercel config
└── README.md
```

## Security Scoring

Score = 100 - penalties:
- Critical finding: -25
- High finding: -15
- Moderate finding: -8
- Low finding: -3

## Environment Variables

```bash
# Optional: For better rate limits
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Node environment
NODE_ENV=development
```

## Local Development

```bash
npm run dev
# http://localhost:3001

# Test with local test-repo or real GitHub URLs
```

## Production (Vercel)

✅ **100% Vercel compatible**
- No local binaries needed
- Uses GitHub API for analysis
- Auto-scaling serverless functions
- CDN edge network

## Limitations

⚠️ **Vercel Deployment**
- 60-second timeout (Hobby plan limit)
- Cannot scan private repos (unless authenticated)
- Vulnerable package list is static (not real-time like npm audit)

✅ **Local Development**
- Full npm audit support
- Can clone private repos (with credentials)
- Unlimited processing time
- Real-time dependency scanning

## Troubleshooting

**400 Bad Request on Vercel?**
- Ensure you're using `https://github.com/user/repo` format
- Check that the repository is public

**No findings detected?**
- Use "🧪 Test Demo" first to verify scanner works
- Real repos need actual vulnerabilities or secrets to show findings

**Want real-time npm audit?**
- Deploy locally with `npm run build && npm start`
- Or use Railway/Render (Docker support)

---

## Architecture Comparison

### Local Development
- Clone via `git`
- Real-time `npm audit`
- Full filesystem scanning
- Unlimited timeout

### Vercel Production
- GitHub API fetches files
- Static vulnerability database
- Pattern-based secret detection
- 60-second timeout

Both achieve the same security outcome with different mechanisms optimized for their environment.
