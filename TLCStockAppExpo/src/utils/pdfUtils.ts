import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// Format currency for PDF
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Generate HTML content for stock data
const generateStockHTML = (
  data: any[],
  title: string,
  selectedDate: Date,
  pharmacyName: string,
  filterType: string
) => {
  const dateStr = selectedDate.toLocaleDateString('en-ZA');
  
  // Check if this is a stock sales report (has selling_price field)
  const isStockSalesReport = data.length > 0 && (("selling_price" in data[0]) || ("sales_value" in data[0] && "cost_of_sales" in data[0]));
  const isLowGP = filterType === 'Low GP';
  const isNegativeStock = filterType === 'Negative Stock';
  
  const tableRows = data.map((item, index) => {
    const rank = index + 1;
    const productName = item.description || item.productName || item.name || item.product_name || item.desc || `Product ${index + 1}`;
    const stockCode = item.product_code || item.stock_code || item.stockCode || item.code || 'N/A';
    
    let quantity = '--';
    let sohDisplay = '--';
    let cost = '--';
    let sales = '--';
    let gpPercent = '--';
    
    if (filterType === 'Low GP') {
      // For Low GP reports, we'll show qty and GP%
      const qty = item.qty_sold ?? item.sales_qty ?? item.quantityMoved ?? item.quantity ?? item.dailyAvgSales;
      if (qty !== undefined && qty !== null) {
        quantity = typeof qty === 'number' ? qty.toString() : String(qty);
      }
      
      // Prefer explicit gp_pct fields if available
      const gpRaw = item.gp_pct ?? item.gross_profit_percent ?? item.grossProfitPercent;
      if (gpRaw !== undefined && gpRaw !== null && gpRaw !== '') {
        const gpNum = typeof gpRaw === 'string' ? parseFloat(gpRaw) : Number(gpRaw);
        if (isFinite(gpNum)) {
          gpPercent = `${gpNum.toFixed(1)}%`;
        }
      } else {
        // Fallback: derive GP% from sales and cost if possible
        const costValue = item.cost_of_sales;
        const salesValue = item.sales_value;
        if (salesValue !== undefined && salesValue !== null && costValue !== undefined && costValue !== null) {
          const s = Number(salesValue) || 0;
          const c = Number(costValue) || 0;
          gpPercent = s !== 0 ? `${(((s - c) / s) * 100).toFixed(1)}%` : '--';
        }
      }
    } else if (isNegativeStock) {
      // For Negative Stock report, show SOH column. Read from common SOH fields.
      const sohRaw = item.current_soh ?? item.currentSOH ?? item.on_hand ?? item.soh ?? item.stock_on_hand;
      if (sohRaw !== undefined && sohRaw !== null) {
        const sohNum = Number(sohRaw);
        sohDisplay = isFinite(sohNum) ? sohNum.toString() : String(sohRaw);
      }
    } else {
      const qty = item.qty_sold ?? item.sales_qty ?? item.quantityMoved ?? item.quantity ?? item.dailyAvgSales;
      if (qty !== undefined && qty !== null) {
        quantity = typeof qty === 'number' ? (filterType === 'Top 12M' ? qty.toFixed(2) : qty.toString()) : String(qty);
      }
      // Populate cost and sales whenever present
      const costValue = item.cost_of_sales;
      const salesValue = item.sales_value;
      if (costValue !== undefined && costValue !== null) {
        cost = formatCurrency(Number(costValue) || 0);
      }
      if (salesValue !== undefined && salesValue !== null) {
        sales = formatCurrency(Number(salesValue) || 0);
      }
      if (salesValue !== undefined && salesValue !== null && costValue !== undefined && costValue !== null) {
        const s = Number(salesValue) || 0;
        const c = Number(costValue) || 0;
        gpPercent = s !== 0 ? `${(((s - c) / s) * 100).toFixed(1)}%` : '--';
      }
    }

    // Check if this is a totals row
    const isTotalsRow = productName === 'TOTALS';
    const rowStyle = isTotalsRow ? 'background-color: #F3F4F6; font-weight: bold;' : '';
    const rankDisplay = isTotalsRow ? '' : (index + 1);

  const rowCells = isLowGP
      ? `
        <td>${productName}</td>
        <td>${stockCode}</td>
        <td style=\"text-align: center;\">${quantity}</td>
        <td style=\"text-align: center;\">${gpPercent}</td>
      `
      : isNegativeStock
      ? `
        <td>${productName}</td>
        <td>${stockCode}</td>
        <td style=\"text-align: center;\">${sohDisplay}</td>
      `
      : `
        <td>${productName}</td>
        <td>${stockCode}</td>
        <td style=\"text-align: center;\">${quantity}</td>
        <td style=\"text-align: right;\">${cost}</td>
        <td style=\"text-align: right;\">${sales}</td>
        ${isStockSalesReport ? `<td style=\"text-align: center;\">${gpPercent}</td>` : ''}
      `;

  return `
    <tr style="${rowStyle}">
      ${rowCells}
    </tr>
  `;
  }).join('');

  const styles = `
    body { font-family: Arial, sans-serif; background-color: #FFFFFF; color: #000000; padding: 16px; }
    .header { margin-bottom: 16px; }
    .title { font-size: 24px; font-weight: bold; color: #FF4500; }
    .subtitle { font-size: 12px; color: #666666; }
    table { width: 100%; border-collapse: collapse; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; }
    th, td { padding: 8px; border-bottom: 1px solid #E5E7EB; font-size: 11px; }
    th { background-color: #F3F4F6; color: #000000; text-align: left; font-weight: 600; }
    tr:nth-child(even) { background-color: #F9FAFB; }
    tr:nth-child(odd) { background-color: #FFFFFF; }
    .footer { margin-top: 16px; font-size: 10px; color: #666666; text-align: right; }
  `;

  return `
    <html>
    <head>
      <meta charset="utf-8" />
      <style>${styles}</style>
    </head>
    <body>
      <div class="header">
        <div class="title">${title}</div>
        <div class="subtitle">${pharmacyName} • ${dateStr}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            ${isLowGP
              ? `
                <th>Product Name</th>
                <th>Stock Code</th>
                <th style=\"text-align: center;\">Qty</th>
                <th style=\"text-align: center;\">GP%</th>
              `
              : isNegativeStock
              ? `
                <th>Product Name</th>
                <th>Stock Code</th>
                <th style=\"text-align: center;\">SOH</th>
              `
              : `
                <th>Product Name</th>
                <th>Stock Code</th>
                <th style=\"text-align: center;\">Qty</th>
                <th style=\"text-align: right;\">Cost</th>
                <th style=\"text-align: right;\">Sales</th>
                ${isStockSalesReport ? '<th style="text-align: center;">GP%</th>' : ''}
              `
            }
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      <div class="footer">
        Generated on ${new Date().toLocaleString('en-ZA')}
      </div>
    </body>
    </html>
  `;
};

// Main PDF export function
export const exportStockDataToPDF = async (
  data: any[],
  filterType: string,
  selectedDate: Date,
  pharmacyName: string
) => {
  try {
    const title = `${filterType} Report`;
    const htmlContent = generateStockHTML(data, title, selectedDate, pharmacyName, filterType);
    
    // Generate PDF using Expo Print
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false
    });

    // Build a filesystem-safe file name: "pharmacy name_report name_date.pdf"
    const dateSafe = selectedDate.toISOString().split('T')[0];
    const makeFileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    const baseFileName = `${pharmacyName}_${filterType}_${dateSafe}`;
    const fileName = makeFileSafe(baseFileName) + '.pdf';

    // Move/rename to documents directory with the desired name
    const destUri = (FileSystem.documentDirectory || '') + fileName;
    try {
      const info = await FileSystem.getInfoAsync(destUri);
      if (info.exists) {
        await FileSystem.deleteAsync(destUri, { idempotent: true });
      }
      await FileSystem.moveAsync({ from: uri, to: destUri });
    } catch (e) {
      console.log('Rename/move failed, falling back to original uri', e);
    }
    const finalUri = (await FileSystem.getInfoAsync(destUri)).exists ? destUri : uri;
    
    // Check if sharing is available
    const isSharingAvailable = await Sharing.isAvailableAsync();
    
    if (isSharingAvailable) {
      // Share the PDF
      await Sharing.shareAsync(finalUri, {
        mimeType: 'application/pdf',
        dialogTitle: `${title} - ${pharmacyName}`,
      });
      
      return { success: true, filePath: finalUri };
    } else {
      console.log('Sharing not available on this device');
      return { success: false, error: 'Sharing not available' };
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}; 

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

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; background-color: #FFFFFF; color: #111827; padding: 18px; }
            .header { margin-bottom: 10px; }
            .title { font-size: 28px; font-weight: bold; color: #111827; }
            .subtitle { font-size: 13px; color: #6B7280; }
            .card { background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 12px; margin-bottom: 12px; }
            .section-title { font-size: 15px; font-weight: bold; margin-bottom: 8px; color: #111827; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
            .row { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #F9FAFB; border-radius: 8px; }
            .label { color: #6B7280; font-size: 12px; }
            .value { color: #111827; font-weight: 700; font-size: 13px; }
            .hero { background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px; margin-bottom: 12px; text-align: center; }
            .hero-label { color: #6B7280; font-size: 13px; margin-bottom: 4px; }
            .hero-value { font-size: 30px; font-weight: 800; color: #111827; }
            .pill { display: inline-block; padding: 4px 8px; background: #FF450022; border-radius: 999px; color: #111827; font-weight: 600; font-size: 11px; margin-left: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${title}<span class="pill">${periodLabel}</span></div>
            <div class="subtitle">${pharmacyName} • ${dateStr}</div>
          </div>

          <div class="hero">
            <div class="hero-label">Turnover</div>
            <div class="hero-value">${formatCurrency(turnover)}</div>
          </div>

          <div class="card">
            <div class="section-title">Sales Breakdown</div>
            <div class="grid">
              <div class="row"><div class="label">Cash Sales</div><div class="value">${formatCurrency(salesCash)}</div></div>
              <div class="row"><div class="label">Account Sales</div><div class="value">${formatCurrency(salesAccount)}</div></div>
              <div class="row"><div class="label">COD Sales</div><div class="value">${formatCurrency(salesCOD)}</div></div>
              <div class="row"><div class="label">Type R Sales</div><div class="value">${formatCurrency(typeRSales)}</div></div>
              <div class="row"><div class="label">Transactions</div><div class="value">${transactionCount.toLocaleString('en-ZA')}</div></div>
              <div class="row"><div class="label">Avg Basket</div><div class="value">${formatCurrency(avgBasket)}</div></div>
            </div>
          </div>

          <div class="card">
            <div class="section-title">Dispensary & Frontshop</div>
            <div class="grid">
              <div class="row"><div class="label">Dispensary Turnover</div><div class="value">${formatCurrency(dispTurnover)}</div></div>
              <div class="row"><div class="label">Frontshop Turnover</div><div class="value">${formatCurrency(Math.max(turnover - dispTurnover, 0))}</div></div>
              <div class="row"><div class="label">Scripts Qty</div><div class="value">${scriptsQty.toLocaleString('en-ZA')}</div></div>
              <div class="row"><div class="label">Avg Script Value</div><div class="value">${formatCurrency(avgScriptValue)}</div></div>
              <div class="row"><div class="label">Dispensary %</div><div class="value">${fmtPct(turnover > 0 ? (dispTurnover / turnover) * 100 : 0)}</div></div>
              <div class="row"><div class="label">Frontshop %</div><div class="value">${fmtPct(turnover > 0 ? (Math.max(turnover - dispTurnover, 0) / turnover) * 100 : 0)}</div></div>
            </div>
          </div>

          <div class="card">
            <div class="section-title">Gross Profit</div>
            <div class="grid">
              <div class="row"><div class="label">GP Value</div><div class="value">${formatCurrency(gpValue)}</div></div>
              <div class="row"><div class="label">GP %</div><div class="value">${fmtPct(gpPct)}</div></div>
              <div class="row"><div class="label">Retail excl Type R</div><div class="value">${formatCurrency(basketNumerator)}</div></div>
              <div class="row"><div class="label">Denom excl Type R</div><div class="value">${formatCurrency(basketNumerator)}</div></div>
              <div class="row"><div class="label">Dispensary excl VAT</div><div class="value">${formatCurrency(toNum(daily?.dispensary_excl_vat))}</div></div>
            </div>
          </div>

          <div class="card">
            <div class="section-title">Purchases & Stock</div>
            <div class="grid">
              <div class="row"><div class="label">Purchases</div><div class="value">${formatCurrency(purchases)}</div></div>
              <div class="row"><div class="label">Cost of Sales</div><div class="value">${formatCurrency(costOfSales)}</div></div>
              <div class="row"><div class="label">Closing Stock</div><div class="value">${formatCurrency(closingStock)}</div></div>
            </div>
          </div>

        </body>
      </html>
    `;

    // Generate PDF
    const { uri } = await Print.printToFileAsync({ html: html, base64: false });

    // Build filename and move
    const dateSafe = selectedDate.toISOString().split('T')[0];
    const makeFileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    const baseFileName = `${pharmacyName}_${title}${periodLabel && periodLabel !== 'Daily' ? ' ' + periodLabel : ''}_${dateSafe}`;
    const fileName = makeFileSafe(baseFileName) + '.pdf';
    const destUri = (FileSystem.documentDirectory || '') + fileName;

    try {
      const info = await FileSystem.getInfoAsync(destUri);
      if (info.exists) await FileSystem.deleteAsync(destUri, { idempotent: true });
      await FileSystem.moveAsync({ from: uri, to: destUri });
    } catch {}
    const finalUri = (await FileSystem.getInfoAsync(destUri)).exists ? destUri : uri;

    // Share
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(finalUri, {
        mimeType: 'application/pdf',
        dialogTitle: `${title} - ${pharmacyName}`,
      });
    }

    return { success: true, filePath: finalUri };
  } catch (e) {
    console.error('Error generating Turnover PDF:', e);
    throw e;
  }
}; 

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

    const row = (label: string, value: string) => `
      <div class="row"><div class="label">${label}</div><div class="value">${value}</div></div>
    `;

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; background-color: #FFFFFF; color: #111827; padding: 18px; }
            .header { margin-bottom: 10px; }
            .title { font-size: 28px; font-weight: bold; color: #111827; }
            .subtitle { font-size: 13px; color: #6B7280; }
            .card { background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 12px; margin-bottom: 12px; }
            .section-title { font-size: 15px; font-weight: bold; margin-bottom: 8px; color: #111827; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
            .row { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #F9FAFB; border-radius: 8px; }
            .label { color: #6B7280; font-size: 12px; }
            .value { color: #111827; font-weight: 700; font-size: 13px; }
            .hero { background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px; margin-bottom: 12px; text-align: center; }
            .hero-label { color: #6B7280; font-size: 13px; margin-bottom: 4px; }
            .hero-value { font-size: 30px; font-weight: 800; color: #111827; }
            .pill { display: inline-block; padding: 4px 8px; background: #FF450022; border-radius: 999px; color: #111827; font-weight: 600; font-size: 11px; margin-left: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Trading Report<span class="pill">${periodLabel}</span></div>
            <div class="subtitle">${pharmacyName} • ${dateStr}</div>
          </div>

          <div class="hero">
            <div class="hero-label">Gross Profit</div>
            <div class="hero-value">${fmtCurr(gpValue)}</div>
          </div>

          <div class="card">
            <div class="section-title">Trading Summary</div>
            <div class="grid">
              ${row('Sales (at retail)', fmtCurr(salesRetail))}
              ${availableOpening != null ? row('Opening Stock (cost at start date)', fmtCurr(safeNumber(availableOpening))) : ''}
              ${row('Purchases', fmtCurr(purchases))}
              ${availableAdjust != null ? row('Adjustments', fmtCurr(safeNumber(availableAdjust))) : ''}
              ${totalAvailable != null ? row('Total Stock Available for Sale', fmtCurr(totalAvailable)) : ''}
              ${row('Closing Stock (cost at end date)', fmtCurr(closingStock))}
              ${row('Cost of Sales', fmtCurr(costOfSales))}
              ${row('Gross Profit from Trading', fmtCurr(gpValue))}
            </div>
          </div>

          <div class="card">
            <div class="section-title">Notes</div>
            <div class="grid">
              ${row('Gross Profit as % of Retail Sales', fmtPct(gpPct))}
              ${row('Total Cost Recorded During Period', fmtCurr(costOfSales))}
            </div>
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const dateSafe = selectedDate.toISOString().split('T')[0];
    const makeFileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    const baseFileName = `${pharmacyName}_Trading Report${periodLabel && periodLabel !== 'Daily' ? ' ' + periodLabel : ''}_${dateSafe}`;
    const fileName = makeFileSafe(baseFileName) + '.pdf';
    const destUri = (FileSystem.documentDirectory || '') + fileName;

    try {
      const info = await FileSystem.getInfoAsync(destUri);
      if (info.exists) await FileSystem.deleteAsync(destUri, { idempotent: true });
      await FileSystem.moveAsync({ from: uri, to: destUri });
    } catch {}
    const finalUri = (await FileSystem.getInfoAsync(destUri)).exists ? destUri : uri;

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(finalUri, { mimeType: 'application/pdf', dialogTitle: `Trading Report - ${pharmacyName}` });
    }

    return { success: true, filePath: finalUri };
  } catch (e) {
    console.error('Error generating Trading PDF:', e);
    throw e;
  }
}; 