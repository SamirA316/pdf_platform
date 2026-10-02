import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const INTERNAL_SECRET = process.env.INTERNAL_MAIL_SECRET || "quickpdf-secret-mail-relay-key-2026";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-internal-secret");
    if (!authHeader || authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { to, subject, html, text } = body;

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json({ success: false, error: "Missing required email fields" }, { status: 400 });
    }

    const smtpUser = process.env.SMTP_USER || "pdfplatform382@gmail.com";
    const smtpPass = process.env.SMTP_PASS || "dwwoklwqsvwoljry";

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"QuickPDF" <${smtpUser}>`,
      to,
      subject,
      html,
      text,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err: any) {
    console.error("[MAIL RELAY ERROR]:", err?.message);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal mail relay failed" },
      { status: 500 }
    );
  }
}
