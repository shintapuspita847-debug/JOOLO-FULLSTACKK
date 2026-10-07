"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type GeneratedBatch = {
  codes: string[];
  createdAt: string;
  expiresAt: string;
};

type BonusResource = {
  id: string;
  name: string;
  description: string;
  file_type: "pdf" | "excel";
  image_url: string;
  drive_url: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
  }).format(new Date(value));
}

async function downloadPdf(batch: GeneratedBatch) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const columnGap = 7;
  const columnWidth = (pageWidth - margin * 2 - columnGap) / 2;
  const rowHeight = 12;
  const rowsPerColumn = 17;
  const rowsPerPage = rowsPerColumn * 2;

  pdf.setProperties({
    title: "JOOLO — Kode Akses",
    subject: "Kode akses challenge JOOLO",
    author: "JOOLO",
  });

  for (let start = 0; start < batch.codes.length; start += rowsPerPage) {
    if (start > 0) {
      pdf.addPage();
    }

    pdf.setFillColor(18, 16, 35);
    pdf.rect(0, 0, pageWidth, 48, "F");
    pdf.setTextColor(237, 225, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(21);
    pdf.text("JOOLO", margin, 20);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(194, 181, 222);
    pdf.text("40-DAY GROWTH CHALLENGE", margin, 28);
    pdf.setFontSize(9);
    pdf.text(`Dibuat ${formatDate(batch.createdAt)}`, margin, 37);
    pdf.text(`Berlaku sampai ${formatDate(batch.expiresAt)}`, pageWidth - margin, 37, {
      align: "right",
    });

    const codesOnPage = batch.codes.slice(start, start + rowsPerPage);
    codesOnPage.forEach((code, index) => {
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const x = margin + column * (columnWidth + columnGap);
      const y = 56 + row * rowHeight;

      pdf.setFillColor(247, 244, 252);
      pdf.setDrawColor(224, 216, 238);
      pdf.roundedRect(x, y, columnWidth, 9, 1.5, 1.5, "FD");
      pdf.setTextColor(37, 31, 55);
      pdf.setFont("courier", "bold");
      pdf.setFontSize(10);
      pdf.text(code, x + 4, y + 5.8);
    });

    pdf.setDrawColor(224, 216, 238);
    pdf.line(margin, pageHeight - 17, pageWidth - margin, pageHeight - 17);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(115, 106, 133);
    pdf.text(
      `${batch.codes.length} kode unik · Setiap kode berlaku satu kali`,
      margin,
      pageHeight - 11,
    );
    pdf.text(
      `Halaman ${Math.floor(start / rowsPerPage) + 1}`,
      pageWidth - margin,
      pageHeight - 11,
      { align: "right" },
    );
  }

  pdf.save(`joolo-kode-akses-${new Date(batch.createdAt).toISOString().slice(0, 10)}.pdf`);
}

