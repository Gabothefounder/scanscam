import { initialValueCoachQuestion } from "@/lib/integrity/value-profile";
import { compileValueCoachTurn } from "@/lib/integrity/value-coach";
import {
  createValueProfileDraft,
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

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const results: TestResult[] = [];
  let profileId: string | null = null;

  const naturalAnswer =
    "Never let an agent spend more than $2,500 without asking me. Privacy matters a lot to me. I prefer Canadian suppliers, but not if they cost more than about 12% extra. I really dislike red-eye flights, but ask me rather than blocking them.";

  try {
    const draft = await createValueProfileDraft();
    profileId = draft.id;

    const turn = await compileValueCoachTurn({
      profile: draft.profile,
      question_count: 0,
      current_question: initialValueCoachQuestion(),
      user_message: naturalAnswer,
    });

    const saved = await saveValueProfile({
      profile_id: draft.id,
      profile: turn.profile,
      event_summary: turn.event_summary,
      event_type: "answer_compiled",
    });

    const approvalThreshold =
      saved.profile.limits.human_approval_amount ??
      saved.profile.limits.max_autonomous_amount;

    const canadian = saved.profile.preferences.find((preference) =>
      /canad/i.test(preference.label)
    );
    const privacy = saved.profile.preferences.find((preference) =>
      /privacy|personal data|data/i.test(preference.label)
    );
    const redEyeRule = saved.profile.hard_rules.find((rule) =>
      /red.?eye/i.test(rule.label)
    );
    const spendRule = saved.profile.hard_rules.find((rule) =>
      rule.target.kind === "action_amount" && rule.effect === "require_approval"
    );

    record(
      results,
      "natural-language-spend-boundary",
      (typeof approvalThreshold === "number" && Math.abs(approvalThreshold - 2500) <= 50) ||
        !!spendRule,
      "explicit $2,500 ask-first boundary becomes a deterministic approval limit/rule",
      {
        approvalThreshold,
        spendRule,
      }
    );

    record(
      results,
      "natural-language-private-preference",
      !!privacy &&
        privacy.private === true &&
        privacy.kind === "qualitative" &&
        ["strong", "very_strong"].includes(privacy.strength) &&
        privacy.confidence >= 0.75,
      "strong privacy statement becomes a high-confidence private preference",
      privacy
    );

    record(
      results,
      "natural-language-tradeoff-tolerance",
      !!canadian &&
        canadian.mode === "prefer" &&
        canadian.value === "CA" &&
        canadian.max_premium_percent !== null &&
        canadian.max_premium_percent >= 8 &&
        canadian.max_premium_percent <= 16,
      "Canadian preference captures roughly 12% willingness-to-trade price for the preference",
      canadian
    );

    record(
      results,
      "natural-language-approval-vs-deny",
      !!redEyeRule && redEyeRule.effect === "require_approval",
      "red-eye statement becomes ask-first, not a block",
      redEyeRule
    );

    record(
      results,
      "coach-asks-one-next-question",
      !!turn.next_question &&
        turn.next_question.text.length > 0 &&
        turn.next_question.options.length <= 8,
      "coach chooses one next high-information question rather than dumping a questionnaire",
      turn.next_question
    );

    const { data: events } = await supabase
      .from("integrity_value_events")
      .select("structured_summary")
      .eq("profile_id", draft.id);

    const persistedText = JSON.stringify({
      profile: saved.profile,
      events: events ?? [],
    });

    record(
      results,
      "raw-answer-not-persisted",
      !persistedText.includes(naturalAnswer),
      "raw conversational answer is not persisted verbatim",
      {
        persisted_bytes: Buffer.byteLength(persistedText, "utf8"),
        event_count: events?.length ?? 0,
      }
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
    if (profileId) {
      await supabase.from("integrity_value_profiles").delete().eq("id", profileId);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  return Response.json({
    suite: "value-guard-live-coach-v0.6",
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
