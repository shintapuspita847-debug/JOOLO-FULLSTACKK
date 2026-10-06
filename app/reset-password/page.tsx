"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase belum dikonfigurasi.");
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.session) {
        setMessage("Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru dari halaman login.");
        return;
      }

      setIsReady(true);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Kata sandi baru harus berisi minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase belum dikonfigurasi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(error.message);
        return;
      }

      setMessageType("success");
      setMessage("Kata sandi berhasil diperbarui. Anda akan diarahkan ke halaman login.");
      window.setTimeout(() => window.location.assign("/"), 1600);
    } catch {
      setMessage("Kata sandi tidak dapat diperbarui. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="reset-shell">
      <section className="reset-card">
        <a className="brand" href="/" aria-label="JOOLO home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>joolo</span>
        </a>
        <p className="form-kicker">A FRESH START</p>
        <h1>Buat kata sandi baru.</h1>
        <p className="form-description">
          Pilih kata sandi baru untuk masuk ke akun JOOLO Anda.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="new-password">Kata sandi baru</label>
          <div className="input-wrap">
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <label htmlFor="confirm-password">Ulangi kata sandi baru</label>
          <div className="input-wrap">
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Masukkan lagi kata sandi"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          <button
            className="submit-button"
            type="submit"
            disabled={!isReady || isSubmitting}
          >
            {isSubmitting ? "Memperbarui..." : "Simpan kata sandi baru"}
          </button>
        </form>

        {message && (
          <p className={`form-message ${messageType}`} role="status">
            {message}
          </p>
        )}

        <a className="admin-back-link" href="/">← Kembali ke login</a>
      </section>
    </main>
  );
}
