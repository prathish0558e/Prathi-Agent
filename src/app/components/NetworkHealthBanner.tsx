import { useEffect, useMemo, useState } from 'react';

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
}

export function NetworkHealthBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [effectiveType, setEffectiveType] = useState('unknown');
  const [downlink, setDownlink] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const nav = navigator as NavigatorWithConnection;

    const updateConnection = () => {
      setIsOnline(navigator.onLine);
      setEffectiveType(nav.connection?.effectiveType ?? 'unknown');
      setDownlink(typeof nav.connection?.downlink === 'number' ? nav.connection.downlink : null);
    };

    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);

    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  const status = useMemo(() => {
    if (!isOnline) {
      return {
        level: 'offline',
        label: 'No internet connection',
        detail: 'Reconnect to sync jobs and email automation.',
      };
    }

    if (effectiveType === 'slow-2g' || effectiveType === '2g' || (downlink !== null && downlink < 1)) {
      return {
        level: 'slow',
        label: 'Slow network detected',
        detail: 'Some actions may take longer than usual.',
      };
    }

    return {
      level: 'good',
      label: 'Network stable',
      detail: `Connection: ${effectiveType.toUpperCase()}`,
    };
  }, [downlink, effectiveType, isOnline]);

  const colorClasses =
    status.level === 'offline'
      ? 'bg-red-500/15 border-red-400/40 text-red-200'
      : status.level === 'slow'
        ? 'bg-amber-500/15 border-amber-300/40 text-amber-100'
        : 'bg-emerald-500/15 border-emerald-300/40 text-emerald-100';

  return (
    <button
      type="button"
      onClick={() => setIsExpanded((current) => !current)}
      className={`fixed top-[4.5rem] right-4 z-50 flex items-center gap-2 border rounded-2xl px-3 py-2 text-xs backdrop-blur-md shadow-lg transition-all duration-300 ${isExpanded ? 'min-w-[220px]' : 'w-auto'} ${colorClasses}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${status.level === 'offline' ? 'bg-red-300' : status.level === 'slow' ? 'bg-amber-200' : 'bg-emerald-200'} ${status.level === 'good' ? 'animate-pulse' : ''}`} />
      <span className="font-semibold whitespace-nowrap">{isExpanded ? status.label : status.level === 'good' ? 'Online' : status.level === 'slow' ? 'Slow' : 'Offline'}</span>
      <span className={`overflow-hidden text-left text-[11px] text-current/80 transition-all duration-300 ${isExpanded ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0'}`}>
        {status.detail}
      </span>
    </button>
  );
}
