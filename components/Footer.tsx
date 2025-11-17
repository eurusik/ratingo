import Link from 'next/link';
import { Film, Tv, Calendar, Github, Info, Lightbulb } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-zinc-950 border-t border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl blur-lg opacity-50" />
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
                  <svg
                    className="w-6 h-6 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 20L8 14L14 17L24 4"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Ratingo
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Проєкт створено з ❤️ для зручного моніторингу трендів фільмів та серіалів. Розробник —{' '}
              <a
                href="https://eurusik.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
              >
                Євген Русаков
              </a>
              . Спершу це був інструмент для особистих задач, але тепер він відкритий для кожного.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Навігація</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <Tv className="w-4 h-4" />
                  <span>Серіали</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/movies"
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <Film className="w-4 h-4" />
                  <span>Фільми</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/airings"
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Надходження</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <Info className="w-4 h-4" />
                  <span>Про проєкт</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Джерела</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://www.themoviedb.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  TMDB
                </a>
              </li>
              <li>
                <a
                  href="https://trakt.tv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Trakt
                </a>
              </li>
              <li>
                <a
                  href="https://www.imdb.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  IMDb
                </a>
              </li>
            </ul>
          </div>

          {/* Project */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Проєкт</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/eurusik/ratingo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <Github className="w-4 h-4" />
                  <span>Репозиторій на GitHub</span>
                </a>
              </li>
              <li>
                <Link
                  href="/ideas"
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <Lightbulb className="w-4 h-4" />
                  <span>Ідеї розвитку</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-zinc-800/50">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
            <p className="text-xs text-gray-500 text-center md:text-left">
              © {currentYear} Ratingo.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
