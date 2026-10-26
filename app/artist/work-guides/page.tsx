import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireArtist } from "../../admin/admin-auth";
import { ensureApplicationsTable } from "../../applications-db";
import type { SourceWork } from "../../work-guides/sources";
import ArtistWorkGuides from "./ArtistWorkGuides";
import "./work-guides.css";

export default async function ArtistWorkGuidesPage() {
  const artist = await requireArtist();
  if (!artist) redirect("/login?next=/artist/work-guides");
  await ensureApplicationsTable();
  const application = await env.DB.prepare("SELECT payload_json, image_keys_json FROM artist_applications WHERE account_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1")
    .bind(artist.accountId).first<{ payload_json: string; image_keys_json: string }>();
  let sources: SourceWork[] = [];
  if (application) {
    try {
      const payload = JSON.parse(application.payload_json) as { works?: { title?: string; description?: string }[] };
      const images = JSON.parse(application.image_keys_json) as { type?: string; workIndex?: number; key?: string }[];
      sources = (payload.works || []).flatMap((work, index) => {
        const imageKey = images.find((image) => image.type === "work" && image.workIndex === index)?.key;
        return imageKey ? [{ index, title: work.title || "", description: work.description || "", imageKey }] : [];
      });
    } catch { /* Incomplete legacy applications can still add a new work manually. */ }
  }
  return <ArtistWorkGuides sources={sources} approved={Boolean(application)}/>;
}
