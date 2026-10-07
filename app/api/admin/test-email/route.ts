import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return jsonError("Permintaan tidak valid.", 403);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Silakan login terlebih dahulu.", 401);
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "is_joolo_admin",
  );
  if (adminError) {
    return jsonError("Tidak dapat memverifikasi akses admin.", 503);
  }
  if (!isAdmin) {
    return jsonError("Akses khusus admin.", 403);
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Alamat email tidak valid.", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return jsonError("Masukkan alamat email penerima yang valid.", 400);
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "JOOLO";
  if (!apiKey || !senderEmail) {
    console.error("Brevo test email: required server configuration is missing.", {
      missing: [
        !apiKey && "BREVO_API_KEY",
        !senderEmail && "BREVO_SENDER_EMAIL",
      ].filter(Boolean),
    });
    return jsonError("BREVO_API_KEY atau BREVO_SENDER_EMAIL belum diatur di server.", 503);
  }

  let response: Response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email }],
        subject: "Tes pengiriman email JOOLO melalui Brevo",
        htmlContent:
          "<div style=\"font-family:Arial,sans-serif;color:#211b36\"><h1>JOOLO email test</h1><p>Email tes ini berhasil dikirim melalui Brevo Transactional Email API.</p><p>Anda tidak perlu melakukan tindakan apa pun.</p></div>",
        textContent:
          "JOOLO email test\n\nEmail tes ini berhasil dikirim melalui Brevo Transactional Email API.\nAnda tidak perlu melakukan tindakan apa pun.",
        tags: ["joolo-brevo-test"],
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("Brevo test email: request failed.", {
      message: error instanceof Error ? error.message : "Unknown network error",
    });
    return jsonError("Tidak dapat terhubung ke Brevo. Coba lagi nanti.", 502);
  }

  if (!response.ok) {
    const brevoError = (await response.text()).slice(0, 500);
    console.error("Brevo test email: provider rejected request.", {
      status: response.status,
      response: brevoError,
    });
    return jsonError(`Brevo menolak email tes (HTTP ${response.status}). Periksa API key dan sender.`, 502);
  }

  return NextResponse.json({ success: true, email });
}
