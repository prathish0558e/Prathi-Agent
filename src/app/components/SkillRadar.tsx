import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

const skillData = [
  { skill: 'Python', value: 90 },
  { skill: 'Backend', value: 85 },
  { skill: 'Security', value: 88 },
  { skill: 'DevOps', value: 75 },
  { skill: 'Cloud', value: 80 },
  { skill: 'API Design', value: 82 },
];

export function SkillRadar() {
  return (
    <div className="app-surface p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        Skill Radar Analysis
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={skillData}>
          <PolarGrid stroke="#0f3d3e" strokeOpacity={0.2} />
          <PolarAngleAxis 
            dataKey="skill" 
            tick={{ fill: '#6a5a4b', fontSize: 12 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fill: '#6a5a4b', fontSize: 10 }}
          />
          <Radar
            name="Skills"
            dataKey="value"
            stroke="#0f3d3e"
            fill="#0f3d3e"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
