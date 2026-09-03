import type { Metadata } from "next";
import AtlasExperience from "./AtlasExperience";

export const metadata: Metadata = {
  title: "Atlas of Deception — ScanScam",
  description:
    "Explore how deception uses emotion, pressure, and trust—and find a path back to clear judgment.",
};

export default function AtlasPage() {
  return <AtlasExperience />;
}
