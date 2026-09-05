import type { SemanticExtraction } from "@/lib/ai/semanticSchema";

export type SignalSource =
  | "semantic_model"
  | "deterministic_rules"
  | "link_intelligence"
  | "ocr"
  | "user_context";

export type SignalLedgerEntry = {
  key: string;
  value: string | number | boolean;
  confidence: number;
  source: SignalSource;
  source_id: string;
};

function push(
  out: SignalLedgerEntry[],
  entry: SignalLedgerEntry | null | undefined
): void {
  if (!entry) return;
  if (entry.value === "" || entry.value === "unknown" || entry.value === "none") return;
  out.push(entry);
}

export function buildSignalLedgerV1(input: {
  semantic?: SemanticExtraction;
  model: string;
  enrichment: {
    narrativeFamily?: string;
    requestedAction?: string;
    threatStage?: string;
    confidenceLevel?: string;
    contextQuality?: string;
  };
  linkIntel?: Record<string, any> | null;
  source: "user_text" | "ocr";
}): SignalLedgerEntry[] {
  const out: SignalLedgerEntry[] = [];
  const semantic = input.semantic;

  if (semantic) {
    push(out, {
      key: "context_sufficiency",
      value: semantic.context_sufficiency,
      confidence: semantic.confidence,
      source: "semantic_model",
      source_id: input.model,
    });
    push(out, {
      key: "scam_family",
      value: semantic.scam_family,
      confidence: semantic.confidence,
      source: "semantic_model",
      source_id: input.model,
    });
    push(out, {
      key: "claimed_identity_type",
      value: semantic.claimed_identity_type,
      confidence: semantic.confidence,
      source: "semantic_model",
      source_id: input.model,
    });
    push(out, {
      key: "attack_stage",
      value: semantic.attack_stage,
      confidence: semantic.confidence,
      source: "semantic_model",
      source_id: input.model,
    });

    for (const action of semantic.requested_actions) {
      push(out, {
        key: "requested_action",
        value: action,
        confidence: semantic.confidence,
        source: "semantic_model",
        source_id: input.model,
      });
    }
    for (const asset of semantic.requested_assets) {
      push(out, {
        key: "requested_asset",
        value: asset,
        confidence: semantic.confidence,
        source: "semantic_model",
        source_id: input.model,
      });
    }
    for (const tactic of semantic.tactics) {
      push(out, {
        key: "tactic",
        value: tactic.type,
        confidence: tactic.confidence,
        source: "semantic_model",
        source_id: input.model,
      });
    }
  }

  const deterministicConfidence =
    input.enrichment.confidenceLevel === "high" ? 0.95 :
    input.enrichment.confidenceLevel === "medium" ? 0.78 :
    0.58;

  push(out, {
    key: "scam_family",
    value: input.enrichment.narrativeFamily || "unknown",
    confidence: deterministicConfidence,
    source: "deterministic_rules",
    source_id: "scan-analysis-v1",
  });
  push(out, {
    key: "requested_action",
    value: input.enrichment.requestedAction || "unknown",
    confidence: deterministicConfidence,
    source: "deterministic_rules",
    source_id: "scan-analysis-v1",
  });
  push(out, {
    key: "threat_stage",
    value: input.enrichment.threatStage || "unknown",
    confidence: deterministicConfidence,
    source: "deterministic_rules",
    source_id: "scan-analysis-v1",
  });
  push(out, {
    key: "context_quality",
    value: input.enrichment.contextQuality || "unknown",
    confidence: 1,
    source: "deterministic_rules",
    source_id: "scan-analysis-v1",
  });

  const link = input.linkIntel;
  if (link) {
    if (link.primary?.flags?.shortened === true) {
      push(out, {
        key: "shortened_link",
        value: true,
        confidence: 1,
        source: "link_intelligence",
        source_id: "url-parser-v1",
      });
    }
    const webRisk = String(link.web_risk?.status || "");
    if (webRisk) {
      push(out, {
        key: "web_risk_status",
        value: webRisk,
        confidence: webRisk === "match" ? 1 : 0.9,
        source: "link_intelligence",
        source_id: "google-web-risk",
      });
    }
    const ageDays = Number(link.domain_registration?.age_days);
    if (Number.isFinite(ageDays) && ageDays >= 0) {
      push(out, {
        key: "domain_age_days",
        value: Math.round(ageDays),
        confidence: 0.95,
        source: "link_intelligence",
        source_id: "rdap",
      });
    }
  }

  if (input.source === "ocr") {
    push(out, {
      key: "input_source",
      value: "ocr",
      confidence: 1,
      source: "ocr",
      source_id: "google-vision",
    });
  }

  // Bound persistent size and never include raw evidence or artifacts.
  return out.slice(0, 32);
}
