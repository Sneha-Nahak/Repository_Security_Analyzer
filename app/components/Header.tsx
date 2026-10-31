export default function Header() {
  return (
    <header className="site-header">
      <div className="site-brand">
        <span className="site-brand-mark" aria-hidden="true"><span /></span>
        <div className="site-brand-copy">
          <span className="site-brand-title">Repository Security Analyzer</span>
          <p>On-demand repository security</p>
        </div>
      </div>
      <div className="site-header-status">
        <span className="header-status-dot" />
        <span>Ephemeral by design</span>
        <span className="status-divider" />
        <span className="header-status-detail">Public repositories</span>
      </div>
    </header>
  );
}
