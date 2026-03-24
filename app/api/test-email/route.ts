import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const { data, error } = await resend.emails.send({
      from: "ScanScam <onboarding@resend.dev>",
      to: "gestionrockwell@gmail.com",
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
