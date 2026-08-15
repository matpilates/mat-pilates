import { classCatalog, type ClassId } from "@/lib/site-content";

export type WeekdayId =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type ScheduleTime = `${number}${number}:${number}${number}`;

export const scheduleWeekdays: readonly WeekdayId[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const weekdayByIntlName: Readonly<Record<string, WeekdayId | undefined>> = {
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
};

export function getScheduleDayOrder(timezone: string): readonly WeekdayId[] {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  })
    .format(new Date())
    .toLowerCase();
  const currentDay = weekday === "sunday" ? "monday" : weekdayByIntlName[weekday];
  const currentDayIndex = currentDay ? scheduleWeekdays.indexOf(currentDay) : 0;

  return [
    ...scheduleWeekdays.slice(currentDayIndex),
    ...scheduleWeekdays.slice(0, currentDayIndex),
  ];
}

export interface WeeklyScheduleSlot {
  readonly classId: ClassId;
  readonly startTime: ScheduleTime;
}

export interface WeeklyScheduleDay {
  readonly id: WeekdayId;
  readonly label: string;
  readonly slots: readonly WeeklyScheduleSlot[];
}

export interface WeeklySchedule {
  readonly days: readonly WeeklyScheduleDay[];
  readonly effectiveFrom: string;
  readonly status: "published";
  readonly timezone: "America/Argentina/Buenos_Aires";
}

export interface ClassScheduleDay {
  readonly id: WeekdayId;
  readonly label: string;
  readonly shortLabel: string;
  readonly times: readonly ScheduleTime[];
}

const scheduleDayAbbreviations: Record<WeekdayId, string> = {
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mie",
  thursday: "Jue",
  friday: "Vie",
  saturday: "Sab",
};

export const weeklySchedule = {
  status: "published",
  timezone: "America/Argentina/Buenos_Aires",
  effectiveFrom: "2026-08-03",
  days: [
    {
      id: "monday",
      label: "Lunes",
      slots: [
        { startTime: "08:00", classId: "mat-pilates" },
        { startTime: "09:00", classId: "stretch-glow" },
        { startTime: "10:00", classId: "hot-pilates-stretch" },
        { startTime: "11:00", classId: "hot-sweat" },
        { startTime: "12:00", classId: "hot-pilates-stretch" },
        { startTime: "13:00", classId: "hot-pilates-stretch" },
        { startTime: "14:00", classId: "stretching" },
        { startTime: "15:00", classId: "abs-on" },
        { startTime: "16:00", classId: "sculpt-flow" },
        { startTime: "17:00", classId: "abs-on" },
        { startTime: "18:00", classId: "hot-booty" },
        { startTime: "19:00", classId: "hot-mat-burn" },
      ],
    },
    {
      id: "tuesday",
      label: "Martes",
      slots: [
        { startTime: "08:00", classId: "mat-pilates" },
        { startTime: "09:00", classId: "mat-pilates" },
        { startTime: "10:00", classId: "stretching" },
        { startTime: "11:00", classId: "hot-pilates-stretch" },
        { startTime: "15:00", classId: "hot-sculpt" },
        { startTime: "16:00", classId: "sculpt-flow" },
        { startTime: "17:00", classId: "abs-on" },
        { startTime: "18:00", classId: "hot-booty" },
        { startTime: "19:00", classId: "hot-mat-burn" },
      ],
    },
    {
      id: "wednesday",
      label: "Miércoles",
      slots: [
        { startTime: "08:00", classId: "mat-pilates" },
        { startTime: "09:00", classId: "stretch-glow" },
        { startTime: "10:00", classId: "hot-sculpt" },
        { startTime: "11:00", classId: "hot-sweat" },
        { startTime: "15:00", classId: "hot-sweat" },
        { startTime: "16:00", classId: "abs-on" },
        { startTime: "17:00", classId: "sculpt-flow" },
        { startTime: "18:00", classId: "hot-booty" },
        { startTime: "19:00", classId: "hot-mat-burn" },
      ],
    },
    {
      id: "thursday",
      label: "Jueves",
      slots: [
        { startTime: "08:00", classId: "mat-pilates" },
        { startTime: "09:00", classId: "stretching" },
        { startTime: "10:00", classId: "stretch-glow" },
        { startTime: "11:00", classId: "hot-pilates-stretch" },
        { startTime: "15:00", classId: "hot-sculpt" },
        { startTime: "16:00", classId: "sculpt-flow" },
        { startTime: "17:00", classId: "abs-on" },
        { startTime: "18:00", classId: "hot-booty" },
        { startTime: "19:00", classId: "hot-sculpt" },
      ],
    },
    {
      id: "friday",
      label: "Viernes",
      slots: [
        { startTime: "08:00", classId: "mat-pilates" },
        { startTime: "09:00", classId: "stretch-glow" },
        { startTime: "10:00", classId: "stretching" },
        { startTime: "11:00", classId: "hot-pilates-stretch" },
        { startTime: "15:00", classId: "abs-on" },
        { startTime: "16:00", classId: "mat-pilates" },
        { startTime: "17:00", classId: "sculpt-flow" },
        { startTime: "18:00", classId: "hot-mat-burn" },
        { startTime: "19:00", classId: "hot-sweat" },
      ],
    },
    {
      id: "saturday",
      label: "Sábado",
      slots: [
        { startTime: "08:00", classId: "stretch-glow" },
        { startTime: "09:00", classId: "stretch-glow" },
        { startTime: "10:00", classId: "hot-sculpt" },
        { startTime: "11:00", classId: "hot-mat-burn" },
      ],
    },
  ],
} as const satisfies WeeklySchedule;

const classOfferingById = new Map(
  classCatalog.map((classOffering) => [classOffering.id, classOffering]),
);

export function getScheduledClassOffering(classId: ClassId) {
  const classOffering = classOfferingById.get(classId);

  if (!classOffering) {
    throw new Error(`Unknown class ID in weekly schedule: ${classId}`);
  }

  return classOffering;
}

export function getClassScheduleDays(classId: ClassId): readonly ClassScheduleDay[] {
  const scheduleDays = weeklySchedule.days.flatMap((day) => {
    const times = day.slots
      .filter((slot) => slot.classId === classId)
      .map((slot) => slot.startTime);

    return times.length > 0
      ? [
          {
            id: day.id,
            label: day.label,
            shortLabel: scheduleDayAbbreviations[day.id],
            times,
          },
        ]
      : [];
  });

  const classOffering = getScheduledClassOffering(classId);
  const hasPublishedSchedule = scheduleDays.length > 0;

  if (classOffering.isActive !== hasPublishedSchedule) {
    const activityLabel = classOffering.isActive ? "active" : "inactive";
    const scheduleLabel = hasPublishedSchedule ? "has published slots" : "has no published slots";

    throw new Error(
      `Class ${classOffering.name} is ${activityLabel} but ${scheduleLabel}.`,
    );
  }

  return scheduleDays;
}

export function formatScheduleTime(time: ScheduleTime) {
  return time.replace(":", ".");
}

export const weeklyScheduleStartTimes = Array.from(
  new Set(weeklySchedule.days.flatMap((day) => day.slots.map((slot) => slot.startTime))),
).sort();
