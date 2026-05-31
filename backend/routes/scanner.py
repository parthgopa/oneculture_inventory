"""
Scanner routes - barcode scanning and scanner device management
OPTIMIZED: Single MongoDB round-trip using find_one_and_update with embedded stock tracking
Target: <200ms per scan (was >1000ms)
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from threading import Thread
import time
from db import (
    barcodes_collection, 
    scan_events_collection, 
    scanners_collection,
    alerts_collection,
    STOCK_THRESHOLD
)

scanner_bp = Blueprint('scanner', __name__)

# ══════════════════════════════════════════════════════════════════════════════
# INDEX SETUP: Run once on startup for optimal query performance
# ══════════════════════════════════════════════════════════════════════════════
def ensure_indexes():
    """Create indexes for fast lookups - idempotent, safe to call multiple times"""
    try:
        # Primary lookup index on barcodes
        barcodes_collection.create_index('barcode_id', unique=True, background=True)
        # Compound index for scan events queries
        scan_events_collection.create_index(
            [('barcode_id', 1), ('timestamp', -1)], 
            background=True
        )
        print("[SCANNER] Indexes ensured")
    except Exception as e:
        print(f"[SCANNER] Index creation note: {e}")

# Call on module load
ensure_indexes()


# ══════════════════════════════════════════════════════════════════════════════
# ASYNC HELPERS: Fire-and-forget operations that don't block response
# ══════════════════════════════════════════════════════════════════════════════
def insert_scan_event_async(barcode_id, action_type, company_name, sku_name):
    """Insert scan event in background thread - doesn't block response"""
    def _insert():
        try:
            scan_events_collection.insert_one({
                'barcode_id': barcode_id,
                'action_type': action_type,
                'timestamp': datetime.now(),
                'company_name': company_name,
                'sku_name': sku_name
            })
        except Exception as e:
            print(f"[SCAN-EVENT] Async insert error: {e}")
    
    Thread(target=_insert, daemon=True).start()


def check_alerts_async(barcode_id, current_stock, sku_name, company_name):
    """Check and create alerts in background thread"""
    def _check():
        try:
            if current_stock == 0:
                alerts_collection.update_one(
                    {'barcode_id': barcode_id, 'resolved': False},
                    {'$set': {
                        'company_name': company_name,
                        'sku_name': sku_name,
                        'alert_type': 'OUT_OF_STOCK',
                        'message': f'{sku_name} is out of stock',
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
                        'company_name': company_name,
                        'sku_name': sku_name,
                        'alert_type': 'LOW_STOCK',
                        'message': f'{sku_name} is running low (Stock: {current_stock})',
                        'current_stock': current_stock,
                        'created_at': datetime.now(),
                        'resolved': False
                    }},
                    upsert=True
                )
            else:
                alerts_collection.update_many(
                    {'barcode_id': barcode_id, 'resolved': False},
                    {'$set': {'resolved': True, 'resolved_at': datetime.now()}}
                )
        except Exception as e:
            print(f"[ALERTS] Async check error: {e}")
    
    Thread(target=_check, daemon=True).start()


# ══════════════════════════════════════════════════════════════════════════════
# STOCK IN ROUTE: POST /api/scan/in
# Single MongoDB round-trip using find_one_and_update
# ══════════════════════════════════════════════════════════════════════════════
@scanner_bp.route('/api/scan/in', methods=['POST'])
def scan_stock_in():
    """
    Stock IN - increment stock by 1
    Uses atomic find_one_and_update for single round-trip
    """
    start_time = time.time()
    
    data = request.json
    barcode_id = data.get('barcode_id')
    
    if not barcode_id:
        return jsonify({'error': 'Barcode ID required'}), 400
    
    # SINGLE ROUND-TRIP: Atomically check last_action, increment stock, update last_action
    # Returns the document BEFORE update so we can check duplicate
    doc = barcodes_collection.find_one_and_update(
        {'barcode_id': barcode_id},
        {
            '$inc': {'current_stock': 1},
            '$set': {'last_action': 'IN', 'last_scan_at': datetime.now()}
        },
        projection={'barcode_id': 1, 'company_name': 1, 'sku_name': 1, 'mrp': 1, 
                    'current_stock': 1, 'last_action': 1},
        return_document=False  # Return BEFORE update to check duplicate
    )
    
    db_time = time.time() - start_time
    
    if not doc:
        print(f"[SCAN/IN] Not found: {barcode_id} | {db_time*1000:.0f}ms")
        return jsonify({'error': 'Barcode not found'}), 404
    
    # Check for duplicate scan (was already IN)
    if doc.get('last_action') == 'IN':
        # Rollback the increment we just did
        barcodes_collection.update_one(
            {'barcode_id': barcode_id},
            {'$inc': {'current_stock': -1}, '$set': {'last_action': 'IN'}}
        )
        print(f"[SCAN/IN] Duplicate: {doc['sku_name']} | {db_time*1000:.0f}ms")
        return jsonify({
            'error': 'already_in',
            'sku_name': doc['sku_name'],
            'current_stock': doc.get('current_stock', 0)
        }), 409
    
    # Calculate new stock (old stock + 1)
    old_stock = doc.get('current_stock', 0)
    new_stock = old_stock + 1
    
    # Fire async operations (don't block response)
    insert_scan_event_async(barcode_id, 'IN', doc['company_name'], doc['sku_name'])
    check_alerts_async(barcode_id, new_stock, doc['sku_name'], doc['company_name'])
    
    total_time = time.time() - start_time
    print(f"[SCAN/IN] {doc['sku_name']} | Stock: {new_stock} | DB: {db_time*1000:.0f}ms | Total: {total_time*1000:.0f}ms")
    
    return jsonify({
        'message': 'Scan recorded successfully',
        'barcode_id': barcode_id,
        'action_type': 'IN',
        'current_stock': new_stock,
        'sku_name': doc['sku_name'],
        'company_name': doc['company_name'],
        'mrp': doc.get('mrp', 0)
    }), 201


