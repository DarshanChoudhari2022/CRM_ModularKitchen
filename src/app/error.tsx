"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty">
      <h1>The workspace could not be displayed.</h1>
      <p>Your saved records have not been deleted.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
