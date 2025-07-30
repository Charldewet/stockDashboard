import jsPDF from 'jspdf';

// Simple table generator with pagination support
const createSimpleTable = (doc, data, headers, startY = 40) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const availableWidth = pageWidth - (2 * margin);
  const colCount = headers.length;
  const rowHeight = 8;
  const headerHeight = 10;
  
  console.log('Creating table with headers:', headers);
  console.log('Available width:', availableWidth);
  
  // Calculate column widths
  let columnWidths = [];
  if (colCount >= 2) {
    // First column (Rank) = 10mm (1cm)
    const rankWidth = 10;
    // Second column (Product Name) = double the remaining average width
    const remainingWidth = availableWidth - rankWidth;
    const averageRemainingWidth = remainingWidth / (colCount - 1);
    const productNameWidth = averageRemainingWidth * 2;
    const otherColumnsWidth = (remainingWidth - productNameWidth) / (colCount - 2);
    
    columnWidths = [rankWidth];
    for (let i = 1; i < colCount; i++) {
      if (i === 1) {
        columnWidths.push(productNameWidth);
      } else {
        columnWidths.push(otherColumnsWidth);
      }
    }
  } else {
    // Fallback for single column
    columnWidths = [availableWidth];
  }
  
  console.log('Column widths:', columnWidths);
  console.log('Total column width:', columnWidths.reduce((sum, width) => sum + width, 0));
  
  let currentY = startY;
  let currentPage = 1;
  const maxRowsPerPage = Math.floor((pageHeight - currentY - margin) / rowHeight);
  
  console.log(`Max rows per page: ${maxRowsPerPage}`);
  console.log(`Total data rows: ${data.length}`);
  
  // Process data in chunks for pagination
  for (let i = 0; i < data.length; i += maxRowsPerPage) {
    const pageData = data.slice(i, i + maxRowsPerPage);
    
    // Add new page if not the first page
    if (currentPage > 1) {
      doc.addPage();
      currentY = startY;
    }
    
    console.log(`Drawing headers for page ${currentPage} at Y position ${currentY}`);
    
    // Draw header on each page - DYNAMIC VERSION
    let currentX = margin;
    
    // Draw each header individually with explicit state management
    console.log('Drawing headers individually...');
    
    // Set up header styling
    doc.setFillColor(0, 0, 0); // Pure black background
    doc.setTextColor(255, 255, 255); // White text
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    // Draw all headers dynamically
    headers.forEach((header, index) => {
      console.log(`Drawing header "${header}" at X=${currentX}, Y=${currentY}, width=${columnWidths[index]}`);
      doc.setFillColor(0, 0, 0); // Pure black background
      doc.rect(currentX, currentY, columnWidths[index], headerHeight, 'F');
      doc.setTextColor(255, 255, 255); // White text
      doc.text(header, currentX + 2, currentY + 6);
      currentX += columnWidths[index];
    });
    
    currentY += headerHeight;
    
    // Draw data rows
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    pageData.forEach((row, rowIndex) => {
      const y = currentY + (rowIndex * rowHeight);
      
      // Alternate row colors
      if (rowIndex % 2 === 0) {
        doc.setFillColor(249, 250, 251);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      
      // Draw row background
      doc.rect(margin, y, availableWidth, rowHeight, 'F');
      
      // Draw cell borders and text
      let cellX = margin;
      row.forEach((cell, colIndex) => {
        const colWidth = columnWidths[colIndex];
        
        // Draw cell border
        doc.setDrawColor(209, 213, 219);
        doc.rect(cellX, y, colWidth, rowHeight, 'S');
        
        // Set text color to black for visibility
        doc.setTextColor(0, 0, 0);
        
        // Truncate long text to fit in cell
        const cellText = String(cell);
        const maxWidth = colWidth - 4;
        let displayText = cellText;
        
        // Simple text truncation
        if (doc.getTextWidth(cellText) > maxWidth) {
          displayText = cellText.substring(0, Math.floor(maxWidth / 3)) + '...';
        }
        
        doc.text(displayText, cellX + 2, y + 5);
        cellX += colWidth;
      });
    });
    
    // Add page number
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`Page ${currentPage}`, pageWidth - 30, pageHeight - 10);
    
    currentPage++;
  }
  
  return currentPage - 1; // Return total number of pages
};

