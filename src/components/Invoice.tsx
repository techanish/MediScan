export interface InvoiceItem {
  batchID: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceDocumentData {
  transactionId: string;
  items: InvoiceItem[];
  totalUnits: number;
  totalPrice: number;
  dateTime: string;
  customerEmail: string;
}

async function getJsPdfConstructor() {
  const existing = (window as Window & { jspdf?: { jsPDF?: any } }).jspdf?.jsPDF;
  if (existing) return existing;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.body.appendChild(script);
  });

  return (window as Window & { jspdf?: { jsPDF?: any } }).jspdf?.jsPDF;
}

export async function downloadInvoicePdf(data: InvoiceDocumentData): Promise<void> {
  const JsPDF = await getJsPdfConstructor();
  if (!JsPDF) {
    throw new Error('jsPDF unavailable');
  }

  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const greenDark: [number, number, number] = [16, 96, 66];
  const greenAccent: [number, number, number] = [34, 197, 94];
  const greenSoft: [number, number, number] = [236, 253, 245];
  const slate: [number, number, number] = [51, 65, 85];
  const lightGray: [number, number, number] = [229, 231, 235];
  const left = 14;
  const right = pageWidth - 14;

  const money = (value: number) => `INR ${value.toFixed(2)}`;

  doc.setFillColor(greenDark[0], greenDark[1], greenDark[2]);
  doc.rect(0, 0, pageWidth, 46, 'F');
  doc.setFillColor(greenAccent[0], greenAccent[1], greenAccent[2]);
  doc.circle(pageWidth - 8, 8, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('MEDISCAN', left, 16);
  doc.setFontSize(28);
  doc.text('INVOICE', right, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Process Sale Completed', right, 31, { align: 'right' });

  doc.setTextColor(slate[0], slate[1], slate[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('INVOICE TO', left, 58);
  doc.setFontSize(12);
  doc.text(data.customerEmail || '-', left, 64);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Invoice No: ${data.transactionId}`, right, 58, { align: 'right' });
  doc.text(`Invoice Date: ${data.dateTime}`, right, 64, { align: 'right' });

  const tableTop = 74;
  const rowHeight = 10;
  const refX = left + 2;
  const descX = left + 28;
  const qtyX = left + 104;
  const priceX = left + 125;
  const totalX = right - 4;

  doc.setFillColor(greenDark[0], greenDark[1], greenDark[2]);
  doc.rect(left, tableTop, right - left, rowHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('REF', refX, tableTop + 6.8);
  doc.text('PRODUCT DESCRIPTION', descX, tableTop + 6.8);
  doc.text('QTY', qtyX, tableTop + 6.8);
  doc.text('PRICE', priceX, tableTop + 6.8);
  doc.text('TOTAL', totalX, tableTop + 6.8, { align: 'right' });

  doc.setTextColor(slate[0], slate[1], slate[2]);
  doc.setFont('helvetica', 'normal');
  let y = tableTop + rowHeight;
  data.items.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(greenSoft[0], greenSoft[1], greenSoft[2]);
      doc.rect(left, y, right - left, rowHeight, 'F');
    }
    const lineTotal = item.quantity * item.unitPrice;
    doc.text(`${(index + 1).toString().padStart(3, '0')}`, refX, y + 6.8);
    doc.text(`${item.medicineName} (${item.batchID})`, descX, y + 6.8, { maxWidth: 72 });
    doc.text(String(item.quantity), qtyX + 2, y + 6.8);
    doc.text(item.unitPrice.toFixed(2), priceX + 2, y + 6.8);
    doc.text(lineTotal.toFixed(2), totalX, y + 6.8, { align: 'right' });
    doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.line(left, y + rowHeight, right, y + rowHeight);
    y += rowHeight;
  });

  const totalsTop = y + 8;
  const totalsWidth = 62;
  const totalsLeft = right - totalsWidth;
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(totalsLeft, totalsTop, totalsWidth, 34, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Sub Total', totalsLeft + 4, totalsTop + 8);
  doc.text(money(data.totalPrice), totalsLeft + totalsWidth - 4, totalsTop + 8, { align: 'right' });
  doc.text('Tax 0%', totalsLeft + 4, totalsTop + 16);
  doc.text(money(0), totalsLeft + totalsWidth - 4, totalsTop + 16, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text('Total Due', totalsLeft + 4, totalsTop + 27);
  doc.text(money(data.totalPrice), totalsLeft + totalsWidth - 4, totalsTop + 27, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text('Payment Method: Direct Sale', left, totalsTop + 8);
  doc.text(`Total Units: ${data.totalUnits}`, left, totalsTop + 14);
  doc.text('Terms: Goods sold are non-returnable after verification.', left, totalsTop + 20);

  doc.setFillColor(greenDark[0], greenDark[1], greenDark[2]);
  doc.rect(0, pageHeight - 18, pageWidth, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('Thanks for choosing MediScan', left, pageHeight - 7);
  doc.text('Generated automatically by MediScan', right, pageHeight - 7, { align: 'right' });

  doc.save(`invoice-${data.transactionId}.pdf`);
}
