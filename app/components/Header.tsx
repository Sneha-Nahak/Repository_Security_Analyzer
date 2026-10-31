export default function Header() {
  return (
    <header
      style={{
        background: "linear-gradient(to right, var(--color-primary), #2D5AA5)",
        color: "white",
      }}
      className="px-4 py-6 sm:px-8 sm:py-8"
    >
      <h1 className="text-2xl font-bold sm:text-4xl">Repository Security Analyzer</h1>
      <p className="mt-2 text-base sm:text-lg" style={{ color: "rgba(255,255,255,0.85)" }}>
        On-Demand Security Check
      </p>
    </header>
  );
}
