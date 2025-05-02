import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot } from '@/components/tickets/status-badge';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

export default function Dashboard() {
  const { data: ticketStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['/api/tickets/stats'],
  });

  const { data: recentTickets, isLoading: isRecentLoading } = useQuery({
    queryKey: ['/api/tickets/recent'],
  });

  // Dummy data for now, in a real app this would come from the backend
  const statusData = [
    { name: 'New', value: ticketStats?.byStatus?.new || 0, color: '#42A5F5' },
    { name: 'On-Going', value: ticketStats?.byStatus?.ongoing || 0, color: '#FFA726' },
    { name: 'Resolved', value: ticketStats?.byStatus?.resolved || 0, color: '#66BB6A' },
  ];

  const priorityData = [
    { name: 'Low', count: ticketStats?.byPriority?.low || 0 },
    { name: 'Medium', count: ticketStats?.byPriority?.medium || 0 },
    { name: 'High', count: ticketStats?.byPriority?.high || 0 },
    { name: 'Critical', count: ticketStats?.byPriority?.critical || 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard 
          title="Total Tickets" 
          value={ticketStats?.total || 0} 
          isLoading={isStatsLoading}
        />
        <StatCard 
          title="New Tickets" 
          value={ticketStats?.byStatus?.new || 0} 
          isLoading={isStatsLoading}
          status={TICKET_STATUS.NEW}
        />
        <StatCard 
          title="On-Going Tickets" 
          value={ticketStats?.byStatus?.ongoing || 0} 
          isLoading={isStatsLoading}
          status={TICKET_STATUS.ONGOING}
        />
        <StatCard 
          title="Resolved Tickets" 
          value={ticketStats?.byStatus?.resolved || 0} 
          isLoading={isStatsLoading}
          status={TICKET_STATUS.RESOLVED}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Status</CardTitle>
            <CardDescription>Distribution of tickets across different statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <Skeleton className="w-full h-72" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Priority</CardTitle>
            <CardDescription>Number of tickets for each priority level</CardDescription>
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <Skeleton className="w-full h-72" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={priorityData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Recent Tickets</CardTitle>
          <CardDescription>Latest tickets that need attention</CardDescription>
        </CardHeader>
        <CardContent>
          {isRecentLoading ? (
            <div className="space-y-4">
              <Skeleton className="w-full h-16" />
              <Skeleton className="w-full h-16" />
              <Skeleton className="w-full h-16" />
            </div>
          ) : (
            <div className="space-y-4">
              {recentTickets?.slice(0, 5).map((ticket: any) => (
                <div key={ticket.id} className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center">
                    <StatusDot status={ticket.status} />
                    <div>
                      <p className="font-medium">{ticket.title}</p>
                      <p className="text-sm text-neutral-500">
                        {ticket.customerEmail} • {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm">
                    {ticket.priority === PRIORITY_LEVELS.HIGH && (
                      <span className="text-xs font-medium text-white bg-status-high px-2 py-1 rounded">
                        High Priority
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  isLoading: boolean;
  status?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, isLoading, status }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center mb-2">
          {status && <StatusDot status={status} />}
          <h3 className="font-medium">{title}</h3>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-16" />
        ) : (
          <p className="text-3xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
};
