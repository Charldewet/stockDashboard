from models import db, Product, DailySales, SalesHistory, Department
from sqlalchemy import func, desc, and_
from datetime import datetime, date, timedelta
import traceback

class AnalyticsService:
    
    @staticmethod
    def get_daily_summary(pharmacy_id, target_date):
        """Get daily stock summary for a specific date"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Get all daily sales for the date
            daily_sales = db.session.query(DailySales).join(Product).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == target_date
                )
            ).all()
            
            if not daily_sales:
                return {
                    'totalReceipts': 0,
                    'totalIssues': 0,
                    'totalAdjustments': 0,
                    'netMovement': 0,
                    'totalSalesValue': 0,
                    'totalGrossProfit': 0,
                    'itemsWithSales': 0
                }
            
            # Calculate totals
            total_sales_value = sum(float(sale.sales_value or 0) for sale in daily_sales)
            total_sales_qty = sum(float(sale.sales_qty or 0) for sale in daily_sales)
            total_gross_profit = sum(float(sale.gross_profit or 0) for sale in daily_sales)
            items_with_sales = len([sale for sale in daily_sales if float(sale.sales_qty or 0) > 0])
            
            return {
                'totalReceipts': 0,  # We'll calculate this when we have receipt data
                'totalIssues': total_sales_qty,
                'totalAdjustments': 0,  # We'll calculate this when we have adjustment data
                'netMovement': -total_sales_qty,  # Negative because items went out
                'totalSalesValue': total_sales_value,
                'totalGrossProfit': total_gross_profit,
                'itemsWithSales': items_with_sales
            }
            
        except Exception as e:
            print(f"❌ Error getting daily summary: {str(e)}")
            print(traceback.format_exc())
            return {
                'totalReceipts': 0,
                'totalIssues': 0,
                'totalAdjustments': 0,
                'netMovement': 0,
                'totalSalesValue': 0,
                'totalGrossProfit': 0,
                'itemsWithSales': 0
            }
    
    @staticmethod
    def get_top_moving_products(pharmacy_id, target_date, limit=10):
        """Get top moving products for a specific date"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Get top products by sales quantity
            top_products = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                DailySales.sales_qty,
                DailySales.sales_value,
                DailySales.gross_profit
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == target_date,
                    DailySales.sales_qty > 0
                )
            ).order_by(desc(DailySales.sales_qty)).limit(limit).all()
            
            products = []
            for product in top_products:
                products.append({
                    'productName': product.description,
                    'stockCode': product.stock_code,
                    'departmentName': product.department_name,
                    'quantityMoved': float(product.sales_qty),
                    'valueMovement': float(product.sales_value),
                    'grossProfit': float(product.gross_profit)
                })
            
            return {'products': products}
            
        except Exception as e:
            print(f"❌ Error getting top moving products: {str(e)}")
            print(traceback.format_exc())
            return {'products': []}
    
    @staticmethod
    def get_top_moving_products_range(pharmacy_id, start_date, end_date, limit=10):
        """Get top moving products for a specific date range (inclusive)"""
        try:
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            pharmacy_id = pharmacy_id.upper()

            top_products = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                db.func.sum(DailySales.sales_qty).label('total_qty'),
                db.func.sum(DailySales.sales_value).label('total_value'),
                db.func.sum(DailySales.gross_profit).label('total_gp')
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date >= start_date,
                    DailySales.sale_date <= end_date,
                    DailySales.sales_qty > 0
                )
            ).group_by(
                Product.stock_code,
                Product.description,
                Department.department_name
            ).order_by(db.desc('total_qty')).limit(limit).all()

            products = []
            for product in top_products:
                products.append({
                    'productName': product.description,
                    'stockCode': product.stock_code,
                    'departmentName': product.department_name,
                    'quantityMoved': float(product.total_qty),
                    'valueMovement': float(product.total_value),
                    'grossProfit': float(product.total_gp)
                })
            return {'products': products}
        except Exception as e:
            print(f"❌ Error getting top moving products for range: {str(e)}")
            print(traceback.format_exc())
            return {'products': []}
    
    @staticmethod
    def get_low_stock_alerts(pharmacy_id, target_date, threshold_days=7):
        """Get low stock alerts based on current stock and sales velocity"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Get products with current stock levels and recent sales
            alerts = []
            
            # Get products with stock on hand from daily sales
            products_with_stock = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                DailySales.on_hand,
                DailySales.sales_qty
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == target_date,
                    DailySales.on_hand > 0,
                    DailySales.on_hand < 10  # Arbitrary low stock threshold
                )
            ).all()
            
            for product in products_with_stock:
                # Calculate days of inventory remaining
                daily_usage = float(product.sales_qty) if product.sales_qty else 0
                current_stock = float(product.on_hand)
                
                days_remaining = float('inf') if daily_usage == 0 else current_stock / daily_usage
                
                if days_remaining <= threshold_days and daily_usage > 0:
                    alerts.append({
                        'productName': product.description,
                        'stockCode': product.stock_code,
                        'departmentName': product.department_name,
                        'currentStock': current_stock,
                        'dailyUsage': daily_usage,
                        'daysRemaining': min(days_remaining, 999)  # Cap at 999 for display
                    })
            
            # Sort by days remaining (most urgent first)
            alerts.sort(key=lambda x: x['daysRemaining'])
            
            return {'alerts': alerts[:20]}  # Limit to top 20 alerts
            
        except Exception as e:
            print(f"❌ Error getting low stock alerts: {str(e)}")
            print(traceback.format_exc())
            return {'alerts': []}
    
    @staticmethod
    def get_stock_movements(pharmacy_id, start_date, end_date):
        """Get stock movements for a date range"""
        try:
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Get daily sales movements
            movements = db.session.query(
                DailySales.sale_date,
                Product.stock_code,
                Product.description,
                Department.department_name,
                DailySales.sales_qty,
                DailySales.sales_value,
                DailySales.on_hand
            ).select_from(DailySales).join(
                Product, DailySales.product_id == Product.id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date >= start_date,
                    DailySales.sale_date <= end_date,
                    DailySales.sales_qty > 0
                )
            ).order_by(desc(DailySales.sale_date), desc(DailySales.sales_qty)).all()
            
            movement_list = []
            for movement in movements:
                movement_list.append({
                    'date': movement.sale_date.isoformat(),
                    'productName': movement.description,
                    'stockCode': movement.stock_code,
                    'departmentName': movement.department_name,
                    'quantity': float(movement.sales_qty),
                    'value': float(movement.sales_value),
                    'stockOnHand': float(movement.on_hand),
                    'movementType': 'sale'
                })
            
            return {'movements': movement_list}
            
        except Exception as e:
            print(f"❌ Error getting stock movements: {str(e)}")
            print(traceback.format_exc())
            return {'movements': []}
    
    @staticmethod
    def get_reorder_recommendations(pharmacy_id, analysis_days=365):
        """Get reorder recommendations based on 12-month sales history and current SOH
        
        Rules:
        - Normal items: minimum 7 days stock, target 14 days
        - High-volume items (≥2 units/day): minimum 14 days stock, target 21 days
        - Only recommends items below minimum thresholds
        """
        try:
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Get baseline data (12-month aggregated sales with current SOH)
            baseline_marker_date = '1900-01-01'
            
            product_analysis = db.session.query(
                Product.id,
                Product.stock_code,
                Product.description,
                Department.department_name,
                DailySales.sales_qty.label('total_sales_12m'),  # This is already 12-month total
                DailySales.on_hand.label('current_soh'),
                DailySales.sales_value.label('total_value_12m')
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == baseline_marker_date
                )
            ).all()
            
            recommendations = []
            for product in product_analysis:
                total_sales_12m = float(product.total_sales_12m or 0)
                current_soh = float(product.current_soh or 0)
                total_value_12m = float(product.total_value_12m or 0)
                
                # Calculate daily average from 12-month total
                avg_daily_sales = total_sales_12m / 365 if total_sales_12m > 0 else 0
                
                # Only recommend if product has movement and current stock
                if current_soh > 0 and total_sales_12m > 0 and avg_daily_sales > 0:
                    # Calculate days of inventory remaining
                    days_remaining = current_soh / avg_daily_sales
                    
                    # Determine if this is a high moving item (≥2 units per day on average)
                    is_high_moving = avg_daily_sales >= 2.0
                    
                    # Set minimum stock days based on movement level
                    min_stock_days = 14 if is_high_moving else 7
                    target_stock_days = 21 if is_high_moving else 14  # Target buffer
                    
                    # Recommend reorder if below minimum stock days
                    if days_remaining < min_stock_days:
                        # Calculate suggested order quantity to reach target stock days
                        target_stock_qty = avg_daily_sales * target_stock_days
                        suggested_order_qty = max(target_stock_qty - current_soh, avg_daily_sales * min_stock_days)
                        
                        # Create note for high moving items
                        note = "High volume item - recommended 14+ days stock" if is_high_moving else ""
                        
                        # Calculate sales frequency (approximate)
                        sales_frequency = min(total_sales_12m / 365, 1.0)  # Max 1 sale per day average
                        
                        recommendations.append({
                            'productName': product.description,
                            'stockCode': product.stock_code,
                            'departmentName': product.department_name,
                            'currentStock': current_soh,
                            'avgDailySales': avg_daily_sales,
                            'totalSales12m': total_sales_12m,
                            'daysRemaining': min(days_remaining, 999),
                            'suggestedOrderQty': suggested_order_qty,
                            'targetStockDays': target_stock_days,
                            'minStockDays': min_stock_days,
                            'salesFrequency': sales_frequency,
                            'isHighMoving': is_high_moving,
                            'note': note,
                            'priority': 'HIGH' if days_remaining < (min_stock_days * 0.5) else 'MEDIUM'
                        })
            
                        # Sort by urgency (days remaining, prioritizing high moving items)
            recommendations.sort(key=lambda x: (x['daysRemaining'], -x['avgDailySales']))

            return {'recommendations': recommendations}  # Return all recommendations
            
        except Exception as e:
            print(f"❌ Error getting reorder recommendations: {str(e)}")
            print(traceback.format_exc())
            return {'recommendations': []}

    @staticmethod
    def get_overstock_alerts(pharmacy_id, analysis_days=365):
        """Get overstock alerts for slow-moving items with high inventory
        
        Identifies items that:
        - Have excessive stock relative to sales velocity (>30 days supply)
        - Are slow movers with low sales frequency
        - Have significant value tied up in inventory
        - Should be considered for promotions or discounts
        """
        try:
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            print(f"🔍 Getting overstock alerts for pharmacy: {pharmacy_id}")
            
            # Use the same baseline data approach as the working dormant stock function
            baseline_marker_date = '1900-01-01'
            
            overstock_items = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                DailySales.sales_qty,
                DailySales.sales_value,
                DailySales.gross_profit,
                DailySales.on_hand
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == baseline_marker_date,
                    DailySales.on_hand >= 1,  # Has stock on hand
                    DailySales.sales_qty > 0,  # Has some sales to calculate cost
                    DailySales.sales_value > 0  # Has sales value
                )
            ).all()
            
            print(f"🔍 Found {len(overstock_items)} products with stock and sales history")
            
            alerts = []
            for product in overstock_items:
                daily_avg_sales = float(product.sales_qty) / 365  # Convert to daily average
                current_soh = float(product.on_hand or 0)
                
                # Calculate GP percentage
                if float(product.sales_value) > 0:
                    gp_percentage = (float(product.gross_profit) / float(product.sales_value)) * 100
                else:
                    gp_percentage = 0
                
                # Calculate cost per unit and total cost value (same as dormant stock)
                if float(product.sales_qty) > 0 and float(product.sales_value) > 0:
                    # Cost per unit = (sales_value - gross_profit) / sales_qty
                    cost_per_unit = (float(product.sales_value) - float(product.gross_profit)) / float(product.sales_qty)
                    total_cost_value = cost_per_unit * current_soh
                else:
                    cost_per_unit = 0
                    total_cost_value = 0
                
                # Calculate days of supply
                days_supply = current_soh / daily_avg_sales if daily_avg_sales > 0 else 999
                
                # Calculate velocity score (0-1, where 1 is fast moving)
                velocity_score = min(daily_avg_sales / 5.0, 1.0) if daily_avg_sales > 0 else 0
                
                # Identify overstock conditions - focus on slow movers with significant value
                is_overstocked = days_supply > 30  # More than 30 days supply
                is_slow_mover = daily_avg_sales < 1.0  # Less than 1 unit per day
                is_high_value = total_cost_value > 1000  # More than R1000 tied up (same threshold as dormant stock)
                has_minimum_value = total_cost_value > 500  # Only include items with stock value > R500
                
                # Include items that meet our overstock criteria AND have minimum stock value
                if (is_overstocked or (is_high_value and is_slow_mover)) and has_minimum_value:
                    # Determine priority based on days supply and value
                    if days_supply > 90 or total_cost_value > 5000:
                        priority = 'HIGH'
                    elif days_supply > 60 or total_cost_value > 2000:
                        priority = 'MEDIUM'
                    else:
                        priority = 'LOW'
                    
                    # Suggest promotion type based on conditions
                    if is_high_value and is_slow_mover:
                        suggestion_type = "Deep discount (20-30%)"
                    elif days_supply > 60:
                        suggestion_type = "Promotional discount (10-20%)"
                    else:
                        suggestion_type = "Bundle or clearance"
                    
                    # Calculate potential savings (value that could be freed up)
                    potential_savings = total_cost_value * 0.7  # Assuming 70% of value recovered
                    
                    # Only include if potential savings is at least R500
                    if potential_savings >= 500:
                        # Calculate days since last sale (rough estimate)
                        days_since_last_sale = max(1, 365 - min(float(product.sales_qty) * 5, 350)) if float(product.sales_qty) > 0 else 365
                        
                        alerts.append({
                            'productName': product.description,
                            'stockCode': product.stock_code,
                            'departmentName': product.department_name,
                            'currentStock': current_soh,
                            'daysSupply': min(days_supply, 999),
                            'avgDailySales': daily_avg_sales,
                            'totalSales12m': float(product.sales_qty),
                            'stockValue': total_cost_value,
                            'velocityScore': velocity_score,
                            'isSlowMover': is_slow_mover,
                            'highValue': is_high_value,
                            'daysSinceLastSale': days_since_last_sale,
                            'suggestionType': suggestion_type,
                            'potentialSavings': potential_savings,
                            'priority': priority
                        })
                        
                        print(f"🔍 Added alert: {product.description[:30]} | Stock: {current_soh} | Days: {days_supply:.1f} | Value: R{total_cost_value:.0f} | Savings: R{potential_savings:.0f}")
            
            # Sort by priority and cost value (highest first)
            priority_order = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
            alerts.sort(key=lambda x: (priority_order[x['priority']], -x['stockValue']))
            
            print(f"✅ Generated {len(alerts)} overstock alerts")
            return {'alerts': alerts}  # Return all alerts
            
        except Exception as e:
            print(f"❌ Error getting overstock alerts: {str(e)}")
            print(traceback.format_exc())
            return {'alerts': []}
    
    @staticmethod
    def get_stock_kpis(pharmacy_id, target_date):
        """Get key stock performance indicators for a specific date"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Get all daily sales for the date
            daily_sales = db.session.query(DailySales).join(Product).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == target_date
                )
            ).all()
            
            if not daily_sales:
                return {
                    'skusInStock': 0,
                    'negativeStockItems': 0,
                    'lowGPItems': 0,
                    'slowMovingItems': 0
                }
            
            # Calculate KPIs
            skus_in_stock = len([sale for sale in daily_sales if float(sale.on_hand or 0) > 0])
            negative_stock_items = len([sale for sale in daily_sales if float(sale.on_hand or 0) < 0])
            low_gp_items = len([sale for sale in daily_sales if float(sale.gross_profit_percent or 0) < 20])
            slow_moving_items = len([sale for sale in daily_sales if float(sale.sales_qty or 0) == 0])
            
            return {
                'skusInStock': skus_in_stock,
                'negativeStockItems': negative_stock_items, 
                'lowGPItems': low_gp_items,
                'slowMovingItems': slow_moving_items
            }
            
        except Exception as e:
            print(f"❌ Error getting stock KPIs: {str(e)}")
            traceback.print_exc()
            return {
                'skusInStock': 0,
                'negativeStockItems': 0,
                'lowGPItems': 0,
                'slowMovingItems': 0
            } 

    @staticmethod
    def get_top_performing_departments(pharmacy_id, target_date, limit=5):
        """Get top performing departments by total turnover for a specific date"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Get departments ranked by total sales value, rolling up sub-departments into main departments
            # Main departments are typically 4 characters (e.g., PDSV)
            # Sub-departments are typically 6 characters starting with main dept code (e.g., PDSV00, PDSV01)
            from sqlalchemy import case
            
            main_dept_case = case(
                (func.length(Department.department_code) > 4, func.substr(Department.department_code, 1, 4)),
                else_=Department.department_code
            )
            
            # First get the aggregated data by main department codes
            top_departments = db.session.query(
                main_dept_case.label('main_dept_code'),
                func.sum(DailySales.sales_value).label('total_turnover'),
                func.sum(DailySales.sales_qty).label('total_quantity'),
                func.sum(DailySales.gross_profit).label('total_gross_profit'),
                func.count(DailySales.id).label('products_sold')
            ).select_from(DailySales).join(
                Product, DailySales.product_id == Product.id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == target_date,
                    DailySales.sales_qty > 0
                )
            ).group_by(
                main_dept_case
            ).order_by(desc(func.sum(DailySales.sales_value))).limit(limit).all()
            
            # Get all main department names in one query to avoid N+1 problem
            main_dept_codes = [dept.main_dept_code for dept in top_departments]
            main_dept_names = {}
            
            if main_dept_codes:
                # Look for exact matches first (main departments)
                main_depts = db.session.query(Department).filter(
                    Department.department_code.in_(main_dept_codes)
                ).all()
                
                main_dept_names = {dept.department_code: dept.department_name for dept in main_depts}
                
                # For any missing main department names, try to find a sub-department and extract the main name
                missing_codes = set(main_dept_codes) - set(main_dept_names.keys())
                if missing_codes:
                    for missing_code in missing_codes:
                        # Look for any sub-department that starts with this main code
                        sub_dept = db.session.query(Department).filter(
                            Department.department_code.like(f"{missing_code}%")
                        ).first()
                        
                        if sub_dept:
                            # Use the sub-department name but clean it up for main department
                            name = sub_dept.department_name
                            # Remove common sub-department suffixes if present
                            name = name.replace(" VETINARY", "").replace(" DISPENSARY", "").strip()
                            if not name:
                                name = sub_dept.department_name  # fallback to original name
                            main_dept_names[missing_code] = name
                        else:
                            main_dept_names[missing_code] = missing_code  # fallback to code
            
            departments = []
            for dept in top_departments:
                main_dept_name = main_dept_names.get(dept.main_dept_code, dept.main_dept_code)
                
                departments.append({
                    'departmentCode': dept.main_dept_code,
                    'departmentName': main_dept_name,
                    'totalTurnover': float(dept.total_turnover or 0),
                    'totalQuantity': float(dept.total_quantity or 0),
                    'totalGrossProfit': float(dept.total_gross_profit or 0),
                    'productsSold': int(dept.products_sold or 0)
                })
            
            return {'departments': departments}
            
        except Exception as e:
            print(f"❌ Error getting top performing departments: {str(e)}")
            print(traceback.format_exc())
            return {'departments': []}

    @staticmethod
    def get_departments_heatmap_data(pharmacy_id, target_date):
        """Get all departments with sales data for heatmap visualization"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            from sqlalchemy import case
            
            main_dept_case = case(
                (func.length(Department.department_code) > 4, func.substr(Department.department_code, 1, 4)),
                else_=Department.department_code
            )
            
            # Get all departments with sales data (no limit for heatmap)
            all_departments = db.session.query(
                main_dept_case.label('main_dept_code'),
                func.sum(DailySales.sales_value).label('total_turnover'),
                func.sum(DailySales.sales_qty).label('total_quantity'),
                func.sum(DailySales.gross_profit).label('total_gross_profit'),
                func.count(DailySales.id).label('products_sold')
            ).select_from(DailySales).join(
                Product, DailySales.product_id == Product.id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == target_date,
                    DailySales.sales_qty > 0
                )
            ).group_by(
                main_dept_case
            ).order_by(desc(func.sum(DailySales.sales_value))).all()
            
            # Get all main department names in one query
            main_dept_codes = [dept.main_dept_code for dept in all_departments]
            main_dept_names = {}
            
            if main_dept_codes:
                # Look for exact matches first (main departments)
                main_depts = db.session.query(Department).filter(
                    Department.department_code.in_(main_dept_codes)
                ).all()
                
                main_dept_names = {dept.department_code: dept.department_name for dept in main_depts}
                
                # For any missing main department names, try to find a sub-department and extract the main name
                missing_codes = set(main_dept_codes) - set(main_dept_names.keys())
                if missing_codes:
                    for missing_code in missing_codes:
                        # Look for any sub-department that starts with this main code
                        sub_dept = db.session.query(Department).filter(
                            Department.department_code.like(f"{missing_code}%")
                        ).first()
                        
                        if sub_dept:
                            # Use the sub-department name but clean it up for main department
                            name = sub_dept.department_name
                            # Remove common sub-department suffixes if present
                            name = name.replace(" VETINARY", "").replace(" DISPENSARY", "").strip()
                            if not name:
                                name = sub_dept.department_name  # fallback to original name
                            main_dept_names[missing_code] = name
                        else:
                            main_dept_names[missing_code] = missing_code  # fallback to code
            
            departments = []
            for dept in all_departments:
                main_dept_name = main_dept_names.get(dept.main_dept_code, dept.main_dept_code)
                
                departments.append({
                    'departmentCode': dept.main_dept_code,
                    'departmentName': main_dept_name,
                    'totalTurnover': float(dept.total_turnover or 0),
                    'totalQuantity': float(dept.total_quantity or 0),
                    'totalGrossProfit': float(dept.total_gross_profit or 0),
                    'productsSold': int(dept.products_sold or 0)
                })
            
            return {'departments': departments}
            
        except Exception as e:
            print(f"❌ Error getting departments heatmap data: {str(e)}")
            print(traceback.format_exc())
            return {'departments': []}

    @staticmethod
    def get_low_gp_products(pharmacy_id, target_date, gp_threshold=20, exclude_pdst=False):
        """Get products sold with gross profit percentage below threshold"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Build filter conditions
            filter_conditions = [
                Product.pharmacy_id == pharmacy_id,
                DailySales.sale_date == target_date,
                DailySales.sales_qty > 0,  # Only products that were sold
                DailySales.gross_profit_percent < gp_threshold,
                DailySales.gross_profit_percent > 0  # Exclude zero or negative GP
            ]
            
            # Add PDST exclusion filter if requested
            if exclude_pdst:
                filter_conditions.append(~Product.department_code.like('PDST%'))
            
            # Get products with low GP from daily sales
            low_gp_products = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                DailySales.sales_qty,
                DailySales.sales_value,
                DailySales.gross_profit_percent
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(and_(*filter_conditions)).order_by(DailySales.gross_profit_percent.asc()).all()
            
            products_list = []
            for product in low_gp_products:
                products_list.append({
                    'stockCode': product.stock_code,
                    'productName': product.description,
                    'departmentName': product.department_name,
                    'quantitySold': float(product.sales_qty or 0),
                    'salesValue': float(product.sales_value or 0),
                    'grossProfitPercent': float(product.gross_profit_percent or 0)
                })
            
            return products_list
            
        except Exception as e:
            print(f"❌ Error getting low GP products: {str(e)}")
            traceback.print_exc()
            return []

    @staticmethod
    def get_low_gp_products_by_department(pharmacy_id, target_date, department_code, gp_threshold=25):
        """Get products sold with gross profit percentage below threshold for a specific department"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            department_code = department_code.upper()
            
            from sqlalchemy import case
            
            # Handle main department logic (roll up sub-departments)
            main_dept_case = case(
                (func.length(Department.department_code) > 4, func.substr(Department.department_code, 1, 4)),
                else_=Department.department_code
            )
            
            # Get products with low GP from daily sales for the specific department
            low_gp_products = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                Department.department_code,
                DailySales.sales_qty,
                DailySales.sales_value,
                DailySales.gross_profit_percent,
                DailySales.gross_profit
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == target_date,
                    DailySales.sales_qty > 0,  # Only products that were sold
                    DailySales.gross_profit_percent < gp_threshold,
                    DailySales.gross_profit_percent > 0,  # Exclude zero or negative GP
                    main_dept_case == department_code  # Filter by main department code
                )
            ).order_by(DailySales.gross_profit_percent.asc()).all()
            
            products_list = []
            for product in low_gp_products:
                products_list.append({
                    'stockCode': product.stock_code,
                    'productName': product.description,
                    'departmentName': product.department_name,
                    'departmentCode': product.department_code,
                    'quantitySold': float(product.sales_qty or 0),
                    'salesValue': float(product.sales_value or 0),
                    'grossProfit': float(product.gross_profit or 0),
                    'grossProfitPercent': float(product.gross_profit_percent or 0)
                })
            
            return products_list
            
        except Exception as e:
            print(f"❌ Error getting low GP products by department: {str(e)}")
            traceback.print_exc()
            return [] 

    @staticmethod
    def get_best_sellers(pharmacy_id, limit=20):
        """Get overall best sellers based on baseline daily average sales"""
        try:
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Get baseline data (12-month aggregated sales)
            baseline_marker_date = '1900-01-01'
            
            best_sellers = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                DailySales.sales_qty,
                DailySales.sales_value,
                DailySales.gross_profit,
                DailySales.on_hand
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == baseline_marker_date,
                    DailySales.sales_qty > 0
                )
            ).order_by(desc(DailySales.sales_qty / 365)).limit(limit).all()  # Daily average over 12 months
            
            products = []
            for product in best_sellers:
                daily_avg_sales = float(product.sales_qty) / 365  # Convert to daily average
                products.append({
                    'productName': product.description,
                    'stockCode': product.stock_code,
                    'departmentName': product.department_name,
                    'dailyAvgSales': round(daily_avg_sales, 2),
                    'totalSales12Months': float(product.sales_qty),
                    'totalValue12Months': float(product.sales_value),
                    'grossProfit12Months': float(product.gross_profit),
                    'currentSOH': float(product.on_hand or 0)
                })
            
            return {'products': products}
            
        except Exception as e:
            print(f"❌ Error getting best sellers: {str(e)}")
            print(traceback.format_exc())
            return {'products': []}
    
    @staticmethod
    def get_dormant_stock_with_value(pharmacy_id, days_threshold=30, limit=20):
        """Get slowest selling products with significant value (>R1000) - high-value slow movers"""
        try:
            from sqlalchemy import asc
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Get baseline data (12-month aggregated sales) - same as best sellers but reverse order
            baseline_marker_date = '1900-01-01'
            
            slowest_sellers = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                DailySales.sales_qty,
                DailySales.sales_value,
                DailySales.gross_profit,
                DailySales.on_hand
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == baseline_marker_date,
                    DailySales.on_hand >= 1,  # Has stock on hand
                    DailySales.sales_qty > 0,  # Has some sales to calculate cost
                    DailySales.sales_value > 0  # Has sales value
                )
            ).order_by(asc(DailySales.sales_qty)).all()  # Get all, then filter by value
            
            products = []
            for product in slowest_sellers:
                daily_avg_sales = float(product.sales_qty) / 365  # Convert to daily average
                
                # Calculate GP percentage
                if float(product.sales_value) > 0:
                    gp_percentage = (float(product.gross_profit) / float(product.sales_value)) * 100
                else:
                    gp_percentage = 0
                
                # Calculate cost per unit and total cost value
                if float(product.sales_qty) > 0 and float(product.sales_value) > 0:
                    # Cost per unit = (sales_value - gross_profit) / sales_qty
                    cost_per_unit = (float(product.sales_value) - float(product.gross_profit)) / float(product.sales_qty)
                    total_cost_value = cost_per_unit * float(product.on_hand or 0)
                else:
                    cost_per_unit = 0
                    total_cost_value = 0
                
                # Only include items with total cost value > R1000
                if total_cost_value > 1000:
                    products.append({
                        'productName': product.description,
                        'stockCode': product.stock_code,
                        'departmentName': product.department_name,
                        'dailyAvgSales': round(daily_avg_sales, 3),
                        'totalSales12Months': float(product.sales_qty),
                        'totalValue12Months': float(product.sales_value),
                        'grossProfitPercent': round(gp_percentage, 1),
                        'currentSOH': float(product.on_hand or 0),
                        'estimatedCostValue': round(total_cost_value, 2),
                        'costPerUnit': round(cost_per_unit, 2)
                    })
            
            # Sort by cost value (highest first) and limit results
            products.sort(key=lambda x: x['estimatedCostValue'], reverse=True)
            products = products[:limit]
            
            return {'products': products}
            
        except Exception as e:
            print(f"❌ Error getting slowest sellers: {str(e)}")
            print(traceback.format_exc())
            return {'products': []} 

    @staticmethod
    def get_stock_levels_with_days(pharmacy_id, min_days_threshold=7):
        """Get all products with stock levels and filter by minimum days of stock"""
        try:
            from sqlalchemy import asc, desc
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
            # Get all products with their current stock levels and sales data
            # We'll use the baseline data (12-month aggregated sales) to calculate daily averages
            baseline_marker_date = '1900-01-01'
            
            stock_levels = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                Department.department_code,
                DailySales.sales_qty,
                DailySales.sales_value,
                DailySales.gross_profit,
                DailySales.on_hand
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == baseline_marker_date,
                    DailySales.on_hand > 0  # Has stock on hand
                )
            ).all()
            
            products = []
            for product in stock_levels:
                # Calculate daily average sales from 12-month total
                daily_avg_sales = float(product.sales_qty) / 365 if float(product.sales_qty) > 0 else 0
                
                # Calculate days of stock on hand
                current_soh = float(product.on_hand or 0)
                days_of_stock = current_soh / daily_avg_sales if daily_avg_sales > 0 else float('inf')
                
                # Only include products that meet the minimum days threshold
                if days_of_stock >= min_days_threshold:
                    # Calculate cost per unit
                    cost_per_unit = 0
                    if float(product.sales_qty) > 0 and float(product.sales_value) > 0:
                        cost_per_unit = (float(product.sales_value) - float(product.gross_profit)) / float(product.sales_qty)
                    
                    products.append({
                        'productName': product.description,
                        'stockCode': product.stock_code,
                        'departmentName': product.department_name,
                        'departmentCode': product.department_code,
                        'currentSOH': current_soh,
                        'dailyAvgSales': round(daily_avg_sales, 3),
                        'daysOfStock': round(days_of_stock, 1),
                        'totalSales12Months': float(product.sales_qty),
                        'totalValue12Months': float(product.sales_value),
                        'grossProfit12Months': float(product.gross_profit),
                        'costPerUnit': round(cost_per_unit, 2)
                    })
            
            # Sort by days of stock (highest first) to show overstocked items first
            products.sort(key=lambda x: x['daysOfStock'], reverse=True)
            
            return {'products': products}
            
        except Exception as e:
            print(f"❌ Error getting stock levels: {str(e)}")
            print(traceback.format_exc())
            return {'products': []} 