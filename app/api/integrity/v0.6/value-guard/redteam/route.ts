import {
  compileValueProfileToMandate,
  emptyHumanValueProfile,
  evaluateOptionsWithValueProfile,
  valueProfileHashes,
  type HumanValueProfile,
} from "@/lib/integrity/value-profile";
import {
  activateValueProfile,
  createValueProfileDraft,
  getValueProfile,
  saveValueProfile,
} from "@/lib/integrity/value-store";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

type TestResult = {
  id: string;
  passed: boolean;
  expected: string;
  actual: string;
};

function record(
  results: TestResult[],
  id: string,
  passed: boolean,
  expected: string,
  actual: unknown
) {
  results.push({
    id,
    passed,
    expected,
    actual: typeof actual === "string" ? actual : JSON.stringify(actual),
  });
}

function sampleProfile(): HumanValueProfile {
  return {
    version: "0.6",
    summary: [
      "Privacy is a strong preference.",
      "Never use vendors explicitly marked excluded.",
      "Prefer Canadian suppliers if the premium is modest.",
    ],
    hard_rules: [
      {
        id: "excluded-vendor",
        label: "Never use explicitly excluded vendors",
        target: { kind: "fact", fact_key: "vendor_policy" },
        operator: "eq",
        value: "never",
        effect: "block",
        reason: "The principal explicitly excluded this vendor.",
        confidence: 1,
        source: "explicit",
      },
      {
        id: "red-eye-approval",
        label: "Ask before red-eye travel",
        target: { kind: "fact", fact_key: "flight.red_eye" },
        operator: "eq",
        value: true,
        effect: "require_approval",
        reason: "The principal wants to approve red-eye travel.",
        confidence: 1,
        source: "explicit",
      },
    ],
    preferences: [
      {
        id: "prefer-canada",
        label: "Prefer Canadian suppliers",
        target: { kind: "fact", fact_key: "supplier_country" },
        kind: "match",
        operator: "eq",
        value: "CA",
        mode: "prefer",
        strength: "strong",
        confidence: 0.9,
        private: true,
        max_premium_percent: 12,
        source: "tradeoff",
      },
      {
        id: "avoid-data-sale",
        label: "Avoid services that sell personal data",
        target: { kind: "fact", fact_key: "privacy.sells_personal_data" },
        kind: "match",
        operator: "eq",
        value: true,
        mode: "avoid",
        strength: "very_strong",
        confidence: 1,
        private: true,
        max_premium_percent: null,
        source: "explicit",
      },
      {
        id: "minimize-price",
        label: "Prefer lower price",
        target: { kind: "action_amount", fact_key: null },
        kind: "minimize",
        operator: null,
        value: null,
        mode: "prefer",
        strength: "moderate",
        confidence: 0.8,
        private: true,
        max_premium_percent: null,
        source: "explicit",
      },
    ],
    limits: {
      currency: "CAD",
      max_autonomous_amount: 500,
      human_approval_amount: 2500,
      budgets: [],
    },
    open_questions: [],
    learned_from_decisions: 3,
  };
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const results: TestResult[] = [];
  let createdProfileId: string | null = null;
  let createdPrincipalId: string | null = null;

  try {
    const empty = compileValueProfileToMandate(emptyHumanValueProfile());
    record(
      results,
      "empty-profile-compiles-safely",
      (empty.rules?.length ?? 0) === 0 &&
        (empty.objectives?.length ?? 0) === 0 &&
        empty.max_autonomous_amount === undefined,
      "empty profile creates no invented policy",
      empty
    );

    const profile = sampleProfile();
    const mandate = compileValueProfileToMandate(profile);

    record(
      results,
      "hard-rules-remain-hard",
      mandate.rules?.some((rule) => rule.id === "excluded-vendor" && rule.effect === "block") === true &&
        mandate.rules?.some((rule) => rule.id === "red-eye-approval" && rule.effect === "require_approval") === true,
      "explicit block and approval rules compile without softening",
      mandate.rules
    );

    const canadaObjective = mandate.objectives?.find((item) => item.id === "prefer-canada");
    record(
      results,
      "soft-preference-remains-objective",
      !!canadaObjective &&
        canadaObjective.mode === "prefer" &&
        canadaObjective.private === true &&
        !mandate.rules?.some((rule) => rule.id === "prefer-canada"),
      "Canadian preference is private utility, not a hard rule",
      canadaObjective
    );

    record(
      results,
      "relative-preference-stays-profile-level",
      !mandate.objectives?.some((item) => item.id === "minimize-price"),
      "relative minimize/maximize preference is retained for option ranking rather than miscompiled as a single-action rule",
      mandate.objectives
    );

    const evaluation = evaluateOptionsWithValueProfile(profile, [
      {
        id: "cheap-us",
        label: "Cheap US",
        price: 100,
        currency: "CAD",
        facts: {
          supplier_country: "US",
          privacy: { sells_personal_data: true },
          vendor_policy: "normal",
          flight: { red_eye: false },
        },
      },
      {
        id: "canada-8",
        label: "Canadian +8%",
        price: 108,
        currency: "CAD",
        facts: {
          supplier_country: "CA",
          privacy: { sells_personal_data: false },
          vendor_policy: "normal",
          flight: { red_eye: false },
        },
      },
      {
        id: "canada-25",
        label: "Canadian +25%",
        price: 125,
        currency: "CAD",
        facts: {
          supplier_country: "CA",
          privacy: { sells_personal_data: false },
          vendor_policy: "normal",
          flight: { red_eye: false },
        },
      },
    ]);

    record(
      results,
      "tradeoff-premium-is-learned-constraint",
      evaluation.recommended_option_id === "canada-8" &&
        evaluation.results.find((item) => item.id === "canada-25")?.tradeoff_notes.length === 1,
      "Canadian preference helps at +8% but is capped beyond learned 12% tolerance",
      evaluation
    );

    const denied = evaluateOptionsWithValueProfile(profile, [
      {
        id: "normal",
        label: "Normal",
        price: 100,
        facts: { vendor_policy: "normal", flight: { red_eye: false } },
      },
      {
        id: "excluded",
        label: "Excluded",
        price: 10,
        facts: { vendor_policy: "never", flight: { red_eye: false } },
      },
    ]);

    record(
      results,
      "hard-block-beats-cheap-option",
      denied.results.find((item) => item.id === "excluded")?.disposition === "denied" &&
        denied.recommended_option_id === "normal",
      "explicit hard rule cannot be outweighed by utility",
      denied
    );

    const approval = evaluateOptionsWithValueProfile(profile, [
      {
        id: "day",
        label: "Day flight",
        price: 500,
        facts: { vendor_policy: "normal", flight: { red_eye: false } },
      },
      {
        id: "night",
        label: "Red-eye",
        price: 100,
        facts: { vendor_policy: "normal", flight: { red_eye: true } },
      },
    ]);

    record(
      results,
      "approval-remains-distinct-from-deny",
      approval.results.find((item) => item.id === "night")?.disposition === "approval_required",
      "ask-first rule remains approval rather than denial",
      approval
    );

    const hashesA = valueProfileHashes(profile);
    const hashesB = valueProfileHashes(JSON.parse(JSON.stringify(profile)));
    record(
      results,
      "profile-compile-is-deterministic",
      hashesA.profile_hash === hashesB.profile_hash &&
        hashesA.compiled_mandate_hash === hashesB.compiled_mandate_hash,
      "same structured human profile produces same profile and mandate hashes",
      hashesA
    );

    const created = await createValueProfileDraft();
    createdProfileId = created.id;
    createdPrincipalId = created.principal_id;

    const saved = await saveValueProfile({
      profile_id: created.id,
      profile,
      event_summary: ["Red-team structured profile loaded."],
      event_type: "profile_edited",
    });

    const activated = await activateValueProfile(saved.id);
    const stored = await getValueProfile(saved.id);
    const { data: activeMandate } = await supabase
      .from("integrity_mandates")
      .select("version,mandate,mandate_hash,active")
      .eq("principal_id", created.principal_id)
      .eq("active", true)
      .single();

    record(
      results,
      "publish-activates-exact-compiled-policy",
      stored.status === "active" &&
        activated.mandate_hash === hashesA.compiled_mandate_hash &&
        activeMandate?.mandate_hash === hashesA.compiled_mandate_hash,
      "publishing activates the exact deterministic Guardian mandate",
      { activated, activeMandate }
    );
  } catch (error) {
    record(
      results,
      "suite-runtime",
      false,
      "no runtime error",
      error instanceof Error ? error.message : "unknown_error"
    );
  } finally {
    if (createdPrincipalId) {
      await supabase.from("integrity_mandates").delete().eq("principal_id", createdPrincipalId);
    }
    if (createdProfileId) {
      await supabase.from("integrity_value_profiles").delete().eq("id", createdProfileId);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  return Response.json({
    suite: "value-guard-human-profile-v0.6",
    total: results.length,
    passed,
    failed: results.length - passed,
    pass_rate: results.length ? Number((passed / results.length).toFixed(3)) : 0,
    results,
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
