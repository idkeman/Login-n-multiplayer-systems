# Login-n-multiplayer-systems

Reusable authentication foundation for browser and multiplayer projects.

## Included

- Supabase email/password login
- Account creation with username
- Persistent sessions
- Password reset
- Username/profile updates
- Ban detection
- Admin-role detection
- Verification status from the existing profiles table
- No Google OAuth

## Files

- auth.js — reusable LoginSystem API
- auth.css — demo styling
- index.html — working browser demo

## Use in another project

Load Supabase first, then auth.js:

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="./auth.js"></script>
    <script>
      LoginSystem.init();
      window.addEventListener("login-state", event => {
        console.log(event.detail.user, event.detail.profile);
      });
    </script>

Available methods:

- LoginSystem.init()
- LoginSystem.login(email, password)
- LoginSystem.signup(email, password, username)
- LoginSystem.forgotPassword(email)
- LoginSystem.logout()
- LoginSystem.updateUsername(username)
- LoginSystem.refresh()

The browser uses the Supabase publishable key. No service-role key is included.

The module is designed around the existing profiles table. Admin moderation and direct-chat are intentionally separate from the core login module.
