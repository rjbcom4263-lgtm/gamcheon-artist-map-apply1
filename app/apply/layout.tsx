import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireArtist } from "../admin/admin-auth";

export const dynamic = "force-dynamic";

export default async function ApplyLayout({ children }: { children: ReactNode }) {
  const user = await requireArtist();
  if (!user) redirect("/signup?next=%2Fapply");
  return children;
}
