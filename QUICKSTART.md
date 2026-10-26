# Quick Start Guide

## Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Using the Scanner

1. **Enter Repository URL**: Paste a GitHub repository URL (e.g., `https://github.com/username/repo`)
2. **Start Scan**: Click the "Start Scan" button
3. **Pipeline Status**: Watch the progress through stages:
   - Cloning project
   - Executing security algorithms
   - Compiling report
4. **Download Report**: PDF automatically downloads when complete

## What Gets Scanned

### Secret Detection
- AWS access keys and secrets
- Stripe API keys (live and test)
- GitHub tokens
- Private SSH/RSA keys
- MongoDB connection strings
- Generic API keys

### Dependency Vulnerabilities
- Runs `npm audit` on package.json
- Reports critical and high severity issues

### Scoring System
- Starts at 100 points
- Deductions for each finding:
  - Exposed secrets: -20 to -30
  - Critical dependency: -25
  - High vulnerability: -15
  - Medium vulnerability: -8

## Privacy

- **Ephemeral**: Code is stored only in temporary OS memory during scan
- **Auto-cleanup**: Everything is deleted immediately after report generation
- **No logging**: Scan results are not saved or analyzed

## Production Deployment

```bash
npm run build
npm start
```

The application runs on port 3000 by default.

## Troubleshooting

### "Failed to clone repository"
- Ensure the GitHub URL is public and accessible
- Verify the repository exists

### "Scan failed"
- Check available disk space for temp files
- Ensure git is installed and available in PATH

## Architecture Overview

```
User Input
    ↓
GitHub Clone (ephemeral /tmp)
    ↓
Secret Pattern Matching + npm audit
    ↓
Security Score Calculation
    ↓
PDF Generation
    ↓
Stream to Browser
    ↓
Auto Cleanup
```
