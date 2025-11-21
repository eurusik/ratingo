/**
 * Модуль для роботи з датами календаря
 */

import type { CalendarConfig } from './types';

/**
 * Формує дату в форматі YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Отримує кількість днів з налаштувань середовища
 */
export function getCalendarDays(): number {
  const daysEnv = parseInt(String(process.env.AIRINGS_CALENDAR_DAYS || '30'), 10);
  const days = Math.max(1, Math.min(30, Number.isFinite(daysEnv) ? daysEnv : 30));
  return days;
}

/**
 * Створює конфігурацію календаря
 */
export function createCalendarConfig(): CalendarConfig {
  const today = new Date();
  return {
    startDate: formatDate(today),
    days: getCalendarDays(),
  };
}
