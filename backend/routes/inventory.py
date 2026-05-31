"""
Inventory routes - comprehensive inventory management
"""
from flask import Blueprint, request, jsonify, Response
from datetime import datetime
from bson import ObjectId
import csv
import io
from db import barcodes_collection, scan_events_collection, STOCK_THRESHOLD

inventory_bp = Blueprint('inventory', __name__)


@inventory_bp.route('/api/inventory', methods=['GET'])
def get_inventory():
    """
    Get inventory grouped by product (SKU + Color + Company).
    Shows products that have been scanned at least once.
    OPTIMIZED: Does not load images - use separate endpoint for images.
    """
    try:
        # First get all scan events with their barcode details
        scan_pipeline = [
            # Lookup barcode details to get color
            {
                '$lookup': {
                    'from': 'barcodes',
                    'localField': 'barcode_id',
                    'foreignField': 'barcode_id',
                    'as': 'barcode_info'
                }
            },
            # Unwind the barcode info array (should be 1:1)
            {'$unwind': {'path': '$barcode_info', 'preserveNullAndEmptyArrays': True}},
            # Group by barcode_id with color and size
            {
                '$group': {
                    '_id': '$barcode_id',
                    'company_name': {'$first': '$company_name'},
                    'sku_name': {'$first': '$sku_name'},
                    'color': {'$first': {'$ifNull': ['$barcode_info.color', '']}},
                    'size': {'$first': {'$ifNull': ['$barcode_info.size', '']}},
                    'total_in': {
                        '$sum': {'$cond': [{'$eq': ['$action_type', 'IN']}, 1, 0]}
                    },
                    'total_out': {
                        '$sum': {'$cond': [{'$eq': ['$action_type', 'OUT']}, 1, 0]}
                    },
                    'last_scanned': {'$max': '$timestamp'},
                    'first_scanned': {'$min': '$timestamp'},
                    'total_scans': {'$sum': 1}
                }
            },
            # Calculate current stock per barcode
            {
                '$addFields': {
                    'current_stock': {'$subtract': ['$total_in', '$total_out']}
                }
            },
            # Now group by product (sku + color + company)
            {
                '$group': {
                    '_id': {
                        'sku_name': '$sku_name',
                        'color': '$color',
                        'company_name': '$company_name'
                    },
                    'size': {'$first': '$size'},
                    'barcodes': {'$push': '$_id'},
                    'barcode_count': {'$sum': 1},
                    'total_stock': {'$sum': '$current_stock'},
                    'total_in': {'$sum': '$total_in'},
                    'total_out': {'$sum': '$total_out'},
                    'total_scans': {'$sum': '$total_scans'},
                    'last_scanned': {'$max': '$last_scanned'},
                    'first_scanned': {'$min': '$first_scanned'}
                }
            },
            # Reshape output
            {
                '$project': {
                    '_id': 0,
                    'sku_name': '$_id.sku_name',
                    'color': '$_id.color',
                    'company_name': '$_id.company_name',
                    'size': 1,
                    'barcodes': 1,
                    'barcode_count': 1,
                    'total_stock': 1,
                    'total_in': 1,
                    'total_out': 1,
                    'total_scans': 1,
                    'last_scanned': 1,
                    'first_scanned': 1,
                    'status': {
                        '$cond': {
                            'if': {'$eq': ['$total_stock', 0]},
                            'then': 'OUT_OF_STOCK',
                            'else': {
                                '$cond': {
                                    'if': {'$lt': ['$total_stock', STOCK_THRESHOLD]},
                                    'then': 'LOW_STOCK',
                                    'else': 'IN_STOCK'
                                }
                            }
                        }
                    }
                }
            },
            {'$sort': {'last_scanned': -1}}
        ]

        products = list(scan_events_collection.aggregate(scan_pipeline))

        # Get MRP and batch_id from barcodes collection (NO IMAGES - too slow)
        all_barcodes = []
        for product in products:
            if product['barcodes']:
                all_barcodes.append(product['barcodes'][0])

        # Single query to get all barcode docs
        barcode_docs = {
            doc['barcode_id']: doc
            for doc in barcodes_collection.find(
                {'barcode_id': {'$in': all_barcodes}},
                {'barcode_id': 1, 'mrp': 1, 'batch_id': 1, 'color': 1, 'size': 1}
            )
        }

        for product in products:
            if product['barcodes']:
                barcode_doc = barcode_docs.get(product['barcodes'][0])
                if barcode_doc:
                    product['mrp'] = barcode_doc.get('mrp', 0)
                    product['batch_id'] = barcode_doc.get('batch_id', '')
                    # Use color/size from barcode if not already set
                    if not product.get('color') and barcode_doc.get('color'):
                        product['color'] = barcode_doc.get('color')
                    if not product.get('size') and barcode_doc.get('size'):
                        product['size'] = barcode_doc.get('size')
                else:
                    product['mrp'] = 0
                    product['batch_id'] = ''

            # Format dates
            if product.get('last_scanned'):
                product['last_scanned'] = product['last_scanned'].isoformat()
            if product.get('first_scanned'):
                product['first_scanned'] = product['first_scanned'].isoformat()

        return jsonify(products), 200
    except Exception as e:
        print(f"[INVENTORY] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/api/inventory/product-images', methods=['GET'])
def get_all_product_images():
    """
    Return all product images in one query keyed by 'sku_name__color__company_name'.
    Single aggregation replaces N per-product image requests on the inventory page.
    """
    try:
        # One aggregation: for each (sku_name, color, company_name) pair find the first
        # barcode doc in the batch that carries a product_image field.
        pipeline = [
            {'$match': {'product_image': {'$exists': True, '$ne': None}}},
            {'$group': {
                '_id': {'sku_name': '$sku_name', 'color': '$color', 'company_name': '$company_name'},
                'image': {'$first': '$product_image'}
            }},
            {'$project': {
                '_id': 0,
                'sku_name': '$_id.sku_name',
                'color': '$_id.color',
                'company_name': '$_id.company_name',
                'image': 1
            }}
        ]
        results = list(barcodes_collection.aggregate(pipeline))
        # Key by "sku_name__color__company_name" for easy frontend lookup
        images = {f"{r['sku_name']}__{r.get('color', '')}__{r['company_name']}": r['image'] for r in results}
        return jsonify(images), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/api/inventory/product-image/<sku_name>', methods=['GET'])
def get_product_image(sku_name):
    """Get product image by SKU name - for lazy loading"""
    try:
        company_name = request.args.get('company')
        
        query = {'sku_name': sku_name}
        if company_name:
            query['company_name'] = company_name
        
        # Find a barcode for this product
        barcode = barcodes_collection.find_one(query, {'batch_id': 1})
        if not barcode:
            return jsonify({'image': None}), 200
        
        # Find image in batch
        batch_with_image = barcodes_collection.find_one(
            {'batch_id': barcode.get('batch_id'), 'product_image': {'$exists': True}},
            {'product_image': 1}
        )
        
        image = batch_with_image.get('product_image') if batch_with_image else None
        return jsonify({'image': image}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/api/inventory/all-barcodes', methods=['GET'])
def get_all_barcodes():
    """
    Get all barcodes (including unscanned ones) with their stock status.
    This shows the complete barcode-level inventory.
    """
    try:
        pipeline = [
            # Lookup scan events for each barcode
            {
                '$lookup': {
                    'from': 'scan_events',
                    'localField': 'barcode_id',
                    'foreignField': 'barcode_id',
                    'as': 'scan_events'
                }
            },
            # Calculate stock and scan stats
            {
                '$addFields': {
                    'total_in': {
                        '$size': {
                            '$filter': {
                                'input': '$scan_events',
                                'cond': {'$eq': ['$$this.action_type', 'IN']}
                            }
                        }
                    },
                    'total_out': {
                        '$size': {
                            '$filter': {
                                'input': '$scan_events',
                                'cond': {'$eq': ['$$this.action_type', 'OUT']}
                            }
                        }
                    },
                    'last_scanned': {'$max': '$scan_events.timestamp'},
                    'total_scans': {'$size': '$scan_events'}
                }
            },
            {
                '$addFields': {
                    'current_stock': {'$subtract': ['$total_in', '$total_out']},
                    'is_scanned': {'$gt': ['$total_scans', 0]}
                }
            },
            # Remove scan_events array
            {
                '$project': {
                    'scan_events': 0
                }
            },
            {'$sort': {'created_at': -1}}
        ]
        
        barcodes = list(barcodes_collection.aggregate(pipeline))
        
        for bc in barcodes:
            bc['_id'] = str(bc['_id'])
            if bc.get('last_scanned'):
                bc['last_scanned'] = bc['last_scanned'].isoformat()
            if bc.get('created_at'):
                bc['created_at'] = bc['created_at'].isoformat()
        
        return jsonify(barcodes), 200
    except Exception as e:
        print(f"[INVENTORY] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/api/inventory/product/<sku_name>', methods=['GET'])
def get_product_details(sku_name):
    """
    Get detailed inventory for a specific product (all barcodes for this SKU).
    """
    try:
        company_name = request.args.get('company')
        color = request.args.get('color', '').strip()

        # Find all barcodes for this product (optionally filtered by color)
        query = {'sku_name': sku_name}
        if company_name:
            query['company_name'] = company_name
        if color:
            query['color'] = color

        barcodes = list(barcodes_collection.find(query))
        
        if not barcodes:
            return jsonify({'error': 'Product not found'}), 404
        
        barcode_ids = [bc['barcode_id'] for bc in barcodes]
        
        # Get scan events for all barcodes
        scan_events = list(scan_events_collection.find(
            {'barcode_id': {'$in': barcode_ids}}
        ).sort('timestamp', -1))
        
        # Calculate stats per barcode (ALL barcodes - scanned and unscanned)
        barcode_stats = []
        for bc in barcodes:
            bc_id = bc['barcode_id']
            bc_events = [e for e in scan_events if e['barcode_id'] == bc_id]
            
            in_count = sum(1 for e in bc_events if e['action_type'] == 'IN')
            out_count = sum(1 for e in bc_events if e['action_type'] == 'OUT')
            
            barcode_stats.append({
                'barcode_id': bc_id,
                'batch_id': bc.get('batch_id', ''),
                'mrp': bc.get('mrp', 0),
                'color': bc.get('color', ''),
                'created_at': bc.get('created_at').isoformat() if bc.get('created_at') else None,
                'in_count': in_count,
                'out_count': out_count,
                'current_stock': in_count - out_count,
                'total_scans': len(bc_events),
                'last_scanned': bc_events[0]['timestamp'].isoformat() if bc_events else None
            })
        
        # Format scan events
        for event in scan_events:
            event['_id'] = str(event['_id'])
            event['timestamp'] = event['timestamp'].isoformat()
        
        # Calculate totals
        total_in = sum(s['in_count'] for s in barcode_stats)
        total_out = sum(s['out_count'] for s in barcode_stats)
        
        # Get product image
        batch_with_image = barcodes_collection.find_one(
            {'batch_id': barcodes[0].get('batch_id'), 'product_image': {'$exists': True}},
            {'product_image': 1}
        )
        product_image = batch_with_image.get('product_image') if batch_with_image else None
        
        return jsonify({
            'sku_name': sku_name,
            'company_name': barcodes[0]['company_name'],
            'color': barcodes[0].get('color', ''),
            'mrp': barcodes[0].get('mrp', 0),
            'batch_id': barcodes[0].get('batch_id', ''),
            'product_image': product_image,
            'total_barcodes': len(barcodes),  # ALL generated barcodes
            'total_scanned_barcodes': len([s for s in barcode_stats if s['total_scans'] > 0]),
            'total_stock': total_in - total_out,
            'total_in': total_in,
            'total_out': total_out,
            'barcodes': barcode_stats,
            'recent_scans': scan_events[:50]  # Last 50 scans
        }), 200
    except Exception as e:
        print(f"[INVENTORY] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/api/inventory/product/<sku_name>/export', methods=['GET'])
def export_product_csv(sku_name):
    """Export product inventory details to CSV"""
    try:
        company_name = request.args.get('company')
        
        query = {'sku_name': sku_name}
        if company_name:
            query['company_name'] = company_name
        
        barcodes = list(barcodes_collection.find(query))
        
        if not barcodes:
            return jsonify({'error': 'Product not found'}), 404
        
        barcode_ids = [bc['barcode_id'] for bc in barcodes]
        
        # Get scan events
        scan_events = list(scan_events_collection.find(
            {'barcode_id': {'$in': barcode_ids}}
        ).sort('timestamp', -1))
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header info
        writer.writerow(['Product Inventory Export'])
        writer.writerow(['SKU Name', sku_name])
        writer.writerow(['Color', barcodes[0].get('color', '')])
        writer.writerow(['Company', barcodes[0]['company_name']])
        writer.writerow(['MRP', barcodes[0].get('mrp', 0)])
        writer.writerow(['Export Date', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow([])

        # Barcode summary
        writer.writerow(['=== BARCODE SUMMARY ==='])
        writer.writerow(['Barcode ID', 'Batch ID', 'Color', 'Stock In', 'Stock Out', 'Current Stock', 'Total Scans', 'Last Scanned'])
        
        for bc in barcodes:
            bc_id = bc['barcode_id']
            bc_events = [e for e in scan_events if e['barcode_id'] == bc_id]
            
            if len(bc_events) == 0:
                continue
            
            in_count = sum(1 for e in bc_events if e['action_type'] == 'IN')
            out_count = sum(1 for e in bc_events if e['action_type'] == 'OUT')
            last_scan = bc_events[0]['timestamp'].strftime('%Y-%m-%d %H:%M:%S') if bc_events else 'Never'
            
            writer.writerow([
                bc_id,
                bc.get('batch_id', ''),
                bc.get('color', ''),
                in_count,
                out_count,
                in_count - out_count,
                len(bc_events),
                last_scan
            ])
        
        writer.writerow([])
        
        # Scan history
        writer.writerow(['=== SCAN HISTORY (Last 100) ==='])
        writer.writerow(['Timestamp', 'Barcode ID', 'Action', 'Scanner'])
        
        for event in scan_events[:100]:
            writer.writerow([
                event['timestamp'].strftime('%Y-%m-%d %H:%M:%S'),
                event['barcode_id'],
                event['action_type'],
                event.get('scanner_id', 'Manual')
            ])
        
        output.seek(0)
        
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename={sku_name.replace(" ", "_")}_inventory.csv'
            }
        )
    except Exception as e:
        print(f"[INVENTORY] CSV Export Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/api/inventory/barcode/<barcode_id>', methods=['GET'])
def get_barcode_details(barcode_id):
    """Get detailed info for a specific barcode"""
    try:
        barcode_doc = barcodes_collection.find_one({'barcode_id': barcode_id})
        
        if not barcode_doc:
            return jsonify({'error': 'Barcode not found'}), 404
        
        # Get all scan events for this barcode
        scan_events = list(scan_events_collection.find(
            {'barcode_id': barcode_id}
        ).sort('timestamp', -1))
        
        in_count = sum(1 for e in scan_events if e['action_type'] == 'IN')
        out_count = sum(1 for e in scan_events if e['action_type'] == 'OUT')
        
        # Format events
        for event in scan_events:
            event['_id'] = str(event['_id'])
            event['timestamp'] = event['timestamp'].isoformat()
        
        return jsonify({
            '_id': str(barcode_doc['_id']),
            'barcode_id': barcode_id,
            'company_name': barcode_doc['company_name'],
            'sku_name': barcode_doc['sku_name'],
            'color': barcode_doc.get('color', ''),
            'mrp': barcode_doc.get('mrp', 0),
            'batch_id': barcode_doc.get('batch_id', ''),
            'created_at': barcode_doc.get('created_at').isoformat() if barcode_doc.get('created_at') else None,
            'total_in': in_count,
            'total_out': out_count,
            'current_stock': in_count - out_count,
            'total_scans': len(scan_events),
            'scan_history': scan_events
        }), 200
    except Exception as e:
        print(f"[INVENTORY] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/api/inventory/summary', methods=['GET'])
def get_inventory_summary():
    """Get overall inventory summary stats"""
    try:
        # Get product-level summary
        pipeline = [
            {
                '$group': {
                    '_id': '$barcode_id',
                    'total_in': {
                        '$sum': {'$cond': [{'$eq': ['$action_type', 'IN']}, 1, 0]}
                    },
                    'total_out': {
                        '$sum': {'$cond': [{'$eq': ['$action_type', 'OUT']}, 1, 0]}
                    }
                }
            },
            {
                '$addFields': {
                    'current_stock': {'$subtract': ['$total_in', '$total_out']}
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total_barcodes_scanned': {'$sum': 1},
                    'total_stock': {'$sum': '$current_stock'},
                    'total_in': {'$sum': '$total_in'},
                    'total_out': {'$sum': '$total_out'},
                    'out_of_stock': {
                        '$sum': {'$cond': [{'$eq': ['$current_stock', 0]}, 1, 0]}
                    },
                    'low_stock': {
                        '$sum': {
                            '$cond': [
                                {'$and': [
                                    {'$gt': ['$current_stock', 0]},
                                    {'$lt': ['$current_stock', STOCK_THRESHOLD]}
                                ]},
                                1, 0
                            ]
                        }
                    }
                }
            }
        ]
        
        result = list(scan_events_collection.aggregate(pipeline))
        
        # Get total barcodes created
        total_barcodes_created = barcodes_collection.count_documents({})

        # Get unique (sku_name, color) combinations count
        unique_pipeline = [
            {'$group': {'_id': {'sku_name': '$sku_name', 'color': '$color'}}},
            {'$count': 'unique_count'}
        ]
        unique_result = list(barcodes_collection.aggregate(unique_pipeline))
        unique_products = unique_result[0]['unique_count'] if unique_result else 0

        if result:
            stats = result[0]
            return jsonify({
                'total_barcodes_created': total_barcodes_created,
                'total_barcodes_scanned': stats.get('total_barcodes_scanned', 0),
                'unique_products': unique_products,
                'total_stock': stats.get('total_stock', 0),
                'total_movements_in': stats.get('total_in', 0),
                'total_movements_out': stats.get('total_out', 0),
                'out_of_stock_count': stats.get('out_of_stock', 0),
                'low_stock_count': stats.get('low_stock', 0)
            }), 200
        else:
            return jsonify({
                'total_barcodes_created': total_barcodes_created,
                'total_barcodes_scanned': 0,
                'unique_products': unique_products,
                'total_stock': 0,
                'total_movements_in': 0,
                'total_movements_out': 0,
                'out_of_stock_count': 0,
                'low_stock_count': 0
            }), 200
    except Exception as e:
        print(f"[INVENTORY] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/api/admin/adjust-stock', methods=['POST'])
def admin_adjust_stock():
    """Admin stock adjustment"""
    try:
        data = request.json
        barcode_id = data.get('barcode_id')
        adjustment = data.get('adjustment')
        reason = data.get('reason', 'Admin adjustment')
        
        if not barcode_id or adjustment is None:
            return jsonify({'error': 'Missing required fields'}), 400
        
        barcode_doc = barcodes_collection.find_one({'barcode_id': barcode_id})
        
        if not barcode_doc:
            return jsonify({'error': 'Barcode not found'}), 404
        
        action_type = 'IN' if adjustment > 0 else 'OUT'
        abs_adjustment = abs(adjustment)
        
        for _ in range(abs_adjustment):
            scan_event = {
                'barcode_id': barcode_id,
                'action_type': action_type,
                'timestamp': datetime.now(),
                'company_name': barcode_doc['company_name'],
                'sku_name': barcode_doc['sku_name'],
                'is_admin_adjustment': True,
                'reason': reason
            }
            scan_events_collection.insert_one(scan_event)
        
        # Calculate new stock
        in_count = scan_events_collection.count_documents({
            'barcode_id': barcode_id, 'action_type': 'IN'
        })
        out_count = scan_events_collection.count_documents({
            'barcode_id': barcode_id, 'action_type': 'OUT'
        })
        
        return jsonify({
            'message': 'Stock adjusted successfully',
            'barcode_id': barcode_id,
            'new_stock': in_count - out_count
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/api/inventory/product/<sku_name>', methods=['DELETE'])
def delete_product(sku_name):
    """
    Delete a product and all its associated data:
    - All barcodes for this product (optionally filtered by color)
    - All scan events for those barcodes
    """
    try:
        company_name = request.args.get('company')
        color = request.args.get('color', '').strip()

        query = {'sku_name': sku_name}
        if company_name:
            query['company_name'] = company_name
        if color:
            query['color'] = color

        # Find all barcodes for this product
        barcodes = list(barcodes_collection.find(query, {'barcode_id': 1}))
        barcode_ids = [bc['barcode_id'] for bc in barcodes]

        if not barcode_ids:
            return jsonify({'error': 'Product not found'}), 404

        # Delete all scan events for these barcodes
        scan_delete_result = scan_events_collection.delete_many({
            'barcode_id': {'$in': barcode_ids}
        })

        # Delete all barcodes for this product
        barcode_delete_result = barcodes_collection.delete_many(query)

        return jsonify({
            'message': 'Product deleted successfully',
            'sku_name': sku_name,
            'color': color,
            'barcodes_deleted': barcode_delete_result.deleted_count,
            'scan_events_deleted': scan_delete_result.deleted_count
        }), 200
    except Exception as e:
        print(f"[INVENTORY] Delete Error: {str(e)}")
        return jsonify({'error': str(e)}), 500
