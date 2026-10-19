"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="page-container">
      <h1>Unable to load · Chargement indisponible</h1>
      <button className="primary-button" onClick={reset}>
        Try again · Réessayer
      </button>
    </main>
  );
}
