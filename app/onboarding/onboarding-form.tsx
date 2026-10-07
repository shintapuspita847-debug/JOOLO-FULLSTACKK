"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/onboarding/claim-access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          gender,
          ageGroup,
          accessCode,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage(result.error ?? "Data onboarding tidak dapat disimpan.");
        return;
      }

      router.replace("/dashboard");
    } catch {
      setMessage("Tidak dapat terhubung ke server. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <a className="brand" href="/" aria-label="JOOLO home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>joolo</span>
        </a>
        <span className="onboarding-step">YOUR FIRST STEP <span>✳</span></span>
      </header>

      <section className="onboarding-content">
        <div className="onboarding-heading">
          <p className="eyebrow"><span /> YOUR JOURNEY STARTS WITHIN</p>
          <h1>Make this space yours.</h1>
          <p>
            Tell us a little about yourself and enter your one-time access code
            to unlock your 40-day challenge.
          </p>
        </div>

        <form className="onboarding-card" onSubmit={handleSubmit}>
          <div className="onboarding-user">
            <span className="onboarding-avatar" aria-hidden="true">✳</span>
            <span>
              <strong>Setting up your JOOLO space</strong>
              <small>{email}</small>
            </span>
          </div>

          <label htmlFor="full-name">Full name</label>
          <input
            className="onboarding-input"
            id="full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            maxLength={100}
            placeholder="Your full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <div className="onboarding-field-grid">
            <div>
              <label htmlFor="gender">Gender</label>
              <select
                className="onboarding-input"
                id="gender"
                name="gender"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
                required
              >
                <option value="" disabled>Select gender</option>
                <option value="woman">Woman</option>
                <option value="man">Man</option>
              </select>
            </div>
            <div>
              <label htmlFor="age-group">Age</label>
              <select
                className="onboarding-input"
                id="age-group"
                name="ageGroup"
                value={ageGroup}
                onChange={(event) => setAgeGroup(event.target.value)}
                required
              >
                <option value="" disabled>Select age range</option>
                <option value="under_18">&lt;18</option>
                <option value="18_25">18-25</option>
                <option value="over_25">&gt;25</option>
              </select>
            </div>
          </div>

          <label htmlFor="access-code">Access code</label>
          <input
            className="onboarding-input access-code-input"
            id="access-code"
            name="accessCode"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={35}
            placeholder="V8R3T6Y1H5F2D9L4"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
            required
          />
          <p className="onboarding-hint">
            Each access code can unlock one account only.
          </p>

          {message && <p className="form-message error" role="alert">{message}</p>}

          <button className="submit-button onboarding-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "UNLOCKING YOUR SPACE..." : "START ACTION"}
            {!isSubmitting && <span aria-hidden="true">↗</span>}
          </button>
        </form>
        <p className="onboarding-footer">40 DAYS, JUST FOR YOU. ONE DAY AT A TIME.</p>
      </section>
    </main>
  );
}
