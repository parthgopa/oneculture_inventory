"""
Scanner routes - barcode scanning and scanner device management
Optimized for high-performance multi-scanner environments
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from db import (
    barcodes_collection, 
    scan_events_collection, 
    scanners_collection,
    alerts_collection,
    STOCK_THRESHOLD
)

scanner_bp = Blueprint('scanner', __name__)


def get_barcode_scan_info(barcode_id):
    """
    Single aggregation query to get:
    - Last action type (IN/OUT)
    - Current stock (IN count - OUT count)
    Returns: (last_action, current_stock)
    """
    pipeline = [
        {'$match': {'barcode_id': barcode_id}},
        {'$sort': {'timestamp': -1}},
        {'$group': {
            '_id': '$barcode_id',
            'last_action': {'$first': '$action_type'},
            'in_count': {'$sum': {'$cond': [{'$eq': ['$action_type', 'IN']}, 1, 0]}},
            'out_count': {'$sum': {'$cond': [{'$eq': ['$action_type', 'OUT']}, 1, 0]}}
        }},
        {'$project': {
            'last_action': 1,
            'stock': {'$subtract': ['$in_count', '$out_count']}
        }}
    ]
    
    result = list(scan_events_collection.aggregate(pipeline))
    
    if result:
        return result[0]['last_action'], result[0]['stock']
    return None, 0


def check_and_create_alerts_async(barcode_id, current_stock, barcode_doc):
    """Create alerts for low/out of stock - optimized with upsert"""
    if current_stock == 0:
        alerts_collection.update_one(
            {'barcode_id': barcode_id, 'resolved': False},
            {'$set': {
                'company_name': barcode_doc['company_name'],
                'sku_name': barcode_doc['sku_name'],
                'alert_type': 'OUT_OF_STOCK',
                'message': f'{barcode_doc["sku_name"]} is out of stock',
                'current_stock': current_stock,
                'created_at': datetime.now(),
                'resolved': False
            }},
            upsert=True
        )
    elif current_stock < STOCK_THRESHOLD:
        alerts_collection.update_one(
            {'barcode_id': barcode_id, 'resolved': False},
            {'$set': {
                'company_name': barcode_doc['company_name'],
                'sku_name': barcode_doc['sku_name'],
                'alert_type': 'LOW_STOCK',
                'message': f'{barcode_doc["sku_name"]} is running low (Stock: {current_stock})',
                'current_stock': current_stock,
                'created_at': datetime.now(),
                'resolved': False
            }},
            upsert=True
        )
    else:
        # Resolve any existing alerts
        alerts_collection.update_many(
            {'barcode_id': barcode_id, 'resolved': False},
            {'$set': {'resolved': True, 'resolved_at': datetime.now()}}
        )


@scanner_bp.route('/api/scan', methods=['POST'])
def scan_barcode():
    """
    Process a barcode scan - auto-toggles IN/OUT
    Optimized: Single aggregation for stock + last action
    """
    data = request.json
    barcode_id = data.get('barcode_id')
    print("Barcode ID:", barcode_id)
    if not barcode_id:
        return jsonify({'error': 'Barcode ID required'}), 400
    
    # Fast lookup with projection (only needed fields)
    barcode_doc = barcodes_collection.find_one(
        {'barcode_id': barcode_id},
        {'barcode_id': 1, 'company_name': 1, 'sku_name': 1, 'mrp': 1}
    )
    
    if not barcode_doc:
        return jsonify({'error': 'Barcode not found'}), 404
    
    # Single query for last action + current stock
    last_action, current_stock = get_barcode_scan_info(barcode_id)
    
    # Auto-toggle: if last action was IN, do OUT. Otherwise do IN.
    action_type = 'OUT' if last_action == 'IN' else 'IN'
    
    if action_type == 'OUT' and current_stock <= 0:
        return jsonify({'error': 'Insufficient stock'}), 400
    
    # Insert scan event
    scan_events_collection.insert_one({
        'barcode_id': barcode_id,
        'action_type': action_type,
        'timestamp': datetime.now(),
        'company_name': barcode_doc['company_name'],
        'sku_name': barcode_doc['sku_name']
    })
    
    # Calculate new stock
    new_stock = current_stock + 1 if action_type == 'IN' else current_stock - 1
    
    print(f"[SCAN] {barcode_doc['sku_name']} | {action_type} | Stock: {new_stock}")
    
    # Check alerts (non-blocking for response)
    check_and_create_alerts_async(barcode_id, new_stock, barcode_doc)
    
    return jsonify({
        'message': 'Scan recorded successfully',
        'barcode_id': barcode_id,
        'action_type': action_type,
        'current_stock': new_stock,
        'sku_name': barcode_doc['sku_name'],
        'company_name': barcode_doc['company_name'],
        'mrp': barcode_doc.get('mrp', 0)
    }), 201


@scanner_bp.route('/api/scan-events', methods=['GET'])
def get_scan_events():
    """Get scan events - optimized with limit and projection"""
    try:
        barcode_id = request.args.get('barcode_id')
        limit = request.args.get('limit', 50, type=int)  # Default 50, max 500
        limit = min(limit, 500)
        
        query = {}
        if barcode_id:
            query['barcode_id'] = barcode_id
        
        # Use projection to fetch only needed fields
        events = list(
            scan_events_collection.find(query)
            .sort('timestamp', -1)
            .limit(limit)
        )
        
        # Fast serialization
        for event in events:
            event['_id'] = str(event['_id'])
            if 'timestamp' in event:
                event['timestamp'] = event['timestamp'].isoformat()
        
        return jsonify(events), 200
    except Exception as e:
        print(f"[SCAN-EVENTS] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@scanner_bp.route('/api/scanners', methods=['GET'])
def get_scanners():
    """Get all registered scanners"""
    try:
        scanners = list(scanners_collection.find().sort('serial_number', 1))
        for scanner in scanners:
            scanner['_id'] = str(scanner['_id'])
        return jsonify(scanners), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@scanner_bp.route('/api/scanners', methods=['POST'])
def save_scanner():
    """Register or update a scanner"""
    try:
        data = request.json
        print(f"[SCANNER] Saving scanner: {data}")
        
        scanner_id = data.get('scanner_id')
        if not scanner_id:
            return jsonify({'error': 'scanner_id is required'}), 400
        
        existing = scanners_collection.find_one({'scanner_id': scanner_id})
        
        if existing:
            scanners_collection.update_one(
                {'scanner_id': scanner_id},
                {'$set': {
                    'name': data.get('name'),
                    'type': data.get('type'),
                    'vendor_id': data.get('vendor_id'),
                    'product_id': data.get('product_id'),
                    'last_connected': datetime.now()
                }}
            )
            print(f"[SCANNER] Updated existing scanner: {scanner_id}")
            updated = scanners_collection.find_one({'scanner_id': scanner_id})
            updated['_id'] = str(updated['_id'])
            return jsonify(updated), 200
        else:
            serial_number = scanners_collection.count_documents({}) + 1
            scanner_doc = {
                'scanner_id': scanner_id,
                'serial_number': serial_number,
                'name': data.get('name', f'Scanner {serial_number}'),
                'type': data.get('type', 'USB'),
                'mode': data.get('mode', 'IN'),
                'vendor_id': data.get('vendor_id'),
                'product_id': data.get('product_id'),
                'created_at': datetime.now(),
                'last_connected': datetime.now(),
                'active': True
            }
            result = scanners_collection.insert_one(scanner_doc)
            scanner_doc['_id'] = str(result.inserted_id)
            print(f"[SCANNER] Created new scanner #{serial_number}: {scanner_id}")
            return jsonify(scanner_doc), 201
    except Exception as e:
        print(f"[SCANNER] Error saving scanner: {str(e)}")
        return jsonify({'error': str(e)}), 500


@scanner_bp.route('/api/scanners/cleanup-duplicates', methods=['DELETE'])
def cleanup_duplicate_scanners():
    """Remove duplicate scanner entries"""
    try:
        pipeline = [
            {'$sort': {'serial_number': 1}},
            {'$group': {'_id': '$scanner_id', 'keep_id': {'$first': '$_id'}, 'all_ids': {'$push': '$_id'}}},
        ]
        groups = list(scanners_collection.aggregate(pipeline))
        removed = 0
        for group in groups:
            duplicates = [oid for oid in group['all_ids'] if oid != group['keep_id']]
            if duplicates:
                scanners_collection.delete_many({'_id': {'$in': duplicates}})
                removed += len(duplicates)
        return jsonify({'message': f'Removed {removed} duplicate scanner(s)'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@scanner_bp.route('/api/scanners/<scanner_id>/mode', methods=['PUT'])
def update_scanner_mode(scanner_id):
    """Update scanner mode (IN/OUT)"""
    try:
        data = request.json
        mode = data.get('mode')
        
        if mode not in ['IN', 'OUT']:
            return jsonify({'error': 'Invalid mode'}), 400
        
        result = scanners_collection.update_one(
            {'scanner_id': scanner_id},
            {'$set': {'mode': mode}}
        )
        
        if result.modified_count > 0:
            print(f"[SCANNER] Updated scanner {scanner_id} mode to {mode}")
            return jsonify({'message': 'Mode updated', 'mode': mode}), 200
        else:
            return jsonify({'error': 'Scanner not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@scanner_bp.route('/api/scanners/<scanner_id>', methods=['DELETE'])
def delete_scanner(scanner_id):
    """Delete a scanner"""
    try:
        result = scanners_collection.delete_one({'scanner_id': scanner_id})
        if result.deleted_count > 0:
            print(f"[SCANNER] Deleted scanner: {scanner_id}")
            return jsonify({'message': 'Scanner deleted'}), 200
        else:
            return jsonify({'error': 'Scanner not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
