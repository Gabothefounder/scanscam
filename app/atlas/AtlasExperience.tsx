"use client";

import { useEffect, useState } from "react";
import AtlasWorld from "./AtlasWorld";
import CinematicJourney from "./CinematicJourney";

export default function AtlasExperience() {
  const [view, setView] = useState<"atlas" | "journey">("atlas");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "scan" || params.get("mode") === "learn" || params.get("journey") === "1") {
      setView("journey");
    }
  }, []);

  return view === "journey"
    ? <CinematicJourney />
    : <AtlasWorld onJourney={() => setView("journey")} />;
}
