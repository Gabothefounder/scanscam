import { NextResponse } from "next/server";
import { Resend } from "resend";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Email service not configured (RESEND_API_KEY missing)");
  }
  return new Resend(apiKey);
}

export async function GET() {
  try {
    const resend = getResendClient();
    const recipient = "gab.gabcaron@gmail.com";
    console.log("Email recipient:", recipient);
    const { data, error } = await resend.emails.send({
      from: "ScanScam <onboarding@resend.dev>",
      to: recipient,
      subject: "ScanScam test email",
      text: "This is a test email from ScanScam MSP flow",
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data?.id) {
      return NextResponse.json(
        { ok: false, error: "No confirmation from email service" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
