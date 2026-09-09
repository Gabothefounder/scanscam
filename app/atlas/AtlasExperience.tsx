"use client";
import ArchiveExplorer from "./ArchiveExplorer";
import type { ArchiveLang } from "./archiveData";
export default function AtlasExperience({ initialLang, initialPattern }: { initialLang?: ArchiveLang; initialPattern?: string }) {
  return <ArchiveExplorer initialLang={initialLang} initialPattern={initialPattern} />;
}
