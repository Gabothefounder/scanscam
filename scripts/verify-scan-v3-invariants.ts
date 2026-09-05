import assert from "node:assert/strict";
import { buildScanEnrichment } from "../lib/scan-analysis";
import { applySemanticSensor } from "../lib/scan-v3/applySemanticSensor";
import { buildSignalLedgerV1 } from "../lib/scan-v3/signalLedger";
import { publicResultState, resolveInsufficientContext } from "../lib/scan-v3/resultState";

function checkResultState() {
  assert.equal(
    resolveInsufficientContext({
      refined: false,
      submissionRoute: "ambiguous",
      contextQuality: "thin",
      semanticSufficiency: "insufficient",
    }),
    true,
    "thin + semantic insufficient must not be treated as classified"
  );

  assert.equal(
    publicResultState(true),
    "insufficient_context",
    "insufficient context must be an explicit public state"
  );

  assert.equal(
    resolveInsufficientContext({
      refined: false,
      submissionRoute: "ambiguous",
      contextQuality: "full",
      semanticSufficiency: "insufficient",
    }),
    false,
    "a semantic sensor alone must not erase full context"
  );

  assert.equal(
    resolveInsufficientContext({
      refined: true,
      submissionRoute: "insufficient_context",
      contextQuality: "fragment",
      semanticSufficiency: "insufficient",
    }),
    false,
    "meaningful refinement bypasses the original thin-input trust floor"
  );
}

function checkLanguageParity() {
  const pairs = [
    [
      "CRA notice: unpaid balance. Pay immediately to avoid penalties.",
      "ARC : solde impayé. Payez immédiatement pour éviter des pénalités.",
      "government_impersonation",
      "pay_money",
    ],
    [
      "Canada Post: your package is held. Update delivery at this link.",
      "Postes Canada : votre colis est retenu. Mettez la livraison à jour avec ce lien.",
      "delivery_scam",
      "click_link",
    ],
    [
      "Your bank account will be suspended. Verify your identity now.",
      "Votre compte bancaire sera suspendu. Vérifiez votre identité maintenant.",
      "account_verification",
      "submit_credentials",
    ],
  ] as const;

  for (const [en, fr, family, action] of pairs) {
    const enResult = buildScanEnrichment({ messageText: en, language: "en", source: "user_text" });
    const frResult = buildScanEnrichment({ messageText: fr, language: "fr", source: "user_text" });
    assert.equal(enResult.narrativeFamily, family, "EN family regression");
    assert.equal(frResult.narrativeFamily, family, "FR family parity regression");
    assert.equal(enResult.requestedAction, action, "EN action regression");
    assert.equal(frResult.requestedAction, action, "FR action parity regression");
  }
}

function checkSemanticFillRules() {
  const base = {
    narrative_family: "delivery_scam",
    requested_action: "click_link",
    threat_stage: "unclear",
    authority_type: "unknown",
    confidence_level: "low",
  };

  const semantic = {
    context_sufficiency: "enough" as const,
    claimed_identity_type: "government" as const,
    scam_family: "government_impersonation" as const,
    requested_actions: ["pay_money" as const],
    requested_assets: ["money" as const],
    tactics: [{ type: "authority" as const, confidence: 0.93, evidence: "ignored" }],
    attack_stage: "payment_extraction" as const,
    confidence: 0.92,
  };

  const out = applySemanticSensor(base, semantic, {
    model: "gpt-5.6-luna",
    analysisPath: "structured_primary",
  });

  assert.equal(out.narrative_family, "delivery_scam", "semantic fill must not overwrite concrete family");
  assert.equal(out.requested_action, "click_link", "semantic fill must not overwrite concrete action");
  assert.equal(out.threat_stage, "payment_extraction", "semantic may fill missing/unclear stage");
  assert.equal(out.analysis_model, "gpt-5.6-luna");
  assert.deepEqual(out.requested_assets, ["money"]);
  assert.equal(out.verification_suppression, false);
}

function checkLedgerPrivacy() {
  const ledger = buildSignalLedgerV1({
    model: "gpt-5.6-luna",
    semantic: {
      context_sufficiency: "enough",
      claimed_identity_type: "government",
      scam_family: "government_impersonation",
      requested_actions: ["pay_money"],
      requested_assets: ["money"],
      tactics: [{ type: "urgency", confidence: 0.9, evidence: "PAY NOW PRIVATE TEXT" }],
      attack_stage: "payment_extraction",
      confidence: 0.9,
    },
    enrichment: {
      narrativeFamily: "government_impersonation",
      requestedAction: "pay_money",
      threatStage: "payment_extraction",
      confidenceLevel: "high",
      contextQuality: "partial",
    },
    source: "user_text",
  });

  const serialized = JSON.stringify(ledger);
  assert.equal(serialized.includes("PAY NOW PRIVATE TEXT"), false, "ledger must never persist raw evidence");
  assert.equal(serialized.includes('"evidence"'), false, "ledger schema must not contain evidence fields");
  assert.ok(ledger.length > 0 && ledger.length <= 32, "ledger must be present and bounded");
}

checkResultState();
checkLanguageParity();
checkSemanticFillRules();
checkLedgerPrivacy();

console.log("ScanScam V3 invariants: OK");
