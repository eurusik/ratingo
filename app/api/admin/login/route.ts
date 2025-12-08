import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, setSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: "Пароль обов'язковий" }, { status: 400 });
    }

    const isValid = verifyPassword(password);

    if (!isValid) {
      return NextResponse.json({ error: 'Невірний пароль' }, { status: 401 });
    }

    // Set session cookie
    await setSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}
