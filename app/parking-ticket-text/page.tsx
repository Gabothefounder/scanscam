import type { Metadata } from "next";
import ParkingTicketTextClient from "./ParkingTicketTextClient";

export const metadata: Metadata = {
  title: "Parking ticket text — what to do next | ScanScam",
  description:
    "Got a suspicious parking or traffic text? Answer a few questions and get a free, practical checklist before you click or pay. No email required.",
};

export default function ParkingTicketTextPage() {
  return <ParkingTicketTextClient />;
}
