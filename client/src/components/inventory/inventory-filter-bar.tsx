import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Filter, Search } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export type InventoryFilterValue = string | string[] | DateRange | undefined;

export interface FilterOption {
  label: string;
  value: string;
  icon?: ReactNode;
}

type SearchFilterConfig = {
  type: "search";
  key: string;
  placeholder?: string;
  value?: string;
  icon?: ReactNode;
  width?: number;
};

type SelectFilterConfig = {
  type: "select";
  key: string;
  placeholder?: string;
  value?: string;
  options: FilterOption[];
  width?: number;
};

type MultiSelectFilterConfig = {
  type: "multi-select";
  key: string;
  placeholder?: string;
  value?: string[];
  options: FilterOption[];
  width?: number;
};

type DateRangeFilterConfig = {
  type: "date-range";
  key: string;
  placeholder?: string;
  value?: DateRange;
  width?: number;
};

export type InventoryFilterConfig =
  | SearchFilterConfig
  | SelectFilterConfig
  | MultiSelectFilterConfig
  | DateRangeFilterConfig;

interface InventoryFilterBarProps {
  filters: InventoryFilterConfig[];
  onChange: (key: string, value: InventoryFilterValue) => void;
  onReset?: () => void;
  isDirty?: boolean;
  className?: string;
}

export function InventoryFilterBar({ filters, onChange, onReset, isDirty, className }: InventoryFilterBarProps) {
  const { formatMessage, locale } = useI18n();
  const localeConfig = locale === "en-US" ? enUS : ptBR;

  const renderedFilters = filters.map((filter) => {
    switch (filter.type) {
      case "search":
        return (
          <div key={filter.key} className="relative flex items-center" style={{ width: filter.width ?? 240 }}>
            <Input
              value={filter.value ?? ""}
              placeholder={filter.placeholder ?? formatMessage("inventory.filters.search_placeholder")}
              onChange={(event) => onChange(filter.key, event.target.value)}
              className="pl-9"
            />
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          </div>
        );
      case "select":
        return (
          <Select
            key={filter.key}
            value={filter.value || undefined}
            onValueChange={(value) => onChange(filter.key, value)}
          >
            <SelectTrigger className="w-[200px]" style={{ width: filter.width ?? 200 }}>
              <SelectValue placeholder={filter.placeholder ?? formatMessage("inventory.filters.select_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "multi-select": {
        const selectedLabels = filter.options.filter((option) => filter.value?.includes(option.value)).map((o) => o.label);
        const displayLabel =
          selectedLabels.length === 0
            ? filter.placeholder ?? formatMessage("inventory.filters.multi_placeholder")
            : selectedLabels.length > 2
            ? formatMessage("inventory.filters.multi_selected", { count: selectedLabels.length })
            : selectedLabels.join(", ");
        return (
          <Popover key={filter.key}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between" style={{ width: filter.width ?? 220 }}>
                <span className="truncate">{displayLabel}</span>
                <Filter className="ml-2 h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-0" align="start">
              <Command>
                <CommandInput placeholder={filter.placeholder ?? formatMessage("inventory.filters.search_placeholder")} />
                <CommandEmpty>{formatMessage("inventory.filters.empty")}</CommandEmpty>
                <CommandGroup>
                  {filter.options.map((option) => {
                    const checked = filter.value?.includes(option.value) ?? false;
                    return (
                      <CommandItem
                        key={option.value}
                        onSelect={() => {
                          const next = new Set(filter.value ?? []);
                          if (next.has(option.value)) {
                            next.delete(option.value);
                          } else {
                            next.add(option.value);
                          }
                          onChange(filter.key, Array.from(next));
                        }}
                      >
                        <Checkbox checked={checked} className="mr-2" />
                        <span>{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        );
      }
      case "date-range": {
        const range = filter.value;
        const label =
          range?.from && range?.to
            ? `${format(range.from, "P", { locale: localeConfig })} - ${format(range.to, "P", { locale: localeConfig })}`
            : filter.placeholder ?? formatMessage("inventory.filters.date_placeholder");
        return (
          <Popover key={filter.key}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !range?.from && "text-muted-foreground"
                )}
                style={{ width: filter.width ?? 260 }}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(nextRange) => onChange(filter.key, nextRange)}
                numberOfMonths={2}
                locale={localeConfig}
              />
            </PopoverContent>
          </Popover>
        );
      }
      default:
        return null;
    }
  });

  const shouldRenderReset = Boolean(onReset) && (isDirty ?? true);

  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-3", className)}>
      {renderedFilters}
      {shouldRenderReset && (
        <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto text-muted-foreground">
          {formatMessage("inventory.filters.reset")}
        </Button>
      )}
    </div>
  );
}

