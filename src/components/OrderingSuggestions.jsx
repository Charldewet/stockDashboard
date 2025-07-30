import React, { useState, useEffect } from 'react';
import { ShoppingCart, AlertTriangle, Clock, Package, TrendingUp, ChevronDown, ChevronUp, CheckCircle, Download } from 'lucide-react';
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

const OrderingSuggestions = ({ selectedDate, formatCurrency, formatNumber }) => {
  const { selectedPharmacy } = useAuth();
  const [orderingData, setOrderingData] = useState({ recommendations: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedPriorities, setExpandedPriorities] = useState({
    HIGH: false,
    MEDIUM: false,
    LOW: false
  });

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



  const handleExportOrderingSuggestions = () => {
    const data = orderingData.recommendations.map(rec => ({
      'Priority': rec.priority || 'MEDIUM',
      'Product Name': rec.productName || '',
      'Stock Code': rec.stockCode || '',
      'Department': rec.departmentName || '',
      'Current SOH': rec.currentStock || 0,
      'Days Remaining': rec.daysRemaining === 999 ? '999+' : rec.daysRemaining || 0,
      '12m Avg Daily Sales': rec.avgDailySales || 0,
      'Suggested Order Qty': Math.ceil(rec.suggestedOrderQty || 0),
      'Target Stock Days': rec.targetStockDays || 0,
      'Total Sales 12m': rec.totalSales12m || 0,
      'Sales Frequency %': Math.round((rec.salesFrequency || 0) * 100),
      'Is High Moving': rec.isHighMoving ? 'Yes' : 'No'
    }));
    
    const headers = [
      'Priority', 'Product Name', 'Stock Code', 'Department', 
      'Current SOH', 'Days Remaining', '12m Avg Daily Sales', 
      'Suggested Order Qty', 'Target Stock Days', 'Total Sales 12m', 
      'Sales Frequency %', 'Is High Moving'
    ];
    
    exportToCSV(data, 'ordering_suggestions', headers);
  };

  const fetchOrderingRecommendations = async () => {
    if (!selectedPharmacy) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching ordering recommendations for:', selectedPharmacy);
      
      const recommendationsData = await dailyStockAPI.getReorderRecommendations(selectedPharmacy, 365);
      setOrderingData(recommendationsData);
      
      console.log('Ordering recommendations loaded:', recommendationsData);
      
    } catch (err) {
      console.error('Error fetching ordering recommendations:', err);
      setError(err.response?.data?.message || 'Failed to fetch ordering recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPharmacy) {
      fetchOrderingRecommendations();
    }
  }, [selectedPharmacy]);

  const togglePriority = (priority) => {
    setExpandedPriorities(prev => ({
      ...prev,
      [priority]: !prev[priority]
    }));
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-status-error bg-opacity-10 border-status-error';
      case 'MEDIUM':
        return 'bg-status-warning bg-opacity-10 border-status-warning';
      default:
        return 'bg-text-secondary bg-opacity-10 border-text-secondary';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'HIGH':
        return AlertTriangle;
      case 'MEDIUM':
        return Clock;
      default:
        return Package;
    }
  };

  const getPriorityTextColor = (priority) => {
    switch (priority) {
      case 'HIGH':
        return 'text-status-error';
      case 'MEDIUM':
        return 'text-status-warning';
      default:
        return 'text-text-secondary';
    }
  };

  const groupedRecommendations = orderingData.recommendations.reduce((acc, recommendation) => {
    const priority = recommendation.priority || 'MEDIUM';
    if (!acc[priority]) acc[priority] = [];
    acc[priority].push(recommendation);
    return acc;
  }, {});

  const renderRecommendationCard = (recommendation, index) => {
    const PriorityIcon = getPriorityIcon(recommendation.priority);
    // Round up suggested order to nearest integer
    const suggestedOrderQtyInt = Math.ceil(recommendation.suggestedOrderQty);
    
    return (
      <div key={index} className={`rounded-lg p-3 ${getPriorityColor(recommendation.priority)}`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            recommendation.priority === 'HIGH' ? 'bg-status-error' : 'bg-status-warning'
          }`}>
            <PriorityIcon className="text-white w-4 h-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium truncate">
                {recommendation.productName}
              </h4>
              {recommendation.isHighMoving && (
                <span className="px-2 py-0.5 bg-accent-primary bg-opacity-20 text-accent-primary text-xs rounded-full font-medium">
                  High Volume
                </span>
              )}
            </div>
            
            <p className="text-xs text-text-secondary mb-2">
              {recommendation.stockCode} • {recommendation.departmentName}
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary">Current SOH:</span>
                <span className="font-medium ml-1">{formatNumber(recommendation.currentStock)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Days Left:</span>
                <span className={`font-medium ml-1 ${
                  recommendation.daysRemaining < recommendation.minStockDays * 0.5 ? 'text-status-error' : 
                  recommendation.daysRemaining < recommendation.minStockDays ? 'text-status-warning' : 'text-text-primary'
                }`}>
                  {recommendation.daysRemaining === 999 ? '999+' : formatNumber(recommendation.daysRemaining)}
                </span>
              </div>
              <div>
                <span className="text-text-secondary">12m Avg Daily:</span>
                <span className="font-medium ml-1">{formatNumber(recommendation.avgDailySales)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Suggested Order:</span>
                <span className="font-medium ml-1 text-accent-primary">{suggestedOrderQtyInt}</span>
              </div>
              <div>
                <span className="text-text-secondary">Target Days:</span>
                <span className="font-medium ml-1">{recommendation.targetStockDays} days</span>
              </div>
              <div>
                <span className="text-text-secondary">Total Sales 12m:</span>
                <span className="font-medium ml-1">{formatNumber(recommendation.totalSales12m)}</span>
              </div>
            </div>
            
            <div className="mt-2 flex items-center gap-1">
              <div className="flex-1 bg-surface-tertiary rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full ${
                    recommendation.salesFrequency > 0.1 ? 'bg-status-success' :
                    recommendation.salesFrequency > 0.05 ? 'bg-status-warning' : 'bg-status-error'
                  }`}
                  style={{ width: `${Math.min(recommendation.salesFrequency * 100 * 5, 100)}%` }}
                />
              </div>
              <span className="text-xs text-text-secondary ml-2">
                {Math.round(recommendation.salesFrequency * 100)}% sales frequency
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPrioritySection = (priority, recommendations) => {
    const isExpanded = expandedPriorities[priority];
    const PriorityIcon = getPriorityIcon(priority);
    const priorityLabel = priority === 'HIGH' ? 'Urgent Orders' : 'Medium Priority';
    
    return (
      <div key={priority} className="mb-4">
        <button
          onClick={() => togglePriority(priority)}
          className="w-full flex items-center justify-between p-3 bg-surface-secondary rounded-lg hover:bg-surface-tertiary transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              priority === 'HIGH' ? 'bg-status-error' : 'bg-status-warning'
            }`}>
              <PriorityIcon className="text-white w-4 h-4" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-text-primary">{priorityLabel}</h3>
              <p className="text-xs text-text-secondary">{recommendations.length} products need ordering</p>
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
            {recommendations.map((recommendation, index) => renderRecommendationCard(recommendation, index))}
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
            <p className="text-text-secondary text-sm">Loading ordering suggestions...</p>
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
            <p className="text-status-warning text-sm mb-2">Ordering suggestions unavailable</p>
            <p className="text-text-secondary text-xs">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!orderingData.recommendations || orderingData.recommendations.length === 0) {
    return (
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-primary" />
            <h3 className="text-xl font-semibold text-text-primary">Ordering Suggestions</h3>
          </div>
          <div className="flex items-center gap-2">
            <DownloadButton 
              onExport={handleExportOrderingSuggestions}
              disabled={true}
            />
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-xs text-text-secondary">12-month analysis • SOH-based recommendations</p>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-status-success bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-8 h-8 text-status-success" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">All Stocked Up!</h3>
          <p className="text-text-secondary text-sm">No urgent reorder recommendations at this time.</p>
        </div>
      </div>
    );
  }

  const totalRecommendations = orderingData.recommendations.length;
  const urgentCount = groupedRecommendations.HIGH?.length || 0;

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent-primary" />
          <h3 className="text-xl font-semibold text-text-primary">Ordering Suggestions</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <DownloadButton 
            onExport={handleExportOrderingSuggestions}
            disabled={!orderingData.recommendations?.length}
          />
        </div>
      </div>
      
      <div className="mb-4">
        <p className="text-xs text-text-secondary">
          12-month analysis • SOH-based • {totalRecommendations} products • {urgentCount} urgent
        </p>
      </div>

      {/* Urgent Summary */}
      {urgentCount > 0 && (
        <div className="bg-status-error bg-opacity-10 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-status-error" />
            <h3 className="text-sm font-semibold text-status-error">
              {urgentCount} Urgent Order{urgentCount > 1 ? 's' : ''} Needed
            </h3>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Products below minimum stock levels (7 days normal, 14 days high-volume)
          </p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groupedRecommendations)
          .sort(([a], [b]) => {
            const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            return priorityOrder[a] - priorityOrder[b];
          })
          .map(([priority, recommendations]) => 
            renderPrioritySection(priority, recommendations)
          )}
      </div>
    </div>
  );
};

export default OrderingSuggestions; 