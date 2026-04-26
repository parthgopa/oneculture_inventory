"""
Alerts routes
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
from db import alerts_collection

alerts_bp = Blueprint('alerts', __name__)


@alerts_bp.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Get all alerts - filtering done in frontend"""
    try:
        alerts = list(alerts_collection.find().sort('created_at', -1))
        
        for alert in alerts:
            alert['_id'] = str(alert['_id'])
            alert['created_at'] = alert['created_at'].isoformat()
            if alert.get('resolved_at'):
                alert['resolved_at'] = alert['resolved_at'].isoformat()
        
        return jsonify(alerts), 200
    except Exception as e:
        print(f"[ALERTS] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@alerts_bp.route('/api/alerts/<alert_id>/resolve', methods=['PUT'])
def resolve_alert(alert_id):
    """Mark an alert as resolved"""
    try:
        result = alerts_collection.update_one(
            {'_id': ObjectId(alert_id)},
            {'$set': {'resolved': True, 'resolved_at': datetime.now()}}
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Alert not found'}), 404
        
        return jsonify({'message': 'Alert resolved'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alerts_bp.route('/api/alerts/<alert_id>', methods=['DELETE'])
def delete_alert(alert_id):
    """Delete an alert"""
    try:
        result = alerts_collection.delete_one({'_id': ObjectId(alert_id)})
        
        if result.deleted_count == 0:
            return jsonify({'error': 'Alert not found'}), 404
        
        return jsonify({'message': 'Alert deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