export const generatePDF = (data, headers, title, selectedDate, formatDateLocal, pharmacyName = '') => {
  try {
    console.log('Generating PDF for:', title);
    console.log('Data:', data);
    console.log('Headers:', headers);
    
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    // Set up the document with pharmacy name
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    
    // Include pharmacy name in title if provided
    const fullTitle = pharmacyName ? `${pharmacyName} ${title}` : title;
    doc.text(fullTitle, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated on: ${selectedDate.toLocaleDateString('en-ZA')}`, 14, 30);
    
    console.log('Creating table with data length:', data.length);
    
    // Create table using simple method with pagination
    const totalPages = createSimpleTable(doc, data, headers, 40);
    
    console.log(`PDF generation completed successfully with ${totalPages} pages`);
    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const exportToPDF = (data, headers, title, selectedDate, formatDateLocal, pharmacyName = '') => {
  try {
    console.log('Exporting PDF:', title);
    const doc = generatePDF(data, headers, title, selectedDate, formatDateLocal, pharmacyName);
    
    // Create filename with pharmacy name at the front
    const pharmacyPrefix = pharmacyName ? `${pharmacyName.toLowerCase().replace(/\s+/g, '_')}_` : '';
    const filename = `${pharmacyPrefix}${title.replace(/\s+/g, '_').toLowerCase()}_${formatDateLocal(selectedDate)}.pdf`;
    
    console.log('Saving PDF as:', filename);
    doc.save(filename);
    console.log('PDF saved successfully');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Error generating PDF. Please check the console for details.');
  }
};

// Specific PDF generators for each card type
export const generateTopMovingProductsPDF = (products, selectedDate, formatDateLocal, pharmacyName = '') => {
  try {
    console.log('Generating Top Moving Products PDF with', products.length, 'products');
    const data = products.map(product => [
      products.indexOf(product) + 1,
      product.productName || '',
      product.stockCode || '',
      product.quantityMoved || 0,
      product.grossProfit && product.valueMovement ? 
        `${((product.grossProfit / product.valueMovement) * 100).toFixed(1)}%` : '--'
    ]);
    
    const headers = ['Rank', 'Product Name', 'Stock Code', 'Quantity Moved', 'GP%'];
    exportToPDF(data, headers, 'Top Moving Products', selectedDate, formatDateLocal, pharmacyName);
  } catch (error) {
    console.error('Error in generateTopMovingProductsPDF:', error);
    alert('Error generating Top Moving Products PDF');
  }
};

export const generateLowGPProductsPDF = (products, selectedDate, formatDateLocal, formatCurrency, pharmacyName = '') => {
  try {
    console.log('Generating Low GP Products PDF with', products.length, 'products');
    const data = products.map(product => {
      const costPrice = product.salesValue && product.grossProfitPercent ? 
        product.salesValue * (1 - product.grossProfitPercent / 100) : null;
      
      return [
        products.indexOf(product) + 1,
        product.productName || '',
        product.stockCode || '',
        typeof product.grossProfitPercent === 'number' ? `${product.grossProfitPercent.toFixed(1)}%` : '--',
        costPrice !== null ? formatCurrency(costPrice) : '--',
        typeof product.salesValue === 'number' ? formatCurrency(product.salesValue) : '--'
      ];
    });
    
    const headers = ['Rank', 'Product Name', 'Stock Code', 'GP%', 'Cost Price', 'Sales Price'];
    exportToPDF(data, headers, 'Low GP Products', selectedDate, formatDateLocal, pharmacyName);
  } catch (error) {
    console.error('Error in generateLowGPProductsPDF:', error);
    alert('Error generating Low GP Products PDF');
  }
};

export const generateBestSellersPDF = (products, selectedDate, formatDateLocal, pharmacyName = '') => {
  try {
    console.log('Generating Best Sellers PDF with', products.length, 'products');
    const data = products.map(product => [
      products.indexOf(product) + 1,
      product.productName || '',
      product.stockCode || '',
      product.dailyAvgSales || 0,
      product.currentSOH || 0
    ]);
    
    const headers = ['Rank', 'Product Name', 'Stock Code', 'Daily Avg Sales', 'Current SOH'];
    exportToPDF(data, headers, 'Top 20 Best Sellers', selectedDate, formatDateLocal, pharmacyName);
  } catch (error) {
    console.error('Error in generateBestSellersPDF:', error);
    alert('Error generating Best Sellers PDF');
  }
};

export const generateSlowMoversPDF = (products, selectedDate, formatDateLocal, formatCurrency, pharmacyName = '') => {
  try {
    console.log('Generating Slow Movers PDF with', products.length, 'products');
    const data = products.map(product => [
      products.indexOf(product) + 1,
      product.productName || '',
      product.stockCode || '',
      formatCurrency(product.estimatedCostValue || 0),
      product.dailyAvgSales?.toFixed(3) || 0,
      product.currentSOH || 0
    ]);
    
    const headers = ['Rank', 'Product Name', 'Stock Code', 'Estimated Cost Value', 'Daily Avg Sales', 'Current SOH'];
    exportToPDF(data, headers, 'High-Value Slow Movers', selectedDate, formatDateLocal, pharmacyName);
  } catch (error) {
    console.error('Error in generateSlowMoversPDF:', error);
    alert('Error generating Slow Movers PDF');
  }
};

export const generateStockLevelsPDF = (products, selectedDate, pharmacyName = '', formatCurrency, formatNumber) => {
  try {
    console.log('Generating Stock Levels PDF with', products.length, 'products');
    const data = products.map(product => [
      products.indexOf(product) + 1,
      product.productName || '',
      product.stockCode || '',
      product.departmentName || '',
      formatNumber(product.currentSOH || 0),
      product.dailyAvgSales?.toFixed(3) || 0,
      product.daysOfStock?.toFixed(1) || 0,
      product.costPerUnit ? formatCurrency(product.costPerUnit * product.currentSOH) : 'N/A'
    ]);
    
    const headers = ['Rank', 'Product Name', 'Stock Code', 'Department', 'Current SOH', 'Daily Avg Sales', 'Days of Stock', 'Stock Value'];
    exportToPDF(data, headers, 'Stock Levels', selectedDate, (date) => date.toISOString().split('T')[0], pharmacyName);
  } catch (error) {
    console.error('Error in generateStockLevelsPDF:', error);
    alert('Error generating Stock Levels PDF');
  }
}; 