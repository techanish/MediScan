import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link2, Hash, Clock, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { blockchainAPI } from '../utils/api';

interface Block {
  index: number;
  timestamp: number;
  data: any;
  previous_hash: string;
  hash: string;
}

export function BlockchainViewer() {
  const { getToken } = useAuth();
  const [chain, setChain] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChain();
  }, []);

  const loadChain = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const response = await blockchainAPI.getChain(token);
      if (response.success && response.chain) {
        setChain(response.chain);
      } else if (Array.isArray(response)) {
        // The blockchain service may return the chain directly
        setChain(response);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load blockchain');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-700 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">Loading blockchain...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Database className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Blockchain Unavailable</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
        <button
          onClick={loadChain}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            Blockchain Ledger
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Immutable audit trail — {chain.length} block{chain.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={loadChain}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {chain.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <Database className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No blocks recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {chain.map((block, idx) => (
            <div key={block.index} className="relative">
              {/* Connector line between blocks */}
              {idx < chain.length - 1 && (
                <div className="absolute left-6 top-full w-0.5 h-4 bg-emerald-200 dark:bg-emerald-800 z-10" />
              )}
              <BlockCard block={block} isGenesis={block.index === 0} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockCard({ block, isGenesis }: { block: Block; isGenesis: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(block.timestamp * 1000);

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden transition-all ${
        isGenesis
          ? 'border-emerald-200 dark:border-emerald-800'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {/* Block header */}
      <button
        className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Block index badge */}
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-lg ${
            isGenesis
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          #{block.index}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-800 dark:text-white">
              {isGenesis ? 'Genesis Block' : getBlockTitle(block.data)}
            </span>
            {isGenesis && (
              <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full font-medium">
                GENESIS
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {date.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 font-mono truncate">
              <Hash className="w-3 h-3 flex-shrink-0" />
              {block.hash.slice(0, 20)}…
            </span>
          </div>
        </div>

        <span className="text-slate-400 dark:text-slate-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-4 space-y-3 text-sm">
          <HashRow label="Hash" value={block.hash} />
          <HashRow label="Previous Hash" value={block.previous_hash} icon={<Link2 className="w-3.5 h-3.5" />} />
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Data</p>
            <pre className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
              {typeof block.data === 'string'
                ? block.data
                : JSON.stringify(block.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function HashRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 rounded px-2 py-1 break-all">
        {value}
      </p>
    </div>
  );
}

function getBlockTitle(data: any): string {
  if (typeof data === 'string') return data;
  if (data?.action) return `${data.action}${data.batchID ? ` — ${data.batchID}` : ''}`;
  if (data?.batchID) return `Batch ${data.batchID}`;
  return 'Transaction';
}
