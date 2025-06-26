
from bs4 import BeautifulSoup
import re

def clean_number(val):
    if not val or val.strip() in ['-', '.00']:
        return 0.0
    return float(val.replace('R', '').replace(',', '').replace(' ', '').replace('-', '').strip())

def parse_html_daily(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    text = soup.get_text(separator='\n')
    lines = [line.strip() for line in text.split('\n') if line.strip()]

    data = {}

    def extract_value(section, label, index_offset):
        idx = next((i for i, line in enumerate(lines) if section in line and label in line), None)
        if idx is not None:
            try:
                return clean_number(lines[idx + index_offset])
            except:
                return 0.0
        return 0.0

    # SALES SUMMARY
    try:
        sales_idx = lines.index("SALES SUMMARY")
        cash_sales_trans_today = int(re.sub(r'\D', '', lines[sales_idx+2]))
        cash_sales_today = clean_number(lines[sales_idx+3])
        cod_payments_trans_today = int(re.sub(r'\D', '', lines[sales_idx+4]))
        cod_payments_today = clean_number(lines[sales_idx+5])
        receipt_on_account_trans_today = int(re.sub(r'\D', '', lines[sales_idx+6]))
        receipt_on_account_today = clean_number(lines[sales_idx+7])
        subtotal_trans_today = int(re.sub(r'\D', '', lines[sales_idx+8]))
        subtotal_today = clean_number(lines[sales_idx+9])
        paid_outs_trans_today = int(re.sub(r'\D', '', lines[sales_idx+10]))
        paid_outs_today = clean_number(lines[sales_idx+11])
        cash_refunds_trans_today = int(re.sub(r'\D', '', lines[sales_idx+12]))
        cash_refunds_today = clean_number(lines[sales_idx+13])
        sales_total_trans_today = int(re.sub(r'\D', '', lines[sales_idx+14]))
        sales_total_today = clean_number(lines[sales_idx+15])
        account_sales_trans_today = int(re.sub(r'\D', '', lines[sales_idx+16]))
        account_sales_today = clean_number(lines[sales_idx+17])
        cod_sales_trans_today = int(re.sub(r'\D', '', lines[sales_idx+18]))
        cod_sales_today = clean_number(lines[sales_idx+19])
        account_refunds_trans_today = int(re.sub(r'\D', '', lines[sales_idx+20]))
        account_refunds_today = clean_number(lines[sales_idx+21])
        pos_turnover_trans_today = int(re.sub(r'\D', '', lines[sales_idx+22]))
        pos_turnover_today = clean_number(lines[sales_idx+23])
        avg_items_per_basket = clean_number(lines[sales_idx+24])
        avg_value_per_basket = clean_number(lines[sales_idx+26])
    except:
        cash_sales_trans_today = cash_sales_today = cod_payments_trans_today = cod_payments_today = 0
        receipt_on_account_trans_today = receipt_on_account_today = subtotal_trans_today = subtotal_today = 0
        paid_outs_trans_today = paid_outs_today = cash_refunds_trans_today = cash_refunds_today = 0
        sales_total_trans_today = sales_total_today = account_sales_trans_today = account_sales_today = 0
        cod_sales_trans_today = cod_sales_today = account_refunds_trans_today = account_refunds_today = 0
        pos_turnover_trans_today = pos_turnover_today = avg_items_per_basket = avg_value_per_basket = 0

    # STOCK TRADING ACCOUNT
    stock_sales_today = extract_value("STOCK TRADING ACCOUNT", "Total Sales of Stock", 1)
    stock_purchases_today = extract_value("STOCK TRADING ACCOUNT", "Purchases", 1)
    stock_adjustments_today = extract_value("STOCK TRADING ACCOUNT", "Adjustments", 1)
    cost_of_sales_today = extract_value("STOCK TRADING ACCOUNT", "Cost Of Sales", 1)
    stock_gross_profit_today = extract_value("STOCK TRADING ACCOUNT", "GROSS PROFIT (R)", 1)
    stock_gross_profit_percent_today = extract_value("STOCK TRADING ACCOUNT", "GROSS PROFIT (%)", 1)
    opening_stock_today = extract_value("STOCK TRADING ACCOUNT", "Opening Stock", 1)
    closing_stock_today = extract_value("STOCK TRADING ACCOUNT", "Closing Stock", 1)

    # DISPENSARY SUMMARY
    dispensary_turnover_today = extract_value("DISPENSARY SUMMARY", "Dispensary Turnover", 1)
    scripts_dispensed_today = extract_value("DISPENSARY SUMMARY", "Number of Scripts", 1)
    avg_script_value_today = extract_value("DISPENSARY SUMMARY", "Average Value", 1)
    avg_items_per_script_today = extract_value("DISPENSARY SUMMARY", "Average Number", 1)
    avg_item_gross_value_today = extract_value("DISPENSARY SUMMARY", "Average Gross", 1)
    outstanding_levies_today = extract_value("DISPENSARY SUMMARY", "Outstanding Levies", 1)

    # TURNOVER SUMMARY
    retail_sales_today = extract_value("TURNOVER SUMMARY", "Retail Sales", 1)
    type_r_sales_today = extract_value("TURNOVER SUMMARY", "Type R Sales", 1)
    capitation_sales_today = extract_value("TURNOVER SUMMARY", "Capitation Sales", 1)
    total_turnover_today = extract_value("TURNOVER SUMMARY", "TOTAL TURNOVER", 1)

    return {
        "cash_sales_today": cash_sales_today,
        "cash_sales_trans_today": cash_sales_trans_today,
        "cod_payments_today": cod_payments_today,
        "cod_payments_trans_today": cod_payments_trans_today,
        "receipt_on_account_today": receipt_on_account_today,
        "receipt_on_account_trans_today": receipt_on_account_trans_today,
        "subtotal_today": subtotal_today,
        "subtotal_trans_today": subtotal_trans_today,
        "paid_outs_today": paid_outs_today,
        "paid_outs_trans_today": paid_outs_trans_today,
        "cash_refunds_today": cash_refunds_today,
        "cash_refunds_trans_today": cash_refunds_trans_today,
        "sales_total_today": sales_total_today,
        "sales_total_trans_today": sales_total_trans_today,
        "account_sales_today": account_sales_today,
        "account_sales_trans_today": account_sales_trans_today,
        "cod_sales_today": cod_sales_today,
        "cod_sales_trans_today": cod_sales_trans_today,
        "account_refunds_today": account_refunds_today,
        "account_refunds_trans_today": account_refunds_trans_today,
        "pos_turnover_today": pos_turnover_today,
        "pos_turnover_trans_today": pos_turnover_trans_today,
        "avg_items_per_basket": avg_items_per_basket,
        "avg_value_per_basket": avg_value_per_basket,
        "stock_sales_today": stock_sales_today,
        "stock_purchases_today": stock_purchases_today,
        "stock_adjustments_today": stock_adjustments_today,
        "cost_of_sales_today": cost_of_sales_today,
        "stock_gross_profit_today": stock_gross_profit_today,
        "stock_gross_profit_percent_today": stock_gross_profit_percent_today,
        "opening_stock_today": opening_stock_today,
        "closing_stock_today": closing_stock_today,
        "dispensary_turnover_today": dispensary_turnover_today,
        "scripts_dispensed_today": scripts_dispensed_today,
        "avg_script_value_today": avg_script_value_today,
        "avg_items_per_script_today": avg_items_per_script_today,
        "avg_item_gross_value_today": avg_item_gross_value_today,
        "outstanding_levies_today": outstanding_levies_today,
        "retail_sales_today": retail_sales_today,
        "type_r_sales_today": type_r_sales_today,
        "capitation_sales_today": capitation_sales_today,
        "total_turnover_today": total_turnover_today,
    }
