import {
  initialValueCoachQuestion,
  type ValueCoachQuestion,
} from "@/lib/integrity/value-profile";
import { compileValueCoachTurn } from "@/lib/integrity/value-coach";
import {
  createValueProfileDraft,
  getValueProfile,
  saveValueProfile,
} from "@/lib/integrity/value-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isQuestion(value: unknown): value is ValueCoachQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<ValueCoachQuestion>;
  return (
    typeof question.id === "string" &&
    typeof question.text === "string" &&
    typeof question.format === "string" &&
    Array.isArray(question.options)
  );
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  return Response.json({
    service: "ScanScam Value Guard Coach",
    version: "0.6",
    model: "conversational preference compiler",
    privacy: "Raw human answers are not persisted; only the structured preference profile and short provenance summaries are stored.",
    principle: "Humans speak naturally. Numeric weights are an internal representation, not a required user input.",
  });
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") {
    return Response.json({ error: "integrity_preview_only" }, { status: 404 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const profileId = typeof body?.profile_id === "string" ? body.profile_id : "";

    if (!profileId) {
      const stored = await createValueProfileDraft();
      return Response.json({
        profile_id: stored.id,
        principal_id: stored.principal_id,
        status: stored.status,
        question_count: stored.question_count,
        profile: stored.profile,
        compiled_mandate: stored.compiled_mandate,
        assistant_message:
          "You do not need to configure weights. Tell me your boundaries and trade-offs in normal language; I will turn them into a private policy and ask only the questions that materially improve it.",
        next_question: initialValueCoachQuestion(),
        ready_to_publish: false,
      }, {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          "X-ScanScam-Integrity-Version": "0.6",
        },
      });
    }

    if (!UUID_RE.test(profileId)) {
      return Response.json({ error: "invalid_profile_id" }, { status: 400 });
    }

    const stored = await getValueProfile(profileId);
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return Response.json({
        profile_id: stored.id,
        principal_id: stored.principal_id,
        status: stored.status,
        question_count: stored.question_count,
        profile: stored.profile,
        compiled_mandate: stored.compiled_mandate,
        assistant_message:
          "Your structured Value Guard profile is loaded. You can continue teaching it or correct anything conversationally.",
        next_question:
          stored.question_count === 0 ? initialValueCoachQuestion() : null,
        ready_to_publish:
          stored.profile.hard_rules.length > 0 ||
          stored.profile.preferences.length >= 2,
      }, {
        headers: {
          "Cache-Control": "no-store",
          "X-ScanScam-Integrity-Version": "0.6",
        },
      });
    }

    if (message.length > 5000) {
      return Response.json({ error: "value_guard_answer_too_large" }, { status: 413 });
    }

    const currentQuestion = isQuestion(body?.current_question)
      ? body.current_question
      : null;

    const turn = await compileValueCoachTurn({
      profile: stored.profile,
      question_count: stored.question_count,
      current_question: currentQuestion,
      user_message: message,
    });

    const saved = await saveValueProfile({
      profile_id: stored.id,
      profile: turn.profile,
      event_summary: turn.event_summary,
      event_type: "answer_compiled",
    });

    return Response.json({
      profile_id: saved.id,
      principal_id: saved.principal_id,
      status: saved.status,
      question_count: saved.question_count,
      profile: saved.profile,
      compiled_mandate: saved.compiled_mandate,
      assistant_message: turn.assistant_message,
      next_question: turn.next_question,
      ready_to_publish: turn.ready_to_publish,
      model: turn.model,
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-ScanScam-Integrity-Version": "0.6",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "value_guard_coach_failed";
    const status =
      message.includes("not_found") ? 404 :
      message.includes("model_unavailable") ? 503 :
      500;

    return Response.json({ error: message }, { status });
  }
}
