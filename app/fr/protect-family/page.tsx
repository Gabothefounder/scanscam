import type { Metadata } from "next";
import FamilyProtectLanding from "@/components/FamilyProtectLanding";
import { FAMILY_PROTECT_COPY } from "@/lib/family-protect/copy";

export const metadata: Metadata = {
  title: FAMILY_PROTECT_COPY.fr.metaTitle,
  description: FAMILY_PROTECT_COPY.fr.metaDescription,
};

export default function ProtectFamilyFrPage() {
  return <FamilyProtectLanding lang="fr" />;
}
