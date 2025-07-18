import csv
import io
from typing import List, Dict, Any

class SimpleCSVParser:
    """Lightweight CSV parser that doesn't require pandas"""
    
    @staticmethod
    def read_csv(file_path: str) -> List[Dict[str, Any]]:
        """Read CSV file and return list of dictionaries"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                return list(reader)
        except Exception as e:
            raise Exception(f"Error reading CSV file: {str(e)}")
    
    @staticmethod
    def read_csv_from_string(content: str) -> List[Dict[str, Any]]:
        """Read CSV from string content and return list of dictionaries"""
        try:
            reader = csv.DictReader(io.StringIO(content))
            return list(reader)
        except Exception as e:
            raise Exception(f"Error reading CSV content: {str(e)}")
    
    @staticmethod
    def filter_rows(data: List[Dict[str, Any]], column: str, condition: Any) -> List[Dict[str, Any]]:
        """Filter rows based on a column value"""
        filtered = []
        for row in data:
            try:
                value = row.get(column, 0)
                # Try to convert to float for numeric comparisons
                if isinstance(value, str):
                    try:
                        value = float(value)
                    except ValueError:
                        pass
                
                if isinstance(condition, (int, float)):
                    if value > condition:
                        filtered.append(row)
                else:
                    if value == condition:
                        filtered.append(row)
            except (ValueError, TypeError):
                continue
        return filtered
    
    @staticmethod
    def get_unique_values(data: List[Dict[str, Any]], column: str) -> List[str]:
        """Get unique values from a column"""
        unique_values = set()
        for row in data:
            value = row.get(column, '').strip()
            if value:
                unique_values.add(value)
        return list(unique_values) 