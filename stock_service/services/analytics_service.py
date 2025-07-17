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
    def get_reorder_recommendations(pharmacy_id, analysis_days=30):
        """Get reorder recommendations based on sales history"""
        try:
            end_date = date.today()
            start_date = end_date - timedelta(days=analysis_days)
            
            # Get products with sales in the analysis period
            recent_sales = db.session.query(
                Product.id,
                Product.stock_code,
                Product.description,
                Department.department_name,
                func.avg(DailySales.sales_qty).label('avg_daily_sales'),
                func.max(DailySales.on_hand).label('current_stock'),
                func.count(DailySales.id).label('sales_days')
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
                Product.id, Product.stock_code, Product.description, Department.department_name
            ).having(func.count(DailySales.id) >= 3).all()  # At least 3 days of sales
            
            recommendations = []
            for product in recent_sales:
                avg_daily_sales = float(product.avg_daily_sales or 0)
                current_stock = float(product.current_stock or 0)
                sales_frequency = product.sales_days / analysis_days
                
                # Calculate days of inventory remaining
                days_remaining = current_stock / avg_daily_sales if avg_daily_sales > 0 else float('inf')
                
                # Recommend reorder if less than 14 days remaining and regular sales
                if days_remaining < 14 and sales_frequency > 0.1:  # Sales on at least 10% of days
                    # Suggest order quantity for 30 days
                    suggested_order_qty = avg_daily_sales * 30 - current_stock
                    
                    if suggested_order_qty > 0:
                        recommendations.append({
                            'productName': product.description,
                            'stockCode': product.stock_code,
                            'departmentName': product.department_name,
                            'currentStock': current_stock,
                            'avgDailySales': avg_daily_sales,
                            'daysRemaining': min(days_remaining, 999),
                            'suggestedOrderQty': max(suggested_order_qty, avg_daily_sales * 7),  # At least 1 week
                            'salesFrequency': sales_frequency,
                            'priority': 'HIGH' if days_remaining < 7 else 'MEDIUM'
                        })
            
            # Sort by urgency (days remaining)
            recommendations.sort(key=lambda x: x['daysRemaining'])
            
            return {'recommendations': recommendations[:50]}  # Limit to top 50
            
        except Exception as e:
            print(f"❌ Error getting reorder recommendations: {str(e)}")
            print(traceback.format_exc())
            return {'recommendations': []} 

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
    def get_low_gp_products(pharmacy_id, target_date, gp_threshold=20):
        """Get products sold with gross profit percentage below threshold"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Normalize pharmacy_id to uppercase for consistency
            pharmacy_id = pharmacy_id.upper()
            
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
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == target_date,
                    DailySales.sales_qty > 0,  # Only products that were sold
                    DailySales.gross_profit_percent < gp_threshold,
                    DailySales.gross_profit_percent > 0  # Exclude zero or negative GP
                )
            ).order_by(DailySales.gross_profit_percent.asc()).all()
            
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