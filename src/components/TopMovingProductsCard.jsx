import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { dailyStockAPI } from '../services/api';
import DownloadDropdown from './DownloadDropdown';
import { generateTopMovingProductsPDF } from '../utils/pdfUtils';

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

const TopMovingProductsCard = ({ selectedDate, selectedPharmacy, formatCurrency, formatDateLocal }) => {
  const [topMovingMode, setTopMovingMode] = useState('daily'); // 'daily' or 'monthly'
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedDate || !selectedPharmacy) return;
    setLoading(true);
    setError(null);
    const fetch = async () => {
      try {
        let result;
        if (topMovingMode === 'monthly') {
          const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          const startDate = formatDateLocal(startOfMonth);
          const endDate = formatDateLocal(selectedDate);
          result = await dailyStockAPI.getTopMovingProductsRange(selectedPharmacy, startDate, endDate, 20);
        } else {
          const date = formatDateLocal(selectedDate);
          result = await dailyStockAPI.getTopMovingProducts(selectedPharmacy, date, 20);
        }
        setProducts(result.products || []);
      } catch (err) {
        setProducts([]);
        setError('Failed to fetch top moving products');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [selectedDate, selectedPharmacy, topMovingMode, formatDateLocal]);

  const handleExportCSV = () => {
    const data = products.map(product => ({
      'Rank': products.indexOf(product) + 1,
      'Product Name': product.productName || '',
      'Stock Code': product.stockCode || '',
      'Quantity Moved': product.quantityMoved || 0,
      'GP%': product.grossProfit && product.valueMovement ? 
        ((product.grossProfit / product.valueMovement) * 100).toFixed(1) : '--'
    }));
    const headers = ['Rank', 'Product Name', 'Stock Code', 'Quantity Moved', 'GP%'];
    exportToCSV(data, 'top_moving_products', headers, selectedDate, formatDateLocal);
  };

  const handleExportPDF = () => {
    generateTopMovingProductsPDF(products, selectedDate, formatDateLocal);
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-status-success" />
        <h3 className="text-sm font-semibold text-text-primary">
          Top Moving Products {topMovingMode === 'monthly' ? 'Month to Date' : 'Today'}
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1">
            <button
              className={`px-2 py-1 rounded text-xs font-medium border ${topMovingMode === 'daily' ? 'bg-accent-primary text-white border-accent-primary' : 'bg-surface-tertiary text-text-secondary border-surface-tertiary'}`}
              onClick={() => setTopMovingMode('daily')}
            >
              Daily
            </button>
            <button
              className={`px-2 py-1 rounded text-xs font-medium border ${topMovingMode === 'monthly' ? 'bg-accent-primary text-white border-accent-primary' : 'bg-surface-tertiary text-text-secondary border-surface-tertiary'}`}
              onClick={() => setTopMovingMode('monthly')}
            >
              Monthly
            </button>
          </div>
          <DownloadDropdown 
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            disabled={!products.length}
            title="Export Top Moving Products"
          />
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto mb-2"></div>
            <p className="text-text-secondary text-sm">Loading top moving products...</p>
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-4">
          <p className="text-status-error text-xs">{error}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {products.length > 0 ? (
            products.slice(0, 20).map((product, index) => (
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
                    <span className="text-xs text-status-success font-bold">
                      {product.quantityMoved || 0} units
                    </span>
                    {product.grossProfit !== undefined && product.grossProfit !== null && product.valueMovement ? (
                      <span className="text-xs text-text-secondary font-medium">
                        {product.valueMovement > 0 ? `${((product.grossProfit / product.valueMovement) * 100).toFixed(1)}% GP` : '--'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <p className="text-text-secondary text-xs">No top moving products</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TopMovingProductsCard; 