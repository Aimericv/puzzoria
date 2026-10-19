import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-container">
      <span className="eyebrow">404 · Puzzoria</span>
      <h1>Puzzle unavailable · Défi indisponible</h1>
      <p className="page-intro">
        Choose a published challenge / Choisissez un défi publié.
      </p>
      <Link className="primary-button" href="/" style={{ marginTop: 24 }}>
        Puzzoria
      </Link>
    </main>
  );
}
