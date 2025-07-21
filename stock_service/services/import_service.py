import re
from models import db, Department, Product, SalesHistory, DailySales
from datetime import datetime, date
import os
import traceback
from sqlalchemy import text

# Optional imports for enhanced functionality
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    print("⚠️ pandas not available - using simple CSV parser")

try:
    import fitz  # PyMuPDF for PDF processing
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    print("⚠️ PyMuPDF not available - PDF processing disabled")

# Import simple CSV parser as fallback
from .csv_parser import SimpleCSVParser

class ImportService:
    
    @staticmethod
    def extract_sales_from_pdf(pdf_file_path):
        """Extract sales data from PDF file using the extraction logic - RE-ENABLED"""
        if not PYMUPDF_AVAILABLE:
            return {
                'error': 'PDF processing not available. PyMuPDF not installed.',
                'success': False
            }
        
        try:
            print(f"📂 Starting PDF extraction from {pdf_file_path}")
            
            # Use your exact PDF extraction code
            doc = fitz.open(pdf_file_path)

            # Clean raw lines by removing headers, footers, and subtotal blocks
            cleaned_lines = []
            header_keywords = [
                "REITZ APTEEK", "PAGE:", "CODE", "DESCRIPTION", "ON HAND", 
                "SALES", "COST", "GROSS", "TURNOVER", "GP%", "QTY", "VALUE"
            ]
            exclusion_keywords = ["MAIN-DEPT", "SUB-DEPT", "TOTAL", "-------"]

            for page in doc:
                lines = page.get_text().split("\n")
                for line in lines:
                    if any(keyword in line for keyword in header_keywords):
                        continue
                    if any(keyword in line for keyword in exclusion_keywords):
                        continue
                    if set(line.strip()) <= {"-", " "}:
                        continue
                    cleaned_lines.append(line.strip())
            
            doc.close()

            # Define regex pattern to extract structured sales data (your exact pattern)
            pattern = re.compile(
                r"^([A-Z0-9]{6})\s+([A-Z0-9\-]{4,})\s+(.*?)\s+"
                r"(-?\d+\.\d{3})\s+(-?\d+\.\d{3})\s+(-?\d+\.\d{2})\s+"
                r"(-?\d+\.\d{2})\s+(-?\d+\.\d{2})\s+(-?\d+\.\d{3})\s+(-?\d+\.\d{3})$"
            )

            # Extract matched values (your exact logic)
            records = []
            for line in cleaned_lines:
                match = pattern.match(line)
                if match:
                    dept, stock_code, desc, on_hand, sales_qty, sales_val, sales_cost, gp_val, turnover_pct, gp_pct = match.groups()
                    records.append({
                        "DepartmentCode": dept.strip(),
                        "StockCode": stock_code.strip(),
                        "Description": desc.strip(),
                        "OnHand": float(on_hand),
                        "SalesQty": float(sales_qty),
                        "SalesValue": float(sales_val),
                        "SalesCost": float(sales_cost),
                        "GrossProfit": float(gp_val),
                        "TurnoverPercent": float(turnover_pct),
                        "GrossProfitPercent": float(gp_pct)
                    })

            # Convert to DataFrame for processing
            df = pd.DataFrame(records)
            print(f"✅ Extracted {len(df)} records from PDF")
            
            # Return consistent response structure
            return {
                'success': True,
                'sales_data': records,  # Return the raw records list
                'records_count': len(records),
                'message': f'Successfully extracted {len(records)} records from PDF'
            }
            
        except Exception as e:
            error_msg = f"❌ Error extracting PDF: {str(e)}"
            print(error_msg)
            print(traceback.format_exc())
            return {
                'success': False,
                'error': error_msg,
                'sales_data': []
            }
    
    @staticmethod
    def import_departments(csv_file_path, pharmacy_id='REITZ'):
        """Import departments from CSV file - OPTIMIZED with bulk operations"""
        try:
            print(f"📂 Starting department import from {csv_file_path}")
            
            # Read CSV file
            if PANDAS_AVAILABLE:
                df = pd.read_csv(csv_file_path)
                data = df.to_dict('records')
            else:
                data = SimpleCSVParser.read_csv(csv_file_path)
            print(f"📊 Found {len(data)} rows in department CSV")
            
            # Filter out invalid department codes (skip header-like rows)
            valid_departments = []
            for row in data:
                dept_code = str(row.get('DepartmentCode', '')).strip()
                dept_name = str(row.get('DepartmentName', '')).strip()
                
                # Skip invalid rows
                if (len(dept_code) == 6 and 
                    (dept_code.isdigit() or bool(re.match(r'^[A-Z0-9]{6}$', dept_code))) and
                    dept_name and
                    dept_name not in ['CODE', 'APTEEK', 'DEPT', 'MARKUP', 'ALLOC']):
                    valid_departments.append(row)
            
            print(f"✅ Found {len(valid_departments)} valid departments")
            
            # Prepare all departments for upsert operation - DEDUPLICATE FIRST
            departments_dict = {}  # Use dict to automatically handle duplicates
            
            for row in valid_departments:
                dept_code = str(row['DepartmentCode']).strip()
                dept_name = str(row['DepartmentName']).strip()
                
                # Keep the last occurrence of each department code
                departments_dict[dept_code] = dept_name
            
            departments_to_upsert = [
                {'department_code': code, 'department_name': name}
                for code, name in departments_dict.items()
            ]
            
            print(f"✅ After deduplication: {len(departments_to_upsert)} unique departments")
            
            # OPTIMIZATION: Bulk upsert all departments with conflict handling
            if departments_to_upsert:
                # Use PostgreSQL's ON CONFLICT for upsert operation
                values_list = []
                for dept in departments_to_upsert:
                    dept_code = dept['department_code'].replace("'", "''")  # Escape single quotes
                    dept_name = dept['department_name'].replace("'", "''")  # Escape single quotes
                    values_list.append(f"('{dept_code}', '{dept_name}')")
                
                insert_sql = f"""
                    INSERT INTO departments (department_code, department_name) 
                    VALUES {', '.join(values_list)}
                    ON CONFLICT (department_code) 
                    DO UPDATE SET department_name = EXCLUDED.department_name
                """
                db.session.execute(text(insert_sql))
            
            # Commit all changes at once
            db.session.commit()
            
            result = {
                'success': True,
                'message': f'Departments imported successfully',
                'total_processed': len(departments_to_upsert),
                'details': f'Processed {len(departments_to_upsert)} departments (inserted new or updated existing)'
            }
            
            print(f"✅ Department import completed: {result}")
            return result
            
        except Exception as e:
            db.session.rollback()
            error_msg = f"❌ Error importing departments: {str(e)}"
            print(error_msg)
            print(traceback.format_exc())
            return {'success': False, 'error': error_msg}
    
    @staticmethod
    def import_sales_history(csv_file_path, pharmacy_id='REITZ'):
        """Import sales history from CSV file (only items with movement > 0) - OPTIMIZED"""
        if not PANDAS_AVAILABLE:
            return {
                'success': False,
                'error': 'CSV processing not available. pandas not installed.'
            }
        
        try:
            print(f"📂 Starting sales history import from {csv_file_path}")
            
            # Read CSV file
            df = pd.read_csv(csv_file_path)
            print(f"📊 Found {len(df)} rows in sales history CSV")
            
            # Filter only items with movement > 0
            df_with_movement = df[df['QuantitySold'] > 0]
            print(f"✅ Found {len(df_with_movement)} items with sales movement")
            
            # OPTIMIZATION: Get existing products and departments in bulk
            stock_codes = df_with_movement['StockCode'].astype(str).str.strip().tolist()
            dept_codes = df_with_movement['DepartmentCode'].astype(str).str.strip().unique().tolist()
            
            existing_products = {
                product.stock_code: product 
                for product in Product.query.filter(
                    Product.stock_code.in_(stock_codes),
                    Product.pharmacy_id == pharmacy_id
                ).all()
            }
            
            existing_departments = {
                dept.department_code: dept 
                for dept in Department.query.filter(Department.department_code.in_(dept_codes)).all()
            }
            
            current_date = datetime.now()
            products_to_create = []
            departments_to_create = []
            history_to_create = []
            
            for _, row in df_with_movement.iterrows():
                dept_code = str(row['DepartmentCode']).strip()
                stock_code = str(row['StockCode']).strip()
                description = str(row['Description']).strip()
                quantity_sold = float(row['QuantitySold'])
                
                # Create department if needed
                if dept_code not in existing_departments:
                    departments_to_create.append({
                        'department_code': dept_code,
                        'department_name': f"Department {dept_code}"
                    })
                    existing_departments[dept_code] = True  # Mark as handled
                
                # Create product if needed
                if stock_code not in existing_products:
                    products_to_create.append({
                        'stock_code': stock_code,
                        'description': description,
                        'department_code': dept_code,
                        'pharmacy_id': pharmacy_id,
                        'first_seen_date': date.today()
                    })
            
            # OPTIMIZATION: Bulk insert departments and products
            if departments_to_create:
                db.session.execute(
                    text("INSERT INTO departments (department_code, department_name) VALUES " +
                         ", ".join([f"('{dept['department_code']}', '{dept['department_name']}')" 
                                   for dept in departments_to_create]))
                )
            
            if products_to_create:
                # Insert products in batches
                for i in range(0, len(products_to_create), 100):
                    batch = products_to_create[i:i+100]
                    db.session.bulk_insert_mappings(Product, batch)
            
            db.session.commit()
            
            # Now get the product IDs for history creation
            all_products = {
                product.stock_code: product.id 
                for product in Product.query.filter(
                    Product.stock_code.in_(stock_codes),
                    Product.pharmacy_id == pharmacy_id
                ).all()
            }
            
            # Prepare sales history
            for _, row in df_with_movement.iterrows():
                stock_code = str(row['StockCode']).strip()
                quantity_sold = float(row['QuantitySold'])
                
                if stock_code in all_products:
                    history_to_create.append({
                        'product_id': all_products[stock_code],
                        'year': current_date.year,
                        'month': current_date.month,
                        'total_quantity_sold': quantity_sold,
                        'avg_monthly_sales': quantity_sold
                    })
            
            # OPTIMIZATION: Bulk insert history records
            if history_to_create:
                for i in range(0, len(history_to_create), 100):
                    batch = history_to_create[i:i+100]
                    db.session.bulk_insert_mappings(SalesHistory, batch)
            
            db.session.commit()
            
            result = {
                'success': True,
                'message': f'Sales history imported successfully',
                'products_imported': len(products_to_create),
                'history_records': len(history_to_create),
                'total_with_movement': len(df_with_movement)
            }
            
            print(f"✅ Sales history import completed: {result}")
            return result
            
        except Exception as e:
            db.session.rollback()
            error_msg = f"❌ Error importing sales history: {str(e)}"
            print(error_msg)
            print(traceback.format_exc())
            return {'success': False, 'error': error_msg}
    
    @staticmethod
    def import_baseline(file_path, baseline_end_date, pharmacy_id='REITZ'):
        """Import 12-month baseline data from CSV or PDF file - replaces all existing baseline data"""
        try:
            print(f"📂 Starting 12-month baseline import from {file_path}")
            print(f"📅 Baseline end date: {baseline_end_date}")
            
            # Calculate 12-month window
            from datetime import datetime, timedelta
            end_date = datetime.strptime(baseline_end_date, '%Y-%m-%d').date()
            start_date = end_date.replace(year=end_date.year - 1) + timedelta(days=1)
            print(f"📊 12-month window: {start_date} to {end_date}")
            
            # Determine if PDF or CSV
            file_extension = os.path.splitext(file_path)[1].lower()
            
            if file_extension == '.pdf':
                # Extract from PDF
                extraction_result = ImportService.extract_sales_from_pdf(file_path)
                if not extraction_result.get('success', False):
                    return extraction_result
                
                # The PDF extraction returns a structured result
                sales_data = extraction_result.get('sales_data', [])
                print(f"📄 Extracted {len(sales_data)} records from PDF")
                
                if not sales_data:
                    return {'success': False, 'error': 'No sales data found in PDF'}
                
                # Convert to DataFrame for consistent processing
                df = pd.DataFrame(sales_data)
                
            else:
                # Process CSV file
                if not PANDAS_AVAILABLE:
                    return {
                        'success': False,
                        'error': 'CSV processing not available. pandas not installed.'
                    }
                
                df = pd.read_csv(file_path)
                print(f"📊 Found {len(df)} rows in baseline CSV")
            
            # Filter items with movement > 0 (handle both CSV and PDF field names)
            if 'QuantitySold' in df.columns:
                # CSV format
                df_with_movement = df[df['QuantitySold'] > 0]
                qty_field = 'QuantitySold'
                cost_field = 'CostOfSales'
            elif 'SalesQty' in df.columns:
                # PDF format
                df_with_movement = df[df['SalesQty'] > 0]
                qty_field = 'SalesQty'
                cost_field = 'SalesCost'
            else:
                # Fallback - use all data
                df_with_movement = df
                qty_field = 'QuantitySold'  # Default
                cost_field = 'CostOfSales'  # Default
                
            print(f"✅ Found {len(df_with_movement)} items with movement in baseline data")
            print(f"📊 Using fields: quantity='{qty_field}', cost='{cost_field}'")
            
            # STEP 1: Clear all existing baseline data (using special date marker)
            baseline_marker_date = '1900-01-01'  # Special date to mark baseline data
            
            # Get product IDs for this pharmacy (subquery approach to avoid join/delete issue)
            pharmacy_product_ids = db.session.query(Product.id).filter(
                Product.pharmacy_id == pharmacy_id
            ).subquery()
            
            # Count existing baseline records for this pharmacy
            deleted_count = DailySales.query.filter(
                DailySales.sale_date == baseline_marker_date,
                DailySales.product_id.in_(db.session.query(pharmacy_product_ids.c.id))
            ).count()
            
            # Delete existing baseline records for this pharmacy
            DailySales.query.filter(
                DailySales.sale_date == baseline_marker_date,
                DailySales.product_id.in_(db.session.query(pharmacy_product_ids.c.id))
            ).delete(synchronize_session=False)
            
            print(f"🗑️ Cleared {deleted_count} existing baseline records")
            
            # STEP 2: Process new baseline data (same logic as daily sales)
            stock_codes = df_with_movement['StockCode'].astype(str).str.strip().tolist()
            dept_codes = df_with_movement['DepartmentCode'].astype(str).str.strip().unique().tolist()
            
            # Get existing products and departments
            existing_products = {
                product.stock_code: product 
                for product in Product.query.filter(
                    Product.stock_code.in_(stock_codes),
                    Product.pharmacy_id == pharmacy_id
                ).all()
            }
            
            existing_departments = {
                dept.department_code: dept 
                for dept in Department.query.filter(Department.department_code.in_(dept_codes)).all()
            }
            
            products_to_create = []
            departments_to_create = []
            baseline_sales_to_create = []
            
            # Process each row
            for _, row in df_with_movement.iterrows():
                dept_code = str(row['DepartmentCode']).strip()
                stock_code = str(row['StockCode']).strip()
                description = str(row['Description']).strip()
                quantity_sold = float(row[qty_field]) if pd.notna(row[qty_field]) else 0
                sales_value = float(row['SalesValue']) if pd.notna(row['SalesValue']) else 0
                cost_of_sales = float(row[cost_field]) if pd.notna(row[cost_field]) else 0
                gross_profit = sales_value - cost_of_sales
                gross_profit_percent = (gross_profit / sales_value * 100) if sales_value > 0 else 0
                on_hand = float(row['OnHand']) if pd.notna(row['OnHand']) else 0
                
                # Create department if needed
                if dept_code not in existing_departments:
                    departments_to_create.append({
                        'department_code': dept_code,
                        'department_name': f"Department {dept_code}"
                    })
                    existing_departments[dept_code] = True
                
                # Create product if needed
                if stock_code not in existing_products:
                    products_to_create.append({
                        'stock_code': stock_code,
                        'description': description,
                        'department_code': dept_code,
                        'pharmacy_id': pharmacy_id,
                        'first_seen_date': end_date
                    })
            
            # Bulk insert departments and products
            if departments_to_create:
                db.session.execute(
                    text("INSERT INTO departments (department_code, department_name) VALUES " +
                         ", ".join([f"('{dept['department_code']}', '{dept['department_name']}')" 
                                   for dept in departments_to_create]))
                )
            
            if products_to_create:
                for i in range(0, len(products_to_create), 100):
                    batch = products_to_create[i:i+100]
                    db.session.bulk_insert_mappings(Product, batch)
            
            db.session.commit()
            
            # Get all product IDs for baseline sales creation
            all_products = {
                product.stock_code: product.id 
                for product in Product.query.filter(
                    Product.stock_code.in_(stock_codes),
                    Product.pharmacy_id == pharmacy_id
                ).all()
            }
            
            # Create baseline sales records with special date marker
            for _, row in df_with_movement.iterrows():
                stock_code = str(row['StockCode']).strip()
                quantity_sold = float(row[qty_field]) if pd.notna(row[qty_field]) else 0
                sales_value = float(row['SalesValue']) if pd.notna(row['SalesValue']) else 0
                cost_of_sales = float(row[cost_field]) if pd.notna(row[cost_field]) else 0
                gross_profit = sales_value - cost_of_sales
                gross_profit_percent = (gross_profit / sales_value * 100) if sales_value > 0 else 0
                on_hand = float(row['OnHand']) if pd.notna(row['OnHand']) else 0
                
                if stock_code in all_products and quantity_sold > 0:
                    baseline_sales_to_create.append({
                        'product_id': all_products[stock_code],
                        'sale_date': baseline_marker_date,  # Special marker for baseline data
                        'sales_qty': quantity_sold,
                        'sales_value': sales_value,
                        'cost_of_sales': cost_of_sales,
                        'gross_profit': gross_profit,
                        'gross_profit_percent': gross_profit_percent,
                        'on_hand': on_hand
                    })
            
            # Bulk insert baseline sales records
            if baseline_sales_to_create:
                for i in range(0, len(baseline_sales_to_create), 100):
                    batch = baseline_sales_to_create[i:i+100]
                    db.session.bulk_insert_mappings(DailySales, batch)
            
            db.session.commit()
            
            result = {
                'success': True,
                'message': f'12-month baseline imported successfully for period {start_date} to {end_date}',
                'baseline_period': f'{start_date} to {end_date}',
                'products_created': len(products_to_create),
                'departments_created': len(departments_to_create),
                'baseline_records': len(baseline_sales_to_create),
                'previous_baseline_cleared': deleted_count
            }
            
            print(f"✅ Baseline import completed: {result}")
            return result
            
        except Exception as e:
            db.session.rollback()
            error_msg = f"❌ Error importing baseline data: {str(e)}"
            print(error_msg)
            print(traceback.format_exc())
            return {'success': False, 'error': error_msg}
    
    @staticmethod
    def import_daily_sales(file_path, sale_date=None, pharmacy_id='REITZ'):
        """Import daily sales from CSV or PDF file - OPTIMIZED with batch processing"""
        if not PANDAS_AVAILABLE:
            return {
                'success': False,
                'error': 'CSV processing not available. pandas not installed.'
            }
        
        try:
            print(f"📂 Starting daily sales import from {file_path}")
            
            if sale_date is None:
                sale_date = date.today()
            elif isinstance(sale_date, str):
                sale_date = datetime.strptime(sale_date, '%Y-%m-%d').date()
            
            # Determine file type and process accordingly
            file_extension = os.path.splitext(file_path)[1].lower()
            
            if file_extension == '.pdf':
                # Extract data from PDF
                extraction_result = ImportService.extract_sales_from_pdf(file_path)
                if not extraction_result.get('success', False):
                    return extraction_result  # Return the error response
                
                # Convert sales_data to DataFrame
                sales_data = extraction_result.get('sales_data', [])
                if not sales_data:
                    return {'success': False, 'error': 'No sales data found in PDF'}
                
                df = pd.DataFrame(sales_data)
                print(f"📊 Extracted {len(df)} rows from PDF")
            elif file_extension == '.csv':
                # Read CSV file
                df = pd.read_csv(file_path)
                print(f"📊 Found {len(df)} rows in daily sales CSV")
            else:
                raise Exception(f"Unsupported file type: {file_extension}. Only PDF and CSV files are supported.")
            
            if df.empty:
                raise Exception("No data found in the file")
            
            # Detect field names (handle both CSV and PDF formats)
            if 'QuantitySold' in df.columns:
                # CSV format
                qty_field = 'QuantitySold'
                cost_field = 'CostOfSales'
            elif 'SalesQty' in df.columns:
                # PDF format  
                qty_field = 'SalesQty'
                cost_field = 'SalesCost'
            else:
                raise Exception("Required sales quantity field not found. Expected 'QuantitySold' (CSV) or 'SalesQty' (PDF)")
            
            # Filter only items with sales > 0
            df_with_sales = df[df[qty_field] > 0]
            print(f"✅ Found {len(df_with_sales)} items with sales today (using field: '{qty_field}')")
            
            # OPTIMIZATION: Get existing data in bulk
            stock_codes = df_with_sales['StockCode'].astype(str).str.strip().tolist()
            dept_codes = df_with_sales['DepartmentCode'].astype(str).str.strip().unique().tolist()
            
            existing_products = {
                product.stock_code: product 
                for product in Product.query.filter(
                    Product.stock_code.in_(stock_codes),
                    Product.pharmacy_id == pharmacy_id
                ).all()
            }
            
            existing_departments = {
                dept.department_code: dept 
                for dept in Department.query.filter(Department.department_code.in_(dept_codes)).all()
            }
            
            existing_daily_sales = {
                (sale.product_id, sale.sale_date): sale
                for sale in DailySales.query.join(Product).filter(
                    Product.stock_code.in_(stock_codes),
                    Product.pharmacy_id == pharmacy_id,
                    DailySales.sale_date == sale_date
                ).all()
            }
            
            departments_to_create = []
            products_to_create = []
            sales_to_create = []
            sales_to_update = []
            
            for _, row in df_with_sales.iterrows():
                dept_code = str(row['DepartmentCode']).strip()
                stock_code = str(row['StockCode']).strip()
                description = str(row['Description']).strip()
                
                # Handle department
                if dept_code not in existing_departments:
                    departments_to_create.append({
                        'department_code': dept_code,
                        'department_name': f"Department {dept_code}"
                    })
                    existing_departments[dept_code] = True  # Mark as handled
                
                # Handle product
                if stock_code not in existing_products:
                    products_to_create.append({
                        'stock_code': stock_code,
                        'description': description,
                        'department_code': dept_code,
                        'pharmacy_id': pharmacy_id,
                        'first_seen_date': sale_date
                    })
            
            # OPTIMIZATION: Bulk insert departments and products first
            if departments_to_create:
                for i in range(0, len(departments_to_create), 100):
                    batch = departments_to_create[i:i+100]
                    db.session.bulk_insert_mappings(Department, batch)
            
            if products_to_create:
                for i in range(0, len(products_to_create), 100):
                    batch = products_to_create[i:i+100]
                    db.session.bulk_insert_mappings(Product, batch)
            
            db.session.commit()
            
            # Get updated product mapping including new products
            all_products = {
                product.stock_code: product 
                for product in Product.query.filter(
                    Product.stock_code.in_(stock_codes),
                    Product.pharmacy_id == pharmacy_id
                ).all()
            }
            
            # Prepare daily sales records
            for _, row in df_with_sales.iterrows():
                stock_code = str(row['StockCode']).strip()
                
                if stock_code in all_products:
                    product = all_products[stock_code]
                    sale_key = (product.id, sale_date)
                    
                    sale_data = {
                        'on_hand': float(row.get('OnHand', 0)),
                        'sales_qty': float(row.get(qty_field, 0)),
                        'sales_value': float(row.get('SalesValue', 0)),
                        'cost_of_sales': float(row.get(cost_field, 0)),
                        'gross_profit': float(row.get('GrossProfit', 0)),
                        'gross_profit_percent': float(row.get('GrossProfitPercent', 0))
                    }
                    
                    if sale_key in existing_daily_sales:
                        # Update existing record
                        existing_sale = existing_daily_sales[sale_key]
                        for key, value in sale_data.items():
                            setattr(existing_sale, key, value)
                        sales_to_update.append(existing_sale)
                    else:
                        # Create new record
                        sale_data.update({
                            'product_id': product.id,
                            'sale_date': sale_date
                        })
                        sales_to_create.append(sale_data)
            
            # OPTIMIZATION: Bulk insert daily sales
            if sales_to_create:
                for i in range(0, len(sales_to_create), 100):
                    batch = sales_to_create[i:i+100]
                    db.session.bulk_insert_mappings(DailySales, batch)
            
            db.session.commit()
            
            result = {
                'success': True,
                'message': f'Daily sales imported successfully for {sale_date}',
                'new_products': len(products_to_create),
                'imported_sales': len(sales_to_create),
                'updated_sales': len(sales_to_update),
                'total_with_sales': len(df_with_sales),
                'sale_date': sale_date.isoformat()
            }
            
            print(f"✅ Daily sales import completed: {result}")
            return result
            
        except Exception as e:
            db.session.rollback()
            error_msg = f"❌ Error importing daily sales: {str(e)}"
            print(error_msg)
            print(traceback.format_exc())
            return {'success': False, 'error': error_msg}
    
    @staticmethod
    def delete_daily_sales(sale_date, pharmacy_id='REITZ'):
        """Delete all daily sales records for a specific date"""
        try:
            print(f"🗑️ Starting daily sales deletion for {sale_date}")
            
            # Parse date if string
            if isinstance(sale_date, str):
                sale_date = datetime.strptime(sale_date, '%Y-%m-%d').date()
            
            # Get product IDs for the pharmacy first
            product_ids = db.session.query(Product.id).filter(
                Product.pharmacy_id == pharmacy_id
            ).subquery()
            
            # Get count of records to delete for reporting
            records_to_delete = db.session.query(DailySales).filter(
                DailySales.product_id.in_(db.session.query(product_ids.c.id)),
                DailySales.sale_date == sale_date
            ).count()
            
            if records_to_delete == 0:
                return {
                    'success': True,
                    'message': f'No daily sales records found for {sale_date}',
                    'deleted_count': 0,
                    'sale_date': sale_date.isoformat()
                }
            
            # Delete records using bulk delete
            deleted_count = db.session.query(DailySales).filter(
                DailySales.product_id.in_(db.session.query(product_ids.c.id)),
                DailySales.sale_date == sale_date
            ).delete(synchronize_session=False)
            
            db.session.commit()
            
            result = {
                'success': True,
                'message': f'Successfully deleted daily sales records for {sale_date}',
                'deleted_count': deleted_count,
                'sale_date': sale_date.isoformat()
            }
            
            print(f"✅ Daily sales deletion completed: {result}")
            return result
            
        except Exception as e:
            db.session.rollback()
            error_msg = f"❌ Error deleting daily sales: {str(e)}"
            print(error_msg)
            print(traceback.format_exc())
            return {'success': False, 'error': error_msg} 