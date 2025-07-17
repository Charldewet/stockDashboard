from flask import Blueprint, request, jsonify
from services.analytics_service import AnalyticsService

stock_bp = Blueprint('stock', __name__, url_prefix='/api/stock')

@stock_bp.route('/daily_summary/<pharmacy_id>/<date>', methods=['GET'])
def get_daily_summary(pharmacy_id, date):
    """Get daily stock summary for a specific pharmacy and date"""
    try:
        summary = AnalyticsService.get_daily_summary(pharmacy_id, date)
        return jsonify(summary), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/top_moving/<pharmacy_id>/<date>', methods=['GET'])
def get_top_moving_products(pharmacy_id, date):
    """Get top moving products for a specific pharmacy and date"""
    try:
        limit = request.args.get('limit', 10, type=int)
        products = AnalyticsService.get_top_moving_products(pharmacy_id, date, limit)
        return jsonify(products), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/low_stock_alerts/<pharmacy_id>/<date>', methods=['GET'])
def get_low_stock_alerts(pharmacy_id, date):
    """Get low stock alerts for a specific pharmacy and date"""
    try:
        threshold_days = request.args.get('threshold_days', 7, type=int)
        alerts = AnalyticsService.get_low_stock_alerts(pharmacy_id, date, threshold_days)
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/movements/<pharmacy_id>/<start_date>/<end_date>', methods=['GET'])
def get_stock_movements(pharmacy_id, start_date, end_date):
    """Get stock movements for a specific pharmacy and date range"""
    try:
        movements = AnalyticsService.get_stock_movements(pharmacy_id, start_date, end_date)
        return jsonify(movements), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/recommendations/<pharmacy_id>', methods=['GET'])
def get_reorder_recommendations(pharmacy_id):
    """Get reorder recommendations for a specific pharmacy"""
    try:
        analysis_days = request.args.get('analysis_days', 30, type=int)
        recommendations = AnalyticsService.get_reorder_recommendations(pharmacy_id, analysis_days)
        return jsonify(recommendations), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/kpis/<pharmacy_id>/<date>', methods=['GET'])
def get_stock_kpis(pharmacy_id, date):
    """Get stock KPIs for a specific pharmacy and date"""
    try:
        kpis = AnalyticsService.get_stock_kpis(pharmacy_id, date)
        return jsonify(kpis), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/low_gp_products/<pharmacy_id>/<date>', methods=['GET'])
def get_low_gp_products(pharmacy_id, date):
    """Get products with low GP for a specific pharmacy and date"""
    try:
        gp_threshold = request.args.get('threshold', 20, type=float)
        products = AnalyticsService.get_low_gp_products(pharmacy_id, date, gp_threshold)
        return jsonify(products), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/top_departments/<pharmacy_id>/<date>', methods=['GET'])
def get_top_performing_departments(pharmacy_id, date):
    """Get top performing departments for a specific pharmacy and date"""
    try:
        limit = request.args.get('limit', 5, type=int)
        departments = AnalyticsService.get_top_performing_departments(pharmacy_id, date, limit)
        return jsonify(departments), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/departments_heatmap/<pharmacy_id>/<date>', methods=['GET'])
def get_departments_heatmap(pharmacy_id, date):
    """Get all departments with sales data for heatmap visualization"""
    try:
        departments = AnalyticsService.get_departments_heatmap_data(pharmacy_id, date)
        return jsonify(departments), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/low_gp_products_by_department/<pharmacy_id>/<date>/<department_code>', methods=['GET'])
def get_low_gp_products_by_department(pharmacy_id, date, department_code):
    """Get products with low GP for a specific department"""
    try:
        gp_threshold = request.args.get('threshold', 25, type=float)
        products = AnalyticsService.get_low_gp_products_by_department(pharmacy_id, date, department_code, gp_threshold)
        return jsonify(products), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        from database import get_db_stats
        from flask import current_app
        
        stats = get_db_stats(current_app._get_current_object())
        
        return jsonify({
            'status': 'healthy',
            'database_stats': stats,
            'message': 'Stock service is operational'
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500 