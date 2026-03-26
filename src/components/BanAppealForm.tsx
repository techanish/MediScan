import { useState } from 'react';
import { motion } from 'framer-motion';
import { Hammer, Send, X } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface BanAppealFormProps {
  userEmail?: string;
  onClose: () => void;
}

export function BanAppealForm({ userEmail, onClose }: BanAppealFormProps) {
  const [email, setEmail] = useState(userEmail || '');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please provide your email address');
      return;
    }

    if (!description.trim()) {
      toast.error('Please provide details for your appeal');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/tickets/ban-appeal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit appeal');
      }

      toast.success('Appeal submitted successfully! An administrator will review your request.');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit appeal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-red-200 dark:border-red-900 overflow-hidden max-w-lg w-full"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Hammer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Account Banned</h2>
              <p className="text-red-100 text-sm">Submit an appeal to the administrator</p>
            </div>
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
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl p-4">
          <p className="text-sm text-red-800 dark:text-red-200 font-medium">
            Your account has been suspended. You cannot access the system until this ban is lifted.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="appeal-email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
            Email Address
          </label>
          <input
            id="appeal-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            required
            disabled={!!userEmail}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="appeal-description" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
            Appeal Message
          </label>
          <textarea
            id="appeal-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain why you believe this ban should be reconsidered..."
            rows={6}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Be respectful and provide clear reasons for your appeal. An administrator will review your request.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !description.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-xl transition-colors disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Submitting...' : 'Submit Appeal'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
