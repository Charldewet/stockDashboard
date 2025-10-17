import jsPDF from 'jspdf';

// Format currency for PDF
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};


// Helper function to add text with word wrapping
const addWrappedText = (pdf: jsPDF, text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
  pdf.setFontSize(fontSize);
  const lines = pdf.splitTextToSize(text, maxWidth);
  pdf.text(lines, x, y);
  return y + (lines.length * fontSize * 0.35); // Return new Y position
};

// Helper function to add table row
const addTableRow = (pdf: jsPDF, rowData: string[], x: number, y: number, colWidths: number[], fontSize: number = 9) => {
  pdf.setFontSize(fontSize);
  let currentX = x;
  
  rowData.forEach((cell, index) => {
    const cellWidth = colWidths[index];
    pdf.text(cell, currentX, y);
    currentX += cellWidth;
  });
  
  return y + fontSize * 0.4; // Return new Y position
};

// Web-specific PDF export function using native jsPDF text rendering
export const exportStockDataToPDF = async (
  data: any[],
  filterType: string,
  selectedDate: Date,
  pharmacyName: string
) => {
  try {
    const title = `${filterType} Report`;
    const dateStr = selectedDate.toLocaleDateString('en-ZA');
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    let currentY = margin;
    
    // Header
    pdf.setFontSize(18);
    pdf.setTextColor(255, 69, 0); // Orange color
    pdf.text(title, margin, currentY);
    currentY += 8;
    
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`${pharmacyName} • ${dateStr}`, margin, currentY);
    currentY += 15;
    
    // Determine columns based on filter type
    const isLowGP = filterType === 'Low GP';
    const isNegativeStock = filterType === 'Negative Stock';
    
    let headers: string[];
    let colWidths: number[];
    
    if (isLowGP) {
      headers = ['Product Name', 'Stock Code', 'Qty', 'GP%'];
      colWidths = [80, 30, 20, 20];
    } else if (isNegativeStock) {
      headers = ['Product Name', 'Stock Code', 'SOH'];
      colWidths = [80, 30, 30];
    } else {
      headers = ['Product Name', 'Stock Code', 'Qty', 'Cost', 'Sales', 'GP%'];
      colWidths = [60, 25, 20, 25, 25, 20];
    }
    
    // Table header
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    
    currentY = addTableRow(pdf, headers, margin, currentY, colWidths);
    currentY += 2;
    
    // Draw header line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 5;
    
    // Table data
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(9);
    
    data.forEach((item, index) => {
      // Check if we need a new page
      if (currentY > pageHeight - 20) {
        pdf.addPage();
        currentY = margin;
      }
      
      const productName = item.description || item.productName || item.name || item.product_name || item.desc || `Product ${index + 1}`;
      const stockCode = item.product_code || item.stock_code || item.stockCode || item.code || 'N/A';
      
      let rowData: string[];
      
      if (isLowGP) {
        const qty = item.qty_sold ?? item.sales_qty ?? item.quantityMoved ?? item.quantity ?? item.dailyAvgSales;
        const qtyStr = qty !== undefined && qty !== null ? String(qty) : '--';
        
        const gpRaw = item.gp_pct ?? item.gross_profit_percent ?? item.grossProfitPercent;
        let gpPercent = '--';
        if (gpRaw !== undefined && gpRaw !== null && gpRaw !== '') {
          const gpNum = typeof gpRaw === 'string' ? parseFloat(gpRaw) : Number(gpRaw);
          if (isFinite(gpNum)) {
            gpPercent = `${gpNum.toFixed(1)}%`;
          }
        }
        
        rowData = [productName, stockCode, qtyStr, gpPercent];
      } else if (isNegativeStock) {
        const sohRaw = item.current_soh ?? item.currentSOH ?? item.on_hand ?? item.soh ?? item.stock_on_hand;
        const sohStr = sohRaw !== undefined && sohRaw !== null ? String(sohRaw) : '--';
        rowData = [productName, stockCode, sohStr];
      } else {
        const qty = item.qty_sold ?? item.sales_qty ?? item.quantityMoved ?? item.quantity ?? item.dailyAvgSales;
        const qtyStr = qty !== undefined && qty !== null ? String(qty) : '--';
        
        const costValue = item.cost_of_sales;
        const salesValue = item.sales_value;
        const costStr = costValue !== undefined && costValue !== null ? formatCurrency(Number(costValue) || 0) : '--';
        const salesStr = salesValue !== undefined && salesValue !== null ? formatCurrency(Number(salesValue) || 0) : '--';
        
        let gpPercent = '--';
        if (salesValue !== undefined && salesValue !== null && costValue !== undefined && costValue !== null) {
          const s = Number(salesValue) || 0;
          const c = Number(costValue) || 0;
          gpPercent = s !== 0 ? `${(((s - c) / s) * 100).toFixed(1)}%` : '--';
        }
        
        rowData = [productName, stockCode, qtyStr, costStr, salesStr, gpPercent];
      }
      
      // Highlight totals row
      if (productName === 'TOTALS') {
        pdf.setFont(undefined, 'bold');
      }
      
      currentY = addTableRow(pdf, rowData, margin, currentY, colWidths);
      
      if (productName === 'TOTALS') {
        pdf.setFont(undefined, 'normal');
      }
      
      currentY += 1;
    });
    
    // Footer
    currentY = pageHeight - 15;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Generated on ${new Date().toLocaleString('en-ZA')}`, margin, currentY);
    
    // Generate filename
    const dateSafe = selectedDate.toISOString().split('T')[0];
    const makeFileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    const baseFileName = `${pharmacyName}_${filterType}_${dateSafe}`;
    const fileName = makeFileSafe(baseFileName) + '.pdf';

    // Download the PDF
    pdf.save(fileName);

    return { success: true, fileName };
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

// Helper function to add key-value pairs
const addKeyValuePair = (pdf: jsPDF, label: string, value: string, x: number, y: number, fontSize: number = 9) => {
  pdf.setFontSize(fontSize);
  pdf.setTextColor(100, 100, 100);
  pdf.text(label, x, y);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont(undefined, 'bold');
  pdf.text(value, x + 60, y);
  pdf.setFont(undefined, 'normal');
  return y + fontSize * 0.4;
};

// Web-specific turnover report PDF export using native text rendering
export const exportTurnoverReportToPDF = async (
  daily: any,
  selectedDate: Date,
  pharmacyName: string,
  periodLabel: string = 'Daily'
) => {
  try {
    const toNum = (v: any) => {
      const n = Number(v);
      return isFinite(n) ? n : 0;
    };

    const fmtPct = (v: number) => `${toNum(v).toFixed(2)}%`;

    const title = 'Turnover Report';
    const dateStr = selectedDate.toLocaleDateString('en-ZA');

    // Derive values (works for Daily and MTD payloads)
    const turnover = toNum(daily?.turnover);
    const salesCash = toNum(daily?.sales_cash);
    const salesAccount = toNum(daily?.sales_account);
    const salesCOD = toNum(daily?.sales_cod);
    const typeRSales = toNum(daily?.type_r_sales);
    const transactionCount = toNum(daily?.transaction_count);
    const purchases = toNum(daily?.purchases);
    const costOfSales = toNum(daily?.cost_of_sales);
    const closingStock = toNum(daily?.closing_stock);
    const dispTurnover = toNum(daily?.dispensary_turnover);
    const scriptsQty = toNum(daily?.scripts_qty);

    const basketNumerator = Math.max(turnover - typeRSales, 0);
    const avgBasket = daily?.avg_basket != null ? toNum(daily.avg_basket) : (transactionCount > 0 ? basketNumerator / transactionCount : 0);

    const avgScriptValue = daily?.avg_script_value != null ? toNum(daily.avg_script_value) : (scriptsQty > 0 ? dispTurnover / scriptsQty : 0);

    const gpValue = toNum(daily?.gp_value);
    const gpPctNumerator = basketNumerator; // turnover minus type R
    const gpPct = daily?.gp_pct != null ? toNum(daily.gp_pct) : (gpPctNumerator > 0 ? (gpValue / gpPctNumerator) * 100 : 0);

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 15;
    
    let currentY = margin;
    
    // Header
    pdf.setFontSize(18);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text(title, margin, currentY);
    
    // Add period label
    pdf.setFontSize(10);
    pdf.setTextColor(255, 69, 0);
    pdf.text(`[${periodLabel}]`, margin + 50, currentY);
    
    currentY += 8;
    
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont(undefined, 'normal');
    pdf.text(`${pharmacyName} • ${dateStr}`, margin, currentY);
    currentY += 15;
    
    // Hero section - Turnover
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Turnover', margin, currentY);
    currentY += 5;
    
    pdf.setFontSize(24);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text(formatCurrency(turnover), margin, currentY);
    currentY += 20;
    
    // Sales Breakdown
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text('Sales Breakdown', margin, currentY);
    currentY += 8;
    
    currentY = addKeyValuePair(pdf, 'Cash Sales:', formatCurrency(salesCash), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Account Sales:', formatCurrency(salesAccount), margin, currentY);
    currentY = addKeyValuePair(pdf, 'COD Sales:', formatCurrency(salesCOD), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Type R Sales:', formatCurrency(typeRSales), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Transactions:', transactionCount.toLocaleString('en-ZA'), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Avg Basket:', formatCurrency(avgBasket), margin, currentY);
    currentY += 10;
    
    // Dispensary & Frontshop
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text('Dispensary & Frontshop', margin, currentY);
    currentY += 8;
    
    currentY = addKeyValuePair(pdf, 'Dispensary Turnover:', formatCurrency(dispTurnover), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Frontshop Turnover:', formatCurrency(Math.max(turnover - dispTurnover, 0)), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Scripts Qty:', scriptsQty.toLocaleString('en-ZA'), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Avg Script Value:', formatCurrency(avgScriptValue), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Dispensary %:', fmtPct(turnover > 0 ? (dispTurnover / turnover) * 100 : 0), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Frontshop %:', fmtPct(turnover > 0 ? (Math.max(turnover - dispTurnover, 0) / turnover) * 100 : 0), margin, currentY);
    currentY += 10;
    
    // Gross Profit
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text('Gross Profit', margin, currentY);
    currentY += 8;
    
    currentY = addKeyValuePair(pdf, 'GP Value:', formatCurrency(gpValue), margin, currentY);
    currentY = addKeyValuePair(pdf, 'GP %:', fmtPct(gpPct), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Retail excl Type R:', formatCurrency(basketNumerator), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Dispensary excl VAT:', formatCurrency(toNum(daily?.dispensary_excl_vat)), margin, currentY);
    currentY += 10;
    
    // Purchases & Stock
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text('Purchases & Stock', margin, currentY);
    currentY += 8;
    
    currentY = addKeyValuePair(pdf, 'Purchases:', formatCurrency(purchases), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Cost of Sales:', formatCurrency(costOfSales), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Closing Stock:', formatCurrency(closingStock), margin, currentY);
    
    // Footer
    currentY = pageHeight - 15;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Generated on ${new Date().toLocaleString('en-ZA')}`, margin, currentY);

    // Generate filename
    const dateSafe = selectedDate.toISOString().split('T')[0];
    const makeFileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    const baseFileName = `${pharmacyName}_${title}${periodLabel && periodLabel !== 'Daily' ? ' ' + periodLabel : ''}_${dateSafe}`;
    const fileName = makeFileSafe(baseFileName) + '.pdf';

    // Download the PDF
    pdf.save(fileName);

    return { success: true, fileName };
  } catch (error) {
    console.error('Error generating Turnover PDF:', error);
    throw error;
  }
};

