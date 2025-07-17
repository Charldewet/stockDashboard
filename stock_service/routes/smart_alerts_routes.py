from flask import Blueprint, request, jsonify
from services.smart_alerts_service import SmartAlertsService

smart_alerts_bp = Blueprint('smart_alerts', __name__, url_prefix='/api/stock/smart-alerts')

@smart_alerts_bp.route('/all/<pharmacy_id>/<date>', methods=['GET'])
def get_all_smart_alerts(pharmacy_id, date):
    """Get all smart alerts for a specific pharmacy and date"""
    try:
        alerts = SmartAlertsService.get_all_smart_alerts(pharmacy_id, date)
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_alerts_bp.route('/high-volume-low-margin/<pharmacy_id>/<date>', methods=['GET'])
def get_high_volume_low_margin_alerts(pharmacy_id, date):
    """Get high-volume low-margin alerts for a specific pharmacy and date"""
    try:
        limit = request.args.get('limit', 10, type=int)
        alerts = SmartAlertsService.get_high_volume_low_margin_alerts(pharmacy_id, date, limit)
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_alerts_bp.route('/department-gp-decline/<pharmacy_id>/<date>', methods=['GET'])
def get_department_gp_decline_alerts(pharmacy_id, date):
    """Get department GP decline alerts for a specific pharmacy and date"""
    try:
        limit = request.args.get('limit', 10, type=int)
        alerts = SmartAlertsService.get_department_gp_decline_alerts(pharmacy_id, date, limit)
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_alerts_bp.route('/overstock-warnings/<pharmacy_id>/<date>', methods=['GET'])
def get_overstock_warnings(pharmacy_id, date):
    """Get overstock warnings for a specific pharmacy and date"""
    try:
        threshold_days = request.args.get('threshold_days', 60, type=int)
        limit = request.args.get('limit', 20, type=int)
        alerts = SmartAlertsService.get_overstock_warnings(pharmacy_id, date, threshold_days, limit)
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_alerts_bp.route('/supplier-performance/<pharmacy_id>/<date>', methods=['GET'])
def get_supplier_performance_alerts(pharmacy_id, date):
    """Get supplier performance alerts for a specific pharmacy and date"""
    try:
        limit = request.args.get('limit', 10, type=int)
        alerts = SmartAlertsService.get_supplier_performance_alerts(pharmacy_id, date, limit)
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_alerts_bp.route('/price-point-analysis/<pharmacy_id>/<date>', methods=['GET'])
def get_price_point_analysis_alerts(pharmacy_id, date):
    """Get price point analysis alerts for a specific pharmacy and date"""
    try:
        limit = request.args.get('limit', 15, type=int)
        alerts = SmartAlertsService.get_price_point_analysis_alerts(pharmacy_id, date, limit)
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@smart_alerts_bp.route('/weekday-patterns/<pharmacy_id>/<date>', methods=['GET'])
def get_weekday_pattern_alerts(pharmacy_id, date):
    """Get weekday pattern alerts for a specific pharmacy and date"""
    try:
        limit = request.args.get('limit', 15, type=int)
        alerts = SmartAlertsService.get_weekday_pattern_alerts(pharmacy_id, date, limit)
        return jsonify(alerts), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500 