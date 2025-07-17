import pandas as pd
# import fitz  # PyMuPDF for PDF processing - temporarily disabled for deployment
import re
from models import db, Department, Product, SalesHistory, DailySales
from datetime import datetime, date
import os
import traceback

class ImportService:
    
    @staticmethod
    def extract_sales_from_pdf(pdf_file_path):
        """Extract sales data from PDF file using the extraction logic - TEMPORARILY DISABLED"""
        # PDF processing temporarily disabled for deployment - PyMuPDF dependency removed
        return {
            'error': 'PDF processing temporarily disabled. Please use CSV upload instead.',
            'success': False
        }
        # try:
        #     print(f"📂 Starting PDF extraction from {pdf_file_path}")
        #     
        #     # Load the PDF
        #     doc = fitz.open(pdf_file_path)
            
        #     # Clean raw lines by removing headers, footers, and subtotal blocks
        #     cleaned_lines = []
        #     header_keywords = [
        #         "REITZ APTEEK", "PAGE:", "CODE", "DESCRIPTION", "ON HAND", 
        #         "SALES", "COST", "GROSS", "TURNOVER", "GP%", "QTY", "VALUE"
        #     ]
        #     exclusion_keywords = ["MAIN-DEPT", "SUB-DEPT", "TOTAL", "-------"]
        #
        #     for page in doc:
        #         lines = page.get_text().split("\n")
        #         for line in lines:
        #             if any(keyword in line for keyword in header_keywords):
        #                 continue
        #             if any(keyword in line for keyword in exclusion_keywords):
        #                 continue
        #             if set(line.strip()) <= {"-", " "}:
        #                 continue
        #             cleaned_lines.append(line.strip())
        #     
        #     doc.close()
        #     
        #     # Define regex pattern to extract structured sales data
        #     pattern = re.compile(
        #         r"^([A-Z0-9]{6})\s+([A-Z0-9\-]{4,})\s+(.*?)\s+"
        #         r"(-?\d+\.\d{3})\s+(-?\d+\.\d{3})\s+(-?\d+\.\d{2})\s+"
        #         r"(-?\d+\.\d{2})\s+(-?\d+\.\d{2})\s+(-?\d+\.\d{3})\s+(-?\d+\.\d{3})$"
        #     )
        #
        #     # Extract matched values
        #     records = []
        #     for line in cleaned_lines:
        #         match = pattern.match(line)
        #         if match:
        #             dept, stock_code, desc, on_hand, sales_qty, sales_val, sales_cost, gp_val, turnover_pct, gp_pct = match.groups()
        #             records.append({
        #                 "DepartmentCode": dept.strip(),
        #                 "StockCode": stock_code.strip(),
        #                 "Description": desc.strip(),
        #                 "OnHand": float(on_hand),
        #                 "SalesQty": float(sales_qty),
        #                 "SalesValue": float(sales_val),
        #                 "SalesCost": float(sales_cost),
        #                 "GrossProfit": float(gp_val),
        #                 "TurnoverPercent": float(turnover_pct),
        #                 "GrossProfitPercent": float(gp_pct)
        #             })
        #
        #     # Convert to DataFrame
        #     df = pd.DataFrame(records)
        #     print(f"✅ Extracted {len(df)} records from PDF")
        #     return df
        #     
        # except Exception as e:
        #     error_msg = f"❌ Error extracting PDF: {str(e)}"
        #     print(error_msg)
        #     print(traceback.format_exc())
        #     raise Exception(error_msg)
    
    @staticmethod
    def import_departments(csv_file_path, pharmacy_id='REITZ'):
        """Import departments from CSV file"""
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
            
            imported_count = 0
            updated_count = 0
            
            for _, row in valid_departments.iterrows():
                dept_code = str(row['DepartmentCode']).strip()
                dept_name = str(row['DepartmentName']).strip()
                
                # Check if department already exists
                existing_dept = Department.query.filter_by(department_code=dept_code).first()
                
                if existing_dept:
                    # Update existing department
                    existing_dept.department_name = dept_name
                    updated_count += 1
                else:
                    # Create new department
                    new_dept = Department(
                        department_code=dept_code,
                        department_name=dept_name
                    )
                    db.session.add(new_dept)
                    imported_count += 1
            
            db.session.commit()
            
            result = {
                'success': True,
                'message': f'Departments imported successfully',
                'imported': imported_count,
                'updated': updated_count,
                'total': imported_count + updated_count
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
        """Import sales history from CSV file (only items with movement > 0)"""
        try:
            print(f"📂 Starting sales history import from {csv_file_path}")
            
            # Read CSV file
            df = pd.read_csv(csv_file_path)
            print(f"📊 Found {len(df)} rows in sales history CSV")
            
            # Filter only items with movement > 0
            df_with_movement = df[df['QuantitySold'] > 0]
            print(f"✅ Found {len(df_with_movement)} items with sales movement")
            
            imported_products = 0
            imported_history = 0
            
            for _, row in df_with_movement.iterrows():
                dept_code = str(row['DepartmentCode']).strip()
                stock_code = str(row['StockCode']).strip()
                description = str(row['Description']).strip()
                quantity_sold = float(row['QuantitySold'])
                
                # Check if product exists
                product = Product.query.filter_by(
                    stock_code=stock_code,
                    pharmacy_id=pharmacy_id
                ).first()
                
                if not product:
                    # Check if department exists, if not create it
                    from models import Department
                    existing_dept = Department.query.filter_by(department_code=dept_code).first()
                    if not existing_dept:
                        # Create department with a generic name
                        new_dept = Department(
                            department_code=dept_code,
                            department_name=f"Department {dept_code}"
                        )
                        db.session.add(new_dept)
                        db.session.flush()
                    
                    # Create new product
                    product = Product(
                        stock_code=stock_code,
                        description=description,
                        department_code=dept_code,
                        pharmacy_id=pharmacy_id,
                        first_seen_date=date.today()
                    )
                    db.session.add(product)
                    db.session.flush()  # Get the product ID
                    imported_products += 1
                
                # For historical data, we'll assume it's aggregated monthly data
                # Since we don't have specific dates, we'll create entries for the last 12 months
                current_date = datetime.now()
                
                # Create a sales history entry (we'll use current year/month as default)
                existing_history = SalesHistory.query.filter_by(
                    product_id=product.id,
                    year=current_date.year,
                    month=current_date.month
                ).first()
                
                if not existing_history:
                    history = SalesHistory(
                        product_id=product.id,
                        year=current_date.year,
                        month=current_date.month,
                        total_quantity_sold=quantity_sold,
                        avg_monthly_sales=quantity_sold  # For now, same as total
                    )
                    db.session.add(history)
                    imported_history += 1
            
            db.session.commit()
            
            result = {
                'success': True,
                'message': f'Sales history imported successfully',
                'products_imported': imported_products,
                'history_records': imported_history,
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
        """Import daily sales from CSV or PDF file"""
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
            
            new_products = 0
            imported_sales = 0
            updated_sales = 0
            
            for _, row in df_with_sales.iterrows():
                dept_code = str(row['DepartmentCode']).strip()
                stock_code = str(row['StockCode']).strip()
                description = str(row['Description']).strip()
                
                # Check if product exists
                product = Product.query.filter_by(
                    stock_code=stock_code,
                    pharmacy_id=pharmacy_id
                ).first()
                
                if not product:
                    # Check if department exists, if not create it
                    from models import Department
                    existing_dept = Department.query.filter_by(department_code=dept_code).first()
                    if not existing_dept:
                        # Create department with a generic name
                        new_dept = Department(
                            department_code=dept_code,
                            department_name=f"Department {dept_code}"
                        )
                        db.session.add(new_dept)
                        db.session.flush()
                    
                    # Create new product
                    product = Product(
                        stock_code=stock_code,
                        description=description,
                        department_code=dept_code,
                        pharmacy_id=pharmacy_id,
                        first_seen_date=sale_date
                    )
                    db.session.add(product)
                    db.session.flush()  # Get the product ID
                    new_products += 1
                
                # Check if daily sales record exists
                existing_sale = DailySales.query.filter_by(
                    product_id=product.id,
                    sale_date=sale_date
                ).first()
                
                if existing_sale:
                    # Update existing record
                    existing_sale.on_hand = float(row.get('OnHand', 0))
                    existing_sale.sales_qty = float(row.get('SalesQty', 0))
                    existing_sale.sales_value = float(row.get('SalesValue', 0))
                    existing_sale.sales_cost = float(row.get('SalesCost', 0))
                    existing_sale.gross_profit = float(row.get('GrossProfit', 0))
                    existing_sale.turnover_percent = float(row.get('TurnoverPercent', 0))
                    existing_sale.gross_profit_percent = float(row.get('GrossProfitPercent', 0))
                    updated_sales += 1
                else:
                    # Create new daily sales record
                    daily_sale = DailySales(
                        product_id=product.id,
                        sale_date=sale_date,
                        on_hand=float(row.get('OnHand', 0)),
                        sales_qty=float(row.get('SalesQty', 0)),
                        sales_value=float(row.get('SalesValue', 0)),
                        sales_cost=float(row.get('SalesCost', 0)),
                        gross_profit=float(row.get('GrossProfit', 0)),
                        turnover_percent=float(row.get('TurnoverPercent', 0)),
                        gross_profit_percent=float(row.get('GrossProfitPercent', 0))
                    )
                    db.session.add(daily_sale)
                    imported_sales += 1
            
            db.session.commit()
            
            result = {
                'success': True,
                'message': f'Daily sales imported successfully for {sale_date}',
                'new_products': new_products,
                'imported_sales': imported_sales,
                'updated_sales': updated_sales,
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