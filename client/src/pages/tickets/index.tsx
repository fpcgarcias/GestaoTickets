import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Plus, Search } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketCard } from '@/components/tickets/ticket-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
import { Ticket } from '@shared/schema';

export default function TicketsIndex() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('this-week');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ['/api/tickets'],
  });

  const filteredTickets = tickets?.filter(ticket => {
    // Apply search filter
    if (searchQuery && !ticket.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Apply status filter
    if (statusFilter !== 'all' && ticket.status !== statusFilter) {
      return false;
    }
    
    // Apply priority filter
    if (priorityFilter && ticket.priority !== priorityFilter) {
      return false;
    }
    
    // Time filter would be applied on the server in a real app
    return true;
  });

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Tickets</h1>
        <Button onClick={() => navigate('/tickets/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {/* Filters Section */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
          <Input 
            placeholder="Search for ticket" 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select
          value={timeFilter}
          onValueChange={setTimeFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-week">This Week</SelectItem>
            <SelectItem value="last-week">Last Week</SelectItem>
            <SelectItem value="this-month">This Month</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={setPriorityFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Priorities</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.LOW}>Low</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.MEDIUM}>Medium</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.HIGH}>High</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.CRITICAL}>Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status Tabs */}
      <Tabs 
        defaultValue="all" 
        value={statusFilter}
        onValueChange={setStatusFilter}
        className="mb-6"
      >
        <TabsList className="border-b border-neutral-200 w-full justify-start rounded-none bg-transparent">
          <TabsTrigger value="all" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            All Tickets
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.NEW} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            New
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.ONGOING} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            On-Going
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.RESOLVED} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            Resolved
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Status Legend */}
      <div className="mb-6 bg-white p-4 rounded-md border border-neutral-200 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-status-new mr-2"></div>
            <span className="text-sm text-neutral-700">New Tickets</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-status-ongoing mr-2"></div>
            <span className="text-sm text-neutral-700">On-Going Tickets</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-status-resolved mr-2"></div>
            <span className="text-sm text-neutral-700">Resolved Tickets</span>
          </div>
        </div>
      </div>

      {/* Ticket Cards */}
      <div className="space-y-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-md border border-neutral-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-10 w-full mb-4" />
              <div className="flex justify-between">
                <Skeleton className="h-7 w-28 rounded-full" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))
        ) : filteredTickets?.length ? (
          filteredTickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))
        ) : (
          <div className="bg-white rounded-md border border-neutral-200 p-8 text-center">
            <h3 className="text-lg font-medium text-neutral-700 mb-2">No tickets found</h3>
            <p className="text-neutral-500 mb-4">
              {searchQuery ? 'Try adjusting your search terms' : 'Create your first ticket to get started'}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/tickets/new">Create Ticket</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredTickets && filteredTickets.length > 0 && (
        <div className="flex justify-end mt-6">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm" className="bg-primary text-white hover:bg-primary/90">1</Button>
            <Button variant="outline" size="sm">2</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
