import pandas as pd
import fitz  # PyMuPDF for PDF processing - RE-ENABLED
import re
from models import db, Department, Product, SalesHistory, DailySales
from datetime import datetime, date
import os
import traceback
from sqlalchemy import text

class ImportService:
    
    @staticmethod
    def extract_sales_from_pdf(pdf_file_path):
        """Extract sales data from PDF file using the extraction logic - RE-ENABLED"""
        try:
            print(f"📂 Starting PDF extraction from {pdf_file_path}")
            
            # Load the PDF
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
            
            # Define regex pattern to extract structured sales data
            pattern = re.compile(
                r"^([A-Z0-9]{6})\s+([A-Z0-9\-]{4,})\s+(.*?)\s+"
                r"(-?\d+\.\d{3})\s+(-?\d+\.\d{3})\s+(-?\d+\.\d{2})\s+"
                r"(-?\d+\.\d{2})\s+(-?\d+\.\d{2})\s+(-?\d+\.\d{3})\s+(-?\d+\.\d{3})$"
            )

            # Extract matched values
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

            # Convert to DataFrame
            df = pd.DataFrame(records)
            print(f"✅ Extracted {len(df)} records from PDF")
            return df
            
        except Exception as e:
            error_msg = f"❌ Error extracting PDF: {str(e)}"
            print(error_msg)
            print(traceback.format_exc())
            raise Exception(error_msg)
    
    @staticmethod
    def import_departments(csv_file_path, pharmacy_id='REITZ'):
        """Import departments from CSV file - OPTIMIZED with bulk operations"""
        try:
            print(f"📂 Starting department import from {csv_file_path}")
            
            # Read CSV file
            df = pd.read_csv(csv_file_path)
            print(f"📊 Found {len(df)} rows in department CSV")
            
            # Filter out invalid department codes (skip header-like rows)
            # Accept both 6-digit codes and alphanumeric codes like BAAA01
            valid_departments = df[
                (
                    (df['DepartmentCode'].str.len() == 6) & 
                    (df['DepartmentCode'].str.isdigit() | df['DepartmentCode'].str.match(r'^[A-Z0-9]{6}$'))
                ) &
                (df['DepartmentName'].notna()) &
                (~df['DepartmentName'].isin(['CODE', 'APTEEK', 'DEPT', 'MARKUP', 'ALLOC']))
            ]
            
            print(f"✅ Found {len(valid_departments)} valid departments")
            
            # OPTIMIZATION: Get all existing departments in one query
            dept_codes = valid_departments['DepartmentCode'].str.strip().tolist()
            existing_departments = {
                dept.department_code: dept 
                for dept in Department.query.filter(Department.department_code.in_(dept_codes)).all()
            }
            
            departments_to_create = []
            departments_to_update = []
            
            for _, row in valid_departments.iterrows():
                dept_code = str(row['DepartmentCode']).strip()
                dept_name = str(row['DepartmentName']).strip()
                
                if dept_code in existing_departments:
                    # Update existing department
                    existing_departments[dept_code].department_name = dept_name
                    departments_to_update.append(existing_departments[dept_code])
                else:
                    # Prepare new department for batch insert
                    departments_to_create.append({
                        'department_code': dept_code,
                        'department_name': dept_name
                    })
            
            # OPTIMIZATION: Bulk insert new departments
            if departments_to_create:
                db.session.execute(
                    text("INSERT INTO departments (department_code, department_name) VALUES " +
                         ", ".join([f"('{dept['department_code']}', '{dept['department_name']}')" 
                                   for dept in departments_to_create]))
                )
            
            # Commit all changes at once
            db.session.commit()
            
            result = {
                'success': True,
                'message': f'Departments imported successfully',
                'imported': len(departments_to_create),
                'updated': len(departments_to_update),
                'total': len(departments_to_create) + len(departments_to_update)
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
    def import_daily_sales(file_path, sale_date=None, pharmacy_id='REITZ'):
        """Import daily sales from CSV or PDF file - OPTIMIZED with batch processing"""
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
                df = ImportService.extract_sales_from_pdf(file_path)
                print(f"📊 Extracted {len(df)} rows from PDF")
            elif file_extension == '.csv':
                # Read CSV file
                df = pd.read_csv(file_path)
                print(f"📊 Found {len(df)} rows in daily sales CSV")
            else:
                raise Exception(f"Unsupported file type: {file_extension}. Only PDF and CSV files are supported.")
            
            if df.empty:
                raise Exception("No data found in the file")
            
            # Filter only items with sales > 0
            df_with_sales = df[df['SalesQty'] > 0]
            print(f"✅ Found {len(df_with_sales)} items with sales today")
            
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
                        'sales_qty': float(row.get('SalesQty', 0)),
                        'sales_value': float(row.get('SalesValue', 0)),
                        'sales_cost': float(row.get('SalesCost', 0)),
                        'gross_profit': float(row.get('GrossProfit', 0)),
                        'turnover_percent': float(row.get('TurnoverPercent', 0)),
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