"use client";
import ArchiveWelcome from "./ArchiveWelcome";
import type { ArchiveLang } from "./archiveData";
export default function AtlasExperience({ initialLang }: { initialLang?: ArchiveLang }) {
  return <ArchiveWelcome initialLang={initialLang} />;
}
