import { NextRequest, NextResponse } from "next/server";
import { formatLandscapeLabel } from "@/app/components/charts/utils";

/**
 * Public-safe weekly brief payload.
 * Exposes only data suitable for the public brief page; does not expose
 * operational metrics, geography, recent signal content, or timelines.
 * Derived fields (fraud_label, how_it_works, protection_tip) are generic
 * sentences based only on aggregate narrative/channel/authority data.
 */
export type BriefWeeklyResponse = {
  week_start: string;
  generated_at: string;
  scan_count: number;
  top_narrative: string;
  top_channel: string;
  top_authority: string | null;
  top_payment_method: string | null;
  fraud_label: string;
  how_it_works: string;
  protection_tip: string;
  narratives: { value: string; scan_count: number; share_of_week: number }[];
  channels: { value: string; scan_count: number; share_of_week: number }[];
};

/** Internal radar payload shape (subset we consume). */
type RadarPayload = {
  week_start?: string;
  generated_at?: string;
  system_health?: { scan_count?: number };
  fraud_landscape?: {
    narratives?: { value: string; scan_count: number; share_of_week: number }[];
    channels?: { value: string; scan_count: number; share_of_week: number }[];
    authority_types?: { value: string; scan_count: number; share_of_week: number }[];
    payment_methods?: { value: string; scan_count: number; share_of_week: number }[];
  };
};

/** Generic "how it works" sentences keyed by dominant narrative (raw value). Safe, non-sensitive. */
const HOW_IT_WORKS: Record<string, string> = {
  delivery_scam:
    "Scammers send messages about a missed delivery or package, then ask you to pay a fee or click a link to reschedule. The link may steal your details or install malware.",
  government_impersonation:
    "Fraudsters pretend to be a government agency (tax, immigration, or benefits) and claim you owe money or must act immediately. They often demand payment by gift cards, crypto, or wire.",
  financial_phishing:
    "Messages mimic banks or financial services and ask you to confirm your identity, update your account, or fix an urgent problem. Links lead to fake login pages that capture your credentials.",
  p2p_app:
    "Scammers use peer-to-peer or payment-app themes—fake buyer/seller deals, verification fees, or prize claims—to get you to send money or share access to your account.",
  financial_institution:
    "Similar to financial phishing: impersonation of a known institution with urgent requests to log in, verify details, or move money.",
  tech_company:
    "Fake tech support or account-security alerts push you to call a number or click a link. The goal is to gain remote access to your device or steal account credentials.",
};

/** Generic protection tips keyed by dominant narrative (raw value). Safe, non-sensitive. */
const PROTECTION_TIP: Record<string, string> = {
  delivery_scam:
    "Verify any delivery or refund message by logging into the carrier or retailer’s official website yourself—never use links in the message.",
  government_impersonation:
    "Government and tax agencies do not demand payment by gift cards or cryptocurrency. Contact the agency through their official website or phone number from a trusted source.",
  financial_phishing:
    "Never log in to your bank or financial accounts from a link in an email or message. Open your app or type the official URL yourself.",
  p2p_app:
    "Use only in-app messaging and official verification. Be wary of anyone asking for payment or verification outside the app.",
  financial_institution:
    "Treat unexpected messages about your account as suspicious. Log in only via the official app or website you already use.",
  tech_company:
    "Legitimate tech companies do not ask you to install remote-access software or pay via gift cards. Hang up and contact support through the company’s official site.",
};

const FALLBACK_HOW_IT_WORKS =
  "Scammers often use common narratives and channels to pressure targets. The breakdown above shows this week’s dominant categories.";
const FALLBACK_PROTECTION_TIP =
  "Stay cautious with unsolicited messages and verify identities or requests through official websites or apps, not links in messages.";

function getTopDisplay(
  arr: { value: string }[] | undefined,
  formatter: (v: string) => string
): string {
  const first = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  if (!first || String(first.value ?? "").toLowerCase() === "unknown") return "—";
  return formatter(first.value);
}

function getTopDisplayOrNull(
  arr: { value: string }[] | undefined,
  formatter: (v: string) => string
): string | null {
  const first = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  if (!first || String(first.value ?? "").toLowerCase() === "unknown") return null;
  return formatter(first.value);
}

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const res = await fetch(`${origin}/api/intel/radar-weekly`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to load weekly data" },
        { status: 502 }
      );
    }
    const data = (await res.json()) as RadarPayload;

    const narratives = Array.isArray(data.fraud_landscape?.narratives)
      ? data.fraud_landscape.narratives
      : [];
    const channels = Array.isArray(data.fraud_landscape?.channels)
      ? data.fraud_landscape.channels
      : [];
    const authorityTypes = Array.isArray(data.fraud_landscape?.authority_types)
      ? data.fraud_landscape.authority_types
      : [];
    const paymentMethods = Array.isArray(data.fraud_landscape?.payment_methods)
      ? data.fraud_landscape.payment_methods
      : [];

    const scanCount = data.system_health?.scan_count ?? 0;
    const topNarrativeRaw = narratives.length > 0 && String(narratives[0]?.value ?? "").toLowerCase() !== "unknown"
      ? narratives[0].value
      : "";
    const topChannelRaw = channels.length > 0 && String(channels[0]?.value ?? "").toLowerCase() !== "unknown"
      ? channels[0].value
      : "";

    const topNarrative = getTopDisplay(narratives, formatLandscapeLabel);
    const topChannel = getTopDisplay(channels, formatLandscapeLabel);
    const topAuthority = getTopDisplayOrNull(authorityTypes, formatLandscapeLabel);
    const topPaymentMethod = getTopDisplayOrNull(paymentMethods, formatLandscapeLabel);

    const fraudLabel =
      topNarrative !== "—" && topChannel !== "—"
        ? `${topNarrative} via ${topChannel}`
        : topNarrative !== "—"
          ? topNarrative
          : "No dominant pattern identified";

    const howItWorks =
      topNarrativeRaw && HOW_IT_WORKS[topNarrativeRaw]
        ? HOW_IT_WORKS[topNarrativeRaw]
        : FALLBACK_HOW_IT_WORKS;

    const protectionTip =
      topNarrativeRaw && PROTECTION_TIP[topNarrativeRaw]
        ? PROTECTION_TIP[topNarrativeRaw]
        : FALLBACK_PROTECTION_TIP;

    const payload: BriefWeeklyResponse = {
      week_start: data.week_start ?? "",
      generated_at: data.generated_at ?? new Date().toISOString(),
      scan_count: scanCount,
      top_narrative: topNarrative,
      top_channel: topChannel,
      top_authority: topAuthority,
      top_payment_method: topPaymentMethod,
      fraud_label: fraudLabel,
      how_it_works: howItWorks,
      protection_tip: protectionTip,
      narratives,
      channels,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[brief/weekly]", err);
    return NextResponse.json(
      { error: "Failed to load weekly brief" },
      { status: 500 }
    );
  }
}
