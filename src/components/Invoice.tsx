import * as QRCode from 'qrcode';

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
  blockchainExplorerUrl: string;
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
  const green900: [number, number, number] = [6, 78, 59];
  const green700: [number, number, number] = [21, 128, 61];
  const green500: [number, number, number] = [34, 197, 94];
  const green100: [number, number, number] = [220, 252, 231];
  const slate700: [number, number, number] = [51, 65, 85];
  const slate500: [number, number, number] = [100, 116, 139];
  const gray200: [number, number, number] = [229, 231, 235];
  const pagePad = 12;
  const left = pagePad + 4;
  const right = pageWidth - pagePad - 4;
  const contentWidth = right - left;
  const now = new Date();
  const dueDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-IN');
  const subtotal = data.totalPrice;
  const taxRate = 0;
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;
  const avgUnitPrice = data.totalUnits > 0 ? subtotal / data.totalUnits : 0;

  const money = (value: number) => `INR ${value.toFixed(2)}`;

  doc.setFillColor(247, 250, 249);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setDrawColor(gray200[0], gray200[1], gray200[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(pagePad, pagePad, pageWidth - (pagePad * 2), pageHeight - (pagePad * 2), 4, 4, 'S');

  doc.setFillColor(green900[0], green900[1], green900[2]);
  doc.roundedRect(pagePad + 1, pagePad + 1, pageWidth - (pagePad * 2) - 2, 42, 3, 3, 'F');
  doc.setFillColor(green500[0], green500[1], green500[2]);
  doc.circle(right + 6, pagePad + 2, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('MEDISCAN PHARMA LEDGER', left, pagePad + 13);
  doc.setFontSize(28);
  doc.text('INVOICE', right, pagePad + 19, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Verified Process Sale Record', right, pagePad + 26, { align: 'right' });

  // Watermark anchored near the bottom so core details stay unobstructed.
  doc.setTextColor(209, 250, 229);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(44);
  doc.text('MEDISCAN', pageWidth / 2, pageHeight - 58, { align: 'center', angle: 35 });
  doc.setFontSize(16);
  doc.text('SECURE INVOICE', pageWidth / 2, pageHeight - 45, { align: 'center', angle: 35 });

  const infoTop = pagePad + 50;
  const infoHeight = 34;
  const infoGap = 4;
  const boxWidth = (contentWidth - (infoGap * 2)) / 3;
  const middleBoxX = left + boxWidth + infoGap + 3;
  const middleBoxWidth = boxWidth - 6;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(left, infoTop, boxWidth, infoHeight, 2.5, 2.5, 'F');
  doc.roundedRect(left + boxWidth + infoGap, infoTop, boxWidth, infoHeight, 2.5, 2.5, 'F');
  doc.roundedRect(left + (boxWidth * 2) + (infoGap * 2), infoTop, boxWidth, infoHeight, 2.5, 2.5, 'F');
  doc.setDrawColor(gray200[0], gray200[1], gray200[2]);
  doc.roundedRect(left, infoTop, boxWidth, infoHeight, 2.5, 2.5, 'S');
  doc.roundedRect(left + boxWidth + infoGap, infoTop, boxWidth, infoHeight, 2.5, 2.5, 'S');
  doc.roundedRect(left + (boxWidth * 2) + (infoGap * 2), infoTop, boxWidth, infoHeight, 2.5, 2.5, 'S');

  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('INVOICE TO', left + 3, infoTop + 6);
  doc.text('INVOICE DETAILS', left + boxWidth + infoGap + 3, infoTop + 6);
  doc.text('PAYMENT DETAILS', left + (boxWidth * 2) + (infoGap * 2) + 3, infoTop + 6);

  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(data.customerEmail || '-', left + 3, infoTop + 13, { maxWidth: boxWidth - 6 });
  doc.setFontSize(9);
  doc.text('MediScan Authenticated Customer', left + 3, infoTop + 21);
  doc.text(`Customer ID: ${data.transactionId.slice(-8)}`, left + 3, infoTop + 27);

  doc.setFontSize(9);
  const invoiceNoLines = doc.splitTextToSize(`Invoice No: ${data.transactionId}`, middleBoxWidth);
  doc.text(invoiceNoLines, middleBoxX, infoTop + 13);
  const invoiceDateLines = doc.splitTextToSize(`Invoice Date: ${data.dateTime}`, middleBoxWidth);
  const invoiceDateY = infoTop + 13 + (invoiceNoLines.length * 3.6) + 1.4;
  doc.text(invoiceDateLines, middleBoxX, invoiceDateY);
  const dueDateY = invoiceDateY + (invoiceDateLines.length * 3.6) + 1.4;
  doc.text(`Due Date: ${dueDate}`, middleBoxX, dueDateY, { maxWidth: middleBoxWidth });

  doc.text('Method: Direct Sale', left + (boxWidth * 2) + (infoGap * 2) + 3, infoTop + 13, { maxWidth: boxWidth - 6 });
  doc.text('Status: Paid', left + (boxWidth * 2) + (infoGap * 2) + 3, infoTop + 21, { maxWidth: boxWidth - 6 });
  doc.text('Currency: INR', left + (boxWidth * 2) + (infoGap * 2) + 3, infoTop + 27, { maxWidth: boxWidth - 6 });

  const tableTop = infoTop + infoHeight + 8;
  const rowHeight = 9;
  const refX = left + 2;
  const descX = left + 23;
  const qtyX = left + 108;
  const priceX = left + 128;
  const totalX = right - 3;

  doc.setFillColor(green700[0], green700[1], green700[2]);
  doc.roundedRect(left, tableTop, contentWidth, rowHeight, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('REF', refX, tableTop + 6);
  doc.text('PRODUCT DESCRIPTION', descX, tableTop + 6);
  doc.text('QTY', qtyX, tableTop + 6);
  doc.text('PRICE', priceX, tableTop + 6);
  doc.text('TOTAL', totalX, tableTop + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  let y = tableTop + rowHeight;

  data.items.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(green100[0], green100[1], green100[2]);
      doc.rect(left, y, contentWidth, rowHeight, 'F');
    }

    const lineTotal = item.quantity * item.unitPrice;
    doc.setFontSize(8.8);
    doc.text(`${(index + 1).toString().padStart(3, '0')}`, refX, y + 5.9);
    doc.text(`${item.medicineName} (${item.batchID})`, descX, y + 5.9, { maxWidth: 83 });
    doc.text(String(item.quantity), qtyX + 1.5, y + 5.9);
    doc.text(item.unitPrice.toFixed(2), priceX + 1.5, y + 5.9);
    doc.text(lineTotal.toFixed(2), totalX, y + 5.9, { align: 'right' });

    doc.setDrawColor(gray200[0], gray200[1], gray200[2]);
    doc.line(left, y + rowHeight, right, y + rowHeight);
    y += rowHeight;
  });

  const summaryTop = y + 8;
  const summaryWidth = 68;
  const summaryLeft = right - summaryWidth;

  doc.setFillColor(236, 253, 245);
  doc.roundedRect(summaryLeft, summaryTop, summaryWidth, 38, 2.5, 2.5, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(summaryLeft, summaryTop, summaryWidth, 38, 2.5, 2.5, 'S');

  doc.setTextColor(slate700[0], slate700[1], slate700[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Sub Total', summaryLeft + 4, summaryTop + 9);
  doc.text(money(subtotal), summaryLeft + summaryWidth - 4, summaryTop + 9, { align: 'right' });
  doc.text('Tax', summaryLeft + 4, summaryTop + 17);
  doc.text(money(taxAmount), summaryLeft + summaryWidth - 4, summaryTop + 17, { align: 'right' });

  doc.setDrawColor(167, 243, 208);
  doc.line(summaryLeft + 4, summaryTop + 22, summaryLeft + summaryWidth - 4, summaryTop + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(green900[0], green900[1], green900[2]);
  doc.text('Total Due', summaryLeft + 4, summaryTop + 31);
  doc.text(money(grandTotal), summaryLeft + summaryWidth - 4, summaryTop + 31, { align: 'right' });

  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Payment Method: Direct Sale', left, summaryTop + 9);
  doc.text(`Total Units: ${data.totalUnits}`, left, summaryTop + 15);
  doc.text(`Items in Invoice: ${data.items.length}`, left, summaryTop + 21);
  doc.text(`Average Unit Price: ${money(avgUnitPrice)}`, left, summaryTop + 27);
  doc.text('Terms: Goods sold are non-returnable after verification.', left, summaryTop + 33);

  const certTop = summaryTop + 41;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(left, certTop, contentWidth, 18, 2.5, 2.5, 'F');
  doc.setDrawColor(gray200[0], gray200[1], gray200[2]);
  doc.roundedRect(left, certTop, contentWidth, 18, 2.5, 2.5, 'S');
  doc.setTextColor(green700[0], green700[1], green700[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Verification Summary', left + 3, certTop + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slate500[0], slate500[1], slate500[2]);
  doc.setFontSize(8.8);
  doc.text(`Ledger Reference: ${data.transactionId}`, left + 3, certTop + 13);
  doc.text('Issued by MediScan secure invoice engine.', right - 3, certTop + 13, { align: 'right' });

  const qrCardSize = 30;
  const qrInnerSize = 20;
  const qrCardX = right - qrCardSize;
  const qrCardY = pageHeight - 59;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrCardX, qrCardY, qrCardSize, qrCardSize, 2, 2, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(qrCardX, qrCardY, qrCardSize, qrCardSize, 2, 2, 'S');

  const qrDataUrl = await QRCode.toDataURL(data.blockchainExplorerUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: {
      dark: '#065f46',
      light: '#ffffff',
    },
  });

  const qrX = qrCardX + ((qrCardSize - qrInnerSize) / 2);
  const qrY = qrCardY + 2.5;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrInnerSize, qrInnerSize);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(green700[0], green700[1], green700[2]);
  doc.setFontSize(6.8);
  doc.text('SCAN TO VERIFY', qrCardX + (qrCardSize / 2), qrCardY + qrCardSize - 2.2, { align: 'center' });

  doc.setFillColor(green900[0], green900[1], green900[2]);
  doc.roundedRect(pagePad + 1, pageHeight - 24, pageWidth - (pagePad * 2) - 2, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.8);
  doc.text('Thank you for choosing MediScan', left, pageHeight - 17);
  doc.text('Auto-generated secure invoice', right, pageHeight - 17, { align: 'right' });

  doc.save(`invoice-${data.transactionId}.pdf`);
}
