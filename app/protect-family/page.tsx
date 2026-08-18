import type { Metadata } from "next";
import FamilyProtectLanding from "@/components/FamilyProtectLanding";
import { FAMILY_PROTECT_COPY } from "@/lib/family-protect/copy";

export const metadata: Metadata = {
  title: FAMILY_PROTECT_COPY.en.metaTitle,
  description: FAMILY_PROTECT_COPY.en.metaDescription,
};

export default function ProtectFamilyPage() {
  return <FamilyProtectLanding lang="en" />;
}
