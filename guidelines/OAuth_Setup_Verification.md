# OAuth Configuration Verification Checklist

## Your Current Setup
```
Supabase Project: fsciwivkplhcjsrqjnmk
Supabase URL: https://fsciwivkplhcjsrqjnmk.supabase.co
Local Dev URL: http://localhost:5173
Production URL: https://prathi.tech
```

---

## ✅ Step-by-Step Verification

### Step 1: Check Supabase Google Provider Configuration

Go to: **https://fsciwivkplhcjsrqjnmk.supabase.co/project/settings/auth-providers**

Or navigate manually:
1. Supabase Dashboard
2. Select your project: `fsciwivkplhcjsrqjnmk`
3. Settings → Authentication → Providers
4. Click "Google"

**Verify these fields are filled:**
- [ ] "Enabled" toggle is ON (green)
- [ ] Client ID: ________________ (should be a long string with .apps.googleusercontent.com)
- [ ] Client Secret: ________________ (should be a string starting with goo_...)

**Under "Redirect URL" section, you should see:**
- [ ] Default URL: `https://fsciwivkplhcjsrqjnmk.supabase.co/auth/v1/callback`
  
**Under "Additional Redirect URLs", add BOTH:**
- [ ] `http://localhost:5173/#/auth/callback`
- [ ] `https://prathi.tech/#/auth/callback`

---

### Step 2: Get Google OAuth Credentials

If you don't have them, get from Google Cloud Console:

1. Go to: https://console.cloud.google.com
2. Select your project (or create a new one)
3. Go to: APIs & Services → Credentials
4. Click "Create Credentials" → "OAuth 2.0 Client ID"
5. Type: Select "Web application"
6. Name: "Career Agent"

**Under "Authorized JavaScript origins", add:**
- [ ] `http://localhost:5173`
- [ ] `https://prathi.tech`
- [ ] `https://fsciwivkplhcjsrqjnmk.supabase.co`

**Under "Authorized redirect URIs", add:**
- [ ] `http://localhost:5173/#/auth/callback`
- [ ] `https://prathi.tech/#/auth/callback`
- [ ] `https://fsciwivkplhcjsrqjnmk.supabase.co/auth/v1/callback`

7. Click "Create"
8. Copy the Client ID and Client Secret
9. Click OK

---

### Step 3: Update Supabase with Google Credentials

Back in Supabase Google Provider settings:
1. Paste your Client ID into the "Client ID" field
2. Paste your Client Secret into the "Client Secret" field
3. Click "Save"

---

### Step 4: Enable Gmail API (Optional but Recommended)

If you want email features to work:

1. Go to: https://console.cloud.google.com
2. APIs & Services → Library
3. Search "Gmail API"
4. Click "Gmail API"
5. Click "Enable"

---

### Step 5: Enable Google Places API (Optional but Recommended)

For company finder to work:

1. Go to: https://console.cloud.google.com
2. APIs & Services → Library
3. Search "Google Places API"
4. Click "Places API"
5. Click "Enable"

---

## 🧪 Test the Setup

1. **Clear browser cache:**
   - Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
   - Select "All time"
   - Check "Cookies" and "Cached images"
   - Click "Clear data"

2. **Also clear localStorage:**
   - Open DevTools (F12)
   - Go to Console tab
   - Paste: `localStorage.clear()`
   - Press Enter

3. **Close browser completely** and reopen

4. **Go to:** http://localhost:5173
5. **Click "Continue with Google"**
6. **You should be redirected to Google login**
7. **After login, you should be redirected to your app**

---

## ❌ If Still Not Working

### Check Browser Console for Errors
1. Open DevTools (F12)
2. Go to "Console" tab
3. Look for red error messages
4. Share the error message

### Check Network Request
1. Open DevTools (F12)
2. Go to "Network" tab
3. Click "Continue with Google"
4. Look for a request to `supabase.co` or `oauth`
5. Check the response for error details

### Verify URLs Match EXACTLY
- Redirect URLs are **case-sensitive**
- Make sure the `/#/` is included
- No trailing slashes
- Use `http://` for localhost, `https://` for production

### Common Mistakes
- [ ] Using `http://localhost:5173/auth/callback` instead of `http://localhost:5173/#/auth/callback`
- [ ] Missing the `#` character
- [ ] Using different URLs in Supabase vs Google Console
- [ ] Typos in Client ID or Secret
- [ ] Provider not enabled (toggle should be green)
- [ ] Waiting less than 1-2 minutes after setting up (Google takes time to propagate)

---

## 📝 Debugging Information

Save this info when contacting support:
- Supabase Project ID: `fsciwivkplhcjsrqjnmk`
- Local Dev URL: `http://localhost:5173`
- Production URL: `https://prathi.tech`
- Error message: (paste the full error you see)
- Browser: (Chrome, Firefox, Safari, etc.)
- Timestamp: (when error occurred)

---

## 🔗 Reference Links

- Supabase Dashboard: https://app.supabase.com
- Google Cloud Console: https://console.cloud.google.com
- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Google OAuth Docs: https://developers.google.com/identity/protocols/oauth2
