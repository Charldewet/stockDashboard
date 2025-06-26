import os
import sys
from datetime import date, timedelta

# Add project root to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db import create_session
from app.models import DailyReport

def copy_pharmacy_data(session, source_code, dest_code):
    """
    Copies all data from a source pharmacy to a destination pharmacy,
    overwriting any existing data for the destination pharmacy.
    """
    # Delete existing data for the destination pharmacy
    print(f"Deleting existing data for {dest_code}...")
    session.query(DailyReport).filter_by(pharmacy_code=dest_code).delete(synchronize_session=False)
    print("Deletion complete.")

    # Get all reports from the source pharmacy
    print(f"Fetching data from {source_code}...")
    source_reports = session.query(DailyReport).filter_by(pharmacy_code=source_code).order_by(DailyReport.report_date).all()
    if not source_reports:
        print(f"Warning: No data found for source pharmacy {source_code}. Skipping.")
        return

    print(f"Copying {len(source_reports)} records from {source_code} to {dest_code}...")
    
    for source_report in source_reports:
        new_report = DailyReport(
            pharmacy_code=dest_code, # Set the new pharmacy code
            report_date=source_report.report_date,
            total_turnover_today=source_report.total_turnover_today,
            pos_turnover_today=source_report.pos_turnover_today,
            stock_sales_today=source_report.stock_sales_today,
            cost_of_sales_today=source_report.cost_of_sales_today,
            stock_gross_profit_today=source_report.stock_gross_profit_today,
            stock_gross_profit_percent_today=source_report.stock_gross_profit_percent_today,
            stock_purchases_today=source_report.stock_purchases_today,
            stock_adjustments_today=source_report.stock_adjustments_today,
            opening_stock_today=source_report.opening_stock_today,
            closing_stock_today=source_report.closing_stock_today,
            avg_value_per_basket=source_report.avg_value_per_basket,
            avg_items_per_basket=source_report.avg_items_per_basket,
            sales_total_trans_today=source_report.sales_total_trans_today,
            dispensary_turnover_today=source_report.dispensary_turnover_today,
            scripts_dispensed_today=source_report.scripts_dispensed_today,
            cash_sales_today=source_report.cash_sales_today,
            account_sales_today=source_report.account_sales_today,
            cash_tenders_today=source_report.cash_tenders_today,
            credit_card_tenders_today=source_report.credit_card_tenders_today,
            cod_payments_today=source_report.cod_payments_today,
            receipt_on_account_today=source_report.receipt_on_account_today,
            paid_outs_today=source_report.paid_outs_today,
        )
        session.add(new_report)
    
    print(f"Data copy for {dest_code} complete.")


if __name__ == "__main__":
    session = create_session()
    
    # Map destination dummy pharmacies to source real pharmacies
    pharmacies_to_copy = {
        "DUMMY1": "reitz",
        "DUMMY2": "winterton"
    }

    try:
        for dest_code, source_code in pharmacies_to_copy.items():
            copy_pharmacy_data(session, source_code, dest_code)
        
        print("Committing changes to the database...")
        session.commit()
        print("Dummy data generation successful!")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        session.rollback()
    finally:
        session.close()
        print("Database session closed.") 