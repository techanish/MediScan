import QRCode from 'qrcode';
import type { Medicine } from '../App';
import { buildMedicineQrPayload } from './medicineQr';

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatEventTime = (value?: string): string => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN');
};

interface PrintMedicineLabelOptions {
  qrPayload?: string;
}

export const printMedicineLabel = async (
  medicine: Medicine,
  options?: PrintMedicineLabelOptions
): Promise<void> => {
  const printWindow = window.open('', '_blank', 'width=860,height=700');
  if (!printWindow) {
    throw new Error('Unable to open print window');
  }

  const qrPayload = options?.qrPayload || buildMedicineQrPayload(medicine);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 240,
    margin: 1,
    color: {
      dark: '#065f46',
      light: '#ffffff',
    },
  });

  const timelineEntries = [...(medicine.ownerHistory || [])]
    .sort((a, b) => new Date(b.date || b.time || '').getTime() - new Date(a.date || a.time || '').getTime())
    .slice(0, 6);

  const timelinePreview = timelineEntries
    .map((event) => {
      const action = escapeHtml(event.action || 'UPDATED');
      const owner = escapeHtml(event.owner || 'Unknown owner');
      const time = escapeHtml(formatEventTime(event.date || event.time));
      return `<li><strong>${action}</strong> • ${owner}<br /><span class="muted">${time}</span></li>`;
    })
    .join('');

  const printableHtml = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>MediScan Label - ${escapeHtml(medicine.batchID)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #111827; }
      .label { border: 2px solid #059669; border-radius: 14px; padding: 16px; max-width: 760px; margin: 0 auto; }
      .brand { background: #065f46; color: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; }
      .brand h1 { margin: 0; font-size: 18px; }
      .brand p { margin: 4px 0 0; font-size: 12px; opacity: 0.9; }
      .layout { display: grid; grid-template-columns: 1fr 180px; gap: 14px; align-items: start; }
      .qrWrap { border: 1px solid #d1d5db; border-radius: 10px; background: #fff; padding: 8px; text-align: center; }
      .qrWrap img { width: 150px; height: 150px; display: block; margin: 0 auto; }
      .qrWrap p { margin: 6px 0 0; font-size: 11px; color: #4b5563; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
      .item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; }
      .item .k { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.02em; }
      .item .v { font-size: 14px; font-weight: 700; margin-top: 2px; word-break: break-word; }
      .timeline { margin-top: 14px; border-top: 1px dashed #d1d5db; padding-top: 10px; }
      .timeline h2 { margin: 0 0 8px; font-size: 13px; }
      .timeline ul { margin: 0; padding-left: 18px; }
      .timeline li { margin-bottom: 6px; font-size: 12px; }
      .muted { color: #6b7280; font-size: 11px; }
      .footer { margin-top: 10px; font-size: 11px; color: #6b7280; }
      @media print { body { padding: 8mm; } }
    </style>
  </head>
  <body>
    <section class="label">
      <div class="brand">
        <h1>MediScan Verified Label</h1>
        <p>Batch ${escapeHtml(medicine.batchID)}</p>
      </div>
      <div class="layout">
        <div>
          <div class="grid">
            <div class="item"><div class="k">Medicine</div><div class="v">${escapeHtml(medicine.name)}</div></div>
            <div class="item"><div class="k">Manufacturer</div><div class="v">${escapeHtml(medicine.manufacturer)}</div></div>
            <div class="item"><div class="k">Category</div><div class="v">${escapeHtml(medicine.category || 'Medicine')}</div></div>
            <div class="item"><div class="k">Status</div><div class="v">${escapeHtml((medicine.status || 'UNKNOWN').replace('_', ' '))}</div></div>
            <div class="item"><div class="k">MFG Date</div><div class="v">${escapeHtml(medicine.mfgDate)}</div></div>
            <div class="item"><div class="k">EXP Date</div><div class="v">${escapeHtml(medicine.expDate)}</div></div>
            <div class="item"><div class="k">Units</div><div class="v">${String(medicine.remainingUnits ?? medicine.totalUnits ?? 0)}</div></div>
            <div class="item"><div class="k">Price / Unit</div><div class="v">INR ${(medicine.price ?? 0).toFixed(2)}</div></div>
          </div>
        </div>
        <div class="qrWrap">
          <img src="${qrDataUrl}" alt="QR code" />
          <p>Scan to verify</p>
        </div>
      </div>
      <div class="timeline">
        <h2>Recent Chain Events</h2>
        <ul>${timelinePreview || '<li>No timeline events available.</li>'}</ul>
      </div>
      <p class="footer">Printed on ${escapeHtml(new Date().toLocaleString('en-IN'))}</p>
    </section>
    <script>
      window.addEventListener('load', () => {
        setTimeout(() => {
          window.print();
          window.onafterprint = () => window.close();
        }, 150);
      });
    </script>
  </body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(printableHtml);
  printWindow.document.close();
};
