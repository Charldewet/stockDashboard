#!/usr/bin/env python3
"""
Test script to check what department codes are in the stock levels data
"""

import requests
import json

def test_stock_levels_api():
    """Test the stock levels API to see what department codes are returned"""
    
    # Test the API endpoint
    url = "http://localhost:5001/api/stock/stock_levels/REITZ"
    params = {"min_days": 7}
    
    try:
        print("🔍 Testing stock levels API...")
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            products = data.get('products', [])
            
            print(f"✅ API call successful. Found {len(products)} products")
            
            # Get unique department codes
            dept_codes = set()
            dept_names = set()
            
            for product in products[:10]:  # Look at first 10 products
                dept_code = product.get('departmentCode', 'NO_CODE')
                dept_name = product.get('departmentName', 'NO_NAME')
                dept_codes.add(dept_code)
                dept_names.add(dept_name)
                print(f"  📦 {product.get('productName', 'NO_NAME')[:50]}...")
                print(f"     Code: {dept_code}, Name: {dept_name}")
            
            print(f"\n📊 Summary:")
            print(f"  Unique department codes: {len(dept_codes)}")
            print(f"  Unique department names: {len(dept_names)}")
            print(f"  Sample codes: {list(dept_codes)[:5]}")
            print(f"  Sample names: {list(dept_names)[:5]}")
            
        else:
            print(f"❌ API call failed with status {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing API: {e}")

if __name__ == "__main__":
    test_stock_levels_api() 