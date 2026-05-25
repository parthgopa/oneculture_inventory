"""
Global preferences route - no user system, single shared preferences document
"""
from flask import Blueprint, request, jsonify
from db import db

auth_bp = Blueprint('auth', __name__)

preferences_collection = db['app_preferences']
PREFS_DOC_ID = 'global'
DEFAULT_PREFS = {'lowStockThreshold': 50}


@auth_bp.route('/api/preferences', methods=['GET'])
def get_preferences():
    """Get global app preferences"""
    try:
        doc = preferences_collection.find_one({'_id': PREFS_DOC_ID})
        prefs = doc.get('preferences', DEFAULT_PREFS) if doc else DEFAULT_PREFS
        return jsonify(prefs), 200
    except Exception as e:
        print(f"[PREFS] get_preferences error: {str(e)}")
        return jsonify(DEFAULT_PREFS), 200


@auth_bp.route('/api/preferences', methods=['PUT'])
def update_preferences():
    """Save global app preferences"""
    try:
        data = request.json
        preferences = data.get('preferences')
        if preferences is None:
            return jsonify({'error': 'preferences required'}), 400

        preferences_collection.update_one(
            {'_id': PREFS_DOC_ID},
            {'$set': {'preferences': preferences}},
            upsert=True
        )
        print(f"[PREFS] Global preferences updated: {preferences}")
        return jsonify({'message': 'Preferences saved'}), 200
    except Exception as e:
        print(f"[PREFS] update_preferences error: {str(e)}")
        return jsonify({'error': 'Failed to save preferences'}), 500
