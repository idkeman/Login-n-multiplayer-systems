/* Reusable Supabase email/password authentication. Google OAuth is intentionally not included. */
(function (global) {
  "use strict";
  const DEFAULT_CONFIG = {
    supabaseUrl: "https://dkwmkvruzebnqlmvwzhy.supabase.co",
    supabaseKey: "sb_publishable_Tur9X4MaQjH__4DnEtwAAQ_Xy9xVl5P",
    redirectUrl: location.origin + location.pathname
  };
  let client = null, currentUser = null, currentProfile = null;
  const api = {
    async init(config = {}) {
      if (!global.supabase) throw new Error("Supabase JS failed to load.");
      const cfg = { ...DEFAULT_CONFIG, ...config };
      client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      await api.refresh();
      client.auth.onAuthStateChange(() => api.refresh());
      return api;
    },
    get client() { return client; },
    get user() { return currentUser; },
    get profile() { return currentProfile; },
    get isLoggedIn() { return !!currentUser; },
    get isAdmin() { return currentProfile?.role === "admin"; },
    async login(email, password) {
      requireClient();
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await api.refresh();
      return data;
    },
    async signup(email, password, username) {
      requireClient();
      email = email.trim(); username = username.trim();
      if (!email || !password) throw new Error("Enter your email and password.");
      if (!username) throw new Error("Enter a username.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      const { data, error } = await client.auth.signUp({
        email, password,
        options: { data: { username }, emailRedirectTo: DEFAULT_CONFIG.redirectUrl }
      });
      if (error) throw error;
      await api.refresh();
      return data;
    },
    async forgotPassword(email) {
      requireClient();
      email = email.trim();
      if (!email) throw new Error("Enter your email first.");
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: DEFAULT_CONFIG.redirectUrl });
      if (error) throw error;
    },
    async logout() {
      requireClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      currentUser = null; currentProfile = null;
    },
    async updateUsername(username) {
      requireClient();
      username = username.trim();
      if (!username) throw new Error("Enter a username.");
      const { data, error } = await client.auth.updateUser({ data: { username } });
      if (error) throw error;
      const { error: profileError } = await client.from("profiles").update({ username }).eq("id", currentUser.id);
      if (profileError) throw profileError;
      await api.refresh();
      return data;
    },
    async refresh() {
      requireClient();
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      currentUser = sessionData.session?.user || null;
      currentProfile = null;
      if (!currentUser) {
        global.dispatchEvent(new CustomEvent("login-state", { detail: { user: null, profile: null } }));
        return;
      }
      const { data: profile, error } = await client.from("profiles")
        .select("id,username,role,banned,ban_reason,banned_until,verified,verified_at")
        .eq("id", currentUser.id).maybeSingle();
      if (error) throw error;
      currentProfile = profile || null;
      const activeBan = !!(profile?.banned && (!profile.banned_until || new Date(profile.banned_until) > new Date()));
      if (activeBan) {
        await client.auth.signOut();
        currentUser = null; currentProfile = null;
        global.dispatchEvent(new CustomEvent("login-banned", {
          detail: { reason: profile.ban_reason || "No reason provided.", until: profile.banned_until || null }
        }));
        return;
      }
      global.dispatchEvent(new CustomEvent("login-state", {
        detail: { user: currentUser, profile: currentProfile }
      }));
    }
  };
  function requireClient() {
    if (!client) throw new Error("Login system has not been initialized. Call LoginSystem.init().");
  }
  global.LoginSystem = api;
})(window);
