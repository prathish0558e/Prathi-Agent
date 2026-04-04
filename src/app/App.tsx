import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { NetworkHealthBanner } from './components/NetworkHealthBanner';
import { getOAuthCallbackParams } from './lib/oauthCallback';
import { isNativeApp } from './lib/platform';
import { router } from './routes';
import { applyTheme, getStoredTheme } from './lib/theme';

function App() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const oauthCallback = getOAuthCallbackParams(url.href);
    const isAlreadyCallbackHash = oauthCallback.isCallbackRoute;

    // Normalize web OAuth redirects so hash-router always lands on callback page.
    if (oauthCallback.hasAuthSignal && !isAlreadyCallbackHash) {
      window.location.replace('/#/auth/callback' + url.search + url.hash);
      return;
    }

    const isNative = isNativeApp();
    if (!isNative) return;

    const listenerPromise = import('@capacitor/app').then(({ App: CapApp }) =>
      CapApp.addListener('appUrlOpen', async ({ url }) => {
        const hasOAuthSignal =
          url.includes('auth/callback') ||
          url.includes('code=') ||
          url.includes('error=') ||
          url.includes('access_token=') ||
          url.includes('refresh_token=');

        if (hasOAuthSignal) {
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.close();
          } catch (_) {
            // ignore if browser already closed
          }
          const urlObj = new URL(url);
          window.location.replace('/#/auth/callback' + urlObj.search + urlObj.hash);
        }
      }),
    );

    return () => {
      void listenerPromise.then((l) => l.remove());
    };
  }, []);

  useEffect(() => {
    const syncTheme = () => {
      applyTheme(getStoredTheme());
    };

    syncTheme();

    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => syncTheme();

    if (media.addEventListener) {
      media.addEventListener('change', handler);
    } else {
      media.addListener(handler);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handler);
      } else {
        media.removeListener(handler);
      }
    };
  }, []);

  return (
    <>
      <NetworkHealthBanner />
      <RouterProvider router={router} />
    </>
  );
}

export default App;