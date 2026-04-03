import { useEffect, useState } from 'react';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

export function CircularProgress({ percentage, size = 200, strokeWidth = 12 }: CircularProgressProps) {
  const [progress, setProgress] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(0, 209, 255, 0.1)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle with gradient */}
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D1FF" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#39FF14" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(0, 209, 255, 0.6))',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-bold bg-gradient-to-r from-[#00D1FF] via-cyan-400 to-[#39FF14] bg-clip-text text-transparent">
          {progress}%
        </div>
        <div className="text-xs text-[#00D1FF] mt-1 tracking-wider">{}</div>
      </div>
    </div>
  );
}