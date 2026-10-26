export const SECRET_PATTERNS = {
  aws_key: /AKIA[0-9A-Z]{16}/g,
  aws_secret: /aws_secret_access_key\s*=\s*['"](.*?)['"]/gi,
  stripe_live: /sk_live_[0-9a-zA-Z]{24,}/g,
  github_token: /ghp_[0-9a-zA-Z]{36}/g,
  private_key: /-----BEGIN\s+(RSA|OPENSSH|EC|PGP)\s+PRIVATE\s+KEY/g,
  mongodb_uri: /mongodb\+srv:\/\/[^\s@]+@[^\s:]+/gi,
};

export const SEVERITY_LEVELS = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "moderate",
  LOW: "low",
} as const;

export const PENALTY_WEIGHTS: Record<string, number> = {
  critical_secret: 30,
  high_secret: 20,
  medium_secret: 10,
  critical_vuln: 25,
  high_vuln: 15,
  medium_vuln: 8,
  low_vuln: 3,
};
