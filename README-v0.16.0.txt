RECIPE LIBRARY v0.16.0 — PASSWORD SIGN-IN

CHANGES
- Removes Google sign-in from the application.
- Removes magic-link sign-in.
- Adds normal email-and-password sign-in.
- Adds “Forgot your password?”.
- The recovery email opens a dedicated page where the user chooses a new password.
- The recovery link does not sign the user into Recipe Library as the final action.

INSTALL
1. Stop Recipe Library.
2. Run INSTALL.bat.
3. Start the app with: npm run dev
4. Open: http://localhost:3000/login

FIRST PASSWORD
If the administrator account previously used Google or magic links and has no password:
1. Click “Forgot your password?” once.
2. Open the recovery email.
3. Choose a password.
4. Sign in normally with email and password from then on.

SUPABASE URL
The reset link uses: /reset-password
If Supabase redirects elsewhere, add these to Authentication > URL Configuration > Redirect URLs:
- http://localhost:3000/reset-password
- your-production-url/reset-password

No SQL is required.