// Web-specific trading report PDF export using native text rendering
export const exportTradingReportToPDF = async (
  daily: any,
  selectedDate: Date,
  pharmacyName: string,
  periodLabel: string = 'Daily'
) => {
  try {
    const safeNumber = (v: any) => {
      const n = Number(v);
      return isFinite(n) ? n : 0;
    };

    const fmtCurr = (n: number) => n.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' }).replace('ZAR', 'R');
    const fmtPct = (v: any) => `${safeNumber(v).toFixed(2)}%`;

    const dateStr = selectedDate.toLocaleDateString('en-ZA');

    const availableOpening = daily?.opening_stock_cost ?? daily?.opening_stock;
    const availableAdjust = daily?.adjustments;
    const turnover = safeNumber(daily?.turnover);
    const typeRSales = safeNumber(daily?.type_r_sales);
    const salesRetail = safeNumber(daily?.turnover || daily?.retail_excl_type_r);
    const purchases = safeNumber(daily?.purchases);
    const closingStock = safeNumber(daily?.closing_stock);
    const costOfSales = safeNumber(daily?.cost_of_sales);
    const gpValue = safeNumber(daily?.gp_value);
    const providedGpPct = daily?.gp_pct;
    const gpPct = providedGpPct != null ? safeNumber(providedGpPct) : ((Math.max(turnover - typeRSales, 0)) > 0 ? (gpValue / Math.max(turnover - typeRSales, 0)) * 100 : 0);

    let totalAvailable: number | undefined;
    if (availableOpening != null) {
      totalAvailable = safeNumber(availableOpening) + purchases + safeNumber(availableAdjust);
    }

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 15;
    
    let currentY = margin;
    
    // Header
    pdf.setFontSize(18);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text('Trading Report', margin, currentY);
    
    // Add period label
    pdf.setFontSize(10);
    pdf.setTextColor(255, 69, 0);
    pdf.text(`[${periodLabel}]`, margin + 50, currentY);
    
    currentY += 8;
    
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont(undefined, 'normal');
    pdf.text(`${pharmacyName} • ${dateStr}`, margin, currentY);
    currentY += 15;
    
    // Hero section - Gross Profit
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Gross Profit', margin, currentY);
    currentY += 5;
    
    pdf.setFontSize(24);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text(fmtCurr(gpValue), margin, currentY);
    currentY += 20;
    
    // Trading Summary
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text('Trading Summary', margin, currentY);
    currentY += 8;
    
    currentY = addKeyValuePair(pdf, 'Sales (at retail):', fmtCurr(salesRetail), margin, currentY);
    if (availableOpening != null) {
      currentY = addKeyValuePair(pdf, 'Opening Stock (cost at start date):', fmtCurr(safeNumber(availableOpening)), margin, currentY);
    }
    currentY = addKeyValuePair(pdf, 'Purchases:', fmtCurr(purchases), margin, currentY);
    if (availableAdjust != null) {
      currentY = addKeyValuePair(pdf, 'Adjustments:', fmtCurr(safeNumber(availableAdjust)), margin, currentY);
    }
    if (totalAvailable != null) {
      currentY = addKeyValuePair(pdf, 'Total Stock Available for Sale:', fmtCurr(totalAvailable), margin, currentY);
    }
    currentY = addKeyValuePair(pdf, 'Closing Stock (cost at end date):', fmtCurr(closingStock), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Cost of Sales:', fmtCurr(costOfSales), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Gross Profit from Trading:', fmtCurr(gpValue), margin, currentY);
    currentY += 10;
    
    // Notes
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text('Notes', margin, currentY);
    currentY += 8;
    
    currentY = addKeyValuePair(pdf, 'Gross Profit as % of Retail Sales:', fmtPct(gpPct), margin, currentY);
    currentY = addKeyValuePair(pdf, 'Total Cost Recorded During Period:', fmtCurr(costOfSales), margin, currentY);
    
    // Footer
    currentY = pageHeight - 15;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Generated on ${new Date().toLocaleString('en-ZA')}`, margin, currentY);

    // Generate filename
    const dateSafe = selectedDate.toISOString().split('T')[0];
    const makeFileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    const baseFileName = `${pharmacyName}_Trading Report${periodLabel && periodLabel !== 'Daily' ? ' ' + periodLabel : ''}_${dateSafe}`;
    const fileName = makeFileSafe(baseFileName) + '.pdf';

    // Download the PDF
    pdf.save(fileName);

    return { success: true, fileName };
  } catch (error) {
    console.error('Error generating Trading PDF:', error);
    throw error;
  }
};
