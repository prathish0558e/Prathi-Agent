interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: 'blue' | 'green' | 'cyan';
}

export function StatCard({ title, value, icon, trend, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'border-primary/25 bg-primary/5',
    green: 'border-emerald-300/40 bg-emerald-50/70',
    cyan: 'border-amber-300/40 bg-amber-50/70',
  };

  return (
    <div className={`rounded-xl border p-4 transition-transform duration-200 hover:scale-[1.01] shadow-[0_12px_30px_rgba(15,61,62,0.12)] ${colorClasses[color]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-secondary rounded-lg border border-border text-foreground/70">
          {icon}
        </div>
        {trend && (
          <span className="text-emerald-700 text-xs font-semibold">{trend}</span>
        )}
      </div>
      <div className="text-3xl font-bold text-foreground mb-1">{value}</div>
      <div className="text-sm text-muted-foreground">{title}</div>
    </div>
  );
}
