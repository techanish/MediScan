import { Bell, Search, Menu, Sun, Moon, RefreshCw } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  notificationCount: number;
  onNotificationClick: () => void;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  onSearchSubmit?: () => void;
  onLiveSync?: () => void;
  isSyncing?: boolean;
}

export function Header({ title, onMenuClick, notificationCount, onNotificationClick, searchValue = '', onSearchChange, onSearchSubmit, onLiveSync, isSyncing }: HeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-slate-200/50 dark:border-slate-800/50 px-6 py-4 flex items-center justify-between transition-colors duration-300">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300 drop-shadow-sm">{title}</h2>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <form onSubmit={e => { e.preventDefault(); onSearchSubmit?.(); }}
          className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-full border border-slate-200 dark:border-slate-700/50 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500/50 transition-all shadow-sm">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={searchValue}
            onChange={e => onSearchChange?.(e.target.value)}
            placeholder="Search inventory..."
            className="bg-transparent border-none focus:outline-none text-sm w-44 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </form>
        
        {onLiveSync && (
          <button
            onClick={onLiveSync}
            className="group flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            title="Live Sync"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-500 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span className="hidden sm:inline-block">{isSyncing ? 'Syncing...' : 'Live Sync'}</span>
          </button>
        )}

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2.5 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        
        <button
          onClick={onNotificationClick}
          className="relative p-2.5 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>
          )}
        </button>
      </div>
    </header>
  );
}

