import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type BonusInput = {
  name?: unknown;
  description?: unknown;
  fileType?: unknown;
  imageUrl?: unknown;
  driveUrl?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isGoogleDriveUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "drive.google.com" ||
        url.hostname === "docs.google.com")
    );
  } catch {
    return false;
  }
}

async function getAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: jsonError("Silakan login terlebih dahulu.", 401) } as const;
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "is_joolo_admin",
  );

  if (adminError) {
    return {
      error: jsonError("Tidak dapat memverifikasi akses admin.", 503),
    } as const;
  }

  if (!isAdmin) {
    return { error: jsonError("Akses khusus admin.", 403) } as const;
  }

  return { supabase, user } as const;
}

export async function GET() {
  const result = await getAdminClient();
  if ("error" in result) return result.error;

  const { data, error } = await result.supabase
    .from("joolo_bonus_resources")
    .select("id, name, description, file_type, image_url, drive_url, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin bonuses: failed to load resources.", error.message);
    return jsonError("Bonus belum dapat dimuat. Pastikan SQL bonus sudah dijalankan.", 503);
  }

  return NextResponse.json({ bonuses: data });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return jsonError("Permintaan tidak valid.", 403);
  }

  const result = await getAdminClient();
  if ("error" in result) return result.error;

  let body: BonusInput;
  try {
    body = await request.json();
  } catch {
    return jsonError("Data bonus tidak valid.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const fileType = body.fileType;
  const imageUrl =
    typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const driveUrl =
    typeof body.driveUrl === "string" ? body.driveUrl.trim() : "";

  if (name.length < 2 || name.length > 120) {
    return jsonError("Nama bonus harus terdiri dari 2–120 karakter.", 400);
  }

  if (description.length < 2 || description.length > 500) {
    return jsonError("Deskripsi singkat harus terdiri dari 2–500 karakter.", 400);
  }

  if (fileType !== "pdf" && fileType !== "excel") {
    return jsonError("Pilih jenis file PDF atau Excel.", 400);
  }

  if (!isHttpsUrl(imageUrl)) {
    return jsonError("Link gambar harus berupa URL HTTPS yang valid.", 400);
  }

  if (!isGoogleDriveUrl(driveUrl)) {
    return jsonError("Link file harus berasal dari drive.google.com atau docs.google.com.", 400);
  }

  const { data, error } = await result.supabase
    .from("joolo_bonus_resources")
    .insert({
      name,
      description,
      file_type: fileType,
      image_url: imageUrl,
      drive_url: driveUrl,
      created_by: result.user.id,
    })
    .select("id, name, description, file_type, image_url, drive_url, created_at")
    .single();

  if (error) {
    console.error("Admin bonuses: failed to create resource.", error.message);
    return jsonError("Bonus gagal disimpan. Pastikan SQL bonus sudah dijalankan.", 503);
  }

  return NextResponse.json({ bonus: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return jsonError("Permintaan tidak valid.", 403);
  }

  const result = await getAdminClient();
  if ("error" in result) return result.error;

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Permintaan hapus tidak valid.", 400);
  }

  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) {
    return jsonError("ID bonus tidak valid.", 400);
  }

  const { error } = await result.supabase
    .from("joolo_bonus_resources")
    .delete()
    .eq("id", body.id);

  if (error) {
    console.error("Admin bonuses: failed to delete resource.", error.message);
    return jsonError("Bonus gagal dihapus.", 500);
  }

  return NextResponse.json({ success: true });
}
