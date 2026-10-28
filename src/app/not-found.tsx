import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty">
      <h1>This page is not here.</h1>
      <Link href="/">Return to the workspace</Link>
    </main>
  );
}