export default function AdminDashboard({ email }: { email: string }) {
  const [quantity, setQuantity] = useState("10");
  const [batch, setBatch] = useState<GeneratedBatch | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [bonuses, setBonuses] = useState<BonusResource[]>([]);
  const [isLoadingBonuses, setIsLoadingBonuses] = useState(true);
  const [isSavingBonus, setIsSavingBonus] = useState(false);
  const [deletingBonusId, setDeletingBonusId] = useState("");
  const [bonusMessage, setBonusMessage] = useState("");
  const [bonusMessageType, setBonusMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    async function loadBonuses() {
      try {
        const response = await fetch("/api/admin/bonuses");
        const result = (await response.json()) as {
          bonuses?: BonusResource[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "Daftar bonus gagal dimuat.");
        }
        setBonuses(result.bonuses ?? []);
      } catch (error) {
        setBonusMessage(
          error instanceof Error ? error.message : "Daftar bonus gagal dimuat.",
        );
        setBonusMessageType("error");
      } finally {
        setIsLoadingBonuses(false);
      }
    }

    void loadBonuses();
  }, []);

  async function handleCreateBonus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBonusMessage("");
    setIsSavingBonus(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/admin/bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("bonusName"),
          description: formData.get("bonusDescription"),
          fileType: formData.get("bonusFileType"),
          imageUrl: formData.get("bonusImageUrl"),
          driveUrl: formData.get("bonusDriveUrl"),
        }),
      });
      const result = (await response.json()) as {
        bonus?: BonusResource;
        error?: string;
      };

      const createdBonus = result.bonus;
      if (!response.ok || !createdBonus) {
        throw new Error(result.error ?? "Bonus gagal disimpan.");
      }

      setBonuses((current) => [createdBonus, ...current]);
      form.reset();
      setBonusMessage("Bonus berhasil ditambahkan dan sekarang tampil di dashboard.");
      setBonusMessageType("success");
    } catch (error) {
      setBonusMessage(
        error instanceof Error ? error.message : "Bonus gagal disimpan.",
      );
      setBonusMessageType("error");
    } finally {
      setIsSavingBonus(false);
    }
  }

  async function handleDeleteBonus(id: string) {
    setBonusMessage("");
    setDeletingBonusId(id);
    try {
      const response = await fetch("/api/admin/bonuses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Bonus gagal dihapus.");
      }

      setBonuses((current) => current.filter((bonus) => bonus.id !== id));
      setBonusMessage("Bonus berhasil dihapus dari dashboard.");
      setBonusMessageType("success");
    } catch (error) {
      setBonusMessage(
        error instanceof Error ? error.message : "Bonus gagal dihapus.",
      );
      setBonusMessageType("error");
    } finally {
      setDeletingBonusId("");
    }
  }

  async function handleGenerate() {
    setMessage("");
    setBatch(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/admin/access-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: Number(quantity) }),
      });
      const result = (await response.json()) as GeneratedBatch & { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Gagal membuat kode akses.");
      }

      setBatch(result);
      try {
        await downloadPdf(result);
        setMessage("Kode akses berhasil dibuat. PDF sudah diunduh.");
        setMessageType("success");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? `Kode tersimpan, tetapi PDF gagal diunduh: ${error.message}`
            : "Kode tersimpan, tetapi PDF gagal diunduh. Gunakan tombol Unduh PDF.",
        );
        setMessageType("error");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Terjadi kesalahan saat membuat kode.",
      );
      setMessageType("error");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownload() {
    if (!batch) return;
    setIsDownloading(true);
    try {
      await downloadPdf(batch);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `PDF tidak dapat dibuat: ${error.message}`
          : "PDF tidak dapat dibuat. Silakan coba lagi.",
      );
      setMessageType("error");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase tidak terkonfigurasi.");
      setMessageType("error");
      setIsSigningOut(false);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      setMessageType("error");
      setIsSigningOut(false);
      return;
    }

    window.location.assign("/");
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a className="brand" href="/" aria-label="JOOLO home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>joolo</span>
          <span className="admin-brand-label">ADMIN</span>
        </a>
        <div className="admin-account">
          <span>{email}</span>
          <button type="button" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? "Keluar..." : "Keluar"}
          </button>
        </div>
      </header>

      <section className="admin-content">
        <p className="eyebrow"><span /> JOOLO CONTROL ROOM</p>
        <h1>Access codes</h1>
        <p className="admin-intro">
          Buat kode akses unik untuk challenge JOOLO 40 hari.
          Setiap kode hanya dapat digunakan satu kali dan berlaku selama enam bulan.
        </p>

        <section className="generator-card" aria-labelledby="generator-heading">
          <div className="generator-card-heading">
            <span className="generator-icon" aria-hidden="true">✳</span>
            <div>
              <p className="form-kicker">ACCESS CODE GENERATOR</p>
              <h2 id="generator-heading">Generate a new batch</h2>
            </div>
          </div>

          <label htmlFor="quantity">Jumlah kode</label>
          <div className="generator-controls">
            <input
              id="quantity"
              name="quantity"
              type="number"
              inputMode="numeric"
              min="1"
              max="100"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <button
              className="submit-button"
              type="button"
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                !Number.isInteger(Number(quantity)) ||
                Number(quantity) < 1 ||
                Number(quantity) > 100
              }
            >
              {isGenerating ? "Membuat kode..." : "Generate & download PDF"}
              {!isGenerating && <span aria-hidden="true">↗</span>}
            </button>
          </div>
          <p className="generator-hint">
            Maksimal 100 kode per batch. Kode disimpan dalam bentuk hash di database.
          </p>

          {message && (
            <p className={`form-message ${messageType}`} role="status">
              {message}
            </p>
          )}

          {batch && (
            <div className="generated-result">
              <div className="generated-result-header">
                <div>
                  <strong>{batch.codes.length} kode berhasil dibuat</strong>
                  <span>
                    Berlaku sampai {formatDate(batch.expiresAt)} · PDF siap diunduh
                  </span>
                </div>
                <button
                  className="download-button"
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? "Menyiapkan PDF..." : "Unduh PDF"}
                </button>
              </div>
              <ul className="generated-code-list">
                {batch.codes.map((code) => <li key={code}>{code}</li>)}
              </ul>
              <p className="code-warning">
                Simpan PDF ini dengan aman. Kode asli hanya ditampilkan saat dibuat;
                database hanya menyimpan hash kode.
              </p>
            </div>
          )}
        </section>

        <section className="generator-card bonus-admin-card" aria-labelledby="bonus-admin-heading">
          <div className="generator-card-heading">
            <span className="generator-icon" aria-hidden="true">✧</span>
            <div>
              <p className="form-kicker">MEMBER DOWNLOADS</p>
              <h2 id="bonus-admin-heading">Tambah bonus PDF atau Excel</h2>
            </div>
          </div>

          <form className="bonus-admin-form" onSubmit={handleCreateBonus}>
            <label htmlFor="bonus-name">Nama file</label>
            <input
              id="bonus-name"
              name="bonusName"
              type="text"
              maxLength={120}
              placeholder="Contoh: Jurnal Refleksi Mingguan"
              required
            />

            <label htmlFor="bonus-description">Deskripsi singkat</label>
            <textarea
              id="bonus-description"
              name="bonusDescription"
              maxLength={500}
              rows={3}
              placeholder="Jelaskan manfaat file ini untuk member."
              required
            />

            <label htmlFor="bonus-file-type">Jenis file</label>
            <select id="bonus-file-type" name="bonusFileType" defaultValue="pdf">
              <option value="pdf">PDF</option>
              <option value="excel">Excel (.xlsx)</option>
            </select>

            <label htmlFor="bonus-image-url">Link gambar sampul</label>
            <input
              id="bonus-image-url"
              name="bonusImageUrl"
              type="url"
              placeholder="https://example.com/gambar-bonus.jpg"
              required
            />

            <label htmlFor="bonus-drive-url">Link file Google Drive</label>
            <input
              id="bonus-drive-url"
              name="bonusDriveUrl"
              type="url"
              placeholder="https://drive.google.com/file/d/..."
              required
            />
            <p className="generator-hint">
              Atur izin berbagi Google Drive agar pengguna yang memiliki link
              dapat membuka atau mengunduh file.
            </p>

            {bonusMessage && (
              <p className={`form-message ${bonusMessageType}`} role="status">
                {bonusMessage}
              </p>
            )}

            <button className="submit-button bonus-admin-submit" type="submit" disabled={isSavingBonus}>
              {isSavingBonus ? "Menyimpan bonus..." : "Tambahkan ke dashboard"}
              {!isSavingBonus && <span aria-hidden="true">↗</span>}
            </button>
          </form>

          <div className="bonus-admin-list">
            <h3>Bonus yang tersedia</h3>
            {isLoadingBonuses ? (
              <p className="generator-hint">Memuat daftar bonus...</p>
            ) : bonuses.length === 0 ? (
              <p className="generator-hint">Belum ada bonus tambahan.</p>
            ) : (
              <ul>
                {bonuses.map((bonus) => (
                  <li key={bonus.id}>
                    <img src={bonus.image_url} alt="" />
                    <span>
                      <strong>{bonus.name}</strong>
                      <small>{bonus.file_type === "pdf" ? "PDF" : "Excel"}</small>
                    </span>
                    <button
                      className="bonus-admin-delete"
                      type="button"
                      onClick={() => handleDeleteBonus(bonus.id)}
                      disabled={deletingBonusId !== ""}
                    >
                      {deletingBonusId === bonus.id ? "Menghapus..." : "Hapus"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <a className="admin-back-link" href="/">← Kembali ke JOOLO</a>
      </section>
    </main>
  );
}
