"""
Dashboard routes
"""
from flask import Blueprint, jsonify
from datetime import datetime, timedelta
from db import barcodes_collection, scan_events_collection, STOCK_THRESHOLD

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        # Get stock stats using aggregation
        stock_pipeline = [
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
                    'stock': {'$subtract': ['$total_in', '$total_out']}
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total_barcodes': {'$sum': 1},
                    'total_stock': {'$sum': '$stock'},
                    'out_of_stock': {
                        '$sum': {'$cond': [{'$eq': ['$stock', 0]}, 1, 0]}
                    },
                    'low_stock': {
                        '$sum': {
                            '$cond': [
                                {'$and': [
                                    {'$gt': ['$stock', 0]},
                                    {'$lt': ['$stock', STOCK_THRESHOLD]}
                                ]},
                                1, 0
                            ]
                        }
                    }
                }
            }
        ]
        
        stats_result = list(scan_events_collection.aggregate(stock_pipeline))
        
        # Get total products (unique SKUs)
        total_products = len(barcodes_collection.distinct('sku_name'))
        
        if stats_result:
            stats = stats_result[0]
            total_stock = stats.get('total_stock', 0)
            out_of_stock_count = stats.get('out_of_stock', 0)
            low_stock_count = stats.get('low_stock', 0)
        else:
            total_stock = 0
            out_of_stock_count = 0
            low_stock_count = 0
        
        # Get most scanned products
        most_scanned = get_most_scanned_products()
        
        # Get stock movement trends
        stock_movement = get_stock_movement_trends()
        
        return jsonify({
            'total_products': total_products,
            'total_stock': total_stock,
            'low_stock_count': low_stock_count,
            'out_of_stock_count': out_of_stock_count,
            'most_scanned': most_scanned,
            'stock_movement': stock_movement
        }), 200
    except Exception as e:
        print(f"[DASHBOARD] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Server is running'}), 200


def get_most_scanned_products():
    """Get products sorted by scan count"""
    pipeline = [
        {
            '$group': {
                '_id': '$barcode_id',
                'scan_count': {'$sum': 1},
                'company_name': {'$first': '$company_name'},
                'sku_name': {'$first': '$sku_name'}
            }
        },
        {'$sort': {'scan_count': -1}},
        {'$limit': 10}
    ]
    
    result = list(scan_events_collection.aggregate(pipeline))
    
    for item in result:
        item['barcode_id'] = item.pop('_id')
    
    return result


def get_stock_movement_trends():
    """Get stock movement for last 7 days"""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    daily_trends = []
    for i in range(7):
        day_start = today - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        in_count = scan_events_collection.count_documents({
            'action_type': 'IN',
            'timestamp': {'$gte': day_start, '$lt': day_end}
        })
        
        out_count = scan_events_collection.count_documents({
            'action_type': 'OUT',
            'timestamp': {'$gte': day_start, '$lt': day_end}
        })
        
        daily_trends.append({
            'date': day_start.strftime('%Y-%m-%d'),
            'stock_in': in_count,
            'stock_out': out_count,
            'net_change': in_count - out_count
        })
    
    daily_trends.reverse()
    return daily_trends
