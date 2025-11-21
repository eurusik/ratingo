/**
 * Модуль для роботи з датами в monthly синхронізації
 */

/**
 * Формує дату початку місяця у форматі YYYY-MM-DD
 */
export function getMonthStartDate(date: Date, offsetMonths: number): string {
  const targetDate = new Date(date.getFullYear(), date.getMonth() + offsetMonths, 1);
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Повертає масив дат початку місяців для 6 місяців (m0..m5)
 */
export function getMonthlyStartDates(now = new Date()): string[] {
  return [0, -1, -2, -3, -4, -5].map((offset) => getMonthStartDate(now, offset));
}
