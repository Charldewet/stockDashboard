from models import db, Product, DailySales, SalesHistory, Department
from sqlalchemy import func, desc, and_, or_, case
from datetime import datetime, date, timedelta
import traceback
import statistics

class SmartAlertsService:
    
    @staticmethod
    def get_high_volume_low_margin_alerts(pharmacy_id, target_date, limit=10):
        """Get top-selling items with GP below pharmacy average"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            pharmacy_id = pharmacy_id.upper()
            
            # First, calculate the pharmacy's average GP% for the target date
            avg_gp_query = db.session.query(
                func.avg(DailySales.gross_profit_percent).label('avg_gp')
            ).join(Product).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == target_date,
                    DailySales.sales_qty > 0,
                    DailySales.gross_profit_percent > 0
                )
            ).first()
            
            pharmacy_avg_gp = float(avg_gp_query.avg_gp or 25) if avg_gp_query else 25
            
            # Get top-selling products with GP below average
            high_volume_low_margin = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                DailySales.sales_qty,
                DailySales.sales_value,
                DailySales.sales_cost,
                DailySales.gross_profit,
                DailySales.gross_profit_percent
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == target_date,
                    DailySales.sales_qty > 0,
                    DailySales.gross_profit_percent < pharmacy_avg_gp,
                    DailySales.gross_profit_percent > 0,
                    DailySales.sales_cost > 0,  # Ensure we have cost data for pricing calculations
                    ~Product.department_code.like('PDST%')  # Exclude PDST department items
                )
            ).order_by(desc(DailySales.sales_value)).limit(limit).all()
            
            alerts = []
            for product in high_volume_low_margin:
                # Calculate pricing details
                current_price = float(product.sales_value) / float(product.sales_qty)
                cost_per_unit = float(product.sales_cost) / float(product.sales_qty)
                
                # Calculate suggested price to achieve pharmacy average GP%
                suggested_price = cost_per_unit / (1 - pharmacy_avg_gp / 100)
                
                # Calculate additional revenue from price increase
                price_increase = suggested_price - current_price
                additional_revenue = price_increase * float(product.sales_qty)
                
                potential_profit_loss = float(product.sales_value) * (pharmacy_avg_gp - float(product.gross_profit_percent)) / 100
                
                alerts.append({
                    'type': 'high_volume_low_margin',
                    'severity': 'high' if potential_profit_loss > 100 else 'medium',
                    'stockCode': product.stock_code,
                    'productName': product.description,
                    'departmentName': product.department_name,
                    'salesValue': float(product.sales_value),
                    'salesQty': float(product.sales_qty),
                    'currentGP': float(product.gross_profit_percent),
                    'pharmacyAvgGP': pharmacy_avg_gp,
                    'currentPrice': current_price,
                    'suggestedPrice': suggested_price,
                    'additionalRevenue': additional_revenue,
                    'potentialProfitLoss': potential_profit_loss,
                    'message': f"High-volume product with {product.gross_profit_percent:.1f}% GP (pharmacy avg: {pharmacy_avg_gp:.1f}%)",
                    'recommendation': f"Increase price from R{current_price:.2f} to R{suggested_price:.2f} (+R{additional_revenue:.2f} revenue)"
                })
            
            return {
                'alerts': alerts,
                'pharmacyAvgGP': pharmacy_avg_gp,
                'totalAlerts': len(alerts)
            }
            
        except Exception as e:
            print(f"❌ Error in high_volume_low_margin_alerts: {str(e)}")
            return {'alerts': [], 'pharmacyAvgGP': 0, 'totalAlerts': 0}
    
    @staticmethod
    def get_department_gp_decline_alerts(pharmacy_id, target_date, limit=10):
        """Get departments with week-over-week GP% drops"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            pharmacy_id = pharmacy_id.upper()
            
            # Calculate date ranges
            current_week_start = target_date - timedelta(days=6)  # 7 days including target
            previous_week_start = current_week_start - timedelta(days=7)
            previous_week_end = current_week_start - timedelta(days=1)
            
            # Main department case for rolling up sub-departments
            main_dept_case = case(
                (func.length(Department.department_code) > 4, func.substr(Department.department_code, 1, 4)),
                else_=Department.department_code
            )
            
            # Get current week GP% by department
            current_week_gp = db.session.query(
                main_dept_case.label('dept_code'),
                (func.sum(DailySales.gross_profit) / func.sum(DailySales.sales_value) * 100).label('gp_percent'),
                func.sum(DailySales.sales_value).label('sales_value')
            ).select_from(DailySales).join(
                Product, DailySales.product_id == Product.id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date >= current_week_start,
                    DailySales.sale_date <= target_date,
                    DailySales.sales_qty > 0
                )
            ).group_by(main_dept_case).all()
            
            # Get previous week GP% by department
            previous_week_gp = db.session.query(
                main_dept_case.label('dept_code'),
                (func.sum(DailySales.gross_profit) / func.sum(DailySales.sales_value) * 100).label('gp_percent'),
                func.sum(DailySales.sales_value).label('sales_value')
            ).select_from(DailySales).join(
                Product, DailySales.product_id == Product.id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date >= previous_week_start,
                    DailySales.sale_date <= previous_week_end,
                    DailySales.sales_qty > 0
                )
            ).group_by(main_dept_case).all()
            
            # Convert to dictionaries for easier lookup
            current_gp_dict = {row.dept_code: {'gp': float(row.gp_percent or 0), 'sales': float(row.sales_value or 0)} for row in current_week_gp}
            previous_gp_dict = {row.dept_code: {'gp': float(row.gp_percent or 0), 'sales': float(row.sales_value or 0)} for row in previous_week_gp}
            
            # Get department names
            dept_codes = list(set(current_gp_dict.keys()) | set(previous_gp_dict.keys()))
            dept_names = {}
            
            if dept_codes:
                main_depts = db.session.query(Department).filter(
                    Department.department_code.in_(dept_codes)
                ).all()
                dept_names = {dept.department_code: dept.department_name for dept in main_depts}
                
                # Fill in missing names from sub-departments
                missing_codes = set(dept_codes) - set(dept_names.keys())
                for missing_code in missing_codes:
                    sub_dept = db.session.query(Department).filter(
                        Department.department_code.like(f"{missing_code}%")
                    ).first()
                    if sub_dept:
                        dept_names[missing_code] = sub_dept.department_name
                    else:
                        dept_names[missing_code] = missing_code
            
            alerts = []
            for dept_code in dept_codes:
                current_data = current_gp_dict.get(dept_code, {'gp': 0, 'sales': 0})
                previous_data = previous_gp_dict.get(dept_code, {'gp': 0, 'sales': 0})
                
                # Only alert if we have data for both weeks and sales > 1000
                if (current_data['gp'] > 0 and previous_data['gp'] > 0 and 
                    current_data['sales'] > 1000 and previous_data['sales'] > 1000):
                    
                    gp_decline = previous_data['gp'] - current_data['gp']
                    decline_percent = (gp_decline / previous_data['gp']) * 100
                    
                    # Alert if GP declined by more than 2% or 10% relative decline
                    if gp_decline > 2 or decline_percent > 10:
                        estimated_profit_loss = (gp_decline / 100) * current_data['sales']
                        
                        alerts.append({
                            'type': 'department_gp_decline',
                            'severity': 'critical' if gp_decline > 5 else 'high' if gp_decline > 3 else 'medium',
                            'departmentCode': dept_code,
                            'departmentName': dept_names.get(dept_code, dept_code),
                            'currentWeekGP': current_data['gp'],
                            'previousWeekGP': previous_data['gp'],
                            'gpDecline': gp_decline,
                            'declinePercent': decline_percent,
                            'currentWeekSales': current_data['sales'],
                            'estimatedProfitLoss': estimated_profit_loss,
                            'message': f"GP declined by {gp_decline:.1f}% ({decline_percent:.1f}% relative)",
                            'recommendation': "Review pricing strategy and supplier costs for this department"
                        })
            
            # Sort by GP decline magnitude
            alerts.sort(key=lambda x: x['gpDecline'], reverse=True)
            
            return {
                'alerts': alerts[:limit],
                'totalAlerts': len(alerts),
                'analysisWeeks': f"{previous_week_start.strftime('%m/%d')} - {target_date.strftime('%m/%d')}"
            }
            
        except Exception as e:
            print(f"❌ Error in department_gp_decline_alerts: {str(e)}")
            return {'alerts': [], 'totalAlerts': 0}
    
    @staticmethod
    def get_overstock_warnings(pharmacy_id, target_date, threshold_days=60, limit=20):
        """Get items with >60 days of inventory based on current velocity"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            pharmacy_id = pharmacy_id.upper()
            
            # Calculate 30-day average sales velocity
            velocity_start = target_date - timedelta(days=29)  # 30 days including target
            
            velocity_data = db.session.query(
                Product.id,
                Product.stock_code,
                Product.description,
                Department.department_name,
                DailySales.on_hand,
                func.avg(DailySales.sales_qty).label('avg_daily_sales'),
                func.sum(DailySales.sales_value).label('total_sales_value'),
                func.count(DailySales.id).label('sales_days')
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date >= velocity_start,
                    DailySales.sale_date <= target_date
                )
            ).group_by(
                Product.id, Product.stock_code, Product.description, 
                Department.department_name, DailySales.on_hand
            ).having(func.avg(DailySales.sales_qty) > 0).all()
            
            alerts = []
            for item in velocity_data:
                avg_daily_sales = float(item.avg_daily_sales or 0)
                current_stock = float(item.on_hand or 0)
                total_value = float(item.total_sales_value or 0)
                
                if avg_daily_sales > 0 and current_stock > 0:
                    days_of_inventory = current_stock / avg_daily_sales
                    
                    if days_of_inventory > threshold_days:
                        # Estimate stock value (rough calculation)
                        avg_cost_ratio = 0.7  # Assume 30% average margin
                        estimated_stock_value = (total_value / 30) * avg_cost_ratio * days_of_inventory
                        
                        excess_days = days_of_inventory - threshold_days
                        excess_stock = avg_daily_sales * excess_days
                        estimated_excess_value = estimated_stock_value * (excess_days / days_of_inventory)
                        
                        alerts.append({
                            'type': 'overstock_warning',
                            'severity': 'critical' if days_of_inventory > 120 else 'high' if days_of_inventory > 90 else 'medium',
                            'stockCode': item.stock_code,
                            'productName': item.description,
                            'departmentName': item.department_name,
                            'currentStock': current_stock,
                            'avgDailySales': avg_daily_sales,
                            'daysOfInventory': days_of_inventory,
                            'excessDays': excess_days,
                            'excessStock': excess_stock,
                            'estimatedStockValue': estimated_stock_value,
                            'estimatedExcessValue': estimated_excess_value,
                            'message': f"{days_of_inventory:.0f} days of inventory (threshold: {threshold_days} days)",
                            'recommendation': f"Consider reducing stock by {excess_stock:.0f} units to optimize cash flow"
                        })
            
            # Sort by excess value (highest first)
            alerts.sort(key=lambda x: x['estimatedExcessValue'], reverse=True)
            
            return {
                'alerts': alerts[:limit],
                'totalAlerts': len(alerts),
                'totalExcessValue': sum(alert['estimatedExcessValue'] for alert in alerts[:limit])
            }
            
        except Exception as e:
            print(f"❌ Error in overstock_warnings: {str(e)}")
            return {'alerts': [], 'totalAlerts': 0}
    
    @staticmethod
    def get_supplier_performance_alerts(pharmacy_id, target_date, limit=10):
        """Get departments consistently underperforming (could indicate supply issues)"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            pharmacy_id = pharmacy_id.upper()
            
            # Analyze last 14 days of performance
            analysis_start = target_date - timedelta(days=13)  # 14 days including target
            
            main_dept_case = case(
                (func.length(Department.department_code) > 4, func.substr(Department.department_code, 1, 4)),
                else_=Department.department_code
            )
            
            # Get department performance metrics
            dept_performance = db.session.query(
                main_dept_case.label('dept_code'),
                func.avg(DailySales.sales_value).label('avg_daily_sales'),
                func.avg(DailySales.gross_profit_percent).label('avg_gp_percent'),
                func.count(func.distinct(DailySales.sale_date)).label('trading_days'),
                func.count(DailySales.id).label('total_transactions'),
                func.sum(DailySales.sales_value).label('total_sales')
            ).select_from(DailySales).join(
                Product, DailySales.product_id == Product.id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date >= analysis_start,
                    DailySales.sale_date <= target_date,
                    DailySales.sales_qty > 0
                )
            ).group_by(main_dept_case).all()
            
            # Get department names
            dept_codes = [row.dept_code for row in dept_performance]
            dept_names = {}
            
            if dept_codes:
                main_depts = db.session.query(Department).filter(
                    Department.department_code.in_(dept_codes)
                ).all()
                dept_names = {dept.department_code: dept.department_name for dept in main_depts}
                
                missing_codes = set(dept_codes) - set(dept_names.keys())
                for missing_code in missing_codes:
                    sub_dept = db.session.query(Department).filter(
                        Department.department_code.like(f"{missing_code}%")
                    ).first()
                    if sub_dept:
                        dept_names[missing_code] = sub_dept.department_name
                    else:
                        dept_names[missing_code] = missing_code
            
            # Calculate benchmarks (median values)
            if dept_performance:
                avg_sales_values = [float(row.avg_daily_sales or 0) for row in dept_performance if row.avg_daily_sales]
                avg_gp_values = [float(row.avg_gp_percent or 0) for row in dept_performance if row.avg_gp_percent]
                
                median_daily_sales = statistics.median(avg_sales_values) if avg_sales_values else 0
                median_gp = statistics.median(avg_gp_values) if avg_gp_values else 0
                
                alerts = []
                for dept in dept_performance:
                    avg_daily_sales = float(dept.avg_daily_sales or 0)
                    avg_gp = float(dept.avg_gp_percent or 0)
                    trading_days = int(dept.trading_days or 0)
                    total_sales = float(dept.total_sales or 0)
                    
                    # Flag departments that are significantly below median performance
                    sales_underperformance = (median_daily_sales - avg_daily_sales) / median_daily_sales * 100 if median_daily_sales > 0 else 0
                    gp_underperformance = (median_gp - avg_gp) / median_gp * 100 if median_gp > 0 else 0
                    
                    # Alert conditions: significantly below median in sales or GP, or limited trading days
                    if (sales_underperformance > 30 or gp_underperformance > 20 or 
                        trading_days < 10 and total_sales > 1000):  # Less than 10 trading days out of 14
                        
                        primary_issue = "Low sales volume" if sales_underperformance > gp_underperformance else "Low profit margins"
                        if trading_days < 10:
                            primary_issue = "Inconsistent supply/availability"
                        
                        alerts.append({
                            'type': 'supplier_performance',
                            'severity': 'high' if trading_days < 8 else 'medium',
                            'departmentCode': dept.dept_code,
                            'departmentName': dept_names.get(dept.dept_code, dept.dept_code),
                            'avgDailySales': avg_daily_sales,
                            'medianDailySales': median_daily_sales,
                            'salesUnderperformance': sales_underperformance,
                            'avgGP': avg_gp,
                            'medianGP': median_gp,
                            'gpUnderperformance': gp_underperformance,
                            'tradingDays': trading_days,
                            'totalSales': total_sales,
                            'primaryIssue': primary_issue,
                            'message': f"{primary_issue} - {sales_underperformance:.0f}% below median sales",
                            'recommendation': "Review supplier relationships and product availability"
                        })
                
                # Sort by overall underperformance (combination of sales and GP issues)
                alerts.sort(key=lambda x: x['salesUnderperformance'] + x['gpUnderperformance'], reverse=True)
                
                return {
                    'alerts': alerts[:limit],
                    'totalAlerts': len(alerts),
                    'benchmarks': {
                        'medianDailySales': median_daily_sales,
                        'medianGP': median_gp
                    }
                }
            
            return {'alerts': [], 'totalAlerts': 0}
            
        except Exception as e:
            print(f"❌ Error in supplier_performance_alerts: {str(e)}")
            return {'alerts': [], 'totalAlerts': 0}
    
    @staticmethod
    def get_price_point_analysis_alerts(pharmacy_id, target_date, limit=15):
        """Get items where small price changes could significantly impact volume"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            pharmacy_id = pharmacy_id.upper()
            
            # Analyze last 30 days to understand price elasticity patterns
            analysis_start = target_date - timedelta(days=29)
            
            # Get products with consistent sales and varying daily volumes
            price_analysis = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                func.avg(DailySales.sales_value / DailySales.sales_qty).label('avg_unit_price'),
                func.avg(DailySales.sales_qty).label('avg_daily_qty'),
                func.stddev(DailySales.sales_qty).label('qty_volatility'),
                func.sum(DailySales.sales_value).label('total_revenue'),
                func.avg(DailySales.gross_profit_percent).label('avg_gp_percent'),
                func.count(DailySales.id).label('sales_days')
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date >= analysis_start,
                    DailySales.sale_date <= target_date,
                    DailySales.sales_qty > 0,
                    DailySales.sales_value > 0
                )
            ).group_by(
                Product.stock_code, Product.description, Department.department_name
            ).having(
                func.count(DailySales.id) >= 10  # At least 10 days of sales
            ).all()
            
            alerts = []
            for product in price_analysis:
                avg_unit_price = float(product.avg_unit_price or 0)
                avg_daily_qty = float(product.avg_daily_qty or 0)
                qty_volatility = float(product.qty_volatility or 0)
                total_revenue = float(product.total_revenue or 0)
                avg_gp = float(product.avg_gp_percent or 0)
                sales_days = int(product.sales_days or 0)
                
                if avg_unit_price > 0 and avg_daily_qty > 0:
                    # Calculate coefficient of variation for quantity (volatility indicator)
                    cv_qty = (qty_volatility / avg_daily_qty) if avg_daily_qty > 0 else 0
                    
                    # High volatility + decent volume = price sensitive
                    # Focus on products with good revenue potential
                    if cv_qty > 0.5 and total_revenue > 5000 and avg_daily_qty > 2:
                        
                        # Estimate impact of 5% price reduction
                        price_reduction = 0.05
                        new_price = avg_unit_price * (1 - price_reduction)
                        
                        # Assume elasticity based on volatility (higher volatility = more elastic)
                        # This is a simplified model - in reality, you'd want historical price change data
                        estimated_elasticity = min(cv_qty * 2, 3)  # Cap at 3x elasticity
                        estimated_qty_increase = avg_daily_qty * price_reduction * estimated_elasticity
                        
                        new_daily_revenue = new_price * (avg_daily_qty + estimated_qty_increase)
                        current_daily_revenue = avg_unit_price * avg_daily_qty
                        revenue_impact = new_daily_revenue - current_daily_revenue
                        
                        # Monthly revenue impact
                        monthly_impact = revenue_impact * 30
                        
                        # Only alert if potentially significant impact
                        if abs(monthly_impact) > 500:  # R500+ monthly impact
                            
                            opportunity_type = "Revenue increase" if monthly_impact > 0 else "Revenue risk"
                            severity = "high" if abs(monthly_impact) > 2000 else "medium"
                            
                            alerts.append({
                                'type': 'price_point_analysis',
                                'severity': severity,
                                'stockCode': product.stock_code,
                                'productName': product.description,
                                'departmentName': product.department_name,
                                'currentPrice': avg_unit_price,
                                'avgDailyQty': avg_daily_qty,
                                'qtyVolatility': cv_qty,
                                'totalRevenue': total_revenue,
                                'avgGP': avg_gp,
                                'estimatedMonthlyImpact': monthly_impact,
                                'suggestedPriceChange': -5 if monthly_impact > 0 else 5,  # Suggest opposite of test
                                'opportunityType': opportunity_type,
                                'message': f"Price-sensitive product: {opportunity_type.lower()} potential of {abs(monthly_impact):.0f}/month",
                                'recommendation': f"Test {'reducing' if monthly_impact > 0 else 'increasing'} price by 5% to optimize revenue"
                            })
            
            # Sort by potential impact
            alerts.sort(key=lambda x: abs(x['estimatedMonthlyImpact']), reverse=True)
            
            return {
                'alerts': alerts[:limit],
                'totalAlerts': len(alerts),
                'totalOpportunity': sum(alert['estimatedMonthlyImpact'] for alert in alerts[:limit] if alert['estimatedMonthlyImpact'] > 0)
            }
            
        except Exception as e:
            print(f"❌ Error in price_point_analysis_alerts: {str(e)}")
            return {'alerts': [], 'totalAlerts': 0}
    
    @staticmethod
    def get_weekday_pattern_alerts(pharmacy_id, target_date, limit=15):
        """Get products with unusual day-of-week performance patterns"""
        try:
            if isinstance(target_date, str):
                target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            pharmacy_id = pharmacy_id.upper()
            
            # Analyze last 4 weeks (28 days) to get good weekday patterns
            analysis_start = target_date - timedelta(days=27)  # 28 days including target
            
            # Get sales by product and day of week
            from sqlalchemy import extract
            
            weekday_sales = db.session.query(
                Product.stock_code,
                Product.description,
                Department.department_name,
                extract('dow', DailySales.sale_date).label('day_of_week'),  # 0=Sunday, 6=Saturday
                func.avg(DailySales.sales_qty).label('avg_qty'),
                func.avg(DailySales.sales_value).label('avg_value'),
                func.count(DailySales.id).label('sale_days')
            ).select_from(Product).join(
                DailySales, Product.id == DailySales.product_id
            ).join(
                Department, Product.department_code == Department.department_code
            ).filter(
                and_(
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date >= analysis_start,
                    DailySales.sale_date <= target_date,
                    DailySales.sales_qty > 0
                )
            ).group_by(
                Product.stock_code, Product.description, Department.department_name,
                extract('dow', DailySales.sale_date)
            ).having(func.count(DailySales.id) >= 2).all()  # At least 2 occurrences of this weekday
            
            # Group by product to analyze patterns
            product_patterns = {}
            for row in weekday_sales:
                key = (row.stock_code, row.description, row.department_name)
                if key not in product_patterns:
                    product_patterns[key] = {}
                
                day_name = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][int(row.day_of_week)]
                product_patterns[key][day_name] = {
                    'avg_qty': float(row.avg_qty or 0),
                    'avg_value': float(row.avg_value or 0),
                    'sale_days': int(row.sale_days or 0)
                }
            
            alerts = []
            day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            
            for (stock_code, description, dept_name), daily_data in product_patterns.items():
                if len(daily_data) >= 5:  # Need data for at least 5 different days
                    
                    # Calculate weekday vs weekend patterns
                    weekday_qtys = []
                    weekend_qtys = []
                    all_qtys = []
                    
                    for day, data in daily_data.items():
                        qty = data['avg_qty']
                        all_qtys.append(qty)
                        
                        if day in ['Saturday', 'Sunday']:
                            weekend_qtys.append(qty)
                        else:
                            weekday_qtys.append(qty)
                    
                    if len(all_qtys) >= 5 and sum(all_qtys) > 10:  # Minimum volume threshold
                        avg_weekday = statistics.mean(weekday_qtys) if weekday_qtys else 0
                        avg_weekend = statistics.mean(weekend_qtys) if weekend_qtys else 0
                        overall_avg = statistics.mean(all_qtys)
                        
                        # Find the most and least performing days
                        sorted_days = sorted(daily_data.items(), key=lambda x: x[1]['avg_qty'], reverse=True)
                        best_day = sorted_days[0]
                        worst_day = sorted_days[-1]
                        
                        best_qty = best_day[1]['avg_qty']
                        worst_qty = worst_day[1]['avg_qty']
                        
                        # Calculate pattern strength
                        pattern_ratio = best_qty / worst_qty if worst_qty > 0 else float('inf')
                        
                        # Alert if significant pattern (3x difference or strong weekend/weekday split)
                        weekend_weekday_ratio = avg_weekend / avg_weekday if avg_weekday > 0 else 0
                        
                        alert_worthy = False
                        pattern_type = ""
                        severity = "low"
                        
                        if pattern_ratio > 3:
                            alert_worthy = True
                            pattern_type = f"Strong {best_day[0]} preference"
                            severity = "medium" if pattern_ratio > 5 else "low"
                        
                        elif weekend_weekday_ratio > 2:
                            alert_worthy = True
                            pattern_type = "Strong weekend preference"
                            severity = "medium"
                        
                        elif weekend_weekday_ratio < 0.5 and avg_weekday > 0:
                            alert_worthy = True
                            pattern_type = "Strong weekday preference"
                            severity = "medium"
                        
                        if alert_worthy:
                            # Calculate opportunity
                            total_weekly_potential = best_qty * 7  # If every day was like best day
                            current_weekly_avg = overall_avg * 7
                            weekly_opportunity = total_weekly_potential - current_weekly_avg
                            
                            alerts.append({
                                'type': 'weekday_pattern',
                                'severity': severity,
                                'stockCode': stock_code,
                                'productName': description,
                                'departmentName': dept_name,
                                'patternType': pattern_type,
                                'bestDay': best_day[0],
                                'bestDayQty': best_qty,
                                'worstDay': worst_day[0],
                                'worstDayQty': worst_qty,
                                'patternRatio': pattern_ratio,
                                'avgWeekday': avg_weekday,
                                'avgWeekend': avg_weekend,
                                'weekendWeekdayRatio': weekend_weekday_ratio,
                                'weeklyOpportunity': weekly_opportunity,
                                'dailyPattern': {day: data['avg_qty'] for day, data in daily_data.items()},
                                'message': f"{pattern_type}: {best_qty:.1f} units on {best_day[0]} vs {worst_qty:.1f} on {worst_day[0]}",
                                'recommendation': f"Optimize inventory and promotions for {best_day[0]} demand patterns"
                            })
            
            # Sort by pattern strength (ratio)
            alerts.sort(key=lambda x: x['patternRatio'], reverse=True)
            
            return {
                'alerts': alerts[:limit],
                'totalAlerts': len(alerts),
                'analysisWeeks': 4
            }
            
        except Exception as e:
            print(f"❌ Error in weekday_pattern_alerts: {str(e)}")
            return {'alerts': [], 'totalAlerts': 0}
    
    @staticmethod
    def get_all_smart_alerts(pharmacy_id, target_date):
        """Get all smart alerts in one consolidated response"""
        try:
            alerts_data = {
                'highVolumeLowMargin': SmartAlertsService.get_high_volume_low_margin_alerts(pharmacy_id, target_date, 5),
                'departmentGPDecline': SmartAlertsService.get_department_gp_decline_alerts(pharmacy_id, target_date, 5),
                'overstockWarnings': SmartAlertsService.get_overstock_warnings(pharmacy_id, target_date, 60, 10),
                'supplierPerformance': SmartAlertsService.get_supplier_performance_alerts(pharmacy_id, target_date, 5),
                'pricePointAnalysis': SmartAlertsService.get_price_point_analysis_alerts(pharmacy_id, target_date, 8),
                'weekdayPatterns': SmartAlertsService.get_weekday_pattern_alerts(pharmacy_id, target_date, 8)
            }
            
            # Count totals
            total_alerts = sum(data.get('totalAlerts', 0) for data in alerts_data.values())
            
            # Get high priority alerts for summary
            high_priority = []
            for category, data in alerts_data.items():
                for alert in data.get('alerts', []):
                    if alert.get('severity') in ['critical', 'high']:
                        high_priority.append({**alert, 'category': category})
            
            return {
                'summary': {
                    'totalAlerts': total_alerts,
                    'highPriorityAlerts': len(high_priority),
                    'analysisDate': target_date.isoformat() if isinstance(target_date, date) else target_date
                },
                'alerts': alerts_data,
                'highPriorityAlerts': sorted(high_priority, key=lambda x: {'critical': 3, 'high': 2, 'medium': 1, 'low': 0}.get(x['severity'], 0), reverse=True)[:10]
            }
            
        except Exception as e:
            print(f"❌ Error in get_all_smart_alerts: {str(e)}")
            return {'summary': {'totalAlerts': 0, 'highPriorityAlerts': 0}, 'alerts': {}} 