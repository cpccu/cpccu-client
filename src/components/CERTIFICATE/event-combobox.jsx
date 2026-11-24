'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export function EventCombobox({
  events,
  value,
  onChange,
  placeholder = 'Select an event…',
  allowNone = true,
  noneLabel = 'No linked event',
}) {
  const [open, setOpen] = useState(false);

  const selected = (events || []).find((event) => event.id === value);
  const triggerLabel = selected
    ? selected.title
    : allowNone
      ? noneLabel
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search events by name…" />
          <CommandList>
            <CommandEmpty>No event found.</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value === '' ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {noneLabel}
                </CommandItem>
              )}
              {(events || []).map((event) => (
                <CommandItem
                  key={event.id}
                  value={`${event.title} ${event.id}`}
                  onSelect={() => {
                    onChange(event.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value === event.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {event.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}