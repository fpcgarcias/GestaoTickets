import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useI18n } from '@/i18n';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ModernSlaBarChartProps {
  data: Array<{
    name: string;
    resposta: number;
    resolucao: number;
  }>;
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  const { formatMessage } = useI18n();
  
  if (active && payload && payload.length) {
    return (
      <div className="bg-card p-4 rounded-lg shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-foreground">{label}</span>
        </div>
        {payload.map((entry: any, index: number) => {
          // Mapear os nomes das chaves para as traduções
          const translatedName = entry.dataKey === 'resposta' 
            ? formatMessage('sla_chart.response')
            : entry.dataKey === 'resolucao'
            ? formatMessage('sla_chart.resolution')
            : entry.name;
            
          return (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">
                {translatedName}: <span className="font-bold" style={{ color: entry.color }}>
                  {Number(entry.value).toFixed(1)}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

const _CustomBar = (props: any) => {
  const { fill: _fill, ...rest } = props;
  return (
    <Bar 
      {...rest} 
      radius={[4, 4, 0, 0]}
      className="hover:opacity-80 transition-opacity duration-200"
    />
  );
};

export const ModernSlaBarChart: React.FC<ModernSlaBarChartProps> = ({ data, isLoading }) => {
  const { formatMessage } = useI18n();
  
  if (isLoading) {
    return (
      <div className="w-full h-80 flex items-center justify-center">
        <LoadingSpinner size="lg" />
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
          <p className="text-muted-foreground font-medium">{formatMessage('sla_chart.no_data')}</p>
          <p className="text-sm text-muted-foreground mt-1 opacity-80">{formatMessage('sla_chart.data_will_appear')}</p>
        </div>
      </div>
    );
  }

  const _maxValue = Math.max(
    ...data.map(item => Math.max(item.resposta, item.resolucao))
  );

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
            {/* Gradiente para Resposta (azul) */}
            <linearGradient id="respostaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
              <stop offset="50%" stopColor="#2563EB" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.7} />
            </linearGradient>
            {/* Gradiente para Resolução (verde) */}
            <linearGradient id="resolucaoGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
              <stop offset="50%" stopColor="#059669" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#047857" stopOpacity={0.7} />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.1"/>
            </filter>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#E5E7EB" 
            strokeOpacity={0.5}
          />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }}
            dx={-10}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="rect"
          />
          <Bar 
            dataKey="resposta" 
            name={formatMessage('sla_chart.response')}
            fill="url(#respostaGradient)"
            radius={[6, 6, 0, 0]}
            filter="url(#shadow)"
            animationDuration={800}
            animationBegin={0}
          />
          <Bar 
            dataKey="resolucao" 
            name={formatMessage('sla_chart.resolution')}
            fill="url(#resolucaoGradient)"
            radius={[6, 6, 0, 0]}
            filter="url(#shadow)"
            animationDuration={800}
            animationBegin={200}
          />
        </BarChart>
      </ResponsiveContainer>
      
      {/* Estatísticas resumidas */}
      <div className="mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((item, _index) => {
            const avgCompliance = (item.resposta + item.resolucao) / 2;
            const isHighPerformer = avgCompliance >= 90;
            const isLowPerformer = avgCompliance < 70;
            
            return (
              <div 
                key={item.name} 
                className={`p-4 rounded-lg transition-all duration-200 ${
                  isHighPerformer 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200' 
                    : isLowPerformer
                    ? 'bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200'
                    : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200'
                }`}
              >
                <div className="text-center">
                  <div className="text-lg font-bold text-foreground mb-2">{item.name}</div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium text-muted-foreground">{formatMessage('sla_chart.response')}</span>
                      </div>
                      <span className="text-sm font-bold text-blue-600">
                        {item.resposta.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm font-medium text-muted-foreground">{formatMessage('sla_chart.resolution')}</span>
                      </div>
                      <span className="text-sm font-bold text-green-600">
                        {item.resolucao.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-1">{formatMessage('sla_chart.average')}</div>
                    <div className={`text-lg font-bold ${
                      isHighPerformer ? 'text-green-600' : 
                      isLowPerformer ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {avgCompliance.toFixed(1)}%
                    </div>
                  </div>
                  
                  {isHighPerformer && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {formatMessage('sla_chart.excellent')}
                      </span>
                    </div>
                  )}
                  
                  {isLowPerformer && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {formatMessage('sla_chart.attention')}
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
