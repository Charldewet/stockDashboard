from sqlalchemy import Column, Integer, String, Float, Date, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class DailyReport(Base):
    __tablename__ = "daily_reports"

    id = Column(Integer, primary_key=True)
    pharmacy_code = Column(String, nullable=False)
    report_date = Column(Date, nullable=False)

    # SALES SUMMARY
    cash_sales_today = Column(Float)
    cash_sales_trans_today = Column(Integer)
    cod_payments_today = Column(Float)
    cod_payments_trans_today = Column(Integer)
    receipt_on_account_today = Column(Float)
    receipt_on_account_trans_today = Column(Integer)
    subtotal_today = Column(Float)
    subtotal_trans_today = Column(Integer)
    paid_outs_today = Column(Float)
    paid_outs_trans_today = Column(Integer)
    cash_refunds_today = Column(Float)
    cash_refunds_trans_today = Column(Integer)
    sales_total_today = Column(Float)
    sales_total_trans_today = Column(Integer)
    account_sales_today = Column(Float)
    account_sales_trans_today = Column(Integer)
    cod_sales_today = Column(Float)
    cod_sales_trans_today = Column(Integer)
    account_refunds_today = Column(Float)
    account_refunds_trans_today = Column(Integer)
    pos_turnover_today = Column(Float)
    pos_turnover_trans_today = Column(Integer)

    # BASKET METRICS
    avg_items_per_basket = Column(Float)
    avg_value_per_basket = Column(Float)

    # CASH-UP RECONCILIATION
    cash_tenders_today = Column(Float)
    credit_card_tenders_today = Column(Float)
    total_banked_today = Column(Float)

    # STOCK TRADING ACCOUNT
    stock_sales_today = Column(Float)
    stock_purchases_today = Column(Float)
    stock_adjustments_today = Column(Float)
    cost_of_sales_today = Column(Float)
    stock_gross_profit_today = Column(Float)
    stock_gross_profit_percent_today = Column(Float)
    opening_stock_today = Column(Float)
    closing_stock_today = Column(Float)

    # DISPENSARY SUMMARY
    dispensary_turnover_today = Column(Float)
    scripts_dispensed_today = Column(Float)
    avg_script_value_today = Column(Float)
    avg_items_per_script_today = Column(Float)
    avg_item_gross_value_today = Column(Float)
    outstanding_levies_today = Column(Float)

    # TURNOVER SUMMARY
    retail_sales_today = Column(Float)
    type_r_sales_today = Column(Float)
    capitation_sales_today = Column(Float)
    total_turnover_today = Column(Float)

    __table_args__ = (
        UniqueConstraint("pharmacy_code", "report_date", name="_pharmacy_day_uc"),
    ) 