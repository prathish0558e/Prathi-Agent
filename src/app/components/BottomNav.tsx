import { Home, Briefcase, FileText, Settings, Compass, GraduationCap } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems: NavItem[] = [
    { icon: <Home className="w-5 h-5" />, label: 'Home', path: '/' },
    { icon: <Briefcase className="w-5 h-5" />, label: 'Jobs', path: '/jobs' },
    { icon: <GraduationCap className="w-5 h-5" />, label: 'University', path: '/university-admission' },
    { icon: <Compass className="w-5 h-5" />, label: 'Nearby', path: '/local-tracker' },
    { icon: <FileText className="w-5 h-5" />, label: 'Resume', path: '/ai-resume' },
    { icon: <Settings className="w-5 h-5" />, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/90 border-t border-border/70 backdrop-blur-lg z-50">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex justify-around items-center">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={index}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 transition-all duration-200 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className={`relative ${isActive ? 'animate-pulse' : ''}`}>
                  {item.icon}
                  {isActive && (
                    <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}

        </div>
      </div>
    </div>
  );
}