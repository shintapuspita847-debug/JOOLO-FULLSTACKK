import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GENDERS = new Set(["woman", "man"]);
const AGE_GROUPS = new Set(["under_18", "18_25", "over_25"]);

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Sesi login berakhir. Silakan login kembali." },
      { status: 401 },
    );
  }

  let body: {
    fullName?: unknown;
    gender?: unknown;
    ageGroup?: unknown;
    accessCode?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Data onboarding tidak valid." }, { status: 400 });
  }

  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim().replace(/\s+/g, " ") : "";
  const gender = body.gender;
  const ageGroup = body.ageGroup;
  const accessCode =
    typeof body.accessCode === "string" ? body.accessCode.trim().toUpperCase() : "";

  if (fullName.length < 2 || fullName.length > 100) {
    return NextResponse.json(
      { error: "Nama lengkap harus terdiri dari 2 sampai 100 karakter." },
      { status: 400 },
    );
  }

  if (typeof gender !== "string" || !GENDERS.has(gender)) {
    return NextResponse.json({ error: "Pilih gender yang tersedia." }, { status: 400 });
  }

  if (typeof ageGroup !== "string" || !AGE_GROUPS.has(ageGroup)) {
    return NextResponse.json({ error: "Pilih rentang usia yang tersedia." }, { status: 400 });
  }

  if (!/^JOOLO(?:-[A-Z0-9]{4}){3}(?:-[A-Z0-9]{4}){0,3}$/.test(accessCode)) {
    return NextResponse.json(
      { error: "Format kode akses tidak valid. Periksa kembali kode Anda." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("claim_joolo_access_code", {
    input_code: accessCode,
    input_full_name: fullName,
    input_gender: gender,
    input_age_group: ageGroup,
  });

  if (error) {
    return NextResponse.json(
      { error: "Fitur onboarding belum disiapkan di Supabase. Jalankan SQL terbaru dari supabase/schema.sql." },
      { status: 503 },
    );
  }

  if (data === "claimed") {
    return NextResponse.json({ success: true });
  }

  if (data === "already_onboarded") {
    return NextResponse.json({ success: true, alreadyOnboarded: true });
  }

  if (data === "unauthorized") {
    return NextResponse.json(
      { error: "Sesi login berakhir. Silakan login kembali." },
      { status: 401 },
    );
  }

  if (data === "invalid_code") {
    return NextResponse.json(
      { error: "Kode tidak valid, sudah pernah digunakan, atau sudah kedaluwarsa." },
      { status: 400 },
    );
  }

  if (data === "invalid_profile") {
    return NextResponse.json({ error: "Data profil tidak valid." }, { status: 400 });
  }

  return NextResponse.json({ error: "Klaim kode gagal. Silakan coba lagi." }, { status: 500 });
}
