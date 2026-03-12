import { Bell, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Notification {
  id: string;
  type: 'ALERT' | 'INFO' | 'SUCCESS' | 'WARNING';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface NotificationsProps {
  notifications: Notification[];
  onMarkAllRead: () => void;
  onRead: (id: string) => void;
}

export function Notifications({ notifications, onMarkAllRead, onRead }: NotificationsProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'WARNING': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'SUCCESS': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'ALERT': return <Bell className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'WARNING': return 'bg-amber-50 dark:bg-amber-900/20';
      case 'SUCCESS': return 'bg-emerald-50 dark:bg-emerald-900/20';
      case 'ALERT': return 'bg-red-50 dark:bg-red-900/20';
      default: return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Updates and alerts about your inventory</p>
        </div>
        <button
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
          className="text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          Mark all as read
        </button>
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 text-gray-400 dark:text-gray-500"
          >
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No notifications yet</p>
          </motion.div>
        ) : (
          <AnimatePresence initial={true}>
            {notifications.map((notif, idx) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.05, duration: 0.25, ease: 'easeOut' }}
                onClick={() => !notif.read && onRead(notif.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  notif.read
                    ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                    : 'bg-white dark:bg-gray-800 border-emerald-100 dark:border-emerald-900/30 shadow-sm hover:shadow-md dark:shadow-none'
                }`}
              >
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getBgColor(notif.type)}`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`font-semibold ${notif.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                        {notif.title}
                      </h3>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{notif.time}</span>
                    </div>
                    <p className={`text-sm mt-1 leading-relaxed ${notif.read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                      {notif.message}
                    </p>
                  </div>
                  {!notif.read && (
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full mt-2 ring-2 ring-white dark:ring-gray-800 shrink-0"></div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
