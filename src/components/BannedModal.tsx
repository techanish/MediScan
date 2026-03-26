import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Hammer, X } from 'lucide-react';

interface BannedModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export function BannedModal({ isOpen, onClose, message }: BannedModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900 max-w-md w-full overflow-hidden"
      >
        {/* Header with red background */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Hammer className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Account Banned</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              Your account has been suspended by the administrator.
            </p>
            {message && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Reason: {message}
              </p>
            )}
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">
              What can you do?
            </p>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 ml-4 list-disc">
              <li>Submit an appeal ticket from the login page</li>
              <li>Contact the administrator for more information</li>
              <li>Review our terms of service</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
