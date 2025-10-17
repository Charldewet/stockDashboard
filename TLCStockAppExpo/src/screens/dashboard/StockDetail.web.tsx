import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Search, Calendar, ChevronRight } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

import { API_CONFIG } from '../../config/api';
import CustomDatePicker from '../../components/common/CustomDatePicker';

const { width } = Dimensions.get('window');

// Helper function to get pharmacy ID
const getPharmacyId = (pharmacy: any): string => {
  if (typeof pharmacy === 'string') return pharmacy;
  if (pharmacy?.id) return String(pharmacy.id);
  if (pharmacy?.pharmacy_id) return String(pharmacy.pharmacy_id);
  if (pharmacy?.code) return String(pharmacy.code);
  return '1'; // fallback
};

const useColors = () => useTheme().colors;

const StockDetail = () => {
  const navigation = useNavigation();
  const { selectedPharmacy } = useAuth();
  const { colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState('itemSearch');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [productDetails, setProductDetails] = useState<{ [key: string]: { loading: boolean; data: any; error: string | null } }>({});
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 days ago
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Helper function to get pharmacy ID from pharmacy code
  const getPharmacyId = (pharmacyCode: string): number => {
    const asNum = Number(pharmacyCode);
    if (Number.isFinite(asNum) && String(asNum) === pharmacyCode) {
      return asNum;
    }
    const pharmacyMap: { [key: string]: number } = {
      'REITZ': 1,
      'TLC WINTERTON': 2
    };
    return pharmacyMap[pharmacyCode] || 1;
  };

  // Search function
  const performSearch = async (query: string) => {
    if (!selectedPharmacy) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const searchTerm = query.trim();
      console.log(`🔍 Searching for products with term: "${searchTerm}"`);

      // Use the new working products search endpoint
      const response = await fetch(`${API_CONFIG.BASE_URL}/products/search?query=${encodeURIComponent(searchTerm)}&page=1&page_size=200`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📊 Products search response status: ${response.status}`);
        
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📊 Products search response data:', data);
      
      let items: any[] = [];
      
      // Handle the response structure
      if (Array.isArray(data)) {
        items = data;
      } else if (data?.items && Array.isArray(data.items)) {
        items = data.items;
      } else if (data?.products && Array.isArray(data.products)) {
        items = data.products;
      } else if (data?.data && Array.isArray(data.data)) {
        items = data.data;
      } else {
        console.log('❌ Unexpected response structure:', data);
        items = [];
      }

      console.log(`📊 Found ${items.length} products from products search endpoint`);

      if (items.length === 0) {
        setSearchResults([]);
        return;
      }

      // Sort results: exact matches first, then partial matches
      const sortedResults = items.sort((a: any, b: any) => {
        const aStockCode = (a.product_code || a.stock_code || a.code || a.sku || '').toLowerCase();
        const aDescription = (a.description || a.product_name || a.name || a.title || '').toLowerCase();
        const bStockCode = (b.product_code || b.stock_code || b.code || b.sku || '').toLowerCase();
        const bDescription = (b.description || b.product_name || b.name || b.title || '').toLowerCase();
        
        // Exact stock code match gets highest priority
        if (aStockCode === searchTerm.toLowerCase() && bStockCode !== searchTerm.toLowerCase()) return -1;
        if (bStockCode === searchTerm.toLowerCase() && aStockCode !== searchTerm.toLowerCase()) return 1;
        
        // Exact description match gets second priority
        if (aDescription === searchTerm.toLowerCase() && bDescription !== searchTerm.toLowerCase()) return -1;
        if (bDescription === searchTerm.toLowerCase() && aDescription !== searchTerm.toLowerCase()) return 1;
        
        // Stock code starts with search term gets third priority
        if (aStockCode.startsWith(searchTerm.toLowerCase()) && !bStockCode.startsWith(searchTerm.toLowerCase())) return -1;
        if (bStockCode.startsWith(searchTerm.toLowerCase()) && !aStockCode.startsWith(searchTerm.toLowerCase())) return 1;
        
        // Description starts with search term gets fourth priority
        if (aDescription.startsWith(searchTerm.toLowerCase()) && !bDescription.startsWith(searchTerm.toLowerCase())) return -1;
        if (bDescription.startsWith(searchTerm.toLowerCase()) && !aDescription.startsWith(searchTerm.toLowerCase())) return 1;
        
        // Finally, sort by description length (shorter descriptions first)
        return aDescription.length - bDescription.length;
      });

      console.log(`✅ Final results: ${sortedResults.length} products`);
      setSearchResults(sortedResults);
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(`Failed to fetch products: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Function to fetch product details for a specific product
  const fetchProductDetails = async (productId: string, productCode: string) => {
    if (!selectedPharmacy) return null;

    try {
      const pharmacyId = getPharmacyId(selectedPharmacy);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log(`🔍 Fetching dated sales for product ${productCode} from ${startDateStr} to ${endDateStr} for pharmacy ${pharmacyId}`);

      // Use older dated sales endpoint for a single fetch when expanding
      const detailsResponse = await fetch(`${API_CONFIG.BASE_URL}/products/${encodeURIComponent(productCode)}/sales?from_date=${startDateStr}&to_date=${endDateStr}&pharmacy_id=${encodeURIComponent(String(pharmacyId))}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (detailsResponse.ok) {
        const raw = await detailsResponse.json();
        console.log('📊 Product dated sales response (raw):', raw);

        // Normalize into { summary, daily }
        const daily: any[] = Array.isArray(raw?.daily)
          ? raw.daily
          : Array.isArray(raw?.items)
            ? raw.items
            : Array.isArray(raw)
              ? raw
              : [];

        // Try to read explicit summary fields
        let totalQty = raw?.summary?.total_qty_sold ?? raw?.total_qty_sold;
        let totalSales = raw?.summary?.total_sales_value ?? raw?.total_sales_value;
        let totalCost = raw?.summary?.total_cost_of_sales ?? raw?.total_cost_of_sales;
        let totalGp = raw?.summary?.total_gp_value ?? raw?.total_gp_value;
        let avgGpPct = raw?.summary?.avg_gp_percentage ?? raw?.avg_gp_percentage;

        // If any missing, compute from daily
        const sumFromDaily = (selector: (d: any) => number) => daily.reduce((s, d) => s + (Number(selector(d)) || 0), 0);
        if (totalQty == null) totalQty = sumFromDaily(d => d.qty_sold ?? d.quantity ?? 0);
        if (totalSales == null) totalSales = sumFromDaily(d => d.sales_val ?? d.sales_value ?? 0);
        if (totalCost == null) totalCost = sumFromDaily(d => d.cost_of_sales ?? d.cost ?? 0);
        if (totalGp == null) totalGp = sumFromDaily(d => d.gp_value ?? d.gp ?? ((d.sales_val ?? d.sales_value ?? 0) - (d.cost_of_sales ?? d.cost ?? 0)));
        if (avgGpPct == null) avgGpPct = totalSales > 0 ? (totalGp / totalSales) * 100 : 0;

        // Helper: compute average daily qty sold over N days ending at selected end date
        const computeAvgQtyOverDays = async (numDays: number): Promise<number> => {
          try {
            const end = new Date(endDate);
            const start = new Date(end);
            start.setDate(start.getDate() - (numDays - 1));
            const fromStr = start.toISOString().split('T')[0];
            const toStr = end.toISOString().split('T')[0];

            const r = await fetch(`${API_CONFIG.BASE_URL}/products/${encodeURIComponent(productCode)}/sales?from_date=${fromStr}&to_date=${toStr}&pharmacy_id=${encodeURIComponent(String(pharmacyId))}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            if (!r.ok) {
              console.log(`avg fetch daily failed ${r.status}`);
            } else {
              const j = await r.json();
              const dailyArr: any[] = Array.isArray(j?.daily)
                ? j.daily
                : Array.isArray(j?.items)
                  ? j.items
                  : Array.isArray(j)
                    ? j
                    : [];
              const totalFromDaily = dailyArr.reduce((sum: number, d: any) => sum + (Number(d.qty_sold ?? d.quantity ?? 0) || 0), 0);
              const summaryQty = Number(j?.summary?.total_qty_sold ?? j?.total_qty_sold ?? 0);
              const pickedTotal = (dailyArr.length > 0 ? totalFromDaily : 0) || summaryQty || 0;
              if (pickedTotal > 0) {
                return pickedTotal / numDays;
              }
            }

            // Fallback to summary-only endpoint if daily not available or zero
            const rSummary = await fetch(`${API_CONFIG.BASE_URL}/products/${encodeURIComponent(productCode)}/sales/summary?from_date=${fromStr}&to_date=${toStr}&pharmacy_id=${encodeURIComponent(String(pharmacyId))}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            if (rSummary.ok) {
              const sj = await rSummary.json();
              const total = Number(sj?.summary?.total_qty_sold ?? sj?.total_qty_sold ?? 0) || 0;
              return total / numDays;
            } else {
              console.log(`avg fetch summary failed ${rSummary.status}`);
            }

            return 0;
          } catch (e) {
            console.log('avg compute error', e);
            return 0;
          }
        };

        const [avg180, avg30] = await Promise.all([
          computeAvgQtyOverDays(180),
          computeAvgQtyOverDays(30)
        ]);

        const normalized = {
          summary: {
            total_qty_sold: Number(totalQty) || 0,
            total_sales_value: Number(totalSales) || 0,
            total_cost_of_sales: Number(totalCost) || 0,
            total_gp_value: Number(totalGp) || 0,
            avg_gp_percentage: Number(Math.round((avgGpPct + Number.EPSILON) * 100) / 100) || 0,
          },
          daily,
          avg_180d_qty: Number(avg180) || 0,
          avg_30d_qty: Number(avg30) || 0,
        };

        return normalized;
      } else {
        const errText = await detailsResponse.text();
        console.log(`❌ Product dated sales endpoint failed: ${detailsResponse.status} - ${errText}`);
        return null;
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      return null;
    }
  };

  // Function to toggle product details
  const toggleProductDetails = async (productId: string, productCode: string) => {
    const expandedKey = `${productId}-${productCode}`;
    
    if (expandedProducts.has(expandedKey)) {
      // Collapse
      const newExpanded = new Set(expandedProducts);
      newExpanded.delete(expandedKey);
      setExpandedProducts(newExpanded);
      setProductDetails(prev => {
        const newDetails = { ...prev };
        delete newDetails[expandedKey];
        return newDetails;
      });
    } else {
      // Expand and fetch details
      const newExpanded = new Set(expandedProducts);
      newExpanded.add(expandedKey);
      setExpandedProducts(newExpanded);
      
      // Show loading state
      setProductDetails(prev => ({
        ...prev,
        [expandedKey]: { loading: true, data: null, error: null }
      }));

      // Fetch details
      const details = await fetchProductDetails(productId, productCode);
      
      setProductDetails(prev => ({
        ...prev,
        [expandedKey]: {
          loading: false,
          data: details,
          error: details ? null : 'No sales for selected period'
        }
      }));
    }
  };

  // Load all products when component mounts
  useEffect(() => {
    if (selectedPharmacy) {
      // Load all products initially (empty search shows all products)
      performSearch('');
    }
  }, [selectedPharmacy]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedPharmacy, startDate, endDate]);

  useFocusEffect(
    React.useCallback(() => {
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' }
      });
      return () => {
        navigation.getParent()?.setOptions({
          tabBarStyle: {
            backgroundColor: colors.surfacePrimary,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingBottom: 24,
            paddingTop: 6,
            height: 80,
          }
        });
      };
    }, [navigation])
  );

  const styles = getStyles(colors);
  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        <View style={styles.mainHeaderRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={colors.accentPrimary} />
              <Text style={styles.backButtonText}>Stock Screen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock Details</Text>
        </View>
        
        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[
              styles.filterButton,
              styles.filterButtonSelected
            ]} 
            onPress={() => setActiveFilter('itemSearch')}
          >
            <Text style={[
              styles.filterButtonText,
              styles.filterButtonTextSelected
            ]}>
              Product History
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Search Box - Always visible when Item Search is active */}
        {activeFilter === 'itemSearch' && (
          <View style={styles.searchContainer}>
            {/* Date Range Selector */}
            <View style={styles.dateRangeContainer}>
              <Text style={styles.dateRangeLabel}>Date Range:</Text>
              <View style={styles.dateRangeRow}>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={styles.dateButtonText}>
                    {startDate.toLocaleDateString('en-ZA')}
                  </Text>
                </TouchableOpacity>
                
                <Text style={styles.dateRangeSeparator}>to</Text>
                
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={styles.dateButtonText}>
                    {endDate.toLocaleDateString('en-ZA')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.searchInputContainer}>
              <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search Product"
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
              />
            </View>
            
            {/* Search Results */}
            {isSearching && (
              <View style={styles.searchingContainer}>
                <ActivityIndicator size="small" color={colors.accentPrimary} />
                <Text style={styles.searchingText}>Searching...</Text>
              </View>
            )}
            
            {searchError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{searchError}</Text>
              </View>
            )}
            
            {!isSearching && !searchError && searchQuery.trim() && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsHeader}>
                  {searchResults.length > 0 
                    ? `Found ${searchResults.length} product${searchResults.length === 1 ? '' : 's'}`
                    : 'No products found'
                  }
                </Text>
                
                {searchResults.map((item, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.resultItem}
                    onPress={() => toggleProductDetails(item.id, (item.product_code || item.stock_code || item.code || item.sku))}
                  >
                    <View style={styles.resultItemContent}>
                      <View style={styles.resultItemInfo}>
                        <Text style={styles.resultItemName} numberOfLines={2}>
                          {item.description || item.product_name || item.name || 'Unknown Product'}
                        </Text>
                        <Text style={styles.resultItemCode}>
                          {item.product_code || item.stock_code || item.code || 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.expandButton}>
                        <ChevronRight 
                          size={16} 
                          color={colors.textSecondary} 
                          style={[
                            styles.expandArrow,
                            { transform: [{ rotate: expandedProducts.has(`${item.id}-${(item.product_code || item.stock_code || item.code || item.sku)}`) ? '90deg' : '0deg' }] }
                          ]}
                        />
                      </View>
                    </View>

                    {expandedProducts.has(`${item.id}-${(item.product_code || item.stock_code || item.code || item.sku)}`) && (
                      <View style={styles.productDetailsContainer}>
                        {productDetails[`${item.id}-${(item.product_code || item.stock_code || item.code || item.sku)}`]?.loading ? (
                          <View style={styles.loadingDetails}>
                            <ActivityIndicator size="small" color={colors.accentPrimary} />
                            <Text style={styles.loadingDetailsText}>Loading details...</Text>
                          </View>
                        ) : productDetails[`${item.id}-${(item.product_code || item.stock_code || item.code || item.sku)}`]?.error ? (
                          <View style={styles.errorDetails}>
                            <Text style={styles.errorDetailsText}>{productDetails[`${item.id}-${(item.product_code || item.stock_code || item.code || item.sku)}`]?.error}</Text>
                          </View>
                        ) : productDetails[`${item.id}-${(item.product_code || item.stock_code || item.code || item.sku)}`]?.data ? (
                          <View style={styles.detailsContent}>
                            
                            {(() => {
                              const data = productDetails[`${item.id}-${(item.product_code || item.stock_code || item.code || item.sku)}`]?.data;
                              const summary = data?.summary;
                              const daily = Array.isArray(data?.daily)
                                ? data.daily
                                : Array.isArray(data)
                                  ? data
                                  : Array.isArray(data?.items)
                                    ? data.items
                                    : [];

                              const hasSummary = !!summary;

                              return (
                                <>
                                  {hasSummary && (
                                    <>
                                      <View style={styles.detailsSummaryRow3}>
                                        <View style={styles.detailsSummaryItem}>
                                          <Text style={styles.detailLabel}>Qty Sold</Text>
                                          <Text style={styles.detailValue}>{summary.total_qty_sold ?? 0}</Text>
                                        </View>
                                        <View style={styles.detailsSummaryItem}>
                                          <Text style={styles.detailLabel}>Sales</Text>
                                          <Text style={styles.detailValue}>{(summary.total_sales_value ?? 0).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' }).replace('ZAR', 'R')}</Text>
                                        </View>
                                        <View style={styles.detailsSummaryItem}>
                                          <Text style={styles.detailLabel}>Daily Avg</Text>
                                          <Text style={styles.detailValue}>{Number(data?.avg_180d_qty ?? 0).toFixed(1)}</Text>
                                        </View>
                                      </View>
                                      <View style={styles.detailsSummaryRow3}>
                                        <View style={styles.detailsSummaryItem}>
                                          <Text style={styles.detailLabel}>GP%</Text>
                                          <Text style={styles.detailValue}>{Number(summary.avg_gp_percentage ?? 0).toFixed(2)}%</Text>
                                        </View>
                                        <View style={styles.detailsSummaryItem}>
                                          <Text style={styles.detailLabel}>Cost</Text>
                                          <Text style={styles.detailValue}>{(summary.total_cost_of_sales ?? Math.max((summary.total_sales_value ?? 0) - (summary.total_gp_value ?? 0), 0)).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' }).replace('ZAR', 'R')}</Text>
                                        </View>
                                        <View style={styles.detailsSummaryItem}>
                                          <Text style={styles.detailLabel}>Mnth Avg</Text>
                                          <Text style={styles.detailValue}>{(Number(data?.avg_180d_qty ?? 0) * 30).toFixed(1)}</Text>
                                        </View>
                                      </View>
                                    </>
                                  )}

                                  {Array.isArray(daily) && daily.length > 0 ? (
                                    <View style={{ marginTop: 12 }}>
                                      {daily.slice(0, 14).map((detail: any, detailIndex: number) => (
                                        <View key={detailIndex} style={styles.detailItem}>
                                          <Text style={styles.detailLabel}>{detail.date || detail.business_date || 'Date'}</Text>
                                          <Text style={styles.detailValue}>{Number(detail.qty_sold ?? detail.quantity ?? 0)}</Text>
                                        </View>
                                      ))}
                                    </View>
                                  ) : !hasSummary ? (
                                    <Text style={styles.noDetailsText}>No detailed data available for this period</Text>
                                  ) : null}
                                </>
                              );
                            })()}
                          </View>
                        ) : (
                          <Text style={styles.noDetailsText}>No data available</Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Start Date Picker Modal */}
      <Modal
        visible={showStartDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStartDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.datePickerContainer}>
              <CustomDatePicker
                value={startDate}
                onChange={(date) => setStartDate(date)}
                minimumDate={new Date(2020, 0, 1)}
                maximumDate={endDate}
              />
            </View>
            <View style={styles.datePickerActions}>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowStartDatePicker(false)}
              >
                <Text style={styles.datePickerButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.datePickerButton, styles.datePickerButtonPrimary]}
                onPress={() => setShowStartDatePicker(false)}
              >
                <Text style={[styles.datePickerButtonText, styles.datePickerButtonTextPrimary]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Date Picker Modal */}
      <Modal
        visible={showEndDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEndDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.datePickerContainer}>
              <CustomDatePicker
                value={endDate}
                onChange={(date) => setEndDate(date)}
                minimumDate={startDate}
                maximumDate={new Date()}
              />
            </View>
            <View style={styles.datePickerActions}>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowEndDatePicker(false)}
              >
                <Text style={styles.datePickerButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.datePickerButton, styles.datePickerButtonPrimary]}
                onPress={() => setShowEndDatePicker(false)}
              >
                <Text style={[styles.datePickerButtonText, styles.datePickerButtonTextPrimary]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGradientFrom,
  },
  stickyHeader: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: colors.bgGradientFrom,
    zIndex: 1000,
  },
  mainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 0,
  },
  backButtonText: {
    fontSize: 20,
    color: colors.accentPrimary,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 96, // Extra padding for bottom navigation
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  // Filter button styles
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterButton: {
    backgroundColor: colors.surfacePrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 0,
    flex: 1,
  },
  filterButtonSelected: {
    backgroundColor: colors.costSales,
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
  },
  filterButtonTextSelected: {
    color: colors.bgGradientFrom,
    fontWeight: '600',
  },
  // Search box styles
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateRangeContainer: {
    marginBottom: 16,
  },
  dateRangeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateButton: {
    backgroundColor: colors.surfacePrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
  },
  dateButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  dateRangeSeparator: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  searchInputContainer: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    padding: 0,
  },
  // Search results styles
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  searchingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.statusError,
    textAlign: 'center',
  },
  resultsContainer: {
    marginTop: 16,
  },
  resultsHeader: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  resultItem: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  resultItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultItemInfo: {
    flex: 1,
    marginRight: 16,
  },
  resultItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  resultItemCode: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  expandButton: {
    padding: 8,
  },
  productDetailsContainer: {
    marginTop: 12,
    padding: 2,
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    marginHorizontal: 0,
  },
  loadingDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loadingDetailsText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorDetails: {
    padding: 16,
    alignItems: 'center',
  },
  errorDetailsText: {
    fontSize: 14,
    color: colors.statusError,
    textAlign: 'center',
  },
  detailsContent: {
    // Add styles for the content inside productDetailsContainer if needed
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: colors.statusSuccess + '20',
    borderRadius: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.statusSuccess,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  detailsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  noDetailsText: {
    fontSize: 14,
    color: colors.bgGradientFrom,
    textAlign: 'center',
    padding: 16,
    opacity: 0.8,
  },
  detailsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 12,
  },
  detailsSummaryRow3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  detailsSummaryItem: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.statusSuccess + '20',
    borderRadius: 8,
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  datePickerContainer: {
    width: '105%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePicker: {
    width: '60%',
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    width: '100%',
    gap: 20,
  },
  datePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    minWidth: 120,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  datePickerButtonPrimary: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  datePickerButtonTextPrimary: {
    color: colors.bgGradientFrom,
  },
  // Expandable arrow styles
  expandArrow: {
    // React Native handles transform animations automatically
  },
});

export default StockDetail;
