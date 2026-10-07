import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { generateAccessCode } from "@/lib/access-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LynkPayload = {
  event?: unknown;
  data?: {
    message_action?: unknown;
    message_code?: unknown;
    message_id?: unknown;
    message_data?: {
      refId?: unknown;
      totals?: {
        grandTotal?: unknown;
      };
      customer?: {
        email?: unknown;
        name?: unknown;
      };
      items?: Array<{
        uuid?: unknown;
        title?: unknown;
      }>;
    };
  };
};

type PreparedOrder = {
  order_id: string;
  raw_code: string | null;
  email_already_sent: boolean;
  delivery_in_progress: boolean;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function validSignature(
  rawSignature: string | null,
  amount: string,
  reference: string,
  messageId: string,
  merchantKey: string,
) {
  const received = rawSignature?.replace(/^Token\s+/i, "").trim().toLowerCase();
  if (!received || !/^[a-f0-9]{64}$/.test(received)) return false;

  const expected = createHash("sha256")
    .update(`${amount}${reference}${messageId}${merchantKey}`, "utf8")
    .digest();
  const supplied = Buffer.from(received, "hex");

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  const merchantKey = process.env.LYNK_MERCHANT_KEY ?? process.env.MERCHANT_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "JOOLO";

  if (
    !merchantKey ||
    !supabaseUrl ||
    !serviceRoleKey ||
    !brevoApiKey ||
    !senderEmail
  ) {
    console.error("Lynk webhook: server configuration is incomplete.", {
      missing: [
        !merchantKey && "LYNK_MERCHANT_KEY",
        !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
        !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
        !brevoApiKey && "BREVO_API_KEY",
        !senderEmail && "BREVO_SENDER_EMAIL",
      ].filter(Boolean),
    });
    return jsonError("Webhook belum dikonfigurasi sepenuhnya di environment server.", 503);
  }

  const rawBody = await request.text();
  if (rawBody.length > 64_000) {
    return jsonError("Payload webhook terlalu besar.", 413);
  }

  let payload: LynkPayload;
  try {
    payload = JSON.parse(rawBody) as LynkPayload;
  } catch {
    return jsonError("Payload JSON tidak valid.", 400);
  }

  if (payload.event !== "payment.received") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const payment = payload.data;
  const order = payment?.message_data;
  if (
    payment?.message_action !== "SUCCESS" ||
    String(payment.message_code) !== "0"
  ) {
    console.info("Lynk webhook: ignoring non-success payment event.", {
      action: payment?.message_action,
      messageCode: payment?.message_code,
    });
    return NextResponse.json({ received: true, ignored: true });
  }

  if (!order) {
    return jsonError("Payload pembayaran tidak memiliki message_data.", 400);
  }

  const rawAmount = order?.totals?.grandTotal;
  const amount =
    typeof rawAmount === "number" || typeof rawAmount === "string"
      ? String(rawAmount)
      : "";
  const reference = typeof order?.refId === "string" ? order.refId.trim() : "";
  const messageId =
    typeof payment.message_id === "string" ? payment.message_id.trim() : "";
  const signature = request.headers.get("X-Lynk-Signature");

  if (!amount || !reference || !messageId) {
    return jsonError("Payload pembayaran tidak memiliki grandTotal, refId, atau message_id.", 400);
  }

  if (!validSignature(signature, amount, reference, messageId, merchantKey)) {
    console.error("Lynk webhook: signature validation failed.", {
      reference,
      messageId,
      hasSignature: Boolean(signature),
    });
    return jsonError("Signature webhook Lynk.id tidak valid.", 401);
  }

  const buyerEmail =
    typeof order?.customer?.email === "string"
      ? order.customer.email.trim().toLowerCase()
      : "";

  if (
    buyerEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)
  ) {
    return jsonError("Email pembeli tidak valid pada payload Lynk.id.", 400);
  }

  const purchasedItems = Array.isArray(order.items)
    ? order.items.filter(
        (item) =>
          typeof item?.uuid === "string" && item.uuid.trim().length > 0,
      )
    : [];

  if (purchasedItems.length === 0) {
    console.error("Lynk webhook: successful payment has no identifiable items.", {
      reference,
    });
    return jsonError("Payload pembayaran tidak memiliki item produk yang valid.", 400);
  }

  const rawCode = generateAccessCode();
  const product = purchasedItems[0];
  const productTitle =
    typeof product.title === "string" && product.title.trim()
      ? product.title.trim().slice(0, 200)
      : "JOOLO 40-Day Challenge";
  const amountNumber = Number(amount);

  if (!Number.isSafeInteger(amountNumber) || amountNumber < 0) {
    return jsonError("Nominal grandTotal tidak valid.", 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("prepare_lynk_access_code", {
    input_payment_ref: reference,
    input_message_id: messageId,
    input_buyer_email: buyerEmail,
    input_product_title: productTitle,
    input_amount: amountNumber,
    input_code_hash: createHash("sha256").update(rawCode).digest("hex"),
    input_raw_code: rawCode,
  });

  if (error) {
    console.error("Lynk webhook: failed to prepare paid order.", {
      reference,
      code: error.code,
      message: error.message,
    });
    return jsonError("Pembayaran diterima, tetapi kode akses belum dapat disiapkan.", 500);
  }

  const prepared = (Array.isArray(data) ? data[0] : data) as PreparedOrder | null;
  if (!prepared?.order_id) {
    console.error("Lynk webhook: order preparation returned no order.");
    return jsonError("Kode akses belum dapat disiapkan.", 500);
  }

  if (prepared.email_already_sent) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (prepared.delivery_in_progress) {
    return NextResponse.json({ received: true, processing: true });
  }

  if (!prepared.raw_code) {
    console.error("Lynk webhook: pending order has no access code.", {
      reference,
      orderId: prepared.order_id,
    });
    return jsonError("Kode akses belum tersedia untuk pengiriman.", 500);
  }

  const escapedName =
    typeof order.customer?.name === "string" && order.customer.name.trim()
      ? escapeHtml(order.customer.name.trim().slice(0, 100))
      : "JOOLO explorer";
  const escapedCode = escapeHtml(prepared.raw_code);
  const htmlContent = `
    <div style="margin:0;padding:36px 16px;background:#0e0d1b;font-family:Arial,sans-serif;color:#f3effc">
      <div style="max-width:560px;margin:auto;padding:32px;border:1px solid #38314f;border-radius:18px;background:#171529">
        <p style="margin:0 0 24px;color:#c3aaf3;font-size:12px;font-weight:bold;letter-spacing:3px">✦ JOOLO</p>
        <p style="margin:0 0 8px;color:#b9a8dd;font-size:11px;letter-spacing:2px">PAYMENT CONFIRMED</p>
        <h1 style="margin:0 0 16px;font-size:27px">Your next chapter starts here.</h1>
        <p style="color:#c6c0d5;font-size:15px;line-height:1.7">Hi ${escapedName}, your payment was successful. Use this one-time access code to unlock your 40-day JOOLO challenge:</p>
        <div style="margin:24px 0;padding:18px;border:1px solid #574876;border-radius:12px;background:#211b36;color:#f2e7ff;text-align:center;font-family:monospace;font-size:21px;font-weight:bold;letter-spacing:2px">${escapedCode}</div>
        <p style="color:#aaa4be;font-size:13px;line-height:1.7">Sign in to your JOOLO account, enter the code on the onboarding page, and start your journey. This code is valid for six months and can only be claimed once by this email address.</p>
        <p style="margin-top:28px;color:#8f88a4;font-size:12px">Small steps. A whole new universe.<br/>The JOOLO team</p>
      </div>
    </div>`;
  const textContent = [
    `Hi ${typeof order.customer?.name === "string" ? order.customer.name.trim() : "JOOLO explorer"},`,
    "",
    "Your Lynk.id payment was successful.",
    `Your one-time JOOLO access code: ${prepared.raw_code}`,
    "",
    "Sign in to JOOLO and enter this code on the onboarding page.",
    "The code is valid for six months and can only be claimed once by this email address.",
    "",
    "Small steps. A whole new universe.",
    "The JOOLO team",
  ].join("\n");

  let emailResponse: Response;
  try {
    emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: buyerEmail }],
        subject: "Pembayaran berhasil — kode akses JOOLO kamu",
        htmlContent,
        textContent,
        tags: ["joolo-access-code", "lynk-payment"],
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    await supabase.rpc("mark_lynk_email_failed", {
      input_order_id: prepared.order_id,
      input_error: error instanceof Error ? error.message.slice(0, 500) : "Brevo tidak dapat dijangkau.",
    });
    console.error("Lynk webhook: Brevo request failed.", {
      reference,
      message: error instanceof Error ? error.message : "Unknown network error",
    });
    return jsonError("Email kode akses belum terkirim. Lynk.id dapat mengulangi webhook.", 502);
  }

  if (!emailResponse.ok) {
    const brevoError = (await emailResponse.text()).slice(0, 500);
    await supabase.rpc("mark_lynk_email_failed", {
      input_order_id: prepared.order_id,
      input_error: `Brevo HTTP ${emailResponse.status}: ${brevoError}`,
    });
    console.error("Lynk webhook: Brevo rejected the email.", {
      reference,
      status: emailResponse.status,
      response: brevoError,
    });
    return jsonError("Brevo menolak email kode akses. Periksa sender email dan konfigurasi Brevo.", 502);
  }

  const { data: markedSent, error: markError } = await supabase.rpc(
    "mark_lynk_email_sent",
    { input_order_id: prepared.order_id },
  );

  if (markError || !markedSent) {
    console.error("Lynk webhook: email sent but delivery status could not be saved.", {
      reference,
      code: markError?.code,
    });
    return jsonError(
      "Email terkirim, tetapi status transaksi belum tersimpan. Periksa log sebelum memutar ulang webhook.",
      500,
    );
  }

  return NextResponse.json({ received: true, emailSent: true });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "lynk-payment-webhook",
    accepts: "POST",
  });
}
