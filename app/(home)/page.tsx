import type { Metadata } from "next";
import Link from "next/link";
import {
  FiActivity,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiChevronRight,
  FiFileText,
  FiKey,
  FiPackage,
  FiShield,
} from "react-icons/fi";

const description =
  "Scan public GitHub repositories for exposed secrets and known dependency vulnerabilities. Review security scores, findings, and clear AI-ready or PDF reports with Ephemeral.";

export const metadata: Metadata = {
  title: "AI-Ready Repository Security Scanner",
  description,
  keywords: [
    "GitHub repository security scanner",
    "secret scanning",
    "dependency vulnerability scanner",
    "AI-ready security reports",
  ],
  openGraph: {
    title: "AI-Ready Repository Security Scanner | Ephemeral",
    description,
  },
  twitter: {
    card: "summary",
    title: "AI-Ready Repository Security Scanner | Ephemeral",
    description,
  },
};

const capabilities = [
  {
    icon: FiKey,
    title: "Find exposed secrets",
    description:
      "Check repository files for credentials and tokens that could put a project at risk.",
  },
  {
    icon: FiPackage,
    title: "Review dependency risk",
    description:
      "Check supported package manifests and lockfiles for known vulnerable versions.",
  },
  {
    icon: FiFileText,
    title: "Get clear reports",
    description:
      "Review a security score and findings, then export a PDF report or AI-ready prompt.",
  },
];

export default function HomePage() {
  return (
    <main id="main-content" className="home-main" tabIndex={-1}>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="home-eyebrow">
            <span className="home-eyebrow-dot" aria-hidden="true" />
            Repository security, in focus
          </p>
          <h1 id="home-title">Understand your repository&apos;s security posture.</h1>
          <p className="home-lede">
            Scan a public GitHub repository for exposed secrets and known dependency
            vulnerabilities. Get a clear score, prioritized findings, and reports you can act on.
          </p>
          <div className="home-actions">
            <Link href="/scanner" className="home-primary-link">
              Get started <FiArrowRight aria-hidden="true" />
            </Link>
            <Link href="/overview" className="home-secondary-link">
              Explore how it works <FiChevronRight aria-hidden="true" />
            </Link>
          </div>
          <ul className="home-assurances" aria-label="Scanner details">
            <li><FiCheckCircle aria-hidden="true" /> Public repositories</li>
            <li><FiActivity aria-hidden="true" /> On-demand scans</li>
            <li><FiShield aria-hidden="true" /> Security-focused reports</li>
          </ul>
        </div>

        <div className="home-preview" aria-hidden="true">
          <div className="home-preview-topline">
            <span><span className="home-preview-dot" /> Analysis workspace</span>
            <span className="home-preview-badge">Ready to scan</span>
          </div>
          <div className="home-preview-core">
            <div className="home-preview-shield"><FiShield /></div>
            <div>
              <span className="home-preview-label">EPHEMERAL SCANNER</span>
              <p>Repository analysis</p>
              <small>Secrets and dependencies, in one clear view</small>
            </div>
          </div>
          <div className="home-preview-rows">
            {capabilities.map(({ icon: Icon, title }) => (
              <div className="home-preview-row" key={title}>
                <span className="home-preview-row-icon"><Icon /></span>
                <span>{title}</span>
                <FiCheck className="home-preview-check" />
              </div>
            ))}
          </div>
          <div className="home-preview-footer">
            <span><span className="home-preview-dot" /> Ready when you are</span>
            <span>No repository data saved</span>
          </div>
        </div>
      </section>

      <section className="home-capabilities" aria-labelledby="capabilities-title">
        <div className="home-section-heading">
          <p className="home-eyebrow">A CLEAR FIRST PASS</p>
          <h2 id="capabilities-title">From repository URL to useful security insights.</h2>
        </div>
        <div className="home-feature-grid">
          {capabilities.map(({ icon: Icon, title, description: featureDescription }) => (
            <article className="home-feature-card" key={title}>
              <span className="home-feature-icon" aria-hidden="true"><Icon /></span>
              <h3>{title}</h3>
              <p>{featureDescription}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-bottom-cta" aria-labelledby="home-cta-title">
        <div>
          <p className="home-eyebrow">YOUR NEXT STEP</p>
          <h2 id="home-cta-title">Start with a public GitHub repository.</h2>
          <p>Review the findings, understand the score, and choose the report format that works for you.</p>
        </div>
        <Link href="/scanner" className="home-primary-link">
          Open scanner <FiArrowRight aria-hidden="true" />
        </Link>
      </section>

      <footer className="home-footer">
        <p>Repository contents and scan results are processed in memory and aren&apos;t persisted by the app.</p>
        <nav aria-label="Footer navigation">
          <Link href="/overview">Overview</Link>
          <Link href="/scanner">Scanner</Link>
        </nav>
      </footer>
    </main>
  );
}
