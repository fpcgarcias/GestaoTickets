import React, { useState } from 'react';
import { Button } from "./button";
import { Calendar } from "lucide-react";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarComponent } from './calendar';
import { DateRange } from 'react-day-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

interface DateRangeFilterProps {
  timeFilter: string;
  setTimeFilter: (value: string) => void;
  dateRange: { from: Date | undefined; to: Date | undefined };
  setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  calendarOpen: boolean;
  setCalendarOpen: (open: boolean) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  timeFilter,
  setTimeFilter,
  dateRange,
  setDateRange,
  calendarOpen,
  setCalendarOpen,
}) => {
  return (
    <>
      {timeFilter === 'custom' ? (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[280px] justify-start text-left font-normal"
            >
              <Calendar className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} {' - '} 
                    {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                )
              ) : (
                <span>Período Personalizado</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={{
                from: dateRange.from,
                to: dateRange.to
              }}
              onSelect={(range: DateRange | undefined) => {
                setDateRange({ 
                  from: range?.from,
                  to: range?.to
                });
                if (range?.from && range?.to) {
                  setTimeout(() => setCalendarOpen(false), 500);
                }
              }}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      ) : (
        <Select
          value={timeFilter}
          onValueChange={(value) => {
            setTimeFilter(value);
            if (value === 'custom') {
              setTimeout(() => setCalendarOpen(true), 100);
            }
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-week">Esta Semana</SelectItem>
            <SelectItem value="last-week">Semana Passada</SelectItem>
            <SelectItem value="this-month">Este Mês</SelectItem>
            <SelectItem value="custom">Período Personalizado</SelectItem>
          </SelectContent>
        </Select>
      )}
    </>
  );
}; 