import React from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { X, Users } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  role: string;
  active: boolean;
  company_id?: number;
}

interface ParticipantListProps {
  participants: User[];
  onRemoveParticipant?: (userId: number) => void;
  maxVisible?: number;
  disabled?: boolean;
}

export function ParticipantList({ 
  participants, 
  onRemoveParticipant,
  maxVisible = 3,
  disabled = false 
}: ParticipantListProps) {
  if (participants.length === 0) {
    return null;
  }

  const visibleParticipants = participants.slice(0, maxVisible);
  const hiddenCount = participants.length - maxVisible;
  const hasHidden = hiddenCount > 0;

  // Gerar inicial do nome para avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Lista completa para tooltip
  const renderFullList = () => (
    <div className="space-y-2">
      <div className="text-sm font-medium mb-2">Todos os participantes ({participants.length})</div>
      {participants.map((participant) => (
        <div key={participant.id} className="flex items-center gap-2 text-sm">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {getInitials(participant.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{participant.name}</div>
            <div className="text-muted-foreground truncate">{participant.email}</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      
      {/* Participantes visíveis */}
      {visibleParticipants.map((participant) => (
        <div key={participant.id} className="flex items-center gap-1">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {getInitials(participant.name)}
            </AvatarFallback>
          </Avatar>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium truncate max-w-20">
                    {participant.name}
                  </span>
                  {onRemoveParticipant && !disabled && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveParticipant(participant.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="text-sm">
                  <div className="font-medium">{participant.name}</div>
                  <div className="text-muted-foreground">{participant.email}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ))}

      {/* Indicador "e mais X" */}
      {hasHidden && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground">
                  e mais {hiddenCount}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              {renderFullList()}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
} 