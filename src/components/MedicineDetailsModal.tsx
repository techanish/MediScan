import { useEffect, useMemo, useState } from 'react';
import type { Medicine } from '../App';
import { X, Calendar, MapPin, Package, ShieldCheck, Activity, FileText, Clock, Printer, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { printMedicineLabel } from '../utils/printLabel';

interface MedicineDetailsModalProps {
  medicine: Medicine | null;
  onClose: () => void;
}

const formatEventTime = (value?: string): string => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN');
};

export function MedicineDetailsModal({ medicine, onClose }: MedicineDetailsModalProps) {
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [isPrintingLabel, setIsPrintingLabel] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  const ownerHistory = medicine?.ownerHistory ?? [];

  const timelineEntries = useMemo(() => {
    const entries = [...ownerHistory];
    entries.sort((a, b) => {
      const aTime = new Date(a.date || a.time || '').getTime();
      const bTime = new Date(b.date || b.time || '').getTime();
      return bTime - aTime;
    });
    return entries;
  }, [ownerHistory]);

  useEffect(() => {
    setShowFullTimeline(false);
  }, [medicine?.batchID]);

  if (!medicine) return null;

  const TIMELINE_PREVIEW_LIMIT = 8;
  const visibleTimeline = showFullTimeline
    ? timelineEntries
    : timelineEntries.slice(0, TIMELINE_PREVIEW_LIMIT);
  const hasMoreTimeline = timelineEntries.length > TIMELINE_PREVIEW_LIMIT;

  const handlePrint = async () => {
    setIsPrintingLabel(true);
    try {
      await printMedicineLabel(medicine);
      toast.success(`Opened printable label for ${medicine.batchID}`);
    } catch {
      toast.error('Unable to open print window. Please allow pop-ups and try again.');
    } finally {
      setIsPrintingLabel(false);
    }
  };

  const handleDownloadReport = async () => {
    setIsDownloadingReport(true);
    try {
      const excelModule = await import('exceljs');
      const WorkbookCtor = excelModule.Workbook || excelModule.default?.Workbook;
      if (!WorkbookCtor) throw new Error('Excel workbook unavailable');

      const workbook = new WorkbookCtor();
      const worksheet = workbook.addWorksheet('Medicine Report');
      const generatedAt = new Date().toLocaleString('en-IN');

      worksheet.columns = [
        { width: 24 },
        { width: 54 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 16 },
      ];

      worksheet.mergeCells('A1:F1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `MediScan Medicine Report - ${medicine.batchID}`;
      titleCell.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 24;

      worksheet.mergeCells('A2:F2');
      const metaCell = worksheet.getCell('A2');
      metaCell.value = `Generated: ${generatedAt}`;
      metaCell.font = { italic: true, color: { argb: 'FF475569' } };

      const summaryRows: Array<[string, string]> = [
        ['Batch ID', medicine.batchID],
        ['Medicine Name', medicine.name],
        ['Manufacturer', medicine.manufacturer],
        ['Category', medicine.category || 'Medicine'],
        ['Status', (medicine.status || 'UNKNOWN').replace('_', ' ')],
        ['Verified', medicine.verified ? 'Yes' : 'No'],
        ['MFG Date', medicine.mfgDate],
        ['EXP Date', medicine.expDate],
        ['Price Per Unit (INR)', (medicine.price ?? 0).toFixed(2)],
        ['Total Units', String(medicine.totalUnits ?? 0)],
        ['Remaining Units', String(medicine.remainingUnits ?? medicine.totalUnits ?? 0)],
        ['Location', medicine.location || 'Unknown'],
      ];

      let rowIndex = 4;
      for (const [field, value] of summaryRows) {
        const row = worksheet.getRow(rowIndex);
        row.getCell(1).value = field;
        row.getCell(2).value = value;

        row.getCell(1).font = { bold: true, color: { argb: 'FF0F172A' } };
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        row.getCell(2).alignment = { wrapText: true };

        row.getCell(1).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        row.getCell(2).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        rowIndex += 1;
      }

      rowIndex += 1;
      worksheet.mergeCells(`A${rowIndex}:F${rowIndex}`);
      const timelineTitleCell = worksheet.getCell(`A${rowIndex}`);
      timelineTitleCell.value = 'Timeline Events';
      timelineTitleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      timelineTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      timelineTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      worksheet.getRow(rowIndex).height = 20;

      rowIndex += 1;
      const tableHeaderRow = worksheet.getRow(rowIndex);
      const tableHeaders = ['#', 'Action', 'Owner', 'Date/Time', 'Location', 'Units'];
      tableHeaders.forEach((header, idx) => {
        const cell = tableHeaderRow.getCell(idx + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });
      tableHeaderRow.height = 19;

      const timelineSource = timelineEntries.length > 0
        ? timelineEntries
        : [{ action: 'NO_TIMELINE', owner: '', date: '', time: '', ownerLocation: '', fromLocation: '', unitsPurchased: undefined }];

      timelineSource.forEach((event, index) => {
        const lineIndex = rowIndex + index + 1;
        const row = worksheet.getRow(lineIndex);

        const location = event.action === 'TRANSFERRED'
          ? `${event.fromLocation || 'Unknown'} -> ${event.ownerLocation || 'Unknown'}`
          : (event.ownerLocation || event.fromLocation || 'N/A');

        const values = [
          timelineEntries.length > 0 ? String(index + 1) : '',
          event.action || 'UPDATED',
          event.owner || 'Unknown owner',
          formatEventTime(event.date || event.time),
          location,
          event.unitsPurchased ? String(event.unitsPurchased) : '',
        ];

        values.forEach((value, idx) => {
          const cell = row.getCell(idx + 1);
          cell.value = value;
          cell.alignment = { vertical: 'top', wrapText: true, horizontal: idx === 0 || idx === 5 ? 'center' : 'left' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          if (index % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `medicine-report-${medicine.batchID}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded Excel report for ${medicine.name}`);
    } catch {
      toast.error('Failed to generate Excel report. Please try again.');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-emerald-600 p-6 text-white flex justify-between items-start shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-emerald-500/30 px-2 py-1 rounded text-xs font-medium border border-emerald-400/30">
                  {medicine.category || 'Medicine'}
                </span>
                {medicine.verified && (
                  <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded text-xs font-medium">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
              <h2 className="text-3xl font-bold">{medicine.name}</h2>
              <p className="text-emerald-100 opacity-90 font-mono text-sm mt-1">{medicine.batchID}</p>
            </div>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

              {/* Main Details */}
              <div className="md:col-span-2 space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Status</span>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                      medicine.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                      medicine.status === 'LOW_STOCK' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {medicine.status?.replace('_', ' ') || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Manufacturer</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{medicine.manufacturer}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-400" />
                    Product Description
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-xl shadow-sm">
                    {medicine.description || 'No description available for this product.'}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-gray-400" />
                    Specifications
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Dosage</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{medicine.dosage || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Composition</p>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{medicine.composition || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Price per Unit</p>
                        <p className="font-semibold text-gray-900 dark:text-white">₹{medicine.price?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{medicine.location || 'Unknown'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Important Dates
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Manufactured</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{medicine.mfgDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Expires</span>
                      <span className={`text-sm font-medium ${medicine.status === 'EXPIRED' ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                        {medicine.expDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    Timeline
                    <span className="ml-auto text-xs font-medium text-gray-400">{timelineEntries.length} events</span>
                  </h4>
                  <div className="max-h-[22rem] sm:max-h-96 overflow-y-auto pr-2">
                    <div className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-6">
                      {visibleTimeline.map((h, i) => {
                        const isLatest = i === 0;
                        return (
                          <div key={i} className="relative min-w-0">
                            <div className={`absolute -left-[20px] top-1.5 w-2.5 h-2.5 rounded-full border border-white dark:border-gray-800 ${
                              isLatest
                                ? 'bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-900/40'
                                : 'bg-slate-300 dark:bg-slate-500'
                            }`} />
                            <p className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase">{h.action || 'UPDATED'}</p>
                            <p className="text-xs text-gray-500">{h.date || h.time || 'Unknown time'}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 break-words" title={h.owner || ''}>
                              {h.owner || 'Unknown owner'}
                            </p>
                            {(h.ownerLocation || h.fromLocation) && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 break-words" title={h.action === 'TRANSFERRED' ? `${h.fromLocation || 'Unknown'} -> ${h.ownerLocation || 'Unknown'}` : (h.ownerLocation || h.fromLocation || '')}>
                                {h.action === 'TRANSFERRED'
                                  ? `${h.fromLocation || 'Unknown'} -> ${h.ownerLocation || 'Unknown'}`
                                  : (h.ownerLocation || h.fromLocation)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {hasMoreTimeline && (
                    <button
                      type="button"
                      onClick={() => setShowFullTimeline(prev => !prev)}
                      className="mt-4 w-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg px-3 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                    >
                      {showFullTimeline
                        ? `Show latest ${TIMELINE_PREVIEW_LIMIT} events`
                        : `Show all ${timelineEntries.length} events`}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handlePrint}
                    disabled={isPrintingLabel}
                    className="flex flex-col items-center justify-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <Printer className="w-5 h-5 mb-1 text-gray-400" />
                    {isPrintingLabel ? 'Preparing...' : 'Print Label'}
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    disabled={isDownloadingReport}
                    className="flex flex-col items-center justify-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <Download className="w-5 h-5 mb-1 text-gray-400" />
                    {isDownloadingReport ? 'Exporting...' : 'Report'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
