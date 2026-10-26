import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ensureWorkGuidesTable, getGuide, parseTranslations } from "../../work-guides/db";
import { GUIDE_LANGUAGES } from "../../work-guides/shared";
import GuideStory from "./GuideStory";
import "./work-guide.css";

export const dynamic = "force-dynamic";

export default async function WorkGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^WG-[0-9a-f-]{36}$/.test(id)) notFound();
  await ensureWorkGuidesTable();
  const guide = await getGuide(id);
  if (!guide?.published_title || !guide.published_description || !guide.published_image_key) notFound();
  const translations = parseTranslations(guide.translations_json);
  const preferred = (await headers()).get("accept-language")?.split(",").map((entry) => entry.trim().split(";")[0].split("-")[0].toLowerCase()) || [];
  const initialLanguage = preferred.find((code) => code === "ko" || GUIDE_LANGUAGES.some((language) => language.code === code && translations[code])) || "ko";
  return <GuideStory id={id} applicationId={guide.application_id} artistName={guide.artist_name} title={guide.published_title} description={guide.published_description} translations={translations} initialLanguage={initialLanguage}/>;
}
