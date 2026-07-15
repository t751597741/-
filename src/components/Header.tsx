import { Link, useLocation } from 'react-router-dom';
import { Home, Video, Brush } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg flex items-center justify-center">
              <Brush className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 font-serif">书法视频生成器</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                isActive('/')
                  ? "bg-amber-100 text-amber-700"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Home className="w-4 h-4" />
              <span>制作</span>
            </Link>
            <Link
              to="/gallery"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                isActive('/gallery') || isActive('/history')
                  ? "bg-amber-100 text-amber-700"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Video className="w-4 h-4" />
              <span>作品库</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
