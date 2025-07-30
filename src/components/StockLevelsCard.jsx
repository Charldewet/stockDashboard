import { useState, useEffect } from 'react';
import { Package, Filter, Download } from 'lucide-react';
import { dailyStockAPI } from '../services/api';
import { formatDateLocal } from '../utils/dateUtils';

const StockLevelsCard = ({ selectedDate, selectedPharmacy, formatCurrency, formatNumber }) => {
  const [stockLevels, setStockLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDaysFilter, setSelectedDaysFilter] = useState(7);

  const daysFilterOptions = [
    { value: 7, label: '7+ Days' },
    { value: 14, label: '14+ Days' },
    { value: 21, label: '21+ Days' },
    { value: 30, label: '30+ Days' }
  ];

  const fetchStockLevels = async (daysThreshold) => {
    if (!selectedPharmacy || !selectedDate) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await dailyStockAPI.getStockLevelsWithDays(
        selectedPharmacy,
        formatDateLocal(selectedDate),
        daysThreshold
      );
      setStockLevels(data.products || []);
    } catch (err) {
      console.error('Error fetching stock levels:', err);
      setError(err.response?.data?.message || 'Failed to fetch stock levels');
      setStockLevels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockLevels(selectedDaysFilter);
  }, [selectedPharmacy, selectedDate, selectedDaysFilter]);

  const handleDaysFilterChange = (event) => {
    const newValue = parseInt(event.target.value);
    setSelectedDaysFilter(newValue);
  };

  const exportToCSV = () => {
    if (!stockLevels.length) return;

    const headers = ['Product Name', 'Stock Code', 'Department', 'SOH', 'Days of Stock', 'Daily Avg Sales', 'GP%'];
    const csvContent = [
      headers.join(','),
      ...stockLevels.map(product => [
        `"${product.productName || ''}"`,
        product.stockCode || '',
        `"${product.departmentName || ''}"`,
        product.currentSOH || 0,
        product.daysOfStock || 0,
        product.dailyAvgSales || 0,
        product.grossProfitPercent || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stock_levels_${selectedDaysFilter}+_days_${formatDateLocal(selectedDate)}.csv`;
    link.click();
  };

  const getDaysColor = (days) => {
    if (days >= 30) return 'text-status-error';
    if (days >= 21) return 'text-status-warning';
    if (days >= 14) return 'text-chart-gold';
    return 'text-status-success';
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-accent-primary" />
          <h3 className="text-sm font-semibold text-text-primary">Stock Levels by Days on Hand</h3>
          <span className="bg-accent-primary bg-opacity-20 text-accent-primary text-xs px-2 py-1 rounded-full">
            {selectedDaysFilter}+ days
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-3 h-3 text-text-secondary" />
            <select
              value={selectedDaysFilter}
              onChange={handleDaysFilterChange}
              className="text-xs bg-surface-tertiary border border-border-primary rounded px-2 py-1 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
            >
              {daysFilterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={exportToCSV}
            disabled={!stockLevels.length}
            className="text-xs bg-surface-tertiary hover:bg-surface-secondary border border-border-primary rounded px-2 py-1 text-text-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-primary mx-auto mb-2"></div>
            <p className="text-text-secondary text-xs">Loading stock levels...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <Package className="h-6 w-6 text-status-warning mx-auto mb-2" />
            <p className="text-status-warning text-xs mb-1">Failed to load stock levels</p>
            <p className="text-text-secondary text-xs">{error}</p>
          </div>
        </div>
      ) : stockLevels.length > 0 ? (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {stockLevels.map((product, index) => (
            <div key={index} className="bg-surface-tertiary rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-text-secondary flex-shrink-0">
                      #{index + 1}.
                    </span>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {product.productName || `Product ${index + 1}`}
                      </span>
                      <span className="text-xs text-text-secondary truncate">
                        {product.stockCode || 'N/A'} • {product.departmentName || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    <span>SOH: {formatNumber(product.currentSOH || 0)}</span>
                    <span>Daily Avg: {product.dailyAvgSales?.toFixed(3) || 0}</span>
                    <span>GP: {product.grossProfitPercent?.toFixed(1) || 0}%</span>
                  </div>
                </div>
                <div className="flex flex-col items-end text-xs ml-4">
                  <span className={`font-bold text-sm ${getDaysColor(product.daysOfStock)}`}>
                    {product.daysOfStock?.toFixed(1) || 0} days
                  </span>
                  <span className="text-text-secondary">
                    {product.daysOfStock === Infinity ? 'No sales' : 'on hand'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Package className="h-8 w-8 text-text-secondary mx-auto mb-2" />
          <p className="text-text-secondary text-sm">No products with {selectedDaysFilter}+ days of stock</p>
          <p className="text-text-secondary text-xs mt-1">
            Try selecting a lower threshold or check if stock data is available
          </p>
        </div>
      )}
    </div>
  );
};

export default StockLevelsCard; 