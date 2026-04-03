import { useEffect, useState } from 'react';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  animated?: boolean;
}

const sizeMap = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
};

export function AnimatedLogo({ size = 'md', showText = true, animated = true }: AnimatedLogoProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${animated ? 'animate-pulse' : ''}`}>
      <div
        className={`
          ${sizeMap[size]}
          flex items-center justify-center
          transition-all duration-500
          ${isVisible && animated ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
          ${animated ? 'hover:scale-110' : ''}
        `}
      >
        <img
          src="/app.png?v=20260403b"
          alt="Prathi Agent Logo"
          className={`w-full h-full object-contain ${animated ? 'drop-shadow-lg' : ''}`}
          onError={(e) => {
            console.warn('Failed to load app.png from /public/app.png');
          }}
        />
      </div>

      {showText && (
        <div className={`text-center transition-all duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            PRATHI AGENT
          </h1>
          <p className="text-sm text-muted-foreground">Prathi Agent</p>
        </div>
      )}

      {animated && showText && (
        <div className="mt-4 flex gap-2 justify-center">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}
    </div>
  );
}
