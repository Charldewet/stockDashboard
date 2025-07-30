import { useState, useEffect } from 'react';
import { Package, Filter, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { dailyStockAPI } from '../services/api';
import DownloadDropdown from './DownloadDropdown';
import { generateStockLevelsPDF } from '../utils/pdfUtils';

const StockLevelsCard = ({ selectedDate, selectedPharmacy, formatCurrency, formatNumber }) => {
  const [stockLevels, setStockLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDaysFilter, setSelectedDaysFilter] = useState(7);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('all');
  const [isDaysDropdownOpen, setIsDaysDropdownOpen] = useState(false);
  const [isDepartmentDropdownOpen, setIsDepartmentDropdownOpen] = useState(false);
  const [sortField, setSortField] = useState('daysOfStock');
  const [sortDirection, setSortDirection] = useState('desc');

  const daysFilterOptions = [
    { value: 7, label: '7+ Days of Stock' },
    { value: 14, label: '14+ Days of Stock' },
    { value: 21, label: '21+ Days of Stock' },
    { value: 30, label: '30+ Days of Stock' }
  ];

  const fetchStockLevels = async (minDays) => {
    setLoading(true);
    setError(null);
    try {
      const data = await dailyStockAPI.getStockLevelsWithDays(selectedPharmacy, minDays);
      console.log('📊 Stock levels data received:', data);
      console.log('🏢 Sample departments:', data.products?.slice(0, 5).map(p => ({ 
        name: p.departmentName, 
        code: p.departmentCode 
      })));
      setStockLevels(data.products || []);
    } catch (err) {
      console.error('Error fetching stock levels:', err);
      setError(err.response?.data?.message || 'Failed to fetch stock levels');
    } finally {
      setLoading(false);
    }
  };

  // Department categories mapping
  const departmentCategories = {
    'all': 'All Categories',
    'pharmacy': 'Pharmacy & Dispensary',
    'medical': 'Medical & Health',
    'sports': 'Sports & Fitness',
    'health_foods': 'Health Foods & Nutrition',
    'footwear': 'Footwear',
    'beauty': 'Beauty & Personal Care',
    'retail': 'Retail & Services',
    'surgical': 'Surgical & Medical Supplies',
    'operations': 'Operations & Support'
  };

  // Department to category mapping
  const getDepartmentCategory = (departmentCode) => {
    if (!departmentCode) {
      console.log('⚠️ No department code provided');
      return 'other';
    }
    
    const code = departmentCode.toUpperCase();
    console.log(`🔍 Mapping department code: ${code}`);
    
    // Pharmacy & Dispensary
    if (code.startsWith('PDST') || code.startsWith('PDSV') || code.startsWith('PDWB') || code === 'SCRIPT') {
      console.log(`✅ Mapped ${code} to pharmacy`);
      return 'pharmacy';
    }
    
    // Medical & Health
    if (code.startsWith('MAD') || code.startsWith('MAH') || code.startsWith('PDO')) {
      console.log(`✅ Mapped ${code} to medical`);
      return 'medical';
    }
    
    // Sports & Fitness
    if (code.startsWith('HST') || code.startsWith('HSN')) {
      console.log(`✅ Mapped ${code} to sports`);
      return 'sports';
    }
    
    // Health Foods & Nutrition
    if (code.startsWith('HNF') || code.startsWith('HVL')) {
      console.log(`✅ Mapped ${code} to health_foods`);
      return 'health_foods';
    }
    
    // Footwear
    if (code.startsWith('SA') || code.startsWith('SB')) {
      console.log(`✅ Mapped ${code} to footwear`);
      return 'footwear';
    }
    
    // Beauty & Personal Care
    if (code.startsWith('BAA') || code.startsWith('ZAJ') || code.startsWith('ZAU')) {
      console.log(`✅ Mapped ${code} to beauty`);
      return 'beauty';
    }
    
    // Retail & Services
    if (code.startsWith('ZA') && !code.startsWith('ZAJ') && !code.startsWith('ZAU')) {
      console.log(`✅ Mapped ${code} to retail`);
      return 'retail';
    }
    
    // Surgical & Medical Supplies
    if (code.startsWith('OAA') || code.startsWith('NAA') || code.startsWith('FDA')) {
      console.log(`✅ Mapped ${code} to surgical`);
      return 'surgical';
    }
    
    // Operations & Support
    if (code.startsWith('YBA') || code.startsWith('ZFB') || code.startsWith('ZFC') || code.startsWith('ZFZ')) {
      console.log(`✅ Mapped ${code} to operations`);
      return 'operations';
    }
    
    console.log(`❌ No category found for ${code}, defaulting to other`);
    return 'other';
  };

  // Get unique departments grouped by category
  const getDepartmentsByCategory = () => {
    const departmentsByCategory = {};
    
    stockLevels.forEach(product => {
      const category = getDepartmentCategory(product.departmentCode);
      if (!departmentsByCategory[category]) {
        departmentsByCategory[category] = new Set();
      }
      departmentsByCategory[category].add(product.departmentName);
    });
    
    return departmentsByCategory;
  };

  // Filter and sort stock levels
  const getFilteredAndSortedStockLevels = () => {
    console.log(`🔍 Filtering stock levels. Selected filter: ${selectedDepartmentFilter}`);
    console.log(`📊 Total stock levels: ${stockLevels.length}`);
    
    let filtered = [];
    
    if (selectedDepartmentFilter === 'all') {
      console.log('✅ Showing all departments');
      filtered = stockLevels;
    } else if (departmentCategories[selectedDepartmentFilter]) {
      // Filter by category
      filtered = stockLevels.filter(product => {
        const category = getDepartmentCategory(product.departmentCode);
        const matches = category === selectedDepartmentFilter;
        if (matches) {
          console.log(`✅ Product ${product.productName} (${product.departmentCode}) matches category ${selectedDepartmentFilter}`);
        }
        return matches;
      });
      console.log(`📊 Filtered to ${filtered.length} products in category ${selectedDepartmentFilter}`);
    } else {
      // Filter by specific department name
      filtered = stockLevels.filter(product => product.departmentName === selectedDepartmentFilter);
      console.log(`📊 Filtered to ${filtered.length} products in department ${selectedDepartmentFilter}`);
    }

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (sortField === 'daysOfStock') {
        aValue = a.daysOfStock;
        bValue = b.daysOfStock;
      } else if (sortField === 'stockValue') {
        aValue = (a.costPerUnit || 0) * a.currentSOH;
        bValue = (b.costPerUnit || 0) * b.currentSOH;
      } else {
        return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    return filtered;
  };

  useEffect(() => {
    if (selectedPharmacy) {
      fetchStockLevels(selectedDaysFilter);
    }
  }, [selectedPharmacy, selectedDaysFilter]);

  const handleDaysFilterChange = (days) => {
    setSelectedDaysFilter(days);
    setIsDaysDropdownOpen(false);
  };

  const handleDepartmentFilterChange = (department) => {
    setSelectedDepartmentFilter(department);
    setIsDepartmentDropdownOpen(false);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to desc
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-text-secondary" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3 h-3 text-accent-primary" />
      : <ChevronDown className="w-3 h-3 text-accent-primary" />;
  };

  const getDaysColor = (days) => {
    if (days >= 30) return 'text-status-error';
    if (days >= 21) return 'text-status-warning';
    if (days >= 14) return 'text-status-success';
    return 'text-text-secondary';
  };

  const getDaysBackground = (days) => {
    if (days >= 30) return 'bg-status-error bg-opacity-10';
    if (days >= 21) return 'bg-status-warning bg-opacity-10';
    if (days >= 14) return 'bg-status-success bg-opacity-10';
    return 'bg-surface-tertiary';
  };

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

  const handleExportCSV = () => {
    const filteredData = getFilteredAndSortedStockLevels();
    const data = filteredData.map(product => ({
      'Product Name': product.productName || '',
      'Stock Code': product.stockCode || '',
      'Department': product.departmentName || '',
      'Current SOH': product.currentSOH || 0,
      'Daily Avg Sales': product.dailyAvgSales || 0,
      'Days of Stock': product.daysOfStock || 0,
      'Stock Value': product.costPerUnit ? (product.costPerUnit * product.currentSOH) : 0,
      'Cost Per Unit': product.costPerUnit || 0
    }));
    
    const headers = [
      'Product Name', 'Stock Code', 'Department', 'Current SOH', 
      'Daily Avg Sales', 'Days of Stock', 'Stock Value', 'Cost Per Unit'
    ];
    
    exportToCSV(data, 'stock_levels', headers);
  };

  const handleExportPDF = () => {
    const filteredData = getFilteredAndSortedStockLevels();
    generateStockLevelsPDF(filteredData, selectedDate, selectedPharmacy, formatCurrency, formatNumber);
  };

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-accent-primary" />
            <h3 className="text-xl font-semibold text-text-primary">Stock Levels</h3>
          </div>
          
          {/* Filter Dropdowns */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            {/* Days Filter Dropdown */}
            <div className="relative">
            <button
              onClick={() => setIsDaysDropdownOpen(!isDaysDropdownOpen)}
              className="flex items-center gap-2 bg-surface-secondary hover:bg-surface-tertiary px-3 py-2 rounded-lg text-sm font-medium text-text-primary transition-colors"
            >
              <Filter className="w-4 h-4" />
              {daysFilterOptions.find(option => option.value === selectedDaysFilter)?.label}
              {isDaysDropdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {isDaysDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-surface-primary border border-surface-tertiary rounded-lg shadow-lg z-10 min-w-48">
                {daysFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleDaysFilterChange(option.value)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-secondary transition-colors ${
                      selectedDaysFilter === option.value 
                        ? 'bg-accent-primary bg-opacity-20 text-accent-primary' 
                        : 'text-text-primary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

          {/* Department Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDepartmentDropdownOpen(!isDepartmentDropdownOpen)}
              className="flex items-center gap-2 bg-surface-secondary hover:bg-surface-tertiary px-3 py-2 rounded-lg text-sm font-medium text-text-primary transition-colors"
            >
              <Filter className="w-4 h-4" />
              {departmentCategories[selectedDepartmentFilter] || selectedDepartmentFilter}
              {isDepartmentDropdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {isDepartmentDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-surface-primary border border-surface-tertiary rounded-lg shadow-lg z-10 min-w-56 max-h-64 overflow-y-auto">
                {Object.entries(departmentCategories).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handleDepartmentFilterChange(key)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-secondary transition-colors ${
                      selectedDepartmentFilter === key 
                        ? 'bg-accent-primary bg-opacity-20 text-accent-primary' 
                        : 'text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DownloadDropdown 
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            disabled={!getFilteredAndSortedStockLevels().length}
            title="Export Stock Levels"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto mb-2"></div>
            <p className="text-text-secondary text-sm">Loading stock levels...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <Package className="h-8 w-8 text-status-warning mx-auto mb-2" />
            <p className="text-status-warning text-sm mb-2">Failed to load stock levels</p>
            <p className="text-text-secondary text-xs">{error}</p>
          </div>
        </div>
      ) : getFilteredAndSortedStockLevels().length > 0 ? (
        <div>
          {/* Header Row - Outside scrollable area */}
          <div className="flex items-center gap-1 lg:gap-2 px-3 py-2 bg-surface-tertiary rounded-lg mb-2">
            <div className="flex-1 text-xs font-medium text-text-secondary">Product</div>
            <div className="w-12 lg:w-16 text-xs font-medium text-text-secondary text-center">SOH</div>
            <div className="w-16 lg:w-20 text-xs font-medium text-text-secondary text-center hidden lg:block">Daily Avg</div>
            <div className="w-12 lg:w-16 text-xs font-medium text-text-secondary text-center">
              <button 
                onClick={() => handleSort('daysOfStock')}
                className="flex items-center justify-center gap-1 w-full hover:text-accent-primary transition-colors"
              >
                <span>Days</span>
                {getSortIcon('daysOfStock')}
              </button>
            </div>
            <div className="w-16 lg:w-20 text-xs font-medium text-text-secondary text-center">
              <button 
                onClick={() => handleSort('stockValue')}
                className="flex items-center justify-center gap-1 w-full hover:text-accent-primary transition-colors"
              >
                <span>Value</span>
                {getSortIcon('stockValue')}
              </button>
            </div>
          </div>
          
          {/* Scrollable content list */}
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-2">
            {getFilteredAndSortedStockLevels().map((product, index) => (
              <div 
                key={index} 
                className={`rounded-lg p-3 ${getDaysBackground(product.daysOfStock)}`}
              >
                <div className="flex items-center gap-1 lg:gap-2">
                  {/* Column 1 - Description, Stock Code, and Department */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {product.productName}
                      </span>
                      <span className="text-xs text-text-secondary truncate">
                        {product.stockCode}
                      </span>
                      <span className="text-xs text-text-secondary truncate">
                        {product.departmentName}
                      </span>
                    </div>
                  </div>
                  
                  {/* Column 2 - SOH */}
                  <div className="w-12 lg:w-16 text-xs text-text-primary font-medium text-center">
                    {formatNumber(product.currentSOH)}
                  </div>
                  
                  {/* Column 3 - Daily Avg (hidden on mobile) */}
                  <div className="w-16 lg:w-20 text-xs text-text-secondary text-center hidden lg:block">
                    {product.dailyAvgSales}
                  </div>
                  
                  {/* Column 4 - Days Stock */}
                  <div className="w-12 lg:w-16 text-xs font-medium text-center">
                    <span className={getDaysColor(product.daysOfStock)}>
                      {product.daysOfStock}
                    </span>
                  </div>
                  
                  {/* Column 5 - Value */}
                  <div className="w-16 lg:w-20 text-xs text-text-primary text-center">
                    {product.costPerUnit ? formatCurrency(product.costPerUnit * product.currentSOH) : 'N/A'}
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <Package className="h-8 w-8 text-text-secondary mx-auto mb-2" />
          <p className="text-text-secondary text-sm">
            {selectedDepartmentFilter === 'all' 
              ? `No products found with ${selectedDaysFilter}+ days of stock`
              : `No products found in ${departmentCategories[selectedDepartmentFilter]} with ${selectedDaysFilter}+ days of stock`
            }
          </p>
          <p className="text-text-secondary text-xs mt-1">
            Try selecting a different category or a lower threshold
          </p>
        </div>
      )}
    </div>
  );
};

export default StockLevelsCard; 