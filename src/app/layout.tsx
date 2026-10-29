import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceProvider } from "@/components/workspace-provider";
export const metadata: Metadata = {
  title: {
    default: "Hutāśana · Business Workspace",
    template: "%s · Hutāśana",
  },
  description:
    "A thoughtfully connected workspace for modular kitchen sales, estimation and delivery.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
