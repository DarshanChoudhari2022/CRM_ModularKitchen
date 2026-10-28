import { CRMApp } from "@/components/crm-app";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  return <CRMApp section={section?.join("/") || "dashboard"} />;
}
