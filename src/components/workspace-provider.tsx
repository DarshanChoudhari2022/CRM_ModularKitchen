"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Actor, Command, Workspace } from "@/domain/types";
import { demoWorkspace } from "@/domain/seed";
import { execute } from "@/domain/commands";

const STORAGE = "hutashana-crm-demo-v1";
interface Store {
  workspace: Workspace | null;
  actor: Actor;
  demo: boolean;
  loading: boolean;
  error: string;
  busy: boolean;
  notice: string;
  organizationName: string;
  run: (command: Command) => Promise<boolean>;
  refresh: () => void;
  notify: (message: string) => void;
  clearError: () => void;
  resetDemo: () => void;
}
const Context = createContext<Store | null>(null);
export const useWorkspace = () => {
  const c = useContext(Context);
  if (!c) throw new Error("Workspace context missing");
  return c;
};
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [actor, setActor] = useState<Actor>({
      userId: "demo-owner",
      role: "owner",
    }),
    [organizationName, setOrganizationName] = useState("Hutāśana");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (demo) {
        const stored = localStorage.getItem(STORAGE);
        const next = stored ? JSON.parse(stored) : demoWorkspace();
        if (!next?.records || !next?.settings || !Array.isArray(next.jobs))
          throw new Error("Demo data is invalid. Use Reset demo in Settings.");
        setWorkspace(next);
        localStorage.setItem(STORAGE, JSON.stringify(next));
      } else {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setWorkspace(data.workspace);
        setActor(data.actor);
        setOrganizationName(data.organizationName);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load workspace.");
    } finally {
      setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const run = async (command: Command) => {
    if (!workspace || busy) return false;
    setBusy(true);
    setError("");
    try {
      let next: Workspace;
      if (demo) {
        const current = localStorage.getItem(STORAGE);
        if (current && JSON.parse(current).revision !== workspace.revision)
          throw new Error(
            "Demo changed in another tab. Refresh before retrying.",
          );
        next = execute(workspace, command, actor);
        localStorage.setItem(STORAGE, JSON.stringify(next));
      } else {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: workspace.revision, command }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        next = data.workspace;
      }
      setWorkspace(next);
      setNotice(
        command.type === "save"
          ? "Changes saved"
          : command.type === "import"
            ? "Import completed"
            : "Action completed",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const resetDemo = () => {
    if (!demo) return;
    localStorage.removeItem(STORAGE);
    void refresh();
  };
  return (
    <Context.Provider
      value={{
        workspace,
        actor,
        demo,
        loading,
        error,
        busy,
        notice,
        organizationName,
        run,
        refresh,
        notify: setNotice,
        clearError: () => setError(""),
        resetDemo,
      }}
    >
      {children}
    </Context.Provider>
  );
}
