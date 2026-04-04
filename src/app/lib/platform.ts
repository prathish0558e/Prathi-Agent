import { Capacitor } from '@capacitor/core';

export const isNativeApp = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return (
      typeof window !== 'undefined' &&
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true
    );
  }
};
