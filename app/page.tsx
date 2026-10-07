"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    try {
      const savedEmail = window.localStorage.getItem("joolo.rememberedEmail");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberAccount(true);
      }
    } catch {
      // Storage may be unavailable in private browsing; sign-in still works.
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "login") {
      setMessage("Silakan login untuk membuka halaman admin.");
      setMessageType("error");
    } else if (params.get("admin") === "required") {
      setMessage("Akun ini tidak memiliki akses admin.");
      setMessageType("error");
    } else if (params.get("admin") === "setup") {
      setMessage("Pengaturan database admin belum aktif. Jalankan SQL terbaru di supabase/schema.sql.");
      setMessageType("error");
    } else if (params.get("dashboard") === "login") {
      setMessage("Silakan login untuk membuka dashboard.");
      setMessageType("error");
    } else if (params.get("dashboard") === "setup") {
      setMessage("Setup onboarding Supabase belum diterapkan. Jalankan SQL terbaru dari supabase/schema.sql.");
      setMessageType("error");
    } else if (params.get("auth") === "success") {
      setMessage("You’re signed in. Welcome to JOOLO.");
      setMessageType("success");
    } else if (params.has("error")) {
      setMessage("We couldn’t complete sign-in. Please try again.");
      setMessageType("error");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setMessageType("");

    if (isSignUp && password.length < 8) {
      setMessage("Choose a password with at least 8 characters.");
      setMessageType("error");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage("Login is not configured yet. Please add your Supabase environment variables.");
      setMessageType("error");
      return;
    }

    function rememberEmailAfterSignIn() {
      if (!rememberAccount || isSignUp) {
        return true;
      }

      try {
        window.localStorage.setItem("joolo.rememberedEmail", email.trim());
        return true;
      } catch {
        return false;
      }
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setMessage(error.message);
          setMessageType("error");
          return;
        }

        if (!data.session) {
          setMessage(
            "Supabase is still asking for email confirmation. In Supabase, open Authentication → Sign In / Providers → Email and turn off Confirm email, then try signing up again.",
          );
          setMessageType("error");
          return;
        }

        if (!rememberEmailAfterSignIn()) {
          setMessage("Account created, but this browser couldn’t remember your email.");
          setMessageType("error");
          return;
        }

        router.replace("/dashboard");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(error.message);
        setMessageType("error");
        return;
      }

      rememberEmailAfterSignIn();
      router.replace("/dashboard");
    } catch {
      setMessage("We couldn’t reach the sign-in service. Please try again.");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordRecovery() {
    setMessage("");
    setMessageType("");

    if (!email.trim()) {
      setMessage("Masukkan alamat email akun terlebih dahulu.");
      setMessageType("error");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage("Login is not configured yet. Please add your Supabase environment variables.");
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        setMessage(error.message);
        setMessageType("error");
        return;
      }

      setMessage("Tautan untuk membuat kata sandi baru sudah dikirim. Periksa email Anda.");
      setMessageType("success");
    } catch {
      setMessage("Kami tidak dapat mengirim tautan pemulihan. Silakan coba lagi.");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="story-panel" aria-label="About JOOLO">
        <div className="starfield" aria-hidden="true" />
        <div className="story-content">
          <a className="brand" href="/" aria-label="JOOLO home">
            <span className="brand-mark" aria-hidden="true">
              <span />
            </span>
            <span>joolo</span>
          </a>

          <div className="story-copy">
            <p className="eyebrow"><span /> YOUR SPACE TO BECOME</p>
            <h1>
              Small steps.
              <br />
              <span>A whole new</span>
              <br />
              universe.
            </h1>
            <p className="story-description">
              Forty days to meet the version of you that’s been waiting to
              bloom.
            </p>

            <div className="challenge-note">
              <div className="note-icon" aria-hidden="true">
                ✳
              </div>
              <div>
                <strong>40 days, just for you</strong>
                <span>One intention. A little progress. Every day.</span>
              </div>
            </div>
          </div>

          <div className="orbit-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="planet">
              <div className="planet-glow" />
            </div>
            <span className="orbit-dot dot-one" />
            <span className="orbit-dot dot-two" />
            <span className="orbit-dot dot-three" />
          </div>

          <div className="story-footer">
            <span>MADE FOR YOUR NEXT CHAPTER</span>
            <span className="footer-star">✳</span>
          </div>
        </div>
      </section>

      <section className="form-panel" aria-label={isSignUp ? "Create account" : "Sign in"}>
        <div className="mobile-brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>joolo</span>
        </div>

        <div className="form-card">
          <div className="welcome-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3.5v3M12 17.5v3M3.5 12h3m11 0h3M6 6l2.1 2.1m7.8 7.8L18 18m0-12-2.1 2.1m-7.8 7.8L6 18" />
              <circle cx="12" cy="12" r="4.2" />
            </svg>
          </div>
          <p className="form-kicker">
            {isSignUp ? "YOUR NEXT CHAPTER STARTS HERE" : "YOUR JOURNEY CONTINUES"}
          </p>
          <h2>{isSignUp ? "Begin again." : "Welcome back."}</h2>
          <p className="form-description">
            {isSignUp
              ? "Create an account and make space for your growth."
              : "Sign in to pick up where your growth left off."}
          </p>

          <form onSubmit={handleSubmit} autoComplete="on">
            <label htmlFor="email">Email address</label>
            <div className="input-wrap">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="2.4" y="4.2" width="15.2" height="11.6" rx="2" />
                <path d="m3.2 5.5 6.8 5.1 6.8-5.1" />
              </svg>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <label htmlFor="password">Password</label>
            {!isSignUp && (
              <button
                className="forgot-password-button"
                type="button"
                onClick={handlePasswordRecovery}
                disabled={isSubmitting}
              >
                Lupa kata sandi?
              </button>
            )}
            <div className="input-wrap password-wrap">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="3.5" y="8.5" width="13" height="9" rx="2" />
                <path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5M10 12v2" />
              </svg>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                placeholder={isSignUp ? "At least 8 characters" : "Your password"}
                minLength={isSignUp ? 8 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {!isSignUp && (
              <div className="remember-account">
                <label className="remember-control" htmlFor="remember-account">
                  <input
                    id="remember-account"
                    name="remember-account"
                    type="checkbox"
                    checked={rememberAccount}
                    onChange={(event) => {
                      const shouldRemember = event.target.checked;
                      setRememberAccount(shouldRemember);
                      if (!shouldRemember) {
                        try {
                          window.localStorage.removeItem("joolo.rememberedEmail");
                        } catch {
                          setMessage("This browser can’t update saved sign-in details.");
                          setMessageType("error");
                        }
                      }
                    }}
                  />
                  <span>Ingat akun ini di perangkat saya</span>
                </label>
                <p>Password disimpan oleh browser jika Anda menyetujuinya.</p>
              </div>
            )}

            <button className="submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isSignUp
                  ? "Creating your account..."
                  : "Signing you in..."
                : isSignUp
                  ? "Create account"
                  : "Sign in with email"}
              {!isSubmitting && <span aria-hidden="true">↗</span>}
            </button>
          </form>

          {message && (
            <p className={`form-message ${messageType}`} role="status">
              {message}
            </p>
          )}

          <p className="auth-switch">
            {isSignUp ? "Already have an account?" : "New to JOOLO?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp((value) => !value);
                setMessage("");
                setMessageType("");
              }}
            >
              {isSignUp ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="divider">
            <span>{isSignUp ? "A SPACE TO GROW" : "YOUR JOURNEY, YOUR PACE"}</span>
          </div>
          <p className="magic-note">
            {isSignUp
              ? "Your email and password are all you need to get started."
              : "Use your email and password to continue your challenge."}
          </p>
        </div>

        <p className="terms-note">
          By continuing, you agree to our <a href="#terms">Terms</a> and{" "}
          <a href="#privacy">Privacy Policy</a>.
        </p>
      </section>
    </main>
  );
}
