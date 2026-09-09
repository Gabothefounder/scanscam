import type { Metadata } from "next";
import AtlasExperience from "./AtlasExperience";

export const metadata: Metadata = {
  title: "The Vigil — ScanScam",
  description:
    "See the pattern, report what happened, and become harder to fool.",
};

export default function AtlasPage() {
  return <AtlasExperience />;
}

