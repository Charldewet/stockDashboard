import { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { dailyStockAPI } from '../services/api';
import DownloadDropdown from './DownloadDropdown';
import { generateLowGPProductsPDF } from '../utils/pdfUtils';

function exportToCSV(data, filename, headers, selectedDate, formatDateLocal) {
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    }).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${formatDateLocal(selectedDate)}.csv`;
  link.click();
}

const LowGPProductsCard = ({ selectedDate, selectedPharmacy, formatCurrency, formatDateLocal }) => {
  const [gpThreshold, setGpThreshold] = useState(20);
  const [excludePDST, setExcludePDST] = useState(true);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedDate || !selectedPharmacy) return;
    setLoading(true);
    setError(null);
    const fetch = async () => {
      try {
        const date = formatDateLocal(selectedDate);
        const result = await dailyStockAPI.getLowGPProducts(selectedPharmacy, date, gpThreshold, excludePDST);
        setProducts(result || []);
      } catch (err) {
        setProducts([]);
        setError('Failed to fetch low GP products');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [selectedDate, selectedPharmacy, gpThreshold, excludePDST, formatDateLocal]);

  const handleExportCSV = () => {
    const data = products.map(product => ({
      'Rank': products.indexOf(product) + 1,
      'Product Name': product.productName || '',
      'Stock Code': product.stockCode || '',
      'GP%': typeof product.grossProfitPercent === 'number' ? product.grossProfitPercent.toFixed(1) : '--',
      'Cost Price': product.salesValue && product.grossProfitPercent ? 
        formatCurrency(product.salesValue * (1 - product.grossProfitPercent / 100)) : '--',
      'Sales Price': typeof product.salesValue === 'number' ? formatCurrency(product.salesValue) : '--'
    }));
    const headers = ['Rank', 'Product Name', 'Stock Code', 'GP%', 'Cost Price', 'Sales Price'];
    exportToCSV(data, 'low_gp_products', headers, selectedDate, formatDateLocal);
  };

  const handleExportPDF = () => {
    generateLowGPProductsPDF(products, selectedDate, formatDateLocal, formatCurrency, selectedPharmacy);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-status-error" />
          <h3 className="text-sm font-semibold text-text-primary">Low GP Products</h3>
          <span className="bg-status-error bg-opacity-20 text-status-error text-xs px-2 py-1 rounded-full">
            {products.length || 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={excludePDST}
              onChange={(e) => setExcludePDST(e.target.checked)}
              className="w-3 h-3 text-status-error border-surface-tertiary rounded focus:ring-status-error focus:ring-1"
            />
            <span className="text-xs text-text-secondary">Exclude SEP</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Below:</span>
          <select
            value={gpThreshold}
            onChange={(e) => setGpThreshold(Number(e.target.value))}
            className="text-xs font-medium text-status-error bg-surface-tertiary border border-surface-tertiary rounded px-2 py-1 focus:outline-none focus:border-status-error cursor-pointer"
          >
            {Array.from({ length: 16 }, (_, i) => i + 15).map(value => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </div>
        <DownloadDropdown 
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          disabled={!products.length}
          title="Export Low GP Products"
        />
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto mb-2"></div>
            <p className="text-text-secondary text-sm">Loading low GP products...</p>
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-4">
          <p className="text-status-error text-xs">{error}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {products.length > 0 ? (
            products.map((product, index) => {
              let costPrice = null;
              if (
                typeof product.salesValue === 'number' &&
                typeof product.grossProfitPercent === 'number'
              ) {
                costPrice = product.salesValue * (1 - product.grossProfitPercent / 100);
              }
              return (
                <div key={index} className="bg-surface-tertiary rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-medium text-text-secondary flex-shrink-0">#{index + 1}.</span>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {product.productName || `Product ${index + 1}`}
                        </span>
                        <span className="text-xs text-text-secondary truncate">
                          {product.stockCode || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 ml-2">
                      <span className="text-xs text-status-error font-bold">
                        {typeof product.grossProfitPercent === 'number' ? `${product.grossProfitPercent.toFixed(1)}% GP` : '--'}
                      </span>
                      <span className="text-xs text-text-secondary font-medium mt-0.5">
                        Cost: {costPrice !== null ? formatCurrency(costPrice) : '--'} - SP: {typeof product.salesValue === 'number' ? formatCurrency(product.salesValue) : '--'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4">
              <p className="text-text-secondary text-xs">No low GP products</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LowGPProductsCard; 