from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from services.import_service import ImportService
import os
import tempfile

import_bp = Blueprint('import', __name__)

def allowed_file(filename, file_type='csv'):
    """Check if file has allowed extension"""
    if file_type == 'csv':
        return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'csv'
    elif file_type == 'pdf':
        return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'pdf'
    elif file_type == 'daily':
        # For daily sales, allow both CSV and PDF
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ['csv', 'pdf']
    return False

@import_bp.route('/departments', methods=['POST'])
def import_departments():
    """Import departments from CSV file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only CSV files allowed'}), 400
        
        pharmacy_id = request.form.get('pharmacy_id', 'REITZ')
        
        # Save file temporarily
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as temp_file:
            file.save(temp_file.name)
            
            try:
                # Import departments
                result = ImportService.import_departments(temp_file.name, pharmacy_id)
                
                # Clean up temp file
                os.unlink(temp_file.name)
                
                if result['success']:
                    return jsonify(result), 200
                else:
                    return jsonify(result), 500
                    
            except Exception as e:
                # Clean up temp file on error
                if os.path.exists(temp_file.name):
                    os.unlink(temp_file.name)
                raise e
                
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@import_bp.route('/history', methods=['POST'])
def import_sales_history():
    """Import sales history from CSV file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only CSV files allowed'}), 400
        
        pharmacy_id = request.form.get('pharmacy_id', 'REITZ')
        
        # Save file temporarily
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as temp_file:
            file.save(temp_file.name)
            
            try:
                # Import sales history
                result = ImportService.import_sales_history(temp_file.name, pharmacy_id)
                
                # Clean up temp file
                os.unlink(temp_file.name)
                
                if result['success']:
                    return jsonify(result), 200
                else:
                    return jsonify(result), 500
                    
            except Exception as e:
                # Clean up temp file on error
                if os.path.exists(temp_file.name):
                    os.unlink(temp_file.name)
                raise e
                
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@import_bp.route('/daily', methods=['POST'])
def import_daily_sales():
    """Import daily sales from CSV or PDF file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, 'daily'):
            return jsonify({'error': 'Invalid file type. Only CSV and PDF files allowed'}), 400
        
        pharmacy_id = request.form.get('pharmacy_id', 'REITZ')
        sale_date = request.form.get('sale_date')  # Optional, defaults to today
        
        # Determine file extension for temporary file
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        # Save file temporarily
        with tempfile.NamedTemporaryFile(mode='wb', suffix=file_extension, delete=False) as temp_file:
            file.save(temp_file.name)
            
            try:
                # Import daily sales
                result = ImportService.import_daily_sales(temp_file.name, sale_date, pharmacy_id)
                
                # Clean up temp file
                os.unlink(temp_file.name)
                
                if result['success']:
                    return jsonify(result), 200
                else:
                    return jsonify(result), 500
                    
            except Exception as e:
                # Clean up temp file on error
                if os.path.exists(temp_file.name):
                    os.unlink(temp_file.name)
                raise e
                
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@import_bp.route('/delete-daily-sales', methods=['DELETE'])
def delete_daily_sales():
    """Delete daily sales records for a specific date"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        sale_date = data.get('sale_date')
        pharmacy_id = data.get('pharmacy_id', 'REITZ')
        
        if not sale_date:
            return jsonify({'error': 'sale_date is required'}), 400
        
        # Delete daily sales for the specified date
        result = ImportService.delete_daily_sales(sale_date, pharmacy_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            'error': f'Error deleting daily sales: {str(e)}',
            'success': False
        }), 500

@import_bp.route('/status', methods=['GET'])
def import_status():
    """Get import status and database statistics"""
    try:
        from database import get_db_stats
        from flask import current_app
        
        stats = get_db_stats(current_app._get_current_object())
        
        return jsonify({
            'status': 'operational',
            'database_stats': stats,
            'message': 'Import service is ready'
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500 