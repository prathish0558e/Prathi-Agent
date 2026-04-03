
  # Mobile App Dashboard Design

  This is a code bundle for Mobile App Dashboard Design. The original project is available at https://www.figma.com/design/Cvv4uXECCXKsYV1qpbsiVF/Mobile-App-Dashboard-Design.

  ## Running the code

  Run `npm i` to install the root dependencies.
  Run `npm --prefix server i` to install the backend dependencies.

    Create a `.env` file in the project root:

    ```bash
    VITE_API_BASE_URL=http://localhost:8000
    VITE_GOOGLE_OAUTH_ENABLED=true
    VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

    # Production deployment (prathi.tech)
    # VITE_API_BASE_URL=https://api.prathi.tech
    ```

    If you see `Missing Supabase config...` in the login screen, the app now shows an in-app Supabase config card.
    Paste `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values there once and tap **Save Supabase Config**.

  Local development:

  ```bash
  npm run dev:all
  ```

  Frontend only:

  ```bash
  npm run dev:client
  ```

  Backend only:

  ```bash
  npm run dev:server
  ```

  Local URLs:

  - Frontend: `http://localhost:5173/`
  - Backend health: `http://127.0.0.1:8000/health`

  OAuth callback URLs to add in Supabase Authentication -> URL Configuration:

  - `http://localhost:5173/#/auth/callback`
  - `http://127.0.0.1:5173/#/auth/callback`

  ## Android APK build (Capacitor)

  This project is now configured for Android packaging through Capacitor.

  Prerequisites:

  - Node.js 18+
  - Java JDK 17 (or at least JDK 11)
  - Android Studio with Android SDK and Platform tools
  - `JAVA_HOME` should point to your JDK 17 installation

  Commands:

  ```bash
  npm install
  npm run cap:add:android
  npm run apk:debug
  ```

  Debug APK output:

  - `android/app/build/outputs/apk/debug/app-debug.apk`

  If Gradle says JVM is too old, your terminal is still using Java 8. Update `JAVA_HOME` and restart terminal, then rerun `npm run apk:debug`.

  Release APK command:

  ```bash
  npm run apk:release
  ```

    ## Google OAuth setup (Supabase)

    1. In Supabase Dashboard, enable Google provider in Authentication -> Providers.
    2. In Supabase Authentication -> URL Configuration, add your app URLs such as:
      - `http://localhost:5173/#/auth/callback`
      - `https://prathi.tech/#/auth/callback`
      - `https://www.prathi.tech/#/auth/callback`
    3. In Google Cloud Console, the Authorized redirect URI must be your Supabase callback URL, usually:
      - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
    4. In Supabase Google provider settings, ensure Client ID and Client Secret match the same Google OAuth app.
    5. After login, users are redirected back to the app callback and Supabase stores the session.
  