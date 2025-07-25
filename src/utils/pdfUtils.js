import jsPDF from 'jspdf';

// Test function to verify jsPDF is working
export const testPDFGeneration = () => {
  try {
    console.log('Testing PDF generation...');
    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.text('Test PDF Generation', 14, 20);
    doc.save('test.pdf');
    console.log('PDF test successful');
    return true;
  } catch (error) {
    console.error('PDF test failed:', error);
    return false;
  }
};

// Simple table generator without autoTable dependency
const createSimpleTable = (doc, data, headers, startY = 40) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const availableWidth = pageWidth - (2 * margin);
  const colCount = headers.length;
  const colWidth = availableWidth / colCount;
  const rowHeight = 10;
  
  // Draw header
  doc.setFillColor(31, 41, 55);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  headers.forEach((header, index) => {
    const x = margin + (index * colWidth);
    doc.rect(x, startY, colWidth, rowHeight, 'F');
    doc.text(header, x + 2, startY + 6);
  });
  
  // Draw data rows
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  data.forEach((row, rowIndex) => {
    const y = startY + rowHeight + (rowIndex * rowHeight);
    
    // Alternate row colors
    if (rowIndex % 2 === 0) {
      doc.setFillColor(249, 250, 251);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    
    // Draw row background
    doc.rect(margin, y, availableWidth, rowHeight, 'F');
    
    // Draw cell borders and text
    row.forEach((cell, colIndex) => {
      const x = margin + (colIndex * colWidth);
      
      // Draw cell border
      doc.setDrawColor(209, 213, 219);
      doc.rect(x, y, colWidth, rowHeight, 'S');
      
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
      
      doc.text(displayText, x + 2, y + 6);
    });
  });
  
  return startY + rowHeight + (data.length * rowHeight);
};

export const generatePDF = (data, headers, title, selectedDate, formatDateLocal) => {
  try {
    console.log('Generating PDF for:', title);
    console.log('Data:', data);
    console.log('Headers:', headers);
    
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    // Set up the document
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(title, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated on: ${selectedDate.toLocaleDateString('en-ZA')}`, 14, 30);
    
    console.log('Creating table with data length:', data.length);
    
    // Create table using simple method
    const tableEndY = createSimpleTable(doc, data, headers, 40);
    
    // Add page number
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`Page 1`, pageWidth - 30, pageWidth - 10);
    
    console.log('PDF generation completed successfully');
    return doc;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const exportToPDF = (data, headers, title, selectedDate, formatDateLocal) => {
  try {
    console.log('Exporting PDF:', title);
    const doc = generatePDF(data, headers, title, selectedDate, formatDateLocal);
    const filename = `${title.replace(/\s+/g, '_').toLowerCase()}_${formatDateLocal(selectedDate)}.pdf`;
    console.log('Saving PDF as:', filename);
    doc.save(filename);
    console.log('PDF saved successfully');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Error generating PDF. Please check the console for details.');
  }
};

// Specific PDF generators for each card type
export const generateTopMovingProductsPDF = (products, selectedDate, formatDateLocal) => {
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
    exportToPDF(data, headers, 'Top Moving Products', selectedDate, formatDateLocal);
  } catch (error) {
    console.error('Error in generateTopMovingProductsPDF:', error);
    alert('Error generating Top Moving Products PDF');
  }
};

export const generateLowGPProductsPDF = (products, selectedDate, formatDateLocal, formatCurrency) => {
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
    exportToPDF(data, headers, 'Low GP Products', selectedDate, formatDateLocal);
  } catch (error) {
    console.error('Error in generateLowGPProductsPDF:', error);
    alert('Error generating Low GP Products PDF');
  }
};

export const generateBestSellersPDF = (products, selectedDate, formatDateLocal) => {
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
    exportToPDF(data, headers, 'Top 20 Best Sellers', selectedDate, formatDateLocal);
  } catch (error) {
    console.error('Error in generateBestSellersPDF:', error);
    alert('Error generating Best Sellers PDF');
  }
};

export const generateSlowMoversPDF = (products, selectedDate, formatDateLocal, formatCurrency) => {
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
    exportToPDF(data, headers, 'High-Value Slow Movers', selectedDate, formatDateLocal);
  } catch (error) {
    console.error('Error in generateSlowMoversPDF:', error);
    alert('Error generating Slow Movers PDF');
  }
}; 