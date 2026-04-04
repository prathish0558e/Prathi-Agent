# OAuth Sign-In Troubleshooting Guide

## Common Error: "Unable to exchange external code" 

When you see `Unable to exchange external code: 4/0AfrIepDFTI0cW7...` and get redirected back to Login, this means Google provided a valid authorization code, but Supabase cannot exchange it for a session.

---

## Root Causes & Fixes

### 1. ❌ Redirect URI Mismatch (Most Common)

**What this means:** The callback URL in your browser doesn't match what's registered in Google Console or Supabase.

**Fix:**
1. Go to Supabase Dashboard → Authentication → Providers → Google
2. Under "Redirect URLs", add BOTH:
   - `https://prathi.tech/#/auth/callback` (for local development)
   - `https://prathi.tech/#/auth/callback` (for production)
3. It must match **exactly** - case-sensitive, include the protocol (http:// or https://)

4. Also update Google Cloud Console:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Click your OAuth 2.0 Client ID
   - Under "Authorized redirect URIs", add the same URLs
   - Click Save

5. **Wait 1-2 minutes** for changes to propagate
6. Try logging in again

---

### 2. ❌ Invalid Google Client ID or Secret

**What this means:** The credentials in Supabase don't match what Google generated.

**Fix:**
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Find your OAuth 2.0 Client ID (type "Web application")
3. Copy the Client ID and Client Secret
4. Go to Supabase → Authentication → Providers → Google
5. Paste them into the "Client ID" and "Client Secret" fields
6. Enable the provider by toggling "Enabled" to ON
7. Save and wait 1 minute

---

### 3. ❌ Google Provider Not Enabled in Supabase

**What this means:** You forgot to enable Google authentication in Supabase.

**Fix:**
1. Supabase Dashboard → Authentication → Providers
2. Click "Google"
3. Toggle "Enabled" to ON
4. Enter your Client ID and Secret (see #2 above)
5. Add redirect URLs (see #1 above)
6. Click Save

---

### 4. ❌ Gmail API Not Enabled

**What this means:** You're trying to use Gmail sync but haven't enabled the Gmail API in Google Cloud.

**Fix:**
1. Go to Google Cloud Console → APIs & Services → Library
2. Search "Gmail API"
3. Click it and press "Enable"
4. Wait 2-5 minutes for activation
5. Try login again

---

## Quick Checklist

- [ ] Supabase Google Provider is **Enabled**
- [ ] Google Client ID is filled in Supabase
- [ ] Google Client Secret is filled in Supabase
- [ ] Redirect URLs in Supabase include `https://prathi.tech/#/auth/callback`
- [ ] Redirect URLs in Google Console include `https://prathi.tech/#/auth/callback`
- [ ] URLs match **exactly** (case-sensitive)
- [ ] Gmail API is enabled (if you need email features)
- [ ] At least 1-2 minutes have passed since making changes

---

## Step-by-Step Setup from Scratch

### In Google Cloud Console:

1. Create a new project or select existing one
2. Go to APIs & Services → Credentials
3. Click "Create Credentials" → "OAuth 2.0 Client IDs"
4. Choose "Web application"
5. Under "Authorized JavaScript origins", add:
   - `https://prathi.tech`
   - `https://prathi.tech`
6. Under "Authorized redirect URIs", add:
   - `https://prathi.tech/#/auth/callback`
   - `https://prathi.tech/#/auth/callback`
7. Click Create
8. Copy the Client ID and Secret

### In Supabase:

1. Go to Authentication → Providers → Google
2. Toggle "Enabled" ON
3. Paste Client ID and Secret from step 8 above
4. Under "Redirect URLs", paste:
   - `https://prathi.tech/#/auth/callback`
   - `https://prathi.tech/#/auth/callback`
5. Click Save
6. Wait 1-2 minutes

### Back in Your App:

1. Refresh the browser
2. Click "Continue with Google"
3. Should work now!

---

## If Still Not Working

**Before trying anything else, close your browser completely and reopen it.**

If still failing:
1. Check the exact error message you're getting
2. Open DevTools (F12) → Console tab
3. Look for error details
4. Try clearing localStorage:
   ```javascript
   localStorage.clear()
   ```
5. Refresh and try again

---

## For Email Features (Gmail Sync)

If you see "Insufficient scopes" error:
1. Go to Supabase → Google Provider settings
2. Under "Additional scopes", add:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
3. Save and wait 1 minute
4. Logout and login again
5. Accept the Gmail permissions on the consent screen

---

## Emergency Reset

If nothing works, try this nuclear option:

1. **In Google Console:**
   - Delete the OAuth Client ID
   - Create a new one
   - Copy new Client ID and Secret

2. **In Supabase:**
   - Delete the Google provider
   - Re-add it with new credentials
   - Add all redirect URLs again

3. **In Your Browser:**
   - Clear all site data: DevTools → Application → Local Storage → Clear all
   - Close browser completely
   - Reopen and try login

---

## Contact Support

If you've done all the above and still stuck:
- Check the error message carefully
- Screenshot the Supabase provider settings
- Try with a different Google Account
- Check if your ISP/VPN is blocking Google's OAuth servers

