import { useState } from 'react';
import { ShieldCheck, Search, Check, AlertOctagon, MapPin, Calendar, User, Box } from 'lucide-react';
import type { Medicine } from '../App';
import { motion, AnimatePresence } from 'framer-motion';

interface VerifyMedicineProps {
  medicines: Medicine[];
  onVerify?: (batchID: string) => Promise<{ verified: boolean; medicine?: Medicine; error?: string }>;
}

export function VerifyMedicine({ medicines, onVerify }: VerifyMedicineProps) {
  const [batchId, setBatchId] = useState('');
  const [result, setResult] = useState<Medicine | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!batchId) return;
    setLoading(true);
    setResult(undefined);
    setErrorMsg('');

    if (onVerify) {
      const res = await onVerify(batchId);
      if (res.verified && res.medicine) {
        setResult(res.medicine);
      } else {
        setResult(null);
        setErrorMsg(res.error || 'Medicine not found in registry');
      }
    } else {
      // fallback: local search
      const found = medicines.find(m => m.batchID === batchId);
      setResult(found || null);
      if (!found) setErrorMsg('Batch ID not found in registry');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Verify Medicine Authenticity</h2>
        <p className="text-gray-500 dark:text-gray-400">Enter the Batch ID to trace the product.</p>
      </div>

      <div className="relative mb-12">
        <form onSubmit={handleVerify} className="relative">
          <input
            type="text"
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            placeholder="Enter Batch ID (e.g., BATCH-001)"
            className="w-full pl-6 pr-28 py-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-lg shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <div className="absolute right-2 top-2 bottom-2 flex gap-2">
            <button
              type="submit"
              disabled={loading || !batchId}
              className="px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-70 font-medium"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>

      <AnimatePresence mode="wait">
        {result !== undefined && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {result === null ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-6 flex items-center gap-4 text-red-800 dark:text-red-300">
                <AlertOctagon className="w-10 h-10 shrink-0" />
                <div>
                  <h3 className="font-bold text-lg">Verification Failed</h3>
                  <p className="text-red-600 dark:text-red-400 opacity-90">{errorMsg || 'This Batch ID was not found in the registry. Please check the ID or contact the manufacturer.'}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
                <div className="bg-emerald-600 dark:bg-emerald-700 p-6 text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-bold tracking-wide uppercase text-sm">Verified Authentic</span>
                  </div>
                  <h3 className="text-2xl font-bold">{result.name}</h3>
                  <p className="opacity-90">{result.manufacturer}</p>
                </div>

                <div className="p-6 grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Box className="w-3 h-3" /> Batch ID
                    </p>
                    <p className="font-mono text-gray-700 dark:text-gray-300">{result.batchID}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3 h-3" /> Current Owner
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 truncate" title={result.currentOwner}>{result.currentOwner}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Mfg Date
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">{result.mfgDate}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Exp Date
                    </p>
                    <p className={`font-bold ${result.status === 'EXPIRED' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {result.expDate}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900/30">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    Chain of Custody
                  </h4>
                  <div className="relative pl-4 space-y-6 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                    {result.ownerHistory.map((history, idx) => (
                      <div key={idx} className="relative flex items-start gap-4">
                        <div className={`relative z-10 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 mt-1.5 ${
                          idx === result.ownerHistory.length - 1 ? 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/30' : 'bg-gray-300 dark:bg-gray-600'
                        }`} />
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {history.action}
                            {history.unitsPurchased && <span className="font-normal text-gray-500 dark:text-gray-400"> ({history.unitsPurchased} units)</span>}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{history.date || history.time}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 font-medium">{history.owner}</p>
                          {(history.ownerLocation || history.fromLocation) && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                              {history.action === 'TRANSFERRED'
                                ? `${history.fromLocation || 'Unknown'} → ${history.ownerLocation || 'Unknown'}`
                                : (history.ownerLocation || history.fromLocation)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
