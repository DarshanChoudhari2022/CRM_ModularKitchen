"use client";
import Link from "next/link";
import { modules } from "@/config/modules";
import { canRead } from "@/domain/commands";
import { WorkspaceProvider, useWorkspace } from "./workspace-provider";
import { Shell } from "./shell";
import { Login } from "./login";
import { Dashboard } from "./dashboard";
import { CollectionView } from "./collection-view";
import { Reports } from "./reports";
import { Settings } from "./settings";
import { Integrations } from "./integrations";
function Content({ section }: { section: string }) {
  const { workspace, loading, actor } = useWorkspace();
  if (loading)
    return (
      <div className="loading-page">
        <div className="loading-mark">
          h<span>•</span>
        </div>
        <span>Putting everything in its place…</span>
        <div className="loading-track">
          <i />
        </div>
      </div>
    );
  if (!workspace) return <Login />;
  const sectionModule = modules.find((m) => m.slug === section);
  let content;
  if (sectionModule)
    content = canRead(actor.role, sectionModule.kind) ? (
      <CollectionView key={section} module={sectionModule} />
    ) : (
      <div className="empty">
        <h1>Access restricted</h1>
        <p>Your role does not include this module.</p>
      </div>
    );
  else if (section === "dashboard")
    content =
      actor.role === "installer" ? (
        <CollectionView module={modules.find((m) => m.kind === "task")!} />
      ) : (
        <Dashboard />
      );
  else if (section === "reports")
    content =
      actor.role === "installer" ? (
        <p>Reports are not available for this role.</p>
      ) : (
        <Reports />
      );
  else if (section === "settings") content = <Settings />;
  else if (section === "integrations")
    content =
      actor.role === "owner" ? (
        <Integrations />
      ) : (
        <p>Only the owner can manage integrations.</p>
      );
  else
    content = (
      <div className="empty">
        <h1>Page not found</h1>
        <Link className="button primary" href="/">
          Return to overview
        </Link>
      </div>
    );
  return <Shell section={section}>{content}</Shell>;
}
export function CRMApp({ section }: { section: string }) {
  return (
    <WorkspaceProvider>
      <Content section={section} />
    </WorkspaceProvider>
  );
}
