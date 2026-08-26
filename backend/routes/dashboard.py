"""
Dashboard & Business Intelligence routes — Ultra High Performance Optimized
"""
from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
from collections import defaultdict
import time
from db import (
    barcodes_collection,
    scan_events_collection,
    cloth_orders_collection,
    sku_catalog_collection
)
from routes.production import compute_all_worker_stock

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Get comprehensive Business Intelligence & Analytics dashboard statistics (Live real-time aggregation)"""
    try:
        seven_days_ago = datetime.now() - timedelta(days=7)

        # ── 1. Single-Pass Scan Events Facet Aggregation ──────────────────
        scan_pipeline = [
            {'$facet': {
                'sold_by_sku': [
                    {'$match': {'action_type': 'OUT', 'sku_name': {'$nin': [None, '']}}},
                    {'$group': {'_id': '$sku_name', 'count': {'$sum': 1}}},
                    {'$sort': {'count': -1}},
                    {'$limit': 15}
                ],
                'in_by_sku': [
                    {'$match': {'action_type': 'IN', 'sku_name': {'$nin': [None, '']}}},
                    {'$group': {'_id': '$sku_name', 'count': {'$sum': 1}}}
                ],
                'daily_trends': [
                    {'$match': {'timestamp': {'$gte': seven_days_ago}}},
                    {'$group': {
                        '_id': {
                            'date': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$timestamp'}},
                            'action': '$action_type'
                        },
                        'count': {'$sum': 1}
                    }}
                ],
                'totals': [
                    {'$group': {
                        '_id': None,
                        'total_out': {'$sum': {'$cond': [{'$eq': ['$action_type', 'OUT']}, 1, 0]}},
                        'total_in': {'$sum': {'$cond': [{'$eq': ['$action_type', 'IN']}, 1, 0]}}
                    }}
                ]
            }}
        ]
        scan_results = list(scan_events_collection.aggregate(scan_pipeline))[0]

        # ── 2. Single-Pass Cloth Orders Facet Aggregation ─────────────────
        order_pipeline = [
            {'$unwind': '$items'},
            {'$facet': {
                'order_summary': [
                    {'$group': {
                        '_id': None,
                        'total_ordered': {'$sum': '$items.quantity_ordered'},
                        'total_completed': {
                            '$sum': {
                                '$cond': [
                                    {'$eq': ['$items.status', 'completed']},
                                    '$items.quantity_ordered',
                                    0
                                ]
                            }
                        }
                    }}
                ],
                'status_counts': [
                    {'$group': {'_id': '$status', 'orders': {'$addToSet': '$_id'}}},
                    {'$project': {'status': '$_id', 'count': {'$size': '$orders'}}}
                ],
                'by_sku': [
                    {'$group': {
                        '_id': '$items.sku_name',
                        'color': {'$first': '$items.color'},
                        'fabric': {'$first': '$items.fabric_type'},
                        'ordered': {'$sum': '$items.quantity_ordered'},
                        'completed': {
                            '$sum': {
                                '$cond': [
                                    {'$eq': ['$items.status', 'completed']},
                                    '$items.quantity_ordered',
                                    0
                                ]
                            }
                        }
                    }},
                    {'$sort': {'ordered': -1}},
                    {'$limit': 10}
                ],
                'by_color': [
                    {'$match': {'items.color': {'$nin': [None, '']}}},
                    {'$group': {
                        '_id': {'$toUpper': '$items.color'},
                        'total': {'$sum': '$items.quantity_ordered'}
                    }},
                    {'$sort': {'total': -1}},
                    {'$limit': 6}
                ],
                'by_fabric': [
                    {'$match': {'items.fabric_type': {'$nin': [None, '']}}},
                    {'$group': {
                        '_id': '$items.fabric_type',
                        'total': {'$sum': '$items.quantity_ordered'}
                    }},
                    {'$sort': {'total': -1}},
                    {'$limit': 6}
                ]
            }}
        ]
        order_results = list(cloth_orders_collection.aggregate(order_pipeline))[0]

        # ── 3. SKU Catalog Price & Info Projection ───────────────────────
        sku_info = {}
        for s in sku_catalog_collection.find({}, {'sku_name': 1, 'mrp': 1, 'color': 1, 'fabric': 1, 'company_name': 1}):
            sku_info[s.get('sku_name')] = {
                'mrp': float(s.get('mrp') or 0),
                'color': s.get('color', ''),
                'fabric': s.get('fabric', ''),
                'company': s.get('company_name', '')
            }

        total_catalog_skus = len(sku_info)

        # ── 4. Process Sales & Outflow Stats ──────────────────────────────
        in_counts_map = {item['_id']: item['count'] for item in scan_results.get('in_by_sku', [])}
        totals_doc = scan_results.get('totals', [{}])[0] if scan_results.get('totals') else {}
        total_units_sold = totals_doc.get('total_out', 0)
        total_units_in = totals_doc.get('total_in', 0)

        total_revenue = 0.0
        top_selling = []
        for s in scan_results.get('sold_by_sku', []):
            sku = s['_id']
            sold_qty = s['count']
            info = sku_info.get(sku, {'mrp': 0, 'color': '', 'fabric': '', 'company': ''})
            mrp = info.get('mrp', 0.0)
            rev = sold_qty * mrp
            total_revenue += rev

            total_in = in_counts_map.get(sku, 0)
            current_stock = max(0, total_in - sold_qty)
            sell_through = round((sold_qty / total_in * 100), 1) if total_in > 0 else 100.0

            top_selling.append({
                'sku_name': sku,
                'color': info.get('color', ''),
                'fabric': info.get('fabric', ''),
                'sold_quantity': sold_qty,
                'mrp': mrp,
                'revenue': rev,
                'current_stock': current_stock,
                'sell_through_rate': sell_through
            })

        top_trending_sku = top_selling[0]['sku_name'] if top_selling else '—'

        # ── 5. Process Production & Orders Stats ──────────────────────────
        order_summary_doc = order_results.get('order_summary', [{}])[0] if order_results.get('order_summary') else {}
        total_cloth_ordered = order_summary_doc.get('total_ordered', 0)
        total_cloth_completed = order_summary_doc.get('total_completed', 0)

        status_counts = {sc['status']: sc['count'] for sc in order_results.get('status_counts', [])}
        active_chalans_count = sum(cnt for status, cnt in status_counts.items() if status != 'completed')
        completed_chalans_count = status_counts.get('completed', 0)

        top_produced = []
        for p in order_results.get('by_sku', []):
            ord_qty = p['ordered']
            comp_qty = p['completed']
            pct = round((comp_qty / ord_qty * 100), 1) if ord_qty > 0 else 0.0
            top_produced.append({
                'sku_name': p['_id'],
                'color': p.get('color', ''),
                'fabric': p.get('fabric', ''),
                'ordered_quantity': ord_qty,
                'completed_quantity': comp_qty,
                'in_work_quantity': max(0, ord_qty - comp_qty),
                'completion_percentage': pct
            })

        top_colors = [
            {
                'color': c['_id'],
                'quantity': c['total'],
                'percentage': round((c['total'] / total_cloth_ordered * 100), 1) if total_cloth_ordered > 0 else 0
            }
            for c in order_results.get('by_color', [])
        ]

        top_fabrics = [
            {
                'fabric': f['_id'],
                'quantity': f['total'],
                'percentage': round((f['total'] / total_cloth_ordered * 100), 1) if total_cloth_ordered > 0 else 0
            }
            for f in order_results.get('by_fabric', [])
        ]

        # ── 6. Worker Factory Pipeline Holdings ───────────────────────────
        worker_stock = compute_all_worker_stock()
        total_pieces_in_workers = sum(ws.get('quantity', 0) for ws in worker_stock)

        worker_holdings_map = defaultdict(int)
        for ws in worker_stock:
            worker_holdings_map[ws['worker_name']] += ws.get('quantity', 0)

        top_workers = [
            {'worker_name': w, 'quantity': q}
            for w, q in sorted(worker_holdings_map.items(), key=lambda x: x[1], reverse=True)[:6]
        ]

        # ── 7. Smart Restock & Velocity Insights ──────────────────────────
        smart_alerts = []
        for item in top_selling:
            if item['current_stock'] == 0:
                smart_alerts.append({
                    'type': 'out_of_stock',
                    'title': f"High Velocity SKU Sold Out",
                    'message': f"'{item['sku_name']}' has {item['sold_quantity']} total sales with 0 stock in warehouse. Consider assigning a new chalan.",
                    'sku_name': item['sku_name']
                })
            elif item['current_stock'] < 5:
                smart_alerts.append({
                    'type': 'low_stock',
                    'title': f"Low Stock Warning",
                    'message': f"'{item['sku_name']}' only has {item['current_stock']} units left in warehouse stock.",
                    'sku_name': item['sku_name']
                })

        # ── 8. Warehouse Physical Stock & Barcodes ─────────────────────────
        total_barcodes_created = barcodes_collection.count_documents({})
        total_current_stock = max(0, total_units_in - total_units_sold)

        # 7-day movement trends
        trends_map = defaultdict(lambda: {'stock_in': 0, 'stock_out': 0})
        for dt in scan_results.get('daily_trends', []):
            d = dt['_id'].get('date')
            act = dt['_id'].get('action')
            cnt = dt.get('count', 0)
            if act == 'IN':
                trends_map[d]['stock_in'] += cnt
            elif act == 'OUT':
                trends_map[d]['stock_out'] += cnt

        stock_movement = []
        for i in range(7):
            day_str = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            t = trends_map[day_str]
            stock_movement.append({
                'date': day_str,
                'stock_in': t['stock_in'],
                'stock_out': t['stock_out'],
                'net_change': t['stock_in'] - t['stock_out']
            })
        stock_movement.reverse()

        response_data = {
            'summary': {
                'total_units_sold': total_units_sold,
                'total_revenue': total_revenue,
                'top_trending_sku': top_trending_sku,
                'total_catalog_skus': total_catalog_skus,
                'total_cloth_ordered': total_cloth_ordered,
                'total_cloth_completed': total_cloth_completed,
                'production_completion_rate': round((total_cloth_completed / total_cloth_ordered * 100), 1) if total_cloth_ordered > 0 else 0,
                'active_chalans_count': active_chalans_count,
                'completed_chalans_count': completed_chalans_count,
                'pieces_with_workers': total_pieces_in_workers,
                'total_barcodes_created': total_barcodes_created,
                'warehouse_stock_units': total_current_stock
            },
            'top_selling_skus': top_selling,
            'top_produced_skus': top_produced,
            'top_colors': top_colors,
            'top_fabrics': top_fabrics,
            'top_workers': top_workers,
            'smart_alerts': smart_alerts,
            'stock_movement': stock_movement
        }

        return jsonify(response_data), 200

    except Exception as e:
        print(f"[DASHBOARD] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Server is running'}), 200
