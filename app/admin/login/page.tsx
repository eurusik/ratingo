import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import LoginForm from './LoginForm';

export default async function AdminLoginPage() {
  // If already authenticated, redirect to admin
  const authenticated = await isAuthenticated();
  if (authenticated) {
    redirect('/admin/blog');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Адмін-панель
          </h1>
          <p className="text-gray-400">Увійдіть для управління блогом</p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
