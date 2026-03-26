import { useEffect, useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { Hammer } from 'lucide-react';

interface BanGuardProps {
  children: React.ReactNode;
}

export function BanGuard({ children }: BanGuardProps) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [isCheckingBan, setIsCheckingBan] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const checkBanStatus = async () => {
      if (!isLoaded || !user) {
        setIsCheckingBan(true);
        return;
      }

      // Force reload user data to get latest metadata
      try {
        await user.reload();
      } catch (error) {
        console.error('Failed to reload user:', error);
      }

      // Check if user is banned
      const banned = Boolean(user.publicMetadata?.isBanned || user.banned);

      console.log('🔒 Ban check:', {
        email: user.primaryEmailAddress?.emailAddress,
        isBanned: user.publicMetadata?.isBanned,
        clerkBanned: user.banned,
        finalBanned: banned
      });

      setIsCheckingBan(false);

      if (banned) {
        setIsBanned(true);

        // Start countdown timer
        let timeLeft = 5;
        const countdownInterval = setInterval(() => {
          timeLeft--;
          setCountdown(timeLeft);

          if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            // Force sign out
            console.log('🚪 Auto-logging out banned user...');
            signOut({ redirectUrl: '/' });
          }
        }, 1000);

        return () => clearInterval(countdownInterval);
      }
    };

    checkBanStatus();
  }, [user, isLoaded, signOut]);

  // Show loading while checking ban status
  if (isCheckingBan || !isLoaded || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-800 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If banned, show countdown and block access
  if (isBanned) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-red-500 dark:border-red-600 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-8 text-white text-center">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                className="inline-block"
              >
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Hammer className="w-10 h-10" />
                </div>
              </motion.div>
              <h1 className="text-3xl font-bold mb-2">Account Suspended</h1>
              <p className="text-red-100">Your access has been restricted</p>
            </div>

            {/* Body */}
            <div className="p-8 text-center space-y-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl p-4">
                <p className="text-red-800 dark:text-red-200 font-semibold">
                  Your account has been banned by an administrator.
                </p>
                <p className="text-red-700 dark:text-red-300 text-sm mt-2">
                  You cannot access the system until this ban is lifted.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  If you believe this is a mistake, please submit an appeal from the login page.
                </p>
                <div className="text-center py-6">
                  <div className="text-6xl font-bold text-red-600 dark:text-red-400 mb-2">
                    {countdown}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Signing out in {countdown} second{countdown !== 1 ? 's' : ''}...
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => signOut({ redirectUrl: '/' })}
                  className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Sign Out Now
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // User is not banned, render children
  return <>{children}</>;
}
