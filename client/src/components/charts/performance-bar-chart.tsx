import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface PerformanceBarChartProps {
  data: Array<{
    name: string;
    ticketsResolvidos: number;
    satisfacao: number;
  }>;
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const ticketsData = payload.find((p: any) => p.dataKey === 'ticketsResolvidos');
    const satisfacaoData = payload.find((p: any) => p.dataKey === 'satisfacao');
    
    return (
      <div className="bg-card text-card-foreground p-4 rounded-lg shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-green-600" />
          <span className="font-semibold text-foreground">{label}</span>
        </div>
        {ticketsData && (
          <p className="text-sm text-muted-foreground mb-1">
            Tickets Resolvidos: <span className="font-bold text-green-600">{ticketsData.value}</span>
          </p>
        )}
        {satisfacaoData && (
          <p className="text-sm text-muted-foreground">
            Satisfação: <span className="font-bold text-blue-600">{satisfacaoData.value.toFixed(1)}</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

const _CustomBar = (props: any) => {
  const { fill: _fill, dataKey, ...rest } = props;
  const gradientId = dataKey === 'ticketsResolvidos' ? 'ticketsGradient' : 'satisfacaoGradient';
  
  return (
    <Bar 
      {...rest} 
      fill={`url(#${gradientId})`}
      radius={[4, 4, 0, 0]}
      className="hover:opacity-80 transition-opacity duration-200"
    />
  );
};

export const PerformanceBarChart: React.FC<PerformanceBarChartProps> = ({ data, isLoading }) => {
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
          <p className="text-muted-foreground font-medium">Nenhum dado disponível</p>
          <p className="text-sm text-muted-foreground mt-1 opacity-80">Os dados aparecerão aqui quando houver atendentes</p>
        </div>
      </div>
    );
  }

  const _maxTickets = Math.max(...data.map(item => item.ticketsResolvidos));
  const _maxSatisfacao = Math.max(...data.map(item => item.satisfacao));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
          barCategoryGap="20%"
        >
          <defs>
            {/* Gradiente para tickets resolvidos - Verde */}
            <linearGradient id="ticketsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
              <stop offset="50%" stopColor="#059669" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#047857" stopOpacity={0.7} />
            </linearGradient>
            {/* Gradiente para satisfação - Azul */}
            <linearGradient id="satisfacaoGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
              <stop offset="50%" stopColor="#2563EB" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.7} />
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
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
            dy={10}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            yAxisId="tickets"
            orientation="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
            dx={-10}
          />
          <YAxis 
            yAxisId="satisfacao"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
            dx={10}
            domain={[0, 100]}
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ 
              fill: 'rgba(128, 128, 128, 0.08)',
              stroke: 'rgba(128, 128, 128, 0.2)',
              strokeWidth: 1
            }} 
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => {
              if (value === 'ticketsResolvidos') return 'Tickets Resolvidos';
              if (value === 'satisfacao') return 'Satisfação';
              return value;
            }}
          />
          <Bar 
            yAxisId="tickets"
            dataKey="ticketsResolvidos" 
            fill="url(#ticketsGradient)"
            radius={[4, 4, 0, 0]}
            filter="url(#shadow)"
            animationDuration={800}
            animationBegin={0}
            name="Tickets Resolvidos"
          />
          <Bar 
            yAxisId="satisfacao"
            dataKey="satisfacao" 
            fill="url(#satisfacaoGradient)"
            radius={[4, 4, 0, 0]}
            filter="url(#shadow)"
            animationDuration={800}
            animationBegin={200}
            name="Satisfação"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
