export type Severity = "critical" | "high" | "medium" | "low";

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/* ------------------------------------------------------------------ */
/* Secret rules                                                        */
/* ------------------------------------------------------------------ */

export interface SecretRule {
  id: string;
  label: string;
  /** Must carry the /g flag (it is used with matchAll). */
  regex: RegExp;
  severity: Severity;
  /**
   * 1 = the format is unmistakable (AKIA…, -----BEGIN PRIVATE KEY).
   * Lower values mean "looks like a secret but may be a false positive".
   * Scales the finding's weight in the score.
   */
  confidence: number;
  /** Capture group holding the secret value (used for placeholder/entropy checks and de-duplication). */
  valueGroup?: number;
  /** Minimum Shannon entropy (bits/char) of the value. Filters out "password123"-style noise. */
  minEntropy?: number;
  /** Only run on .env-style files. */
  envOnly?: boolean;
  /** If this matches the full match, confidence is cut to 30%. */
  weakIf?: RegExp;
  /** Extra explanation shown in the report. */
  note?: string;
}

export const SECRET_RULES: SecretRule[] = [
  {
    id: "aws_access_key",
    label: "AWS access key ID",
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    severity: "critical",
    confidence: 1,
  },
  {
    id: "aws_secret_key",
    label: "AWS secret access key",
    regex: /aws_?secret_?(?:access_)?key["']?[ \t]*[:=][ \t]*["']?([A-Za-z0-9/+=]{40})\b/gi,
    severity: "critical",
    confidence: 1,
    valueGroup: 1,
  },
  {
    id: "private_key",
    label: "Private key",
    regex: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g,
    severity: "critical",
    confidence: 1,
  },
  {
    id: "stripe_live",
    label: "Stripe live secret key",
    regex: /\b[sr]k_live_[0-9a-zA-Z]{24,}\b/g,
    severity: "critical",
    confidence: 1,
  },
  {
    id: "github_token",
    label: "GitHub token",
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g,
    severity: "high",
    confidence: 1,
  },
  {
    id: "anthropic_key",
    label: "Anthropic API key",
    regex: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/g,
    severity: "high",
    confidence: 1,
  },
  {
    id: "openai_key",
    label: "OpenAI API key",
    regex: /\bsk-(?!ant-)(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}\b/g,
    severity: "high",
    confidence: 0.9,
  },
  {
    id: "slack_token",
    label: "Slack token",
    regex: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/g,
    severity: "high",
    confidence: 1,
  },
  {
    id: "sendgrid_key",
    label: "SendGrid API key",
    regex: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g,
    severity: "high",
    confidence: 1,
  },
  {
    id: "npm_token",
    label: "npm access token",
    regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
    severity: "high",
    confidence: 1,
  },
  {
    id: "database_url",
    label: "Database URL with credentials",
    regex:
      /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/[^\s:@/'"`]+:([^\s@'"`/]+)@[^\s'"`]+/gi,
    severity: "high",
    confidence: 0.9,
    valueGroup: 1,
    weakIf: /@(?:localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal|db|postgres|mysql|mongo|redis)\b/i,
    note: "Connection strings pointing at localhost are usually development defaults.",
  },
  {
    id: "slack_webhook",
    label: "Slack webhook URL",
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{20,}/g,
    severity: "medium",
    confidence: 1,
  },
  {
    id: "discord_webhook",
    label: "Discord webhook URL",
    regex: /https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]{20,}/g,
    severity: "medium",
    confidence: 1,
  },
  {
    id: "google_api_key",
    label: "Google API key",
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    severity: "low",
    confidence: 1,
    note: "Firebase/Maps web keys are public by design. Make sure this key is restricted by HTTP referrer/API in the Google Cloud console.",
  },
  {
    id: "jwt",
    label: "JSON Web Token",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: "medium",
    confidence: 0.5,
    note: "May be a public/anon token (e.g. a Supabase anon key) or a long-lived credential.",
  },
  {
    id: "env_secret",
    label: "Secret value in environment file",
    regex:
      /^[ \t]*(?:export[ \t]+)?([A-Z][A-Z0-9_]*(?:SECRET|PASSWORD|PASSWD|TOKEN|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CREDENTIALS?)[A-Z0-9_]*)[ \t]*=[ \t]*["']?([^\s"']{8,})["']?(?:[ \t]+#.*)?[ \t]*$/g,
    severity: "high",
    confidence: 0.7,
    valueGroup: 2,
    minEntropy: 2.5,
    envOnly: true,
  },
  {
    id: "generic_secret",
    label: "Hardcoded credential",
    regex:
      /(?:secret|passw(?:or)?d|passwd|pwd|token|api[_-]?key|apikey|auth[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret)["']?[ \t]*[:=][ \t]*["']([^"'\s]{8,})["']/gi,
    severity: "medium",
    confidence: 0.4,
    valueGroup: 1,
    minEntropy: 3.2,
  },
];

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/**
 * Points of "risk" each finding adds before exposure/confidence multipliers.
 * Roughly mirrors how CVSS bands relate to each other.
 */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 0.5,
};

/** Dev-only dependencies never reach users, so they count for a fraction. */
export const DEV_MULTIPLIER = 0.2;

/** Extra advisories on the same package add 10% each, up to +50%. */
export const ADVISORY_BUMP = { perAdvisory: 0.1, max: 0.5 };

/**
 * score = 100 * exp(-risk / RISK_SCALE)
 * 5 risk (one high production issue) ≈ 90, 22 ≈ 64, 50 ≈ 37. Smooth, never saturates at 0.
 */
export const RISK_SCALE = 50;

/**
 * Hard ceilings, so serious problems can't be averaged away by clean code elsewhere.
 * A "confident" secret is one with confidence >= CONFIDENT_THRESHOLD.
 */
export const CONFIDENT_THRESHOLD = 0.8;
export const SCORE_CAPS = {
  confidentCriticalSecret: 40,
  confidentHighSecret: 55,
  criticalProductionVuln: 60,
  highProductionVuln: 80,
} as const;

export const GRADES: Array<{ min: number; grade: "A" | "B" | "C" | "D" | "F" }> = [
  { min: 90, grade: "A" },
  { min: 75, grade: "B" },
  { min: 60, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" },
];

/** Relative importance of each check when computing coverage. */
export const COVERAGE_WEIGHTS = { secrets: 40, dependencies: 60 } as const;