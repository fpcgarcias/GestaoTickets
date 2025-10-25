import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/i18n';

interface ModernBarChartProps {
  data: Array<{
    name: string;
    Qtde: number;
  }>;
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  const { formatMessage } = useI18n();
  
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-card text-card-foreground p-4 rounded-lg shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600" />
          <span className="font-semibold text-foreground">{label}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatMessage('dashboard.quantity')}: <span className="font-bold text-primary">{data.value}</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomBar = (props: any) => {
  const { fill, ...rest } = props;
  return (
    <Bar 
      {...rest} 
      fill="url(#barGradient)"
      radius={[4, 4, 0, 0]}
      className="hover:opacity-80 transition-opacity duration-200"
    />
  );
};

export const ModernBarChart: React.FC<ModernBarChartProps> = ({ data, isLoading }) => {
  const { formatMessage } = useI18n();
  if (isLoading) {
    return (
      <div className="w-full h-80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-muted-foreground font-medium">Nenhum dado disponível</p>
          <p className="text-sm text-muted-foreground mt-1 opacity-80">Os dados aparecerão aqui quando houver chamados</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(item => item.Qtde));
  const total = data.reduce((sum, item) => sum + item.Qtde, 0);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
          barCategoryGap="20%"
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
              <stop offset="50%" stopColor="#6366F1" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.7} />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.1"/>
            </filter>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            strokeOpacity={0.35}
          />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--primary), 0.12)' }} />
          <Bar 
            dataKey="Qtde" 
            fill="url(#barGradient)"
            radius={[6, 6, 0, 0]}
            filter="url(#shadow)"
            animationDuration={800}
            animationBegin={0}
          />
        </BarChart>
      </ResponsiveContainer>
      
      {/* Estatísticas resumidas */}
      <div className="mt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {data.map((item, index) => {
            const percentage = total > 0 ? ((item.Qtde / total) * 100).toFixed(1) : '0';
            const isHighest = item.Qtde === maxValue;
            return (
              <div 
                key={item.name} 
                className={`p-2 sm:p-3 rounded-lg transition-all duration-200 ${
                  isHighest 
                    ? 'bg-primary/15 border border-primary/40 shadow-sm' 
                    : 'bg-muted/60 hover:bg-muted'
                }`}
              >
                <div className="text-center">
                  <div className={`text-xl sm:text-2xl font-bold ${
                    isHighest ? 'text-primary' : 'text-foreground'
                  }`}>
                    {item.Qtde}
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-muted-foreground mt-1 truncate">{item.name}</div>
                  <div className={`text-xs mt-1 ${
                    isHighest ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {percentage}% {formatMessage('dashboard.of_total')}
                  </div>
                  {isHighest && (
                    <div className="mt-1 sm:mt-2">
                      <span className="inline-flex items-center px-1 sm:px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
                        🏆 {formatMessage('dashboard.highest_volume')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        

      </div>
    </div>
  );
};


