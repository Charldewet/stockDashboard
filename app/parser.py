from bs4 import BeautifulSoup
import re

def clean_number(val_str):
    if not val_str or not isinstance(val_str, str):
        return 0.0
    # Remove R, thousand separators (,), and leading/trailing spaces first
    cleaned = val_str.replace('R', '').replace(',', '').strip()
    # Remove internal spaces (e.g. "26 %" -> "26%")
    cleaned = cleaned.replace(' ', '')

    if not cleaned or cleaned == '-' or cleaned == '.00':
        return 0.0

    # Handle percentage sign
    if cleaned.endswith('%'):
        cleaned = cleaned[:-1]

    try:
        if cleaned.endswith('-'): # Trailing negative sign
            return -float(cleaned[:-1])
        if cleaned.startswith('(') and cleaned.endswith(')'): # Parentheses for negative
            return -float(cleaned[1:-1])
        return float(cleaned)
    except ValueError:
        # print(f"DEBUG clean_number: ValueError for '{val_str}' -> '{cleaned}'") # Optional debug
        return 0.0

def clean_int(val_str):
    if not val_str or not isinstance(val_str, str):
        return 0
    # Remove all non-digit characters then convert to int
    cleaned = re.sub(r'\D', '', val_str.strip())
    if not cleaned:
        return 0
    try:
        return int(cleaned)
    except ValueError:
        # print(f"ValueError converting '{val_str}' (cleaned: '{cleaned}') to int.")
        return 0

