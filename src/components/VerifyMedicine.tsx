import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Search,
  Package,
  Shield,
  Clock,
  Building2,
  Calendar,
  User,
  ArrowRight,
  Box,
} from 'lucide-react';
import type { Medicine } from '../App';


interface VerifyMedicineProps {
  onVerify: (batchID: string) => Promise<{ verified: boolean; medicine?: Medicine; error?: string }>;
}

export function VerifyMedicine({ onVerify }: VerifyMedicineProps) {
  const [batchID, setBatchID] = useState('');
  const [result, setResult] = useState<{ verified: boolean; medicine?: Medicine; error?: string } | null>(
    null
  );
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (!batchID.trim()) return;

    setIsVerifying(true);
    setResult(null);

    await new Promise((resolve) => setTimeout(resolve, 800));

    const verifyResult = await onVerify(batchID);
    setResult(verifyResult);
    setIsVerifying(false);
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      MANUFACTURER: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800',
      DISTRIBUTOR: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
      PHARMACY: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
      CUSTOMER: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800',
    };
    return colors[role] || 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-500" />
          Verify Medicine
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Check medicine authenticity and ownership history</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={batchID}
              onChange={(e) => setBatchID(e.target.value)}
              placeholder="Enter Batch ID to verify (e.g., BATCH-001)"
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder-slate-400"
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
          </div>
          <button
            onClick={handleVerify}
            disabled={isVerifying || !batchID.trim()}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:shadow-xl transition-all duration-200 disabled:opacity-50 flex items-center gap-2 disabled:cursor-not-allowed"
          >
            {isVerifying ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Search className="w-5 h-5" />
                Verify
              </>
            )}
          </button>
        </div>

        {result && (
          <div
            className={`rounded-2xl overflow-hidden border-2 ${
              result.verified
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-900'
                : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-900'
            }`}
          >
            {/* Status Header */}
            <div
              className={`p-4 flex items-center gap-3 ${
                result.verified ? 'bg-green-100/50 dark:bg-green-900/50' : 'bg-red-100/50 dark:bg-red-900/50'
              }`}
            >
              {result.verified ? (
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              )}
              <div>
                <h3 className={`text-lg font-bold ${result.verified ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  {result.verified ? 'Verified Authentic' : 'Verification Failed'}
                </h3>
                <p className={result.verified ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}>
                  {result.verified
                    ? 'This medicine is registered and authenticated'
                    : result.error || 'Medicine not found in the registry'}
                </p>
              </div>
            </div>

            {/* Medicine Details */}
            {result.medicine && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-slate-900/10">
                    <Package className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Medicine Name</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{result.medicine.name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-slate-900/10">
                    <Building2 className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Manufacturer</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{result.medicine.manufacturer}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-slate-900/10">
                    <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Manufacturing Date</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{result.medicine.mfgDate}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-slate-900/10">
                    <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Expiry Date</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{result.medicine.expDate}</p>
                    </div>
                  </div>
                  {result.medicine.totalUnits !== undefined && (
                    <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-slate-900/10">
                      <Box className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Stock Status</p>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {result.medicine.remainingUnits ?? result.medicine.totalUnits} / {result.medicine.totalUnits} units
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ownership History */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Ownership History
                  </h4>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
                    <div className="space-y-4">
                      {result.medicine.ownerHistory.map((entry, index) => (
                        <div key={index} className="relative flex items-start gap-4 pl-10">
                          <div
                            className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                              index === result.medicine!.ownerHistory.length - 1
                                ? 'bg-green-500 border-green-500 ring-4 ring-green-100 dark:ring-green-900/30'
                                : 'bg-slate-300 dark:bg-slate-600 border-slate-300 dark:border-slate-600'
                            }`}
                          />
                          <div className="flex-1 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-900 dark:text-white">{entry.owner}</span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full border ${getRoleColor(
                                  entry.role
                                )}`}
                              >
                                {entry.role}
                              </span>
                              {index < result.medicine!.ownerHistory.length - 1 && (
                                <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{entry.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
