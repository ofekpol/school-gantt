"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function RtlShowcasePage() {
  const [date, setDate] = useState<Date | undefined>(undefined);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-12 p-8">
      <header>
        <h1 className="text-3xl font-bold">RTL Showcase — Phase 0 INFRA-05</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Validates shadcn Popover, Calendar, and Dropdown render correctly under
          <code className="mx-1 rounded bg-neutral-100 px-1 py-0.5">dir=&quot;rtl&quot;</code>.
          Open each component and confirm: (1) opens on the correct side,
          (2) animates from the correct direction, (3) icons/chevrons point the right way,
          (4) no horizontal overflow or clipping.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">1. Popover</h2>
        <Popover>
          <PopoverTrigger render={<Button variant="outline">פתח Popover</Button>} />
          <PopoverContent className="w-72">
            <p className="text-sm">
              זהו תוכן ה-Popover. Should be aligned to start (right edge in RTL),
              not overflowing the trigger&apos;s start side.
            </p>
          </PopoverContent>
        </Popover>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">2. Calendar (react-day-picker)</h2>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="rounded-md border w-fit"
        />
        <p className="text-xs text-neutral-500">
          Verify: previous-month chevron is on the right edge of the caption,
          next-month chevron on the left, both pointing the correct direction.
          Weekday headers should read ש ו ה ד ג ב א from right to left.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">3. Dropdown Menu</h2>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline">פתח תפריט</Button>} />
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>פעולות</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>ערוך</DropdownMenuItem>
            <DropdownMenuItem>שכפל</DropdownMenuItem>
            <DropdownMenuItem>מחק</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="text-xs text-neutral-500">
          Verify: menu opens aligned to the start of the trigger (right edge in RTL).
          Hebrew text is right-aligned. No horizontal scrollbar appears.
        </p>
      </section>
    </main>
  );
}