def parse_html_daily(file_path):
    # Correct encoding based on HTML <meta http-equiv=Content-Type content=text/html; charset=windows-1252>
    with open(file_path, 'r', encoding='windows-1252') as f:
        soup = BeautifulSoup(f, 'html.parser')

    # Initialize data dictionary with defaults for all fields to ensure they exist
    data = {
        'cash_sales_today': 0.0, 'cash_sales_trans_today': 0,
        'cod_payments_today': 0.0, 'cod_payments_trans_today': 0,
        'receipt_on_account_today': 0.0, 'receipt_on_account_trans_today': 0,
        'subtotal_today': 0.0, 'subtotal_trans_today': 0,
        'paid_outs_today': 0.0, 'paid_outs_trans_today': 0,
        'cash_refunds_today': 0.0, 'cash_refunds_trans_today': 0,
        'sales_total_today': 0.0, 'sales_total_trans_today': 0,
        'account_sales_today': 0.0, 'account_sales_trans_today': 0,
        'cod_sales_today': 0.0, 'cod_sales_trans_today': 0,
        'account_refunds_today': 0.0, 'account_refunds_trans_today': 0,
        'pos_turnover_today': 0.0, 'pos_turnover_trans_today': 0,
        'avg_items_per_basket': 0.0,
        'avg_value_per_basket': 0.0,
        'cash_tenders_today': 0.0, # Changed default from None to 0.0 for consistency
        'credit_card_tenders_today': 0.0, # Changed default from None to 0.0
        'total_banked_today': 0.0, # Changed default from None to 0.0
        'stock_sales_today': 0.0,
        'stock_purchases_today': 0.0,
        'stock_adjustments_today': 0.0,
        'cost_of_sales_today': 0.0,
        'stock_gross_profit_today': 0.0,
        'stock_gross_profit_percent_today': 0.0,
        'opening_stock_today': 0.0,
        'closing_stock_today': 0.0,
        'dispensary_turnover_today': 0.0,
        'scripts_dispensed_today': 0.0, # Model is Float, but represents count
        'avg_script_value_today': 0.0,
        'avg_items_per_script_today': 0.0,
        'avg_item_gross_value_today': 0.0,
        'outstanding_levies_today': 0.0,
        'retail_sales_today': 0.0,
        'type_r_sales_today': 0.0,
        'capitation_sales_today': 0.0,
        'total_turnover_today': 0.0
    }

    # --- Helper to find table by header text ---
    def find_table_by_header(header_text_identifier):
        # Find the bold tag containing the header text
        header_bold_tag = soup.find(lambda tag: tag.name == 'b' and header_text_identifier in tag.get_text(strip=True))
        if header_bold_tag:
            # The table is usually an ancestor of this bold tag.
            # Navigate up to the <table> element.
            current_tag = header_bold_tag
            while current_tag and current_tag.name != 'table':
                current_tag = current_tag.parent
            return current_tag # This should be the table element
        return None

    # --- SALES SUMMARY & BASKET METRICS (Table 1 in example HTML) ---
    sales_summary_table = find_table_by_header("SALES SUMMARY")
    if sales_summary_table:
        rows = sales_summary_table.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if not cells or len(cells) < 3: # Most data rows have at least 3 cells (Label, Trans, Value)
                # Handle special rows for basket metrics separately if their structure differs
                if len(cells) > 0:
                    label_cell_text = cells[0].get_text(strip=True).lower()
                    if "average number of items per basket" in label_cell_text and len(cells) > 1:
                        # cells[0] might have colspan="2", value is in the next cell logically
                        value_cell_index = 1 if cells[0].get('colspan') == '2' else 2
                        if len(cells) > value_cell_index:
                            data['avg_items_per_basket'] = clean_number(cells[value_cell_index].get_text(strip=True))
                    elif "average value per docket/basket" in label_cell_text and len(cells) > 1:
                        value_cell_index = 1 if cells[0].get('colspan') == '2' else 2
                        if len(cells) > value_cell_index:
                             data['avg_value_per_basket'] = clean_number(cells[value_cell_index].get_text(strip=True))
                continue

            # Get label text from the first cell, common for all rows in this table
            label_cell_text = cells[0].get_text(strip=True).lower()

            # Handle specific structures for basket metrics first
            if "average number of items per basket" in label_cell_text:
                # This row has 3 TD elements: TD(colspan=2, label), TD(value), TD(colspan=2, month_value)
                if cells[0].get('colspan') == '2' and len(cells) > 1: # cells[0] is the label cell
                    data['avg_items_per_basket'] = clean_number(cells[1].get_text(strip=True))
            elif "average value per docket/basket" in label_cell_text:
                # Similar structure to above
                if cells[0].get('colspan') == '2' and len(cells) > 1:
                    data['avg_value_per_basket'] = clean_number(cells[1].get_text(strip=True))
            # For other rows, expect at least 3 cells (Label, Trans Today, Value Today)
            elif len(cells) >= 3:
                trans_today_str = cells[1].get_text(strip=True)
                value_today_str = cells[2].get_text(strip=True)
                
                # Map labels to data dictionary keys
                if "cash sales" == label_cell_text:
                    data['cash_sales_trans_today'] = clean_int(trans_today_str)
                    data['cash_sales_today'] = clean_number(value_today_str)
                elif "c.o.d payments" == label_cell_text: # Note: HTML uses "C.O.D Payments"
                    data['cod_payments_trans_today'] = clean_int(trans_today_str)
                    data['cod_payments_today'] = clean_number(value_today_str)
                elif "receipt on account" == label_cell_text:
                    data['receipt_on_account_trans_today'] = clean_int(trans_today_str)
                    data['receipt_on_account_today'] = clean_number(value_today_str)
                elif "sub-total:" in label_cell_text: # Original: "Sub-Total:"
                    data['subtotal_trans_today'] = clean_int(trans_today_str)
                    data['subtotal_today'] = clean_number(value_today_str)
                elif "less: paid-outs" == label_cell_text:
                    data['paid_outs_trans_today'] = clean_int(trans_today_str)
                    data['paid_outs_today'] = clean_number(value_today_str)
                elif "less: cash refunds" == label_cell_text:
                    data['cash_refunds_trans_today'] = clean_int(trans_today_str)
                    data['cash_refunds_today'] = clean_number(value_today_str)
                elif "total:" == label_cell_text and "total pos turnover:" not in label_cell_text: # Original: "TOTAL:"
                    data['sales_total_trans_today'] = clean_int(trans_today_str)
                    data['sales_total_today'] = clean_number(value_today_str)
                elif "account sales" == label_cell_text:
                    data['account_sales_trans_today'] = clean_int(trans_today_str)
                    data['account_sales_today'] = clean_number(value_today_str)
                elif "c.o.d sales" == label_cell_text: # Original: "C.O.D Sales"
                    data['cod_sales_trans_today'] = clean_int(trans_today_str)
                    data['cod_sales_today'] = clean_number(value_today_str)
                elif "less: account refunds" == label_cell_text:
                    data['account_refunds_trans_today'] = clean_int(trans_today_str)
                    data['account_refunds_today'] = clean_number(value_today_str)
                elif "total pos turnover:" in label_cell_text: # Original: "TOTAL POS TURNOVER:"
                    data['pos_turnover_trans_today'] = clean_int(trans_today_str)
                    data['pos_turnover_today'] = clean_number(value_today_str)
    else:
        print("Warning: SALES SUMMARY table not found.")

    # --- CASH-UP RECONCILIATION ---
    cash_up_table = find_table_by_header("CASH-UP RECONCILIATION")
    if cash_up_table:
        rows = cash_up_table.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if not cells or len(cells) < 3: continue # Expect Label, Trans, Value for most rows

            label_cell_text = cells[0].get_text(strip=True).lower()
            # Today's Value is typically in cells[2] for this table structure
            value_today_str = cells[2].get_text(strip=True)

            if "cash tenders" == label_cell_text:
                data['cash_tenders_today'] = clean_number(value_today_str)
            elif "credit card tenders" == label_cell_text:
                data['credit_card_tenders_today'] = clean_number(value_today_str)
            elif "total banked" in label_cell_text: # Label is "TOTAL BANKED"
                data['total_banked_today'] = clean_number(value_today_str)
    else:
        print("Warning: CASH-UP RECONCILIATION table not found.")

    # --- STOCK TRADING ACCOUNT (Revised based on email structure) ---
    stock_trading_table = find_table_by_header("STOCK TRADING ACCOUNT")
    if stock_trading_table:
        rows = stock_trading_table.find_all('tr')
        header_skipped = False
        # Expected header texts (lowercase) for the actual data table part
        expected_header_texts = ["description", "today", "this month"]

        for row in rows:
            cells = row.find_all('td')
            if not cells: continue

            if not header_skipped:
                # Check if this row is the actual header of the data section
                current_row_texts = [cell.get_text(strip=True).lower() for cell in cells[:len(expected_header_texts)]]
                if current_row_texts == expected_header_texts:
                    header_skipped = True
                continue # Skip the main section title and wait for the specific data header
            
            # After header is skipped, process data rows
            if len(cells) < 2: continue # Need at least label and one value cell

            label_cell_text = cells[0].get_text(strip=True).lower()
            value_today_str = cells[1].get_text(strip=True) if len(cells) > 1 else ""
            cleaned_val = clean_number(value_today_str)

            if "total sales of stock" == label_cell_text:
                data['stock_sales_today'] = cleaned_val
            elif "purchases" == label_cell_text and "total purchases" not in label_cell_text: # Avoid more generic purchase rows if any
                data['stock_purchases_today'] = cleaned_val
            elif "adjustments" == label_cell_text:
                data['stock_adjustments_today'] = cleaned_val
            elif "cost of sales" == label_cell_text:
                data['cost_of_sales_today'] = cleaned_val
            elif "gross profit (r) from trading of stock items" == label_cell_text:
                data['stock_gross_profit_today'] = cleaned_val
            elif "gross profit (%) from trading of stock items" == label_cell_text:
                data['stock_gross_profit_percent_today'] = cleaned_val # Value is directly the percentage
            elif "opening stock (@ cost at the beginning of the month)" == label_cell_text:
                data['opening_stock_today'] = cleaned_val
            elif "closing stock valued at cost now" == label_cell_text: 
                data['closing_stock_today'] = cleaned_val
    else:
        print("Warning: STOCK TRADING ACCOUNT table not found.")

    # --- DISPENSARY SUMMARY ---
    # Structure based on email debug logs
    dispensary_table = find_table_by_header("DISPENSARY SUMMARY")
    if dispensary_table:
        rows = dispensary_table.find_all('tr')
        print(f"DEBUG: DISPENSARY SUMMARY - Found table, {len(rows)} rows.")
        header_skipped = False
        expected_dispensary_header = ["description", "today", "this month"] # Based on email logs pattern

        for row_idx, row in enumerate(rows):
            cells = row.find_all('td')
            if not cells: continue

            if not header_skipped:
                current_row_texts = [cell.get_text(strip=True).lower() for cell in cells[:len(expected_dispensary_header)]]
                if current_row_texts == expected_dispensary_header:
                    print(f"DEBUG: DISPENSARY - Skipping header row {row_idx}")
                    header_skipped = True
                else:
                    # Handle cases where the first row might be the main title with colspan
                    if row_idx == 0 and cells[0].get('colspan'):
                        print(f"DEBUG: DISPENSARY - Skipping main title row {row_idx}")
                        continue # Don't set header_skipped true yet, wait for actual column header
                    elif row_idx > 0: # If not the first row and still no header match, something is off
                         print(f"DEBUG: DISPENSARY - Row {row_idx} not matching expected header: {current_row_texts} vs {expected_dispensary_header}")
                if not header_skipped: # If still not skipped, continue to next row
                    continue
            
            if len(cells) < 2: 
                print(f"DEBUG: DISPENSARY - Row {row_idx} has < 2 cells, skipping.")
                continue

            label_cell_text_raw = cells[0].get_text(strip=True)
            label_cell_text = label_cell_text_raw.lower()
            value_today_str = cells[1].get_text(strip=True) if len(cells) > 1 else ""
            cleaned_val = clean_number(value_today_str)

            print(f"DEBUG: DISPENSARY - Row {row_idx} | Label: '{label_cell_text}' | Val: '{value_today_str}' | Cleaned: {cleaned_val}")

            if "dispensary turnover/revenue" == label_cell_text:
                data['dispensary_turnover_today'] = cleaned_val
            elif "number of scripts dispensed" == label_cell_text:
                data['scripts_dispensed_today'] = clean_int(value_today_str)
            elif "average value of a script" == label_cell_text:
                data['avg_script_value_today'] = cleaned_val
            elif "average number of items per script" == label_cell_text:
                data['avg_items_per_script_today'] = cleaned_val
            elif "average gross value of an item" == label_cell_text: # Moved from Turnover based on email logs
                data['avg_item_gross_value_today'] = cleaned_val
            elif "outstandinglevies" == label_cell_text: # Moved from Turnover & label corrected based on email logs
                data['outstanding_levies_today'] = cleaned_val
    else:
        print("Warning: DISPENSARY SUMMARY table not found.")

    # --- TURNOVER SUMMARY ---
    turnover_summary_table = find_table_by_header("TURNOVER SUMMARY")
    if turnover_summary_table:
        rows = turnover_summary_table.find_all('tr')
        print(f"DEBUG: TURNOVER SUMMARY - Found table, {len(rows)} rows.")
        header_skipped = False
        expected_turnover_header = ["description", "today", "this month"]

        for row_idx, row in enumerate(rows):
            cells = row.find_all('td')
            if not cells: continue

            if not header_skipped:
                if row_idx == 0 and cells[0].get('colspan'):
                    print(f"DEBUG: TURNOVER - Skipping main title row {row_idx}")
                    continue
                current_row_texts = [cell.get_text(strip=True).lower() for cell in cells[:len(expected_turnover_header)]]
                if current_row_texts == expected_turnover_header:
                    print(f"DEBUG: TURNOVER - Skipping header row {row_idx} (Email style)")
                    header_skipped = True
                if not header_skipped:
                    print(f"DEBUG: TURNOVER - Row {row_idx} not matching header, texts: {[c.get_text(strip=True).lower() for c in cells]}")
                    continue
            
            if len(cells) < 2: 
                print(f"DEBUG: TURNOVER - Row {row_idx} has < 2 cells, skipping.")
                continue
            
            label_cell_text_raw = cells[0].get_text(strip=True)
            label_cell_text = label_cell_text_raw.lower()
            value_today_str = cells[1].get_text(strip=True) if len(cells) > 1 else ""
            cleaned_val = clean_number(value_today_str)

            print(f"DEBUG: TURNOVER - Row {row_idx} | Label: '{label_cell_text}' | Val: '{value_today_str}' | Cleaned: {cleaned_val}")

            if "retail sales (excl.)" == label_cell_text:
                data['retail_sales_today'] = cleaned_val
            elif "type r sales (sales @ cost - excl.)" == label_cell_text:
                data['type_r_sales_today'] = cleaned_val
            elif "capitation sales (excl.)" == label_cell_text:
                data['capitation_sales_today'] = cleaned_val
            elif "total turnover (excl.)" == label_cell_text: 
                data['total_turnover_today'] = cleaned_val
    else:
        print("Warning: TURNOVER SUMMARY table not found.")

    print("Info: HTML parsing complete for all sections.")
    return data
