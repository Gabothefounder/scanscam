import type { Metadata } from "next";
import CinematicJourney from "../CinematicJourney";

export const metadata: Metadata = {
  title: "Tell us what happened — The Archive",
  description: "Turn what happened into a practical incident ledger and an anonymous signal that helps reveal recurring manipulation patterns.",
};

export default function ArchiveReportPage() {
  return <CinematicJourney />;
}
