import React, { useState, useEffect } from 'react';
import { TrendingDown, DollarSign, Clock, Package, AlertTriangle, ChevronDown, ChevronUp, CheckCircle, Percent, FileSpreadsheet, Download } from 'lucide-react';
import { dailyStockAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Download Button Component
const DownloadButton = ({ onExport, disabled = false }) => {
  return (
    <button
      onClick={onExport}
      disabled={disabled}
      className={`p-1 rounded hover:bg-surface-tertiary transition-colors flex items-center gap-1 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
      title="Export to CSV"
    >
      <Download className="w-4 h-4 text-text-secondary" />
    </button>
  );
};

const OverstockAlerts = ({ selectedDate, formatCurrency, formatNumber }) => {
  const [overstockData, setOverstockData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedPriorities, setExpandedPriorities] = useState({ HIGH: false, MEDIUM: false, LOW: false });
  const { selectedPharmacy } = useAuth();

  // Helper function to format date for filename
  const formatDateForFilename = (date) => {
    if (!date) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  };

  // Export functions
  const exportToCSV = (data, filename, headers) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        // Wrap in quotes if contains comma and escape quotes
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${formatDateForFilename(selectedDate)}.csv`;
    link.click();
  };



  const handleExportOverstockAlerts = () => {
    const overstockItems = overstockData?.alerts || [];
    const data = overstockItems.map(item => ({
      'Priority': item.priority || 'MEDIUM',
      'Product Name': item.productName || '',
      'Stock Code': item.stockCode || '',
      'Department': item.departmentName || '',
      'Current SOH': item.currentStock || 0,
      'Days Supply': item.daysSupply === 999 ? '999+' : item.daysSupply?.toFixed(1) || 0,
      '12m Avg Daily Sales': item.avgDailySales || 0,
      'Stock Value': item.stockValue || 0,
      'Days Since Last Sale': item.daysSinceLastSale || 0,
      'Total Sales 12m': item.totalSales12m || 0,
      'Velocity Score %': Math.round((item.velocityScore || 0) * 100),
      'Suggestion Type': item.suggestionType || '',
      'Potential Savings': item.potentialSavings || 0,
      'Is Slow Mover': item.isSlowMover ? 'Yes' : 'No',
      'High Value': item.highValue ? 'Yes' : 'No'
    }));
    
    const headers = [
      'Priority', 'Product Name', 'Stock Code', 'Department', 
      'Current SOH', 'Days Supply', '12m Avg Daily Sales', 
      'Stock Value', 'Days Since Last Sale', 'Total Sales 12m', 
      'Velocity Score %', 'Suggestion Type', 'Potential Savings',
      'Is Slow Mover', 'High Value'
    ];
    
    exportToCSV(data, 'overstock_alerts', headers);
  };

  useEffect(() => {
    if (selectedPharmacy) {
      fetchOverstockData();
    }
  }, [selectedPharmacy]);

  const fetchOverstockData = async () => {
    if (!selectedPharmacy) return;
    
    console.log('🔍 Fetching overstock data for pharmacy:', selectedPharmacy);
    setLoading(true);
    setError(null);
    
    try {
      const overstockData = await dailyStockAPI.getOverstockAlerts(selectedPharmacy, 365);
      console.log('✅ Overstock data received:', overstockData);
      setOverstockData(overstockData);
    } catch (err) {
      console.error('❌ Error fetching overstock data:', err);
      setError('Failed to load overstock data');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'bg-blue-600 bg-opacity-10';
      case 'MEDIUM': return 'bg-blue-500 bg-opacity-10';
      default: return 'bg-blue-400 bg-opacity-10';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'HIGH': return TrendingDown;
      case 'MEDIUM': return Clock;
      default: return Package;
    }
  };

  const togglePriority = (priority) => {
    setExpandedPriorities(prev => ({
      ...prev,
      [priority]: !prev[priority]
    }));
  };

  const renderOverstockCard = (item, index) => {
    const PriorityIcon = getPriorityIcon(item.priority);
    
    return (
      <div key={index} className={`rounded-lg p-3 ${getPriorityColor(item.priority)}`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            item.priority === 'HIGH' ? 'bg-blue-600' : 
            item.priority === 'MEDIUM' ? 'bg-blue-500' : 'bg-blue-400'
          }`}>
            <PriorityIcon className="text-white w-4 h-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium truncate">
                {item.productName}
              </h4>
              {item.isSlowMover && (
                <span className="px-2 py-0.5 bg-blue-600 bg-opacity-20 text-blue-400 text-xs rounded-full font-medium">
                  Slow Mover
                </span>
              )}
              {item.highValue && (
                <span className="px-2 py-0.5 bg-blue-600 bg-opacity-20 text-blue-400 text-xs rounded-full font-medium">
                  High Value
                </span>
              )}
            </div>
            
            <p className="text-xs text-text-secondary mb-2">
              {item.stockCode} • {item.departmentName}
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Current SOH:</span>
                <span className="font-medium ml-1">{formatNumber(item.currentStock)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Days Supply:</span>
                <span className={`font-medium ml-1 ${
                  item.daysSupply > 90 ? 'text-blue-600' : 
                  item.daysSupply > 60 ? 'text-blue-500' : 'text-blue-400'
                }`}>
                  {item.daysSupply === 999 ? '999+' : item.daysSupply.toFixed(1)}
                </span>
              </div>
              <div>
                <span className="text-text-secondary">12m Avg Daily:</span>
                <span className="font-medium ml-1">{formatNumber(item.avgDailySales)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Stock Value:</span>
                <span className="font-medium ml-1 text-blue-600">{formatCurrency(item.stockValue)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Last Sale:</span>
                <span className="font-medium ml-1">{item.daysSinceLastSale} days ago</span>
              </div>
              <div>
                <span className="text-text-secondary">Total Sales 12m:</span>
                <span className="font-medium ml-1">{formatNumber(item.totalSales12m)}</span>
              </div>
            </div>
            
            {/* Promotion suggestion */}
            <div className="mt-2 p-2 bg-green-600 bg-opacity-20 rounded text-xs">
              <div className="flex items-center gap-1">
                <Percent className="w-3 h-3 text-green-400" />
                <span className="text-green-300 font-medium">
                  Consider: {item.suggestionType} • Potential savings: {formatCurrency(item.potentialSavings)}
                </span>
              </div>
            </div>
            
            <div className="mt-2 flex items-center gap-1">
              <div className="flex-1 bg-surface-tertiary rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full ${
                    item.velocityScore > 0.3 ? 'bg-green-500' :
                    item.velocityScore > 0.1 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(item.velocityScore * 100 * 3, 100)}%` }}
                />
              </div>
              <span className="text-xs text-text-secondary ml-2">
                {Math.round(item.velocityScore * 100)}% velocity
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPrioritySection = (priority, items) => {
    const isExpanded = expandedPriorities[priority];
    const PriorityIcon = getPriorityIcon(priority);
    const priorityLabel = priority === 'HIGH' ? 'High Priority Overstock' : 
                         priority === 'MEDIUM' ? 'Medium Priority Overstock' : 'Low Priority Overstock';
    
    return (
      <div key={priority} className="mb-4">
        <button
          onClick={() => togglePriority(priority)}
          className="w-full flex items-center justify-between p-3 bg-surface-secondary rounded-lg hover:bg-surface-tertiary transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              priority === 'HIGH' ? 'bg-blue-600' : 
              priority === 'MEDIUM' ? 'bg-blue-500' : 'bg-blue-400'
            }`}>
              <PriorityIcon className="text-white w-4 h-4" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-text-primary">{priorityLabel}</h3>
              <p className="text-xs text-text-secondary">{items.length} products need attention</p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-text-secondary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-text-secondary" />
          )}
        </button>
        
        {isExpanded && (
          <div className="mt-3 space-y-2">
            {items.map((item, index) => renderOverstockCard(item, index))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto mb-2"></div>
            <p className="text-text-secondary text-sm">Loading overstock alerts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-status-warning mx-auto mb-2" />
            <p className="text-status-warning text-sm mb-2">Overstock alerts unavailable</p>
            <p className="text-text-secondary text-xs">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const overstockItems = overstockData?.alerts || [];

  if (overstockItems.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Overstock Alerts</h2>
            <p className="text-xs text-text-secondary">12-month analysis • Slow movers</p>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600" />
            <DownloadButton 
              onExport={handleExportOverstockAlerts}
              disabled={true}
            />
          </div>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-status-success bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-8 h-8 text-status-success" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">Optimal Stock Levels!</h3>
          <p className="text-text-secondary text-sm">No overstock alerts at this time.</p>
        </div>
      </div>
    );
  }

  // Group items by priority
  const groupedItems = overstockItems.reduce((acc, item) => {
    if (!acc[item.priority]) acc[item.priority] = [];
    acc[item.priority].push(item);
    return acc;
  }, {});

  const totalItems = overstockItems.length;
  const highPriorityCount = groupedItems.HIGH?.length || 0;
  const totalValue = overstockItems.reduce((sum, item) => sum + item.stockValue, 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Overstock Alerts</h2>
          <p className="text-xs text-text-secondary">
            12-month analysis • Slow movers • {totalItems} products • {formatCurrency(totalValue)} tied up
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-blue-600" />
          <DownloadButton 
            onExport={handleExportOverstockAlerts}
            disabled={!overstockItems?.length}
          />
        </div>
      </div>

      {/* High Priority Summary */}
      {highPriorityCount > 0 && (
        <div className="bg-blue-600 bg-opacity-10 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-600">
              {highPriorityCount} High Priority Overstock Alert{highPriorityCount > 1 ? 's' : ''}
            </h3>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Items with excess inventory relative to sales velocity - consider promotions or discounts
          </p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groupedItems)
          .sort(([a], [b]) => {
            const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            return priorityOrder[a] - priorityOrder[b];
          })
          .map(([priority, items]) => 
            renderPrioritySection(priority, items)
          )}
      </div>
    </div>
  );
};

export default OverstockAlerts; 