import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, Package, Users, DollarSign, Calendar, ChevronDown, ChevronUp, Info, TrendingUp, Target } from 'lucide-react';
import { dailyStockAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const SmartAlertsPanel = ({ selectedDate, formatCurrency, formatDateLocal }) => {
  const { selectedPharmacy } = useAuth();
  const [smartAlerts, setSmartAlerts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({
    highVolumeLowMargin: false,
    departmentGPDecline: false,
    overstockWarnings: false,
    pricePointAnalysis: false
  });

  const fetchSmartAlerts = async (dateObj) => {
    if (!selectedPharmacy || !dateObj) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const date = formatDateLocal(dateObj);
      console.log('Fetching smart alerts for:', date);
      
      const alertsData = await dailyStockAPI.getAllSmartAlerts(selectedPharmacy, date);
      setSmartAlerts(alertsData);
      
      console.log('Smart alerts loaded:', alertsData);
      
    } catch (err) {
      console.error('Error fetching smart alerts:', err);
      setError(err.response?.data?.message || 'Failed to fetch smart alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate && selectedPharmacy) {
      fetchSmartAlerts(selectedDate);
    }
  }, [selectedDate, selectedPharmacy]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-status-error bg-status-error bg-opacity-10';
      case 'high': return 'text-status-warning bg-status-warning bg-opacity-10';
      case 'medium': return 'text-blue-500 bg-blue-500 bg-opacity-10';
      case 'low': return 'text-text-secondary bg-surface-tertiary';
      default: return 'text-text-secondary bg-surface-tertiary';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return AlertTriangle;
      case 'high': return AlertTriangle;
      case 'medium': return Info;
      case 'low': return Info;
      default: return Info;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'high_volume_low_margin': return TrendingUp;
      case 'department_gp_decline': return TrendingDown;
      case 'overstock_warning': return Package;
      case 'supplier_performance': return Users;
      case 'price_point_analysis': return Target;
      case 'weekday_pattern': return Calendar;
      default: return Info;
    }
  };

  const getTypeName = (type) => {
    switch (type) {
      case 'high_volume_low_margin': return 'High Volume Low Margin';
      case 'department_gp_decline': return 'Department GP Decline';
      case 'overstock_warning': return 'Overstock Warning';
      case 'supplier_performance': return 'Supplier Performance';
      case 'price_point_analysis': return 'Price Point Analysis';
      case 'weekday_pattern': return 'Weekday Pattern';
      default: return type;
    }
  };

  const renderAlertCard = (alert, index) => {
    const SeverityIcon = getSeverityIcon(alert.severity);
    const TypeIcon = getTypeIcon(alert.type);
    
    return (
      <div key={index} className={`rounded-lg p-3 ${getSeverityColor(alert.severity)}`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            alert.severity === 'critical' ? 'bg-status-error' :
            alert.severity === 'high' ? 'bg-status-warning' :
            alert.severity === 'medium' ? 'bg-blue-500' : 'bg-text-secondary'
          }`}>
            <SeverityIcon className="text-white w-4 h-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TypeIcon className="w-4 h-4 flex-shrink-0" />
              <h4 className="text-sm font-medium truncate">
                {alert.productName || alert.departmentName || `${getTypeName(alert.type)} Alert`}
              </h4>
            </div>
            
            <p className="text-xs text-text-secondary mb-2">
              {alert.message}
            </p>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              {alert.salesValue && (
                <div>
                  <span className="text-text-secondary">Sales Value:</span>
                  <span className="font-medium ml-1">{formatCurrency(alert.salesValue)}</span>
                </div>
              )}
              {alert.currentGP && (
                <div>
                  <span className="text-text-secondary">Current GP:</span>
                  <span className="font-medium ml-1">{alert.currentGP.toFixed(1)}%</span>
                </div>
              )}
              {alert.currentPrice && alert.suggestedPrice && (
                <div>
                  <span className="text-text-secondary">Current Price:</span>
                  <span className="font-medium ml-1">{formatCurrency(alert.currentPrice)}</span>
                </div>
              )}
              {alert.currentPrice && alert.suggestedPrice && (
                <div>
                  <span className="text-text-secondary">Suggested Price:</span>
                  <span className="font-medium ml-1 text-status-success">{formatCurrency(alert.suggestedPrice)}</span>
                </div>
              )}
              {alert.additionalRevenue && (
                <div className="col-span-2">
                  <span className="text-text-secondary">Potential Revenue Gain:</span>
                  <span className="font-medium ml-1 text-status-success">{formatCurrency(alert.additionalRevenue)}</span>
                </div>
              )}
              {alert.daysOfInventory && (
                <div>
                  <span className="text-text-secondary">Days Inventory:</span>
                  <span className="font-medium ml-1">{alert.daysOfInventory.toFixed(0)} days</span>
                </div>
              )}
              {alert.estimatedMonthlyImpact && (
                <div>
                  <span className="text-text-secondary">Monthly Impact:</span>
                  <span className="font-medium ml-1">{formatCurrency(alert.estimatedMonthlyImpact)}</span>
                </div>
              )}
            </div>
            
            {alert.recommendation && (
              <div className="mt-2 text-xs">
                <span className="font-medium text-text-secondary">Recommendation: </span>
                <span className="text-text-primary">{alert.recommendation}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAlertCategory = (categoryKey, categoryData, title, IconComponent) => {
    const isExpanded = expandedCategories[categoryKey];
    const alerts = categoryData?.alerts || [];
    const totalAlerts = categoryData?.totalAlerts || 0;
    
    if (totalAlerts === 0) return null;
    
    return (
      <div className="mb-4">
        <button
          onClick={() => toggleCategory(categoryKey)}
          className="w-full flex items-center justify-between p-3 bg-surface-secondary rounded-lg hover:bg-surface-tertiary transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent-primary rounded-lg flex items-center justify-center">
              <IconComponent className="text-white w-4 h-4" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
              <p className="text-xs text-text-secondary">{totalAlerts} alerts found</p>
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
            {alerts.map((alert, index) => renderAlertCard(alert, index))}
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
            <p className="text-text-secondary text-sm">Loading smart alerts...</p>
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
            <p className="text-status-warning text-sm mb-2">Smart alerts unavailable</p>
            <p className="text-text-secondary text-xs">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!smartAlerts || !smartAlerts.summary) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <Info className="h-8 w-8 text-text-secondary mx-auto mb-2" />
            <p className="text-text-secondary text-sm">No smart alerts data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Smart Alerts</h2>
          <p className="text-xs text-text-secondary">
            AI-powered insights • {smartAlerts.summary.totalAlerts} total alerts • {smartAlerts.summary.highPriorityAlerts} high priority
          </p>
        </div>
      </div>

      {smartAlerts.summary.totalAlerts === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-status-success bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">✅</span>
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">All Clear!</h3>
          <p className="text-text-secondary text-sm">No significant alerts detected for this date.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* High Priority Alerts Summary */}
          {smartAlerts.summary.highPriorityAlerts > 0 && (
            <div className="bg-status-warning bg-opacity-10 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-status-warning" />
                <h3 className="text-sm font-semibold text-status-warning">
                  {smartAlerts.summary.highPriorityAlerts} High Priority Alert{smartAlerts.summary.highPriorityAlerts > 1 ? 's' : ''}
                </h3>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Critical issues requiring immediate attention
              </p>
            </div>
          )}

          {/* Alert Categories */}
          {renderAlertCategory(
            'highVolumeLowMargin',
            smartAlerts.alerts.highVolumeLowMargin,
            'High Volume Low Margin',
            TrendingUp
          )}
          
          {renderAlertCategory(
            'departmentGPDecline', 
            smartAlerts.alerts.departmentGPDecline,
            'Department GP Decline',
            TrendingDown
          )}
          
          {renderAlertCategory(
            'overstockWarnings',
            smartAlerts.alerts.overstockWarnings,
            'Overstock Warnings',
            Package
          )}
          
          {renderAlertCategory(
            'pricePointAnalysis',
            smartAlerts.alerts.pricePointAnalysis,
            'Price Point Analysis',
            Target
          )}
        </div>
      )}
    </div>
  );
};

export default SmartAlertsPanel; 