# ══════════════════════════════════════════════════════════════════════════════
# STOCK OUT ROUTE: POST /api/scan/out
# Single MongoDB round-trip using find_one_and_update
# ══════════════════════════════════════════════════════════════════════════════
@scanner_bp.route('/api/scan/out', methods=['POST'])
def scan_stock_out():
    """
    Stock OUT - decrement stock by 1
    Uses atomic find_one_and_update for single round-trip
    """
    start_time = time.time()
    
    data = request.json
    barcode_id = data.get('barcode_id')
    
    if not barcode_id:
        return jsonify({'error': 'Barcode ID required'}), 400
    
    # First, get current state to validate
    doc = barcodes_collection.find_one(
        {'barcode_id': barcode_id},
        {'barcode_id': 1, 'company_name': 1, 'sku_name': 1, 'mrp': 1, 
         'current_stock': 1, 'last_action': 1}
    )
    
    if not doc:
        print(f"[SCAN/OUT] Not found: {barcode_id}")
        return jsonify({'error': 'Barcode not found'}), 404
    
    current_stock = doc.get('current_stock', 0)
    last_action = doc.get('last_action')
    
    # Check for duplicate scan (was already OUT)
    if last_action == 'OUT':
        db_time = time.time() - start_time
        print(f"[SCAN/OUT] Duplicate: {doc['sku_name']} | {db_time*1000:.0f}ms")
        return jsonify({
            'error': 'already_out',
            'sku_name': doc['sku_name'],
            'current_stock': current_stock
        }), 409
    
    # Check stock availability
    if current_stock <= 0:
        db_time = time.time() - start_time
        print(f"[SCAN/OUT] No stock: {doc['sku_name']} | {db_time*1000:.0f}ms")
        return jsonify({
            'error': 'no_stock',
            'sku_name': doc['sku_name'],
            'current_stock': current_stock
        }), 400
    
    # Atomic decrement
    barcodes_collection.update_one(
        {'barcode_id': barcode_id},
        {
            '$inc': {'current_stock': -1},
            '$set': {'last_action': 'OUT', 'last_scan_at': datetime.now()}
        }
    )
    
    db_time = time.time() - start_time
    new_stock = current_stock - 1
    
    # Fire async operations
    insert_scan_event_async(barcode_id, 'OUT', doc['company_name'], doc['sku_name'])
    check_alerts_async(barcode_id, new_stock, doc['sku_name'], doc['company_name'])
    
    total_time = time.time() - start_time
    print(f"[SCAN/OUT] {doc['sku_name']} | Stock: {new_stock} | DB: {db_time*1000:.0f}ms | Total: {total_time*1000:.0f}ms")
    
    return jsonify({
        'message': 'Scan recorded successfully',
        'barcode_id': barcode_id,
        'action_type': 'OUT',
        'current_stock': new_stock,
        'sku_name': doc['sku_name'],
        'company_name': doc['company_name'],
        'mrp': doc.get('mrp', 0)
    }), 201


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY ROUTE: Keep /api/scan for backward compatibility (redirects to new routes)
# ══════════════════════════════════════════════════════════════════════════════
@scanner_bp.route('/api/scan', methods=['POST'])
def scan_barcode_legacy():
    """
    Legacy route - redirects to /api/scan/in or /api/scan/out based on action_type
    DEPRECATED: Frontend should use /api/scan/in or /api/scan/out directly
    """
    data = request.json
    action_type = data.get('action_type')
    
    if action_type == 'IN':
        return scan_stock_in()
    elif action_type == 'OUT':
        return scan_stock_out()
    else:
        return jsonify({'error': 'action_type required (IN or OUT)'}), 400


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
