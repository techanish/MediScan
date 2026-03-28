import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Hash, Database, RefreshCw, ShieldCheck,
  Truck, Package, Activity, ChevronRight,
  Users, ArrowRight, ExternalLink, CheckCircle2, XCircle,
  AlertOctagon, Cpu, Layers, Zap, Eye, FileText, Boxes
} from 'lucide-react';
import { blockchainAPI, companiesAPI } from '../utils/api';
import { downloadInvoicePdf } from './Invoice';
import type { Medicine } from '../App';
import { formatDateTimeDayFirst, toBlockchainDate } from '../utils/time';

function normalizeIdentity(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function fallbackCompanyName(email: string): string {
  const local = email.split('@')[0] || email;
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveCompanyName(identity: string, companyByEmail: Record<string, string>): string {
  if (!identity) return 'N/A';
  const normalized = normalizeIdentity(identity);
  if (companyByEmail[normalized]) return companyByEmail[normalized];
  return looksLikeEmail(identity) ? fallbackCompanyName(identity) : identity;
}

function statusIndicator(data: any): { label: string; color: string; icon: typeof CheckCircle2 } {
  if (data?.status === 'BLOCKED' || data?.blockReason) return { label: 'Blocked', color: 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', icon: XCircle };
  if (data?.suspicious) return { label: 'Suspicious', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', icon: AlertOctagon };
  return { label: 'Verified', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 };
}

function getActionBadge(action: string) {
  const map: Record<string, string> = {
    REGISTER: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    TRANSFER: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    PURCHASE: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    SALE: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    INVOICE_ISSUED: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  };
  return map[action?.toUpperCase()] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
}

interface Block {
  index: number;
  timestamp: number;
  data: any;
  previous_hash: string;
  hash: string;
}

function getBatchIdFromBlock(block: Block): string {
  return String(block.data?.batchID || block.data?.batchId || '').trim();
}

function getActionLabel(data: any): string {
  if (data?.action) return String(data.action).toUpperCase();
  if (data?.eventType === 'MEDICINE_TRANSFER') return 'TRANSFER';
  return 'DATA';
}

function extractTransferFields(data: any): {
  action: string;
  from: string;
  to: string;
  units: number | null;
  fromLocation: string;
  toLocation: string;
  transferId: string;
  payloadHash: string;
  signature: string;
} {
  const action = getActionLabel(data);
  const invoice = data?.invoice;

  if (action === 'INVOICE_ISSUED') {
    return {
      action,
      from: String(data?.soldBy || '').trim(),
      to: String(invoice?.customerEmail || data?.soldTo || '').trim(),
      units: Number.isFinite(Number(invoice?.totalUnits)) ? Number(invoice.totalUnits) : null,
      fromLocation: '',
      toLocation: '',
      transferId: String(invoice?.transactionId || data?.transactionId || '').trim(),
      payloadHash: String(invoice?.blockchainExplorerUrl || '').trim(),
      signature: 'N/A',
    };
  }

  return {
    action,
    from: String(data?.from || data?.fromOwner || data?.soldBy || data?.registeredBy || data?.manufacturer || '').trim(),
    to: String(data?.to || data?.toOwner || data?.soldTo || '').trim(),
    units: Number.isFinite(Number(data?.unitsTransferred ?? data?.unitsSold ?? data?.units))
      ? Number(data?.unitsTransferred ?? data?.unitsSold ?? data?.units)
      : null,
    fromLocation: String(data?.fromLocation || '').trim(),
    toLocation: String(data?.toLocation || '').trim(),
    transferId: String(data?.transferId || '').trim(),
    payloadHash: String(data?.transferPayloadHash || '').trim(),
    signature: String(data?.transferSignature || '').trim(),
  };
}

interface BlockchainExplorerProps {
  medicines: Medicine[];
  initialTransactionId?: string;
}

/* ─────────────── Chain Stats ─────────────── */
function ChainStats({ chain, medicines }: { chain: Block[]; medicines: Medicine[] }) {
  const transfers = chain.filter(b => b.data?.action === 'TRANSFER' || b.data?.action === 'PURCHASE').length;
  const participants = new Set(
    chain.flatMap(b => [b.data?.from, b.data?.to, b.data?.registeredBy, b.data?.manufacturer].filter(Boolean))
  ).size;

  const cards = [
    { label: 'Total Blocks', value: chain.length, icon: Layers, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Transactions', value: transfers, icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Medicines Tracked', value: medicines.length, icon: Package, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Participants', value: participants, icon: Users, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4 shadow-sm">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.bg}`}>
            <c.icon className={`w-5 h-5 ${c.color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{c.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ─────────────── Medicine Tracker (Etherscan-style) ─────────────── */
function MedicineTracker({ chain, medicines, initialBatchID, companyByEmail }: { chain: Block[]; medicines: Medicine[]; initialBatchID?: string; companyByEmail: Record<string, string> }) {
  const [batchID, setBatchID] = useState(initialBatchID || '');
  const [result, setResult] = useState<{ medicine: Medicine | null; blocks: Block[] } | null>(null);
  const [searched, setSearched] = useState(false);

  const track = (id?: string) => {
    const target = (id || batchID).trim();
    if (!target) return;
    const medicine = medicines.find(m => m.batchID.toLowerCase() === target.toLowerCase()) || null;
    const relatedBlocks = chain.filter(b =>
      b.data?.batchID?.toLowerCase() === target.toLowerCase() ||
      b.data?.batchId?.toLowerCase() === target.toLowerCase()
    );
    setResult({ medicine, blocks: relatedBlocks });
    setSearched(true);
  };

  useEffect(() => {
    if (initialBatchID) { setBatchID(initialBatchID); track(initialBatchID); }
  }, [initialBatchID]);

  const ownerHistory = result?.medicine?.ownerHistory ?? [];
  const status = result?.medicine ? statusIndicator(result.medicine) : null;

  return (
    <div className="space-y-4">
      <form onSubmit={e => { e.preventDefault(); track(); }} className="relative">
        <input
          value={batchID}
          onChange={e => setBatchID(e.target.value)}
          placeholder="Enter Batch ID / QR code  (e.g. BATCH-001)"
          className="w-full pl-5 pr-32 py-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 focus:border-emerald-500 text-base shadow-lg transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <button type="submit"
          className="absolute right-2 top-2 bottom-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-2">
          <Search className="w-4 h-4" /> Track
        </button>
      </form>

      <AnimatePresence>
        {searched && result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {result.medicine ? (
              <>
                {/* Medicine Header */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                  <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{result.medicine.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">{result.medicine.batchID}</p>
                    </div>
                    {status && (
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${status.color}`}>
                        <status.icon className="w-4 h-4" /> {status.label}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    {[
                      { label: 'Manufacturer', val: resolveCompanyName(result.medicine.manufacturer, companyByEmail) },
                      { label: 'Units Remaining', val: `${result.medicine.remainingUnits ?? '—'} / ${result.medicine.totalUnits}` },
                      { label: 'Mfg Date', val: result.medicine.mfgDate },
                      { label: 'Exp Date', val: result.medicine.expDate },
                    ].map(r => (
                      <div key={r.label} className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-3">
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide mb-1">{r.label}</p>
                        <p className="font-mono font-semibold text-gray-800 dark:text-gray-200 text-xs break-all">{r.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chain of Custody — Etherscan-style timeline */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-purple-500" />
                    Chain of Custody
                    <span className="ml-auto text-xs text-gray-400">{ownerHistory.length} hops</span>
                  </h4>
                  {ownerHistory.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No history recorded yet.</p>
                  ) : (
                    <div className="relative">
                      {/* vertical line */}
                      {ownerHistory.length > 1 && <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gradient-to-b from-blue-300 via-purple-300 to-emerald-300 dark:from-blue-700 dark:via-purple-700 dark:to-emerald-700" />}
                      <div className="space-y-4">
                        {ownerHistory.map((h, idx) => {
                          const isLast = idx === ownerHistory.length - 1;
                          const actionColors: Record<string, string> = {
                            REGISTERED: 'bg-blue-500', TRANSFERRED: 'bg-purple-500', SOLD: 'bg-emerald-500', PURCHASED: 'bg-emerald-500'
                          };
                          const dotColor = actionColors[h.action || ''] ?? (isLast ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-500');
                          return (
                            <div key={idx} className="flex gap-5 items-start">
                              <div className={`relative z-10 w-10 h-10 rounded-full ${dotColor} flex items-center justify-center flex-shrink-0 shadow-md ring-4 ring-white dark:ring-gray-800`}>
                                {h.action === 'REGISTERED' ? <Package className="w-4 h-4 text-white" /> :
                                h.action === 'TRANSFERRED' ? <Truck className="w-4 h-4 text-white" /> :
                                <ShieldCheck className="w-4 h-4 text-white" />}
                              </div>
                              <div className="flex-1 bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getActionBadge(h.action || '')}`}>
                                    {h.action || 'TRANSFER'}
                                  </span>
                                  <span className="text-xs text-gray-400">{h.date || h.time || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-lg text-xs font-medium">
                                    {resolveCompanyName(h.owner || h.from || 'N/A', companyByEmail)}
                                  </span>
                                  {h.from && h.from !== h.owner && (
                                    <>
                                      <ArrowRight className="w-3 h-3 text-gray-400" />
                                      <span className="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-lg text-xs font-medium">
                                        {resolveCompanyName(h.from, companyByEmail)}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{h.role} {h.unitsPurchased ? `• ${h.unitsPurchased} units` : ''}</p>
                                {(h.ownerLocation || h.fromLocation) && (
                                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    {h.action === 'TRANSFERRED'
                                      ? `${h.fromLocation || 'Unknown'} -> ${h.ownerLocation || 'Unknown'}`
                                      : (h.ownerLocation || h.fromLocation)}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Blockchain events for this medicine */}
                {result.blocks.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                    <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Hash className="w-4 h-4 text-blue-500" /> Blockchain Records ({result.blocks.length})
                    </h4>
                    <div className="space-y-2">
                      {result.blocks.map(b => (
                        <div key={b.index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl text-sm">
                          <span className="text-xs font-bold text-gray-400 w-12">#{b.index}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getActionBadge(b.data?.action)}`}>{b.data?.action}</span>
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">{b.hash.slice(0, 24)}…</span>
                          <span className="text-xs text-gray-400">{toBlockchainDate(b.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
                <AlertOctagon className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h3 className="font-bold text-red-800 dark:text-red-300 text-lg">Not Found</h3>
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">No medicine found with Batch ID: <code className="font-mono">{batchID}</code></p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────── Block Row ─────────────── */
function BlockRow({ block, isGenesis, onClick, companyByEmail }: { block: Block; isGenesis: boolean; onClick: () => void; companyByEmail: Record<string, string> }) {
  const date = toBlockchainDate(block.timestamp);
  const tx = extractTransferFields(block.data);
  const action = tx.action;
  const from = tx.from;
  const batchId = getBatchIdFromBlock(block);
  const to = tx.to || batchId;
  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex w-10 h-10 rounded-lg items-center justify-center font-bold text-sm ${isGenesis ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
          #{block.index}
        </span>
      </td>
      <td className="px-4 py-3">
        {action ? (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${getActionBadge(action)}`}>{action}</span>
        ) : (
          <span className="text-xs text-gray-400">{isGenesis ? 'GENESIS' : 'DATA'}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-gray-600 dark:text-gray-300">{block.hash.slice(0, 14)}…</span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        {batchId && (
          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">{batchId}</span>
        )}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        {from && (
          <div className="flex items-center gap-1 text-xs">
            <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-medium">{resolveCompanyName(from, companyByEmail)}</span>
            {to && to !== batchId && (
              <>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-medium">{resolveCompanyName(to, companyByEmail)}</span>
              </>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 text-right">
        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        <ChevronRight className="w-4 h-4 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </td>
    </motion.tr>
  );
}

/* ─────────────── Block Detail Panel ─────────────── */
function BlockDetail({ block, chain, companyByEmail, onClose, onSelectBlock }: { block: Block; chain: Block[]; companyByEmail: Record<string, string>; onClose: () => void; onSelectBlock?: (block: Block) => void }) {
  const date = toBlockchainDate(block.timestamp);
  const status = statusIndicator(block.data);
  const batchId = getBatchIdFromBlock(block);
  const tx = extractTransferFields(block.data);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const invoicePayload = block.data?.invoice;
  const isInvoiceBlock = tx.action === 'INVOICE_ISSUED' && invoicePayload;
  const relatedChain = batchId
    ? chain
        .filter((b) => getBatchIdFromBlock(b).toLowerCase() === batchId.toLowerCase())
        .sort((a, b) => a.index - b.index)
    : [block];

  const details = isInvoiceBlock
    ? [
        { label: 'Action', val: tx.action || 'INVOICE_ISSUED', mono: false },
        { label: 'Invoice Transaction', val: String(invoicePayload.transactionId || tx.transferId || 'N/A'), mono: true },
        { label: 'Seller', val: resolveCompanyName(tx.from || 'N/A', companyByEmail), mono: false },
        { label: 'Customer', val: String(invoicePayload.customerEmail || tx.to || 'N/A'), mono: false },
        { label: 'Item Count', val: String(Array.isArray(invoicePayload.items) ? invoicePayload.items.length : 0), mono: false },
        { label: 'Total Units', val: String(invoicePayload.totalUnits ?? tx.units ?? 'N/A'), mono: false },
        { label: 'Total Price', val: Number.isFinite(Number(invoicePayload.totalPrice)) ? `INR ${Number(invoicePayload.totalPrice).toFixed(2)}` : 'N/A', mono: false },
        { label: 'Invoice Date', val: formatDateTimeDayFirst(String(invoicePayload.dateTime || date.toISOString())), mono: false },
        { label: 'Explorer Link', val: String(invoicePayload.blockchainExplorerUrl || tx.payloadHash || 'N/A'), mono: true },
      ]
    : [
        { label: 'Action', val: tx.action || 'DATA', mono: false },
        { label: 'Batch ID', val: batchId || 'N/A', mono: true },
        { label: 'From Company', val: resolveCompanyName(tx.from || 'N/A', companyByEmail), mono: false },
        { label: 'To Company', val: resolveCompanyName(tx.to || 'N/A', companyByEmail), mono: false },
        { label: 'Units', val: tx.units !== null ? String(tx.units) : 'N/A', mono: false },
        { label: 'Route', val: tx.fromLocation || tx.toLocation ? `${tx.fromLocation || 'Unknown'} -> ${tx.toLocation || 'Unknown'}` : 'N/A', mono: false },
        { label: 'Transfer ID', val: tx.transferId || 'N/A', mono: true },
        { label: 'Payload Hash', val: tx.payloadHash || block.hash, mono: true },
        { label: 'Signature', val: tx.signature || 'N/A', mono: true },
      ];

  const handleDownloadInvoice = async () => {
    if (!isInvoiceBlock) return;

    const explorerUrl = invoicePayload.blockchainExplorerUrl
      || `${window.location.origin}${window.location.pathname}?tab=blockchain&tx=${encodeURIComponent(String(invoicePayload.transactionId || block.data?.transactionId || ''))}`;

    setIsDownloadingInvoice(true);
    try {
      await downloadInvoicePdf({
        transactionId: String(invoicePayload.transactionId || block.data?.transactionId || ''),
        items: Array.isArray(invoicePayload.items) ? invoicePayload.items : [],
        totalUnits: Number(invoicePayload.totalUnits || 0),
        totalPrice: Number(invoicePayload.totalPrice || 0),
        dateTime: formatDateTimeDayFirst(String(invoicePayload.dateTime || date.toISOString())),
        customerEmail: String(invoicePayload.customerEmail || block.data?.soldTo || ''),
        blockchainExplorerUrl: String(explorerUrl),
      });
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl p-6 sm:p-8 md:p-10 space-y-5 max-h-[94vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" /> Block #{block.index}
        </h3>
        <div className="flex items-center gap-2">
          {isInvoiceBlock && (
            <button
              type="button"
              onClick={handleDownloadInvoice}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              disabled={isDownloadingInvoice}
            >
              <FileText className="h-4 w-4" />
              {isDownloadingInvoice ? 'Preparing PDF...' : 'Download Invoice PDF'}
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">✕</button>
        </div>
      </div>
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${status.color}`}>
        <status.icon className="w-3.5 h-3.5" /> {status.label}
      </span>
      <div className="space-y-4">
        {[
          { label: 'Hash', val: block.hash, mono: true },
          { label: 'Previous Hash', val: block.previous_hash, mono: true },
          { label: 'Timestamp', val: date.toLocaleString(), mono: false },
        ].map(r => (
          <div key={r.label}>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{r.label}</p>
            <p className={`text-xs sm:text-sm break-all bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 ${r.mono ? 'font-mono' : ''} text-gray-700 dark:text-gray-300`}>{r.val}</p>
          </div>
        ))}

        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Transaction Details</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {details.map((r) => (
              <div key={r.label}>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{r.label}</p>
                <p className={`text-xs sm:text-sm break-all bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 ${r.mono ? 'font-mono' : ''} text-gray-700 dark:text-gray-300`}>{r.val}</p>
              </div>
            ))}
          </div>
        </div>

        {isInvoiceBlock && Array.isArray(invoicePayload.items) && invoicePayload.items.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5" /> Invoice Line Items
            </p>
            <div className="space-y-2 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-2.5">
              {invoicePayload.items.map((item: any, idx: number) => (
                <div key={`${item.batchID || 'item'}-${idx}`} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold truncate">{item.medicineName || 'Medicine'}</span>
                    <span className="font-mono rounded bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">x{item.quantity || 0}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500 dark:text-gray-400">
                    <span>Batch: <span className="font-mono">{item.batchID || 'N/A'}</span></span>
                    <span>Unit: INR {Number(item.unitPrice || 0).toFixed(2)}</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">Total: INR {(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">{isInvoiceBlock ? 'Related Blocks' : 'Transfer Chain'}</p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-2.5">
            {relatedChain.map((b) => {
              const link = extractTransferFields(b.data);
              const isActive = b.index === block.index;
              const fromLabel = resolveCompanyName(link.from || 'N/A', companyByEmail);
              const toLabel = resolveCompanyName(link.to || 'N/A', companyByEmail);
              const showDirection = fromLabel !== toLabel && toLabel !== getBatchIdFromBlock(b);
              return (
                <button
                  key={b.index}
                  type="button"
                  onClick={() => onSelectBlock?.(b)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 border transition-colors ${isActive ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Block #{b.index}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getActionBadge(link.action)}`}>{link.action}</span>
                  </div>
                  <p className="text-xs font-mono text-gray-700 dark:text-gray-300 mt-1 break-all">{b.hash.slice(0, 28)}...</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {showDirection ? `${fromLabel} => ${toLabel}` : fromLabel}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BlockDetailModal({ block, chain, companyByEmail, onClose, onSelectBlock }: { block: Block; chain: Block[]; companyByEmail: Record<string, string>; onClose: () => void; onSelectBlock: (block: Block) => void }) {
  return (
    <AnimatePresence>
      <motion.div
        key="block-detail-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm p-2 sm:p-4 flex items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="w-[98vw] sm:w-[95vw] max-w-[1400px]"
          onClick={(e) => e.stopPropagation()}
        >
          <BlockDetail block={block} chain={chain} companyByEmail={companyByEmail} onClose={onClose} onSelectBlock={onSelectBlock} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─────────────── Main Explorer ─────────────── */
export function BlockchainExplorer({ medicines, initialTransactionId }: BlockchainExplorerProps) {
  const { getToken } = useAuth();
  const [chain, setChain] = useState<Block[]>([]);
  const [companyByEmail, setCompanyByEmail] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [activeTab, setActiveTab] = useState<'blocks' | 'tracker'>('blocks');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [trackerBatchID, setTrackerBatchID] = useState<string>('');
  const [liveBlocks, setLiveBlocks] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAppliedInitialTxRef = useRef(false);

  const loadChain = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const response = await blockchainAPI.getChain(token);
      if (response.success && response.chain) setChain(response.chain);
      else if (Array.isArray(response)) setChain(response);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load blockchain');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { loadChain(); }, [loadChain]);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await companiesAPI.list(token);
        if (!response?.success || !Array.isArray(response.companies)) return;

        const map: Record<string, string> = {};
        response.companies.forEach((company: { email?: string; companyName?: string }) => {
          if (!company.email || !company.companyName) return;
          map[normalizeIdentity(company.email)] = company.companyName;
        });
        setCompanyByEmail(map);
      } catch {
        // Non-blocking: UI falls back to readable labels.
      }
    };

    loadCompanies();
  }, [getToken]);

  // Real-time polling via interval
  useEffect(() => {
    if (liveBlocks) {
      intervalRef.current = setInterval(() => loadChain(true), 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [liveBlocks, loadChain]);

  useEffect(() => {
    if (!initialTransactionId || !chain.length || hasAppliedInitialTxRef.current) return;

    const tx = initialTransactionId.trim();
    if (!tx) return;

    const targetBlock = chain.find((block) => String(block.data?.transactionId || '').trim() === tx);
    if (targetBlock) {
      setActiveTab('blocks');
      setSelectedBlock(targetBlock);
      setSearch(String(targetBlock.index));
      const batchId = getBatchIdFromBlock(targetBlock);
      if (batchId) {
        setTrackerBatchID(batchId);
      }
    }

    hasAppliedInitialTxRef.current = true;
  }, [initialTransactionId, chain]);

  const filteredChain = chain.filter(b => {
    const matchSearch = !search || 
      b.hash.toLowerCase().includes(search.toLowerCase()) ||
      b.data?.batchID?.toLowerCase().includes(search.toLowerCase()) ||
      b.data?.action?.toLowerCase().includes(search.toLowerCase()) ||
      String(b.index).includes(search);
    const matchAction = filterAction === 'ALL' || b.data?.action === filterAction;
    return matchSearch && matchAction;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="w-14 h-14 border-4 border-gray-200 dark:border-gray-700 border-t-emerald-600 rounded-full animate-spin" />
      <p className="text-gray-500 dark:text-gray-400 font-medium">Loading blockchain…</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-24 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
      <Database className="w-12 h-12 text-red-400 mx-auto mb-3" />
      <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">Blockchain Unavailable</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
      <button onClick={() => loadChain()} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            Blockchain Explorer
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Immutable ledger · {chain.length} blocks · Last sync {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLiveBlocks(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${liveBlocks ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200/50' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
          >
            <Zap className={`w-4 h-4 ${liveBlocks ? 'animate-pulse' : ''}`} />
            {liveBlocks ? 'Live' : 'Go Live'}
          </button>
          <button onClick={() => loadChain()} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Chain Stats */}
      <ChainStats chain={chain} medicines={medicines} />

      {/* Tabs */}
      <div className="flex bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-1 gap-1 shadow-sm w-full sm:w-auto sm:inline-flex">
        {[{ id: 'blocks', label: 'Block Explorer', icon: Database }, { id: 'tracker', label: 'Medicine Tracker', icon: Eye }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Block Explorer Tab */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          {/* Search + Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by block #, hash, or Batch ID…"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
              />
            </div>
            <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                className="px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" title="Filter by action">
              <option value="ALL">All Actions</option>
              <option value="REGISTER">Register</option>
              <option value="TRANSFER">Transfer</option>
              <option value="PURCHASE">Purchase</option>
              <option value="INVOICE_ISSUED">Invoice Issued</option>
            </select>
          </div>

          {/* Block list */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 w-16">Block</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Action</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400">Hash</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">Medicine</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">From → To</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-500 dark:text-gray-400">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {filteredChain.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-16 text-gray-400 dark:text-gray-500">
                        <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>No blocks match your search.</p>
                      </td></tr>
                    ) : (
                      filteredChain.map(block => (
                        <BlockRow
                          key={block.index}
                          block={block}
                          isGenesis={block.index === 0}
                          companyByEmail={companyByEmail}
                          onClick={() => {
                            setSelectedBlock(prev => prev?.index === block.index ? null : block);
                            const batchId = getBatchIdFromBlock(block);
                            if (batchId) setTrackerBatchID(batchId);
                          }}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center justify-between">
                <span className="text-xs text-gray-400">Showing {filteredChain.length} of {chain.length} blocks</span>
                {search && filteredChain.length > 0 && (
                  <button onClick={() => { setActiveTab('tracker'); }} className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline">
                    Track medicine <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
          </div>

          {selectedBlock && (
            <BlockDetailModal
              block={selectedBlock}
              chain={chain}
              companyByEmail={companyByEmail}
              onClose={() => setSelectedBlock(null)}
              onSelectBlock={(block) => setSelectedBlock(block)}
            />
          )}
        </div>
      )}

      {/* Medicine Tracker Tab */}
      {activeTab === 'tracker' && (
        <MedicineTracker chain={chain} medicines={medicines} initialBatchID={trackerBatchID} companyByEmail={companyByEmail} />
      )}
    </div>
  );
}
