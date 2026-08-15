"use client";

import { useEffect } from "react";
import { openAnimatedDisclosure } from "@/components/animated-disclosure";
import { getScheduleDayOrder } from "@/lib/schedule-content";

interface ScheduleAccordionProps {
  timezone: string;
}

export function ScheduleAccordion({ timezone }: ScheduleAccordionProps) {
  useEffect(() => {
    const mobileSchedule = document
      .getElementById("horarios")
      ?.querySelector<HTMLElement>(".mat-schedule__mobile");
    const openDay = mobileSchedule?.querySelector<HTMLDetailsElement>(
      `details[data-schedule-day="${getScheduleDayOrder(timezone)[0]}"]`,
    );

    if (openDay) {
      openAnimatedDisclosure(openDay);
    }
  }, [timezone]);

  return null;
}
