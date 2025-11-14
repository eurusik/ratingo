/**
 * Утиліти формування HTTP-відповідей для Next.js API роутів.
 */
import { NextResponse } from 'next/server';

/**
 * Повертає JSON-відповідь із необов’язковим статусом та заголовками.
 */
export function respondJson(
  data: any,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return NextResponse.json(data, init);
}

/**
 * Повертає JSON-помилку з кодом статусу.
 */
export function respondError(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}