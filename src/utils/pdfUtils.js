import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Attach autoTable to jsPDF prototype
jsPDF.API.autoTable = autoTable;

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

export const generatePDF = (data, headers, title, selectedDate, formatDateLocal) => {
  try {
    console.log('Generating PDF for:', title);
    console.log('Data:', data);
    console.log('Headers:', headers);
    
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    // Set up the document
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${selectedDate.toLocaleDateString('en-ZA')}`, 14, 30);
    
    // Calculate column widths based on content
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const availableWidth = pageWidth - (2 * margin);
    
    // Define column widths based on content type
    let columnWidths = [];
    if (title.includes('Top Moving Products') || title.includes('Best Sellers')) {
      columnWidths = [15, 60, 30, 25, 20]; // Rank, Product Name, Stock Code, Quantity/Value, GP%/SOH
    } else if (title.includes('Low GP Products')) {
      columnWidths = [15, 50, 25, 20, 30, 30]; // Rank, Product Name, Stock Code, GP%, Cost Price, Sales Price
    } else if (title.includes('High-Value Slow Movers')) {
      columnWidths = [15, 50, 25, 35, 25, 20]; // Rank, Product Name, Stock Code, Value Tied Up, Avg/Day, SOH
    } else {
      // Default column widths
      columnWidths = headers.map(() => availableWidth / headers.length);
    }
    
    // Adjust column widths to fit page
    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const scale = availableWidth / totalWidth;
    columnWidths = columnWidths.map(width => width * scale);
    
    console.log('Creating table with data length:', data.length);
    
    // Create table
    doc.autoTable({
      head: [headers],
      body: data,
      startY: 40,
      margin: { top: 40, right: margin, bottom: margin, left: margin },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left'
      },
      headStyles: {
        fillColor: [31, 41, 55],
        textColor: [249, 250, 251],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { halign: 'center' }, // Rank column
        1: { cellWidth: columnWidths[1] }, // Product Name
        2: { cellWidth: columnWidths[2] }, // Stock Code
        3: { halign: 'right' }, // Numeric values
        4: { halign: 'right' }, // Numeric values
        5: { halign: 'right' }  // Numeric values
      },
      columnWidths: columnWidths,
      didDrawPage: function (data) {
        // Add page number
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth - 30, pageWidth - 10);
      }
    });
    
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