import React, { useState } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { Bell, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusDot } from '@/components/tickets/status-badge';
import { formatDate } from '@/lib/utils';
import { Link } from 'wouter';

export const NotificationCenter: React.FC = () => {
  const { notifications, connected } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const toggleNotifications = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={toggleNotifications}
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center p-2 text-xs"
          >
            {notifications.length > 9 ? '9+' : notifications.length}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 top-10 z-10 mt-1 w-80 max-h-[70vh] overflow-auto shadow-lg">
          <div className="flex items-center justify-between border-b p-3">
            <div className="flex items-center">
              <h3 className="font-semibold">Notificações</h3>
              <div className="ml-2">
                {connected ? (
                  <StatusDot status="ongoing" className="h-2 w-2" />
                ) : (
                  <StatusDot status="new" className="h-2 w-2" />
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="divide-y">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Não há notificações no momento
              </div>
            ) : (
              notifications.map((notification, index) => {
                let priorityColor = '';
                if (notification.priority === 'high') priorityColor = 'border-l-amber-500';
                if (notification.priority === 'critical') priorityColor = 'border-l-red-500';
                
                return (
                  <div 
                    key={index} 
                    className={`p-3 hover:bg-muted border-l-4 ${priorityColor || 'border-l-transparent'}`}
                  >
                    {notification.ticketId ? (
                      <Link to={`/tickets/${notification.ticketId}`}>
                        <h4 className="font-medium text-sm">{notification.title}</h4>
                      </Link>
                    ) : (
                      <h4 className="font-medium text-sm">{notification.title}</h4>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(new Date(notification.timestamp))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
