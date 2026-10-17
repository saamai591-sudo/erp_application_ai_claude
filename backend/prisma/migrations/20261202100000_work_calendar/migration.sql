-- تقویم کاری (حقوق و دستمزد): یک تقویم برای هر سال شمسی، با ۱۲ ماه
CREATE TABLE "WorkCalendar" (
  "id" SERIAL NOT NULL,
  "year" INTEGER NOT NULL,
  "dailyMinutes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkCalendar_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkCalendar_year_key" ON "WorkCalendar"("year");

CREATE TABLE "WorkCalendarMonth" (
  "id" SERIAL NOT NULL,
  "calendarId" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "standardDays" INTEGER NOT NULL,
  "allowedDays" INTEGER NOT NULL,
  "standardMinutes" INTEGER NOT NULL,
  "allowedMinutes" INTEGER NOT NULL,
  "trafficStartDate" DATE NOT NULL,
  "trafficEndDate" DATE NOT NULL,
  CONSTRAINT "WorkCalendarMonth_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkCalendarMonth_calendarId_month_key" ON "WorkCalendarMonth"("calendarId", "month");
ALTER TABLE "WorkCalendarMonth" ADD CONSTRAINT "WorkCalendarMonth_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "WorkCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
