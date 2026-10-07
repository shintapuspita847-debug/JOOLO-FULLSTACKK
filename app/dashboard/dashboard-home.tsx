"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createGrowthTrackerWorkbook } from "@/lib/growth-tracker";

type DashboardHomeProps = {
  email: string;
  fullName: string;
  onboardingCompletedAt: string;
  bonuses: {
    id: string;
    name: string;
    description: string;
    file_type: "pdf" | "excel";
    image_url: string;
    drive_url: string;
  }[];
  bonusLoadError: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default function DashboardHome({
  email,
  fullName,
  onboardingCompletedAt,
  bonuses,
  bonusLoadError,
}: DashboardHomeProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState<"pdf" | "excel" | "">("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const firstName = fullName.trim().split(/\s+/)[0] || "friend";

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const interval = window.setInterval(refreshWhenVisible, 15_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [router]);

  async function downloadJournal() {
    setDownloading("pdf");
    setDownloadMessage("");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const prompts = [
        "Apa hal kecil yang membuatmu merasa bangga hari ini?",
        "Kebiasaan apa yang ingin kamu bangun, dan mengapa?",
        "Kapan kamu merasa paling berenergi hari ini?",
        "Apa satu hal yang ingin kamu lepaskan minggu ini?",
        "Siapa yang menginspirasi dirimu untuk terus bertumbuh?",
        "Apa arti istirahat yang cukup untuk dirimu?",
        "Hal baru apa yang ingin kamu coba?",
        "Kapan kamu berhasil berkata tidak pada hal yang menguras energi?",
        "Apa yang ingin kamu syukuri dari dirimu hari ini?",
        "Langkah kecil apa yang akan mendekatkanmu pada tujuanmu?",
        "Apa tantangan yang kamu hadapi dan apa yang kamu pelajari?",
        "Kapan kamu merasa paling menjadi dirimu sendiri?",
        "Apa pikiran baik yang ingin kamu bawa sepanjang hari?",
        "Bagaimana kamu merawat dirimu saat merasa lelah?",
        "Apa satu hal yang ingin kamu lakukan dengan lebih berani?",
        "Pencapaian kecil apa yang layak kamu rayakan?",
        "Apa batasan sehat yang ingin kamu jaga?",
        "Bagaimana kamu ingin orang lain merasa setelah bertemu denganmu?",
        "Apa yang sudah kamu lakukan lebih baik dibanding kemarin?",
        "Apa satu hal yang bisa kamu sederhanakan?",
        "Apa yang ingin kamu katakan kepada dirimu di masa lalu?",
        "Kapan kamu memberi perhatian penuh pada sesuatu hari ini?",
        "Apa hubungan yang ingin kamu rawat dengan lebih baik?",
        "Apa yang dapat kamu pelajari dari rasa tidak nyaman?",
        "Apa pilihan yang membuatmu merasa selaras dengan nilai dirimu?",
        "Apa yang ingin kamu rayakan tentang perjalananmu sejauh ini?",
        "Kegiatan apa yang membuat waktu terasa berjalan lebih ringan?",
        "Apa hal baik yang dapat kamu berikan kepada orang lain hari ini?",
        "Kekhawatiran apa yang bisa kamu ubah menjadi satu langkah nyata?",
        "Apa yang ingin kamu coba meski hasilnya belum pasti?",
        "Apa yang membantu kamu kembali fokus?",
        "Hal apa yang ingin kamu maafkan dari dirimu sendiri?",
        "Apa satu hal yang ingin kamu lakukan dengan penuh perhatian?",
        "Bagaimana kamu tahu bahwa kamu sedang berkembang?",
        "Apa kebiasaan yang tidak lagi mendukung dirimu?",
        "Momen apa yang ingin kamu kenang dari minggu ini?",
        "Apa yang bisa kamu lakukan untuk masa depan dirimu?",
        "Apa yang terasa lebih mudah setelah kamu terus mencoba?",
        "Apa perubahan positif yang kamu perhatikan dalam dirimu?",
        "Apa niat yang ingin kamu bawa ke babak berikutnya?",
      ];

      const drawHeader = (pageNumber: number) => {
        pdf.setFillColor(18, 16, 35);
        pdf.rect(0, 0, width, 31, "F");
        pdf.setTextColor(237, 225, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.text("JOOLO", margin, 14);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(194, 181, 222);
        pdf.text("40-DAY COSMIC GROWTH JOURNAL", margin, 22);
        pdf.text(`PAGE ${pageNumber}`, width - margin, 22, { align: "right" });
      };

      pdf.setProperties({
        title: "JOOLO — 40-Day Growth Journal",
        subject: "A guided reflection journal for your 40-day growth challenge",
        author: "JOOLO",
      });

      drawHeader(1);
      let pageNumber = 1;
      let y = 42;

      pdf.setTextColor(61, 48, 83);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("A little space to grow.", margin, y);
      y += 7;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(112, 103, 130);
      pdf.text(
        "Take a few quiet minutes each day. Small, honest answers are enough.",
        margin,
        y,
      );
      y += 9;

      prompts.forEach((prompt, index) => {
        const lines = pdf.splitTextToSize(prompt, width - margin * 2 - 22) as string[];
        const blockHeight = Math.max(35, 22 + lines.length * 4);
        if (y + blockHeight > height - 17) {
          pdf.addPage();
          pageNumber += 1;
          drawHeader(pageNumber);
          y = 41;
        }

        pdf.setFillColor(247, 244, 252);
        pdf.roundedRect(margin, y, width - margin * 2, blockHeight - 3, 2, 2, "F");
        pdf.setTextColor(143, 111, 195);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text(`DAY ${String(index + 1).padStart(2, "0")}`, margin + 4, y + 6);
        pdf.setTextColor(48, 41, 65);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(lines, margin + 25, y + 6);

        const firstRuleY = y + blockHeight - 12;
        pdf.setDrawColor(218, 211, 231);
        pdf.line(margin + 4, firstRuleY, width - margin - 4, firstRuleY);
        pdf.line(margin + 4, firstRuleY + 4, width - margin - 4, firstRuleY + 4);
        y += blockHeight + 2;
      });

      const pages = pdf.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        pdf.setPage(page);
        pdf.setDrawColor(224, 216, 238);
        pdf.line(margin, height - 11, width - margin, height - 11);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(115, 106, 133);
        pdf.text("SMALL STEPS. A WHOLE NEW UNIVERSE.", margin, height - 7);
        pdf.text(`${page} / ${pages}`, width - margin, height - 7, { align: "right" });
      }

      pdf.save("joolo-40-day-growth-journal.pdf");
      setDownloadMessage("Jurnal PDF berhasil diunduh.");
    } catch (error) {
      setDownloadMessage(
        error instanceof Error ? `PDF gagal dibuat: ${error.message}` : "PDF gagal dibuat.",
      );
    } finally {
      setDownloading("");
    }
  }

  async function downloadTracker() {
    setDownloading("excel");
    setDownloadMessage("");
    try {
      const bytes = createGrowthTrackerWorkbook();
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "joolo-40-day-growth-tracker.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      setDownloadMessage("Tracker Excel berhasil diunduh.");
    } catch (error) {
      setDownloadMessage(
        error instanceof Error
          ? `Excel gagal dibuat: ${error.message}`
          : "Excel gagal dibuat.",
      );
    } finally {
      setDownloading("");
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setDownloadMessage("Tidak dapat keluar. Silakan coba lagi.");
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="member-shell">
      <header className="member-header">
        <a className="brand" href="/" aria-label="JOOLO home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>joolo</span>
        </a>
        <div className="member-header-actions">
          <span className="member-email">{email}</span>
          <button className="member-sign-out" type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="member-content">
        <p className="eyebrow"><span /> YOUR SPACE TO BECOME</p>
        <div className="member-welcome">
          <div>
            <p className="member-overline">A NEW DAY, A NEW POSSIBILITY</p>
            <h1>Welcome to your universe, {firstName}.</h1>
            <p className="member-intro">
              Your 40-day journey is a space to grow at your own pace.
              Small steps count. Showing up counts.
            </p>
          </div>
          <div className="member-orbit-art" aria-hidden="true">
            <span className="member-orbit orbit-a" />
            <span className="member-orbit orbit-b" />
            <span className="member-orbit-planet">✳</span>
            <span className="member-orbit-star star-a">✦</span>
            <span className="member-orbit-star star-b">·</span>
          </div>
        </div>

        <section className="journey-card" aria-label="Your 40-day journey">
          <div className="journey-icon" aria-hidden="true">✳</div>
          <div className="journey-copy">
            <p className="form-kicker">YOUR FIRST ORBIT</p>
            <h2>Your 40-day challenge starts here.</h2>
            <p>
              Begin with one intention today. Your space was unlocked on{" "}
              {formatDate(onboardingCompletedAt)}.
            </p>
          </div>
          <div className="journey-days" aria-label="40-day challenge">
            <strong>40</strong>
            <span>DAYS</span>
          </div>
        </section>

        <section className="bonus-section" aria-labelledby="bonus-heading">
          <div className="bonus-heading">
            <div>
              <p className="eyebrow"><span /> A LITTLE SOMETHING EXTRA</p>
              <h2 id="bonus-heading">Your cosmic bonuses.</h2>
              <p>Free tools to help you stay present through all 40 days.</p>
            </div>
            <div className="bonus-heading-actions">
              <button
                className="bonus-refresh"
                type="button"
                onClick={() => router.refresh()}
                aria-label="Refresh bonus list"
              >
                Refresh
              </button>
              <span className="bonus-heading-star" aria-hidden="true">✧</span>
            </div>
          </div>

          <div className="bonus-grid">
            <article className="bonus-card bonus-pdf">
              <div className="bonus-art" aria-hidden="true">
                <span className="bonus-art-orbit" />
                <span className="bonus-file-icon">PDF</span>
                <span className="bonus-art-star">✦</span>
              </div>
              <div className="bonus-card-content">
                <span className="bonus-tag">FREE JOURNAL</span>
                <h3>40-Day Growth Journal</h3>
                <p>
                  Forty gentle daily prompts and room to reflect, reset, and
                  notice how far you have come.
                </p>
                <button
                  className="bonus-download"
                  type="button"
                  onClick={downloadJournal}
                  disabled={downloading !== ""}
                >
                  {downloading === "pdf" ? "Preparing PDF..." : "Download PDF"}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </article>

            <article className="bonus-card bonus-excel">
              <div className="bonus-art" aria-hidden="true">
                <span className="bonus-art-orbit" />
                <span className="bonus-file-icon">XLS</span>
                <span className="bonus-art-star">✦</span>
              </div>
              <div className="bonus-card-content">
                <span className="bonus-tag">FREE TRACKER</span>
                <h3>40-Day Progress Tracker</h3>
                <p>
                  A ready-to-use spreadsheet for daily intentions, small
                  actions, mood, and reflections.
                </p>
                <button
                  className="bonus-download"
                  type="button"
                  onClick={downloadTracker}
                  disabled={downloading !== ""}
                >
                  {downloading === "excel" ? "Preparing Excel..." : "Download Excel"}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </article>

            {bonuses.map((bonus) => (
              <article
                className={`bonus-card ${bonus.file_type === "excel" ? "bonus-excel" : "bonus-pdf"}`}
                key={bonus.id}
              >
                <div className="bonus-art bonus-art-image">
                  <img src={bonus.image_url} alt="" loading="lazy" />
                  <span className="bonus-file-label">
                    {bonus.file_type === "pdf" ? "PDF" : "XLSX"}
                  </span>
                </div>
                <div className="bonus-card-content">
                  <span className="bonus-tag">MEMBER BONUS</span>
                  <h3>{bonus.name}</h3>
                  <p>{bonus.description}</p>
                  <a
                    className="bonus-download"
                    href={bonus.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Buka {bonus.file_type === "pdf" ? "PDF" : "Excel"}
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </article>
            ))}
          </div>

          {bonusLoadError && (
            <p className="bonus-download-message" role="status">
              {bonusLoadError}
            </p>
          )}
          {downloadMessage && (
            <p className="bonus-download-message" role="status">
              {downloadMessage}
            </p>
          )}
          <p className="bonus-footnote">
            Made with care for your journey. Both downloads are completely free.
          </p>
        </section>
      </section>
    </main>
  );
}
