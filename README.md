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
after creation, and is included in the downloadable PDF. The original code
is shown only when generated, so keep the PDF securely. The SQL function
`public.consume_joolo_access_code(input_code)` atomically validates and
redeems a code once; connect it to the enrollment flow when access-code
redemption is added to the app.
