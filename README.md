# JOOLO

A cosmic-themed sign-in page for the JOOLO 40-day self-growth challenge. It
uses Supabase Auth email/password sign-in and creates a private app profile
when an account is first registered.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set the Supabase project URL and
   publishable key. Existing projects using an anon key can set
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead.
3. In Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).
4. In Supabase, open **Authentication → Sign In / Providers → Email** and
   turn off **Confirm email** to let new users register and sign in without
   opening their inbox.
5. Start the app with `npm run dev`.

Supabase stores authenticated users in its managed `auth.users` table; the
SQL trigger mirrors their ID and email into `public.profiles`. Row-level
security ensures each signed-in user can only read their own profile.

Existing users created with a magic link may not have a password yet. They
can select **Lupa kata sandi?** on the sign-in form to set one using a
Supabase password-recovery email.

On the sign-in form, **Ingat akun ini di perangkat saya** remembers only the
email address in that browser. The password is never stored by the app;
password saving and autofill are handled securely by the browser's password
manager using the standard email/password autocomplete fields.

## Admin dashboard and access-code PDF

1. Sign in to JOOLO with the account that should be an administrator.
2. In Supabase **SQL Editor**, run the updated
   [`supabase/schema.sql`](./supabase/schema.sql).
3. In Supabase **Authentication → Users**, copy that user's UUID.
4. In the SQL Editor, grant admin access to that UUID:

   ```sql
   insert into public.joolo_admins (user_id)
   values ('PASTE-USER-UUID-HERE')
   on conflict (user_id) do nothing;
   ```

5. Open `/admin` while signed in as that account. To remove admin access:

   ```sql
   delete from public.joolo_admins
   where user_id = 'PASTE-USER-UUID-HERE';
   ```

Admin checks run on the server and in database row-level security. The app
does not use a service-role key. The dashboard generates 1–100 unique codes
per batch; each is stored as a SHA-256 hash, expires six calendar months
after creation, and is included in the downloadable PDF. A code can optionally
be reserved for a specific email address. The original code is shown only
when generated, so keep the PDF securely.

## First-time onboarding

After signing in, users are sent to `/dashboard`. If they have not completed
onboarding, the dashboard redirects them to `/onboarding` to submit their
full name, gender, age range, and a generated access code. The RPC
`public.claim_joolo_access_code(...)` validates and consumes the code in the
same database transaction that saves the profile. Each code can be claimed
once, expires after six calendar months, and a completed profile is sent
straight to the dashboard on future visits. Run the latest
[`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor
before enabling this flow.

## Member dashboard bonuses

The authenticated member dashboard is available at `/dashboard` after
onboarding. It offers two free, locally generated downloads: a 40-day guided
reflection journal (`.pdf`) and an editable 40-day challenge tracker
(`.xlsx`). The spreadsheet includes a tracker sheet and a short getting-started
guide; neither download sends member data to an external service. Files are
generated when downloaded, so no separate bonus-file hosting or SQL setup is
required.

## Lynk.id purchase webhook → access-code email

The server endpoint `/api/webhooks/lynk` accepts successful Lynk.id
`payment.received` events. It checks the Lynk `X-Lynk-Signature` SHA-256
signature (`grandTotal + refId + message_id + merchant key`), verifies that
the purchased item UUID matches `LYNK_PRODUCT_UUID`, creates one unique
six-month access code reserved for the buyer email, and sends it through
Brevo's **transactional email API**. The Brevo API key and Supabase
service-role key are used only on the server.

Configure these server-only environment variables in `.env.local` (and in
your production hosting environment):

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Project Settings → API Keys →
  `service_role` secret. Keep it private; never add a `NEXT_PUBLIC_` prefix.
- `LYNK_MERCHANT_KEY` — the merchant key Lynk.id shows after saving the
  webhook URL.
- `LYNK_PRODUCT_UUID` — the JOOLO product UUID from a Lynk.id webhook
  `data.message_data.items[].uuid`.
- `BREVO_API_KEY` — Brevo API key.
- `BREVO_SENDER_EMAIL` — a sender address verified in Brevo.
- `BREVO_SENDER_NAME` — optional; defaults to `JOOLO`.

Run the updated `supabase/schema.sql` in the Supabase SQL Editor to create the
idempotent `lynk_purchase_orders` table and service-role-only RPC functions.
The SQL requires at least one row in `public.joolo_admins` to associate newly
issued codes with an administrator.

In Lynk.id, set the webhook URL to
`https://YOUR_PUBLIC_DOMAIN/api/webhooks/lynk`. Lynk.id cannot call a local
`localhost` development server. Save the URL, copy its merchant key into
`LYNK_MERCHANT_KEY`, and deploy/restart the app. Verify the sender in Brevo
before accepting real orders.

Repeated webhook events for the same `refId` reuse the existing order/code
and do not resend an email after Brevo has accepted it. Failed email attempts
retain the pending code so a Lynk retry can try again. The webhook ignores
successful purchases for products other than `LYNK_PRODUCT_UUID`.

`CAMPAIGN_ID` is not used for these order-specific messages. A Brevo
marketing campaign targets a list/audience; it is not a transactional
per-purchase email. This flow sends each unique code using Brevo's
transactional email API with the verified sender above.
