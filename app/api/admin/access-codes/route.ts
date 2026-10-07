import { createHash } from "node:crypto";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { generateAccessCode } from "@/lib/access-code";

const MAX_CODES_PER_BATCH = 100;

function getExpirationDate(createdAt: Date) {
  const expiration = new Date(createdAt);
  const originalDay = expiration.getUTCDate();
  expiration.setUTCDate(1);
  expiration.setUTCMonth(expiration.getUTCMonth() + 6);
  const lastDayOfMonth = new Date(
    Date.UTC(expiration.getUTCFullYear(), expiration.getUTCMonth() + 1, 0),
  ).getUTCDate();
  expiration.setUTCDate(Math.min(originalDay, lastDayOfMonth));
  return expiration;
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server." },
      { status: 503 },
    );
  }

  let response = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "is_joolo_admin",
  );

  if (adminError) {
    return NextResponse.json(
      { error: "Tidak dapat memverifikasi akses admin. Pastikan SQL admin sudah dijalankan." },
      { status: 503 },
    );
  }

  if (!isAdmin) {
    return NextResponse.json({ error: "Akses khusus admin." }, { status: 403 });
  }

  let body: { quantity?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const quantity = body.quantity;
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_CODES_PER_BATCH
  ) {
    return NextResponse.json(
      { error: `Jumlah kode harus antara 1 dan ${MAX_CODES_PER_BATCH}.` },
      { status: 400 },
    );
  }

  const createdAt = new Date();
  const expiresAt = getExpirationDate(createdAt).toISOString();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const codes = Array.from({ length: quantity }, generateAccessCode);
    const records = codes.map((code) => ({
      code_hash: createHash("sha256").update(code).digest("hex"),
      created_by: user.id,
      expires_at: expiresAt,
    }));
    const { error } = await supabase.from("joolo_access_codes").insert(records);

    if (!error) {
      return NextResponse.json(
        { codes, createdAt: createdAt.toISOString(), expiresAt },
        { status: 201, headers: response.headers },
      );
    }

    if (error.code !== "23505") {
      return NextResponse.json(
        { error: `Kode gagal disimpan: ${error.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "Gagal membuat kode unik. Silakan coba lagi." },
    { status: 500 },
  );
}
