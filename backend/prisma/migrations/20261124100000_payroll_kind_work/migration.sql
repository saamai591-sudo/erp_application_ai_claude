-- حقوق و دستمزد: طبقه‌ی تازه‌ی «کارکرد» با اولویت اول (قبل از پرداختی)
ALTER TYPE "PayrollComponentKind" ADD VALUE IF NOT EXISTS 'WORK' BEFORE 'EARNING';
