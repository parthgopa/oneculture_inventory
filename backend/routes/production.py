"""
Production Workflow Routes
Cloth Order → Job Work → Additional Work → Final Receive → Barcode Generation
Full ledger-based tracking: no stock disappears or duplicates.
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import random
import string
from db import cloth_orders_collection, work_ledger_collection, workers_collection, suppliers_collection

production_bp = Blueprint('production', __name__)


def generate_id(prefix):
    ts = datetime.now().strftime('%y%m%d%H%M%S')
    rand = ''.join(random.choices(string.digits, k=4))
    return f"{prefix}{ts}{rand}"


def serialize(doc):
    """Convert MongoDB doc to JSON-serializable dict"""
    doc['_id'] = str(doc['_id'])
    if doc.get('created_at'):
        doc['created_at'] = doc['created_at'].isoformat()
    return doc


# ── Chalan Number Helper ──────────────────────────────────────────────────────

def get_next_chalan_number():
    """Get next sequential chalan number across all cloth orders"""
    last = cloth_orders_collection.find_one(
        {'chalan_number': {'$gt': 0}},
        sort=[('chalan_number', -1)]
    )
    return (last.get('chalan_number', 0) + 1) if last else 1


# ── Ledger Helper ─────────────────────────────────────────────────────────────

def get_next_ledger_number():
    """Get next sequential ledger number integer across all work types"""
    # Find max ledger_number_int across ALL entries with a number assigned
    last = work_ledger_collection.find_one(
        {'ledger_number_int': {'$gt': 0}},
        sort=[('ledger_number_int', -1)]
    )
    return (last.get('ledger_number_int', 0) + 1) if last else 1


def get_entity_holding(entity, sku_name=None, order_id=None, item_id=None, color=None):
    """
    Current holding = total received by entity - total sent by entity.
    Filtered optionally by sku_name, order_id, item_id, color.
    """
    def build_match(direction_key):
        q = {direction_key: entity}
        if sku_name:
            q['sku_name'] = sku_name
        if order_id:
            q['order_id'] = order_id
        if item_id:
            q['item_id'] = item_id
        if color is not None and color != '':
            q['color'] = color
        return q

    in_res = list(work_ledger_collection.aggregate([
        {'$match': build_match('to_entity')},
        {'$group': {'_id': None, 'total': {'$sum': '$quantity'}}}
    ]))
    out_res = list(work_ledger_collection.aggregate([
        {'$match': build_match('from_entity')},
        {'$group': {'_id': None, 'total': {'$sum': '$quantity'}}}
    ]))
    return (in_res[0]['total'] if in_res else 0) - (out_res[0]['total'] if out_res else 0)


def compute_all_worker_stock():
    """Compute current holding per (worker, sku, color, order_id) - excludes 'company' and supplier entities"""
    if work_ledger_collection.count_documents({}) == 0:
        return []

    pipeline = [
        {'$facet': {
            'received': [{'$group': {
                '_id': {'entity': '$to_entity', 'sku': '$sku_name', 'color': '$color', 'order_id': '$order_id'},
                'total': {'$sum': '$quantity'}
            }}],
            'sent': [{'$group': {
                '_id': {'entity': '$from_entity', 'sku': '$sku_name', 'color': '$color', 'order_id': '$order_id'},
                'total': {'$sum': '$quantity'}
            }}]
        }}
    ]
    result = list(work_ledger_collection.aggregate(pipeline))[0]
    received_map = {(r['_id']['entity'], r['_id']['sku'], r['_id'].get('color') or '', r['_id'].get('order_id') or ''): r['total'] for r in result['received']}
    sent_map = {(s['_id']['entity'], s['_id']['sku'], s['_id'].get('color') or '', s['_id'].get('order_id') or ''): s['total'] for s in result['sent']}

    all_keys = set(list(received_map.keys()) + list(sent_map.keys()))
    holdings = []
    for (entity, sku, color, order_id) in all_keys:
        if not entity or entity.lower() in ('company',) or entity.lower().startswith('supplier'):
            continue
        holding = received_map.get((entity, sku, color, order_id), 0) - sent_map.get((entity, sku, color, order_id), 0)
        if holding > 0:
            holdings.append({'worker_name': entity, 'sku_name': sku, 'color': color or '', 'order_id': order_id or '', 'quantity': holding})
    holdings.sort(key=lambda x: (x['worker_name'], x['sku_name'], x['color']))
    return holdings


# ── Workers ───────────────────────────────────────────────────────────────────

@production_bp.route('/api/production/workers', methods=['GET'])
def get_workers():
    try:
        workers = list(workers_collection.find({'active': True}).sort('name', 1))
        return jsonify([serialize(w) for w in workers]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/workers', methods=['POST'])
def create_worker():
    try:
        data = request.json
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'Worker name is required'}), 400

        if workers_collection.find_one({'name': name, 'active': True}):
            return jsonify({'error': f'Worker "{name}" already exists'}), 400

        worker = {
            'worker_id': generate_id('W'),
            'name': name,
            'phone': (data.get('phone') or '').strip(),
            'work_type': (data.get('work_type') or 'General').strip(),
            'active': True,
            'created_at': datetime.now()
        }
        result = workers_collection.insert_one(worker)
        worker['_id'] = str(result.inserted_id)
        worker['created_at'] = worker['created_at'].isoformat()
        return jsonify(worker), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/workers/<worker_id>', methods=['PUT'])
def update_worker(worker_id):
    try:
        data = request.json
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'Worker name is required'}), 400

        existing = workers_collection.find_one({'name': name, 'active': True, 'worker_id': {'$ne': worker_id}})
        if existing:
            return jsonify({'error': f'Another worker named "{name}" already exists'}), 400

        update_fields = {
            'name': name,
            'phone': (data.get('phone') or '').strip(),
            'work_type': (data.get('work_type') or 'General').strip(),
        }
        workers_collection.update_one({'worker_id': worker_id}, {'$set': update_fields})
        updated = workers_collection.find_one({'worker_id': worker_id})
        return jsonify(serialize(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/workers/<worker_id>', methods=['DELETE'])
def delete_worker(worker_id):
    try:
        workers_collection.update_one({'worker_id': worker_id}, {'$set': {'active': False}})
        return jsonify({'message': 'Worker removed'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Cloth Orders ──────────────────────────────────────────────────────────────

@production_bp.route('/api/production/orders', methods=['POST'])
def create_order():
    try:
        data = request.json
        items_raw = data.get('items', [])
        if not items_raw:
            return jsonify({'error': 'At least one item is required'}), 400

        order_id = generate_id('ORD')
        items = []
        for idx, item in enumerate(items_raw):
            if not item.get('sku_name') or not item.get('quantity_ordered'):
                return jsonify({'error': f'Item {idx+1}: sku_name and quantity_ordered are required'}), 400
            items.append({
                'item_id': f"{order_id}_I{idx+1:02d}",
                'sku_name': item['sku_name'].strip(),
                'fabric_type': (item.get('fabric_type') or '').strip(),
                'color': (item.get('color') or '').strip(),
                'quantity_ordered': int(item['quantity_ordered']),
                'quantity_received': 0,
                'mrp': float(item.get('mrp') or 0),
                'status': 'ordered'
            })

        # Accept custom chalan_number from frontend, else auto-generate
        chalan_number_input = data.get('chalan_number')
        if chalan_number_input is not None and str(chalan_number_input).strip():
            try:
                chalan_number = int(chalan_number_input)
            except (ValueError, TypeError):
                chalan_number = get_next_chalan_number()
        else:
            chalan_number = get_next_chalan_number()

        order = {
            'order_id': order_id,
            'chalan_number': chalan_number,
            'supplier_name': (data.get('supplier_name') or '').strip(),
            'company_name': (data.get('company_name') or 'OneCulture').strip(),
            'status': 'ordered',
            'notes': (data.get('notes') or '').strip(),
            'items': items,
            'created_at': datetime.now()
        }
        result = cloth_orders_collection.insert_one(order)
        
        # Create ledger entries to assign quantity to supplier
        for item in items:
            work_ledger_collection.insert_one({
                'ledger_id': generate_id('L'),
                'ledger_number_int': get_next_ledger_number(),
                'order_id': order_id,
                'item_id': item['item_id'],
                'sku_name': item['sku_name'],
                'color': item['color'],
                'from_entity': 'company',
                'to_entity': order['supplier_name'],
                'quantity': item['quantity_ordered'],
                'stage': 'cloth_received',
                'work_type': 'Cloth Order',
                'notes': 'Order placed with supplier',
                'created_at': order['created_at']
            })
        
        order['_id'] = str(result.inserted_id)
        order['created_at'] = order['created_at'].isoformat()
        return jsonify(order), 201
    except Exception as e:
        print(f"[PRODUCTION] create_order error: {e}")
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/next-chalan', methods=['GET'])
def get_next_chalan():
    """Return the next chalan number to be used"""
    try:
        return jsonify({'chalan_number': get_next_chalan_number()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/orders', methods=['GET'])
def get_orders():
    try:
        orders = list(cloth_orders_collection.find().sort('created_at', -1))
        return jsonify([serialize(o) for o in orders]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/orders/<order_id>', methods=['GET'])
def get_order_detail(order_id):
    try:
        order = cloth_orders_collection.find_one({'order_id': order_id})
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        order = serialize(order)
        ledger = list(work_ledger_collection.find({'order_id': order_id}).sort('created_at', -1))
        return jsonify({'order': order, 'ledger': [serialize(l) for l in ledger]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/orders/<order_id>', methods=['PATCH'])
def update_order(order_id):
    """Edit supplier_name, notes, and item fields (sku_name, fabric_type, color, quantity_ordered, mrp) of a cloth order."""
    try:
        data = request.json or {}
        order = cloth_orders_collection.find_one({'order_id': order_id})
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        set_fields = {}
        old_supplier = order.get('supplier_name', '')
        new_supplier = None
        if 'supplier_name' in data:
            new_supplier = (data['supplier_name'] or '').strip()
            set_fields['supplier_name'] = new_supplier
        if 'notes' in data:
            set_fields['notes'] = (data['notes'] or '').strip()
        if 'chalan_number' in data and data['chalan_number'] is not None:
            try:
                set_fields['chalan_number'] = int(data['chalan_number'])
            except (ValueError, TypeError):
                pass

        if 'items' in data:
            existing_items = {i['item_id']: i for i in order.get('items', [])}
            updated_items = []
            for item_data in data['items']:
                item_id = item_data.get('item_id')
                if item_id and item_id in existing_items:
                    item = dict(existing_items[item_id])
                    if 'sku_name' in item_data:
                        item['sku_name'] = (item_data['sku_name'] or '').strip()
                    if 'fabric_type' in item_data:
                        item['fabric_type'] = (item_data['fabric_type'] or '').strip()
                    if 'color' in item_data:
                        item['color'] = (item_data['color'] or '').strip()
                    if 'quantity_ordered' in item_data:
                        item['quantity_ordered'] = int(item_data['quantity_ordered'] or 0)
                    if 'mrp' in item_data:
                        item['mrp'] = float(item_data['mrp'] or 0)
                    updated_items.append(item)
                else:
                    updated_items.append(existing_items.get(item_id, item_data))
            set_fields['items'] = updated_items

        if set_fields:
            cloth_orders_collection.update_one({'order_id': order_id}, {'$set': set_fields})

        if new_supplier and old_supplier and new_supplier != old_supplier:
            work_ledger_collection.update_many(
                {'order_id': order_id, 'to_entity': old_supplier},
                {'$set': {'to_entity': new_supplier}}
            )
            work_ledger_collection.update_many(
                {'order_id': order_id, 'from_entity': old_supplier},
                {'$set': {'from_entity': new_supplier}}
            )

        updated = cloth_orders_collection.find_one({'order_id': order_id})
        return jsonify(serialize(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/orders/<order_id>', methods=['DELETE'])
def delete_order(order_id):
    """Delete a cloth order and all its associated ledger entries."""
    try:
        order = cloth_orders_collection.find_one({'order_id': order_id})
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        work_ledger_collection.delete_many({'order_id': order_id})
        cloth_orders_collection.delete_one({'order_id': order_id})
        return jsonify({'message': f'Order {order_id} and its ledger entries deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/orders/<order_id>/date', methods=['PATCH'])
def update_order_date(order_id):
    """Update the created_at date of a cloth order (for backdating)."""
    try:
        data = request.json
        date_str = (data.get('date') or '').strip()
        if not date_str:
            return jsonify({'error': 'date is required (ISO format)'}), 400
        new_date = datetime.fromisoformat(date_str)
        result = cloth_orders_collection.update_one(
            {'order_id': order_id},
            {'$set': {'created_at': new_date}}
        )
        if result.matched_count == 0:
            return jsonify({'error': 'Order not found'}), 404
        return jsonify({'message': 'Date updated', 'date': new_date.isoformat()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/orders/<order_id>/receive', methods=['PATCH'])
def receive_cloth(order_id):
    """Mark cloth as physically received from supplier. Creates ledger: supplier → company."""
    try:
        data = request.json
        items_received = data.get('items', [])  # [{item_id, quantity_received}]

        order = cloth_orders_collection.find_one({'order_id': order_id})
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        updated = 0
        for ir in items_received:
            item_id = ir.get('item_id')
            qty = int(ir.get('quantity_received') or 0)
            if qty <= 0:
                continue
            item = next((i for i in order['items'] if i['item_id'] == item_id), None)
            if not item:
                continue

            cloth_orders_collection.update_one(
                {'order_id': order_id, 'items.item_id': item_id},
                {'$set': {'items.$.quantity_received': qty, 'items.$.status': 'received'}}
            )
            date_str = data.get('date') or ''
            entry_date = datetime.now()
            if date_str:
                try:
                    entry_date = datetime.fromisoformat(date_str)
                except Exception:
                    pass
            work_ledger_collection.insert_one({
                'ledger_id': generate_id('L'),
                'ledger_number_int': get_next_ledger_number(),
                'order_id': order_id,
                'item_id': item_id,
                'sku_name': item['sku_name'],
                'from_entity': order.get('supplier_name') or 'Supplier',
                'to_entity': 'company',
                'quantity': qty,
                'stage': 'cloth_received',
                'work_type': 'Cloth Receipt',
                'notes': f"Cloth received from {order.get('supplier_name') or 'supplier'}",
                'created_at': entry_date
            })
            updated += 1

        cloth_orders_collection.update_one({'order_id': order_id}, {'$set': {'status': 'received'}})
        return jsonify({'message': f'Cloth received for {updated} item(s)'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Job Work Assignment ───────────────────────────────────────────────────────

@production_bp.route('/api/production/assign', methods=['POST'])
def assign_job_work():
    """Company → Worker: assign pieces for job work (embroidery, cutting, etc.)"""
    try:
        data = request.json
        worker_name = (data.get('worker_name') or '').strip()
        quantity = int(data.get('quantity') or 0)
        sku_name = (data.get('sku_name') or '').strip()
        order_id = (data.get('order_id') or '').strip()
        item_id = (data.get('item_id') or '').strip()
        work_type = (data.get('work_type') or 'Job Work').strip()
        notes = (data.get('notes') or '').strip()
        color = (data.get('color') or '').strip()

        if not worker_name or quantity <= 0 or not sku_name:
            return jsonify({'error': 'Worker name, SKU, and quantity are required'}), 400

        # Find which supplier has this SKU
        supplier_with_sku = None
        if order_id:
            # Get the order to find the supplier
            order = cloth_orders_collection.find_one({'order_id': order_id})
            if order:
                supplier_with_sku = order.get('supplier_name')
        
        if not supplier_with_sku:
            # Find any supplier that has this SKU
            supplier_ledger = work_ledger_collection.find_one({
                'sku_name': sku_name,
                'stage': 'cloth_received',
                'to_entity': {'$ne': 'company'}
            }, sort=[('created_at', -1)])
            if supplier_ledger:
                supplier_with_sku = supplier_ledger.get('to_entity')
        
        if not supplier_with_sku:
            return jsonify({'error': f'No supplier found with SKU "{sku_name}"'}), 400
        
        # Check supplier has enough available
        available = get_entity_holding(supplier_with_sku, sku_name=sku_name,
                                       order_id=order_id or None,
                                       item_id=item_id or None)
        if available < quantity:
            return jsonify({
                'error': f'Supplier "{supplier_with_sku}" only has {available} pieces of "{sku_name}" available to assign'
            }), 400

        if order_id and item_id:
            cloth_orders_collection.update_one(
                {'order_id': order_id, 'items.item_id': item_id},
                {'$set': {'items.$.status': 'in_work'}}
            )
            cloth_orders_collection.update_one(
                {'order_id': order_id}, {'$set': {'status': 'in_work'}}
            )

        date_str = (data.get('date') or '').strip()
        entry_date = datetime.now()
        if date_str:
            try: entry_date = datetime.fromisoformat(date_str)
            except Exception: pass

        work_ledger_collection.insert_one({
            'ledger_id': generate_id('L'),
            'ledger_number_int': get_next_ledger_number(),
            'order_id': order_id,
            'item_id': item_id,
            'sku_name': sku_name,
            'color': color,
            'from_entity': supplier_with_sku,
            'to_entity': worker_name,
            'quantity': quantity,
            'stage': 'job_assigned',
            'work_type': work_type,
            'notes': notes,
            'created_at': entry_date
        })
        return jsonify({'message': f'Assigned {quantity} pieces of "{sku_name}" to {worker_name}'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Additional Work Transfer ──────────────────────────────────────────────────

@production_bp.route('/api/production/transfer', methods=['POST'])
def transfer_work():
    """Worker A → Worker B: transfer pieces for additional work (diamond, jari, etc.)"""
    try:
        data = request.json
        from_worker = (data.get('from_worker') or '').strip()
        to_worker = (data.get('to_worker') or '').strip()
        sku_name = (data.get('sku_name') or '').strip()
        color = (data.get('color') or '').strip()
        quantity = int(data.get('quantity') or 0)
        work_type = (data.get('work_type') or 'Additional Work').strip()
        notes = (data.get('notes') or '').strip()
        order_id = (data.get('order_id') or '').strip()
        item_id = (data.get('item_id') or '').strip()

        if not from_worker or not to_worker or not sku_name or quantity <= 0:
            return jsonify({'error': 'From worker, to worker, SKU, and quantity are required'}), 400
        if from_worker == to_worker:
            return jsonify({'error': 'Cannot transfer to the same worker'}), 400

        available = get_entity_holding(from_worker, sku_name=sku_name, color=color)
        if available < quantity:
            color_msg = f' ({color})' if color else ''
            return jsonify({
                'error': f'{from_worker} only has {available} pieces of "{sku_name}"{color_msg} available'
            }), 400

        date_str = (data.get('date') or '').strip()
        entry_date = datetime.now()
        if date_str:
            try: entry_date = datetime.fromisoformat(date_str)
            except Exception: pass

        work_ledger_collection.insert_one({
            'ledger_id': generate_id('L'),
            'ledger_number_int': get_next_ledger_number(),
            'order_id': order_id,
            'item_id': item_id,
            'sku_name': sku_name,
            'color': color,
            'from_entity': from_worker,
            'to_entity': to_worker,
            'quantity': quantity,
            'stage': 'transferred',
            'work_type': work_type,
            'notes': notes,
            'created_at': entry_date
        })
        color_msg = f' ({color})' if color else ''
        return jsonify({'message': f'Transferred {quantity} pieces of "{sku_name}"{color_msg} from {from_worker} to {to_worker}'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Final Receive (Ready for Barcode) ─────────────────────────────────────────

@production_bp.route('/api/production/receive-final', methods=['POST'])
def receive_final():
    """Worker → Company: receive finished goods. Sets status ready_for_barcode."""
    try:
        data = request.json
        worker_name = (data.get('worker_name') or '').strip()
        sku_name = (data.get('sku_name') or '').strip()
        color = (data.get('color') or '').strip()
        quantity = int(data.get('quantity') or 0)
        order_id = (data.get('order_id') or '').strip()
        item_id = (data.get('item_id') or '').strip()
        notes = (data.get('notes') or '').strip()
        mrp = float(data.get('mrp') or 0)

        if not worker_name or not sku_name or quantity <= 0:
            return jsonify({'error': 'Worker, SKU, and quantity are required'}), 400

        available = get_entity_holding(worker_name, sku_name=sku_name, color=color)
        if available < quantity:
            color_msg = f' ({color})' if color else ''
            return jsonify({
                'error': f'{worker_name} only has {available} pieces of "{sku_name}"{color_msg} available'
            }), 400

        date_str = (data.get('date') or '').strip()
        entry_date = datetime.now()
        if date_str:
            try: entry_date = datetime.fromisoformat(date_str)
            except Exception: pass

        work_ledger_collection.insert_one({
            'ledger_id': generate_id('L'),
            'ledger_number_int': get_next_ledger_number(),
            'order_id': order_id,
            'item_id': item_id,
            'sku_name': sku_name,
            'color': color,
            'from_entity': worker_name,
            'to_entity': 'company',
            'quantity': quantity,
            'stage': 'final_received',
            'work_type': 'Final Receive',
            'notes': notes,
            'mrp': mrp,
            'created_at': entry_date
        })

        if order_id and item_id:
            # Check if this is the final receive for the full quantity
            order = cloth_orders_collection.find_one({'order_id': order_id})
            if order:
                item = next((i for i in order.get('items', []) if i.get('item_id') == item_id), None)
                if item:
                    # Calculate total received for this item
                    total_received = work_ledger_collection.aggregate([
                        {'$match': {
                            'order_id': order_id,
                            'item_id': item_id,
                            'stage': 'final_received',
                            'to_entity': 'company'
                        }},
                        {'$group': {
                            '_id': None,
                            'total': {'$sum': '$quantity'}
                        }}
                    ])
                    total_received = list(total_received)[0]['total'] if total_received else 0
                    
                    # Only mark as completed if full quantity received
                    if total_received >= item.get('quantity_ordered', 0):
                        cloth_orders_collection.update_one(
                            {'order_id': order_id, 'items.item_id': item_id},
                            {'$set': {'items.$.status': 'completed'}}
                        )

        return jsonify({
            'message': f'Received {quantity} finished pieces of "{sku_name}" from {worker_name}',
            'sku_name': sku_name,
            'quantity': quantity,
            'mrp': mrp,
            'ready_for_barcode': True
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Return to Supplier ────────────────────────────────────────────────────────

@production_bp.route('/api/production/return-to-supplier', methods=['POST'])
def return_to_supplier():
    """Worker or company returns defective/plain cloth back to supplier."""
    try:
        data = request.json
        from_entity = (data.get('from_entity') or '').strip()
        sku_name    = (data.get('sku_name') or '').strip()
        color       = (data.get('color') or '').strip()
        quantity    = int(data.get('quantity') or 0)
        supplier    = (data.get('supplier_name') or 'Supplier').strip()
        notes       = (data.get('notes') or '').strip()
        order_id    = (data.get('order_id') or '').strip()
        item_id     = (data.get('item_id') or '').strip()
        date_str    = (data.get('date') or '').strip()

        if not from_entity or not sku_name or quantity <= 0:
            return jsonify({'error': 'from_entity, sku_name, and quantity are required'}), 400

        available = get_entity_holding(from_entity, sku_name=sku_name, color=color)
        if available < quantity:
            color_msg = f' ({color})' if color else ''
            return jsonify({
                'error': f'"{from_entity}" only has {available} pieces of "{sku_name}"{color_msg} available'
            }), 400

        created_at = datetime.now()
        if date_str:
            try:
                created_at = datetime.fromisoformat(date_str)
            except Exception:
                pass

        work_ledger_collection.insert_one({
            'ledger_id': generate_id('L'),
            'ledger_number_int': get_next_ledger_number(),
            'order_id': order_id,
            'item_id': item_id,
            'sku_name': sku_name,
            'color': color,
            'from_entity': from_entity,
            'to_entity': supplier,
            'quantity': quantity,
            'stage': 'returned_to_supplier',
            'work_type': 'Return',
            'notes': notes or f'Returned to {supplier}',
            'created_at': created_at
        })
        color_msg = f' ({color})' if color else ''
        return jsonify({'message': f'Returned {quantity} pieces of "{sku_name}"{color_msg} from {from_entity} to {supplier}'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Ledger Entry Edits ────────────────────────────────────────────────────────

@production_bp.route('/api/production/ledger/<ledger_id>/date', methods=['PATCH'])
def update_ledger_date(ledger_id):
    """Update the created_at date of a ledger entry (for backdating)."""
    try:
        data = request.json
        date_str = (data.get('date') or '').strip()
        if not date_str:
            return jsonify({'error': 'date is required (ISO format)'}), 400
        new_date = datetime.fromisoformat(date_str)
        result = work_ledger_collection.update_one(
            {'ledger_id': ledger_id},
            {'$set': {'created_at': new_date}}
        )
        if result.matched_count == 0:
            return jsonify({'error': 'Ledger entry not found'}), 404
        return jsonify({'message': 'Date updated', 'date': new_date.isoformat()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/ledger/<ledger_id>/revert', methods=['POST'])
def revert_ledger_entry(ledger_id):
    """
    Revert a ledger entry by DELETING it from the ledger.
    No counter-entry is created - the entry is simply removed.
    Stock calculations will automatically reflect the removal.
    """
    try:
        original = work_ledger_collection.find_one({'ledger_id': ledger_id})
        if not original:
            return jsonify({'error': 'Ledger entry not found'}), 404

        # Simply delete the entry - stock will be recalculated automatically
        result = work_ledger_collection.delete_one({'ledger_id': ledger_id})
        
        if result.deleted_count > 0:
            return jsonify({
                'message': f'Entry {ledger_id} deleted',
                'sku_name': original.get('sku_name'),
                'quantity': original.get('quantity'),
                'from_entity': original.get('from_entity'),
                'to_entity': original.get('to_entity')
            }), 200
        else:
            return jsonify({'error': 'Failed to delete entry'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Stock & Ledger Queries ────────────────────────────────────────────────────

@production_bp.route('/api/production/worker-stock', methods=['GET'])
def get_worker_stock():
    try:
        return jsonify(compute_all_worker_stock()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/ledger', methods=['GET'])
def get_ledger():
    try:
        order_id = request.args.get('order_id')
        sku_name = request.args.get('sku_name')
        entity = request.args.get('entity')
        limit = int(request.args.get('limit') or 100)

        query = {}
        if order_id:
            query['order_id'] = order_id
        if sku_name:
            query['sku_name'] = sku_name
        if entity:
            query['$or'] = [{'from_entity': entity}, {'to_entity': entity}]

        entries = list(work_ledger_collection.find(query).sort('created_at', -1).limit(limit))
        return jsonify([serialize(e) for e in entries]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/ready-for-barcode', methods=['GET'])
def get_ready_for_barcode():
    """Items that have been final-received at company but barcodes not yet generated. Grouped by (sku_name, color)."""
    try:
        pipeline = [
            {'$match': {'stage': 'final_received', 'to_entity': 'company'}},
            {'$group': {
                '_id': {'sku_name': '$sku_name', 'color': '$color'},
                'total_received': {'$sum': '$quantity'},
                'mrp': {'$last': '$mrp'},
                'order_id': {'$last': '$order_id'},
                'last_received': {'$max': '$created_at'}
            }},
            {'$sort': {'last_received': -1}}
        ]
        items = list(work_ledger_collection.aggregate(pipeline))
        result = []
        for item in items:
            entry = {
                'sku_name': item['_id']['sku_name'],
                'color': item['_id'].get('color') or '',
                'quantity': item['total_received'],
                'mrp': item.get('mrp') or 0,
                'order_id': item.get('order_id') or '',
                'last_received': item['last_received'].isoformat() if item.get('last_received') else None
            }
            print(f"[ready-for-barcode] {entry['sku_name']} ({entry['color']}): total_received={entry['quantity']}, mrp={entry['mrp']}, order_id={entry['order_id']}")
            result.append(entry)
        print(f"[ready-for-barcode] Total items: {len(result)}")
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/mrp', methods=['GET'])
def get_mrp_for_sku():
    """Get MRP for a SKU+color combination from the most recent cloth order item."""
    try:
        sku_name = request.args.get('sku_name', '').strip()
        color = request.args.get('color', '').strip()

        if not sku_name:
            return jsonify({'error': 'sku_name is required'}), 400

        # Find the most recent cloth order item with this SKU and color
        query = {'items.sku_name': sku_name}
        if color:
            query['items.color'] = color

        order = cloth_orders_collection.find_one(
            query,
            {'items': 1, 'order_id': 1},
            sort=[('created_at', -1)]
        )

        if not order:
            return jsonify({'mrp': 0, 'found': False}), 200

        # Find the matching item in the order
        matching_item = None
        for item in order.get('items', []):
            if item['sku_name'] == sku_name:
                if not color or item.get('color') == color:
                    matching_item = item
                    break

        if matching_item:
            return jsonify({
                'mrp': matching_item.get('mrp', 0),
                'found': True,
                'order_id': order.get('order_id'),
                'item_id': matching_item.get('item_id')
            }), 200
        else:
            return jsonify({'mrp': 0, 'found': False}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/sku-colors', methods=['GET'])
def get_sku_colors():
    """Get available colors for a SKU from cloth orders."""
    try:
        sku_name = request.args.get('sku_name', '').strip()
        if not sku_name:
            return jsonify({'error': 'sku_name is required'}), 400

        # Find all cloth orders with this SKU and get distinct colors
        orders = cloth_orders_collection.find(
            {'items.sku_name': sku_name},
            {'items': 1}
        )

        colors = set()
        for order in orders:
            for item in order.get('items', []):
                if item['sku_name'] == sku_name:
                    color = item.get('color', '').strip()
                    if color:
                        colors.add(color)

        return jsonify({'colors': sorted(list(colors))}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/stats', methods=['GET'])
def get_stats():
    """
    Optimized: 3 DB round-trips total.
    - 1 $facet on cloth_orders  (count + status breakdown)
    - 1 $facet on work_ledger   (worker holdings + final_received total)
    - 1 count  on workers       (fast index scan)
    """
    try:
        # ── orders: count + status breakdown in one pass ─────────────────────
        orders_agg = list(cloth_orders_collection.aggregate([
            {'$facet': {
                'by_status': [{'$group': {'_id': '$status', 'count': {'$sum': 1}}}],
                'total':     [{'$count': 'n'}]
            }}
        ]))[0]
        total_orders  = orders_agg['total'][0]['n'] if orders_agg['total'] else 0
        status_counts = {s['_id']: s['count'] for s in orders_agg['by_status']}

        # ── ledger: worker holdings + final-received in one pass ──────────────
        has_ledger = work_ledger_collection.count_documents({}, limit=1) > 0
        if has_ledger:
            ledger_agg = list(work_ledger_collection.aggregate([
                {'$facet': {
                    'rcv': [{'$group': {
                        '_id': {'entity': '$to_entity', 'sku': '$sku_name'},
                        'n': {'$sum': '$quantity'}
                    }}],
                    'snt': [{'$group': {
                        '_id': {'entity': '$from_entity', 'sku': '$sku_name'},
                        'n': {'$sum': '$quantity'}
                    }}],
                    'final': [
                        {'$match': {'stage': 'final_received', 'to_entity': 'company'}},
                        {'$group': {'_id': None, 'n': {'$sum': '$quantity'}}}
                    ]
                }}
            ]))[0]

            rcv_map  = {(r['_id']['entity'], r['_id']['sku']): r['n'] for r in ledger_agg['rcv']}
            snt_map  = {(s['_id']['entity'], s['_id']['sku']): s['n'] for s in ledger_agg['snt']}
            all_keys = set(rcv_map) | set(snt_map)

            worker_stock = []
            total_in_work = 0
            for (entity, sku) in all_keys:
                if not entity or entity.lower() == 'company' or entity.lower().startswith('supplier'):
                    continue
                holding = rcv_map.get((entity, sku), 0) - snt_map.get((entity, sku), 0)
                if holding > 0:
                    worker_stock.append({'worker_name': entity, 'sku_name': sku, 'quantity': holding})
                    total_in_work += holding
            worker_stock.sort(key=lambda x: x['worker_name'])
            ready_for_barcode = ledger_agg['final'][0]['n'] if ledger_agg['final'] else 0
        else:
            worker_stock, total_in_work, ready_for_barcode = [], 0, 0

        return jsonify({
            'total_orders':     total_orders,
            'orders_by_status': status_counts,
            'total_in_work':    total_in_work,
            'ready_for_barcode': ready_for_barcode,
            'workers_count':    workers_collection.count_documents({'active': True}),
            'worker_stock':     worker_stock
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Worker History ─────────────────────────────────────────────────────────────

@production_bp.route('/api/production/workers/<path:worker_name>/history', methods=['GET'])
def get_worker_history(worker_name):
    """
    Single $facet query returns everything about a worker:
    - All ledger activity (newest first)
    - Current holdings (received - sent > 0) grouped by (sku, color)
    - Completed SKUs  (received - sent == 0) grouped by (sku, color)
    """
    try:
        has_ledger = work_ledger_collection.count_documents({}, limit=1) > 0
        if not has_ledger:
            return jsonify({
                'current_holdings': [], 'completed_skus': [],
                'activity': [], 'total_pieces_ever': 0,
                'total_pieces_current': 0, 'total_pieces_completed': 0
            }), 200

        facet = list(work_ledger_collection.aggregate([
            {'$facet': {
                'activity': [
                    {'$match': {'$or': [{'from_entity': worker_name}, {'to_entity': worker_name}]}},
                    {'$sort': {'created_at': -1}}
                ],
                'received': [
                    {'$match': {'to_entity': worker_name}},
                    {'$group': {'_id': {'sku': '$sku_name', 'color': '$color'}, 'n': {'$sum': '$quantity'},
                                'last_date': {'$max': '$created_at'}}}
                ],
                'sent': [
                    {'$match': {'from_entity': worker_name}},
                    {'$group': {'_id': {'sku': '$sku_name', 'color': '$color'}, 'n': {'$sum': '$quantity'}}}
                ]
            }}
        ]))[0]

        # Build maps with (sku, color) tuple keys
        rcv_map  = {(r['_id']['sku'], r['_id'].get('color') or ''): {'n': r['n'], 'last_date': r.get('last_date')} for r in facet['received']}
        snt_map  = {(s['_id']['sku'], s['_id'].get('color') or ''): s['n'] for s in facet['sent']}
        all_keys = set(rcv_map) | set(snt_map)

        current_holdings, completed_skus = [], []
        for (sku, color) in all_keys:
            r = rcv_map.get((sku, color), {}).get('n', 0)
            s = snt_map.get((sku, color), 0)
            d = rcv_map.get((sku, color), {}).get('last_date')
            holding = r - s
            entry = {
                'sku_name': sku,
                'color': color or '',
                'total_received': r,
                'total_sent': s,
                'last_date': d.isoformat() if d else None
            }
            if holding > 0:
                entry['quantity'] = holding
                current_holdings.append(entry)
            else:
                completed_skus.append(entry)

        current_holdings.sort(key=lambda x: (x['sku_name'], x['color']))
        completed_skus.sort(key=lambda x: x['last_date'] or '', reverse=True)

        activity = []
        for e in facet['activity']:
            e['_id'] = str(e['_id'])
            if e.get('created_at'):
                e['created_at'] = e['created_at'].isoformat()
            # Ensure color field exists for frontend
            if 'color' not in e:
                e['color'] = ''
            activity.append(e)

        return jsonify({
            'current_holdings':      current_holdings,
            'completed_skus':        completed_skus,
            'activity':              activity,
            'total_pieces_ever':     sum(r.get('n', 0) for r in rcv_map.values()),
            'total_pieces_current':  sum(h['quantity'] for h in current_holdings),
            'total_pieces_completed': sum(c['total_sent'] for c in completed_skus)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Repair: sync ledger supplier names to match cloth orders ──────────────────

@production_bp.route('/api/production/repair/sync-supplier-names', methods=['POST'])
def repair_sync_supplier_names():
    """One-time repair: for every cloth order, update ledger entries whose
    to_entity or from_entity is an old supplier name to match the current
    order.supplier_name. Safe to run multiple times."""
    try:
        orders = list(cloth_orders_collection.find({}, {'order_id': 1, 'supplier_name': 1}))
        updated_orders = 0
        for order in orders:
            order_id = order['order_id']
            current_supplier = (order.get('supplier_name') or '').strip()
            if not current_supplier:
                continue
            # Find ledger entries for this order whose entity doesn't match
            ledger_entries = list(work_ledger_collection.find(
                {'order_id': order_id,
                 '$or': [
                     {'to_entity': {'$ne': current_supplier, '$ne': 'company'}},
                     {'from_entity': {'$ne': current_supplier, '$ne': 'company'}}
                 ]},
                {'_id': 1, 'from_entity': 1, 'to_entity': 1}
            ))
            for entry in ledger_entries:
                updates = {}
                fe = (entry.get('from_entity') or '').strip()
                te = (entry.get('to_entity') or '').strip()
                if fe and fe.lower() not in ('company',) and fe != current_supplier:
                    updates['from_entity'] = current_supplier
                if te and te.lower() not in ('company',) and te != current_supplier:
                    updates['to_entity'] = current_supplier
                if updates:
                    work_ledger_collection.update_one({'_id': entry['_id']}, {'$set': updates})
            updated_orders += 1
        return jsonify({'message': f'Synced ledger entries for {updated_orders} orders'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Suppliers ─────────────────────────────────────────────────────────────────

@production_bp.route('/api/production/suppliers', methods=['GET'])
def get_suppliers():
    try:
        docs = list(suppliers_collection.find({'active': True}).sort('name', 1))
        return jsonify([serialize(d) for d in docs]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/suppliers', methods=['POST'])
def create_supplier():
    try:
        data = request.json or {}
        name = (data.get('name') or '').strip()
        company_name = (data.get('company_name') or '').strip()
        if not name:
            return jsonify({'error': 'Supplier name is required'}), 400
        if suppliers_collection.find_one({'name': name, 'active': True}):
            return jsonify({'error': f'Supplier "{name}" already exists'}), 409
        doc = {
            'supplier_id': generate_id('SUP'),
            'name': name,
            'company_name': company_name,
            'active': True,
            'created_at': datetime.now()
        }
        result = suppliers_collection.insert_one(doc)
        doc['_id'] = str(result.inserted_id)
        doc['created_at'] = doc['created_at'].isoformat()
        return jsonify(doc), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/suppliers/<supplier_id>', methods=['PUT'])
def update_supplier(supplier_id):
    try:
        data = request.json or {}
        name = (data.get('name') or '').strip()
        company_name = (data.get('company_name') or '').strip()
        if not name:
            return jsonify({'error': 'Supplier name is required'}), 400
        conflict = suppliers_collection.find_one({'name': name, 'active': True, 'supplier_id': {'$ne': supplier_id}})
        if conflict:
            return jsonify({'error': f'Another supplier named "{name}" already exists'}), 409
        suppliers_collection.update_one(
            {'supplier_id': supplier_id},
            {'$set': {'name': name, 'company_name': company_name}}
        )
        updated = suppliers_collection.find_one({'supplier_id': supplier_id})
        return jsonify(serialize(updated)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/suppliers/<supplier_id>', methods=['DELETE'])
def delete_supplier(supplier_id):
    try:
        suppliers_collection.update_one({'supplier_id': supplier_id}, {'$set': {'active': False}})
        return jsonify({'message': 'Supplier removed'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@production_bp.route('/api/production/suppliers/<supplier_name>/holdings', methods=['GET'])
def get_supplier_holdings(supplier_name):
    """Return current holdings and full ledger activity for a supplier entity."""
    try:
        pipeline_in = [
            {'$match': {'to_entity': supplier_name}},
            {'$group': {'_id': {'sku': '$sku_name', 'color': '$color'}, 'total': {'$sum': '$quantity'}}}
        ]
        pipeline_out = [
            {'$match': {'from_entity': supplier_name}},
            {'$group': {'_id': {'sku': '$sku_name', 'color': '$color'}, 'total': {'$sum': '$quantity'}}}
        ]
        in_map = {(r['_id']['sku'], r['_id'].get('color') or ''): r['total']
                  for r in work_ledger_collection.aggregate(pipeline_in)}
        out_map = {(r['_id']['sku'], r['_id'].get('color') or ''): r['total']
                   for r in work_ledger_collection.aggregate(pipeline_out)}

        all_keys = set(list(in_map.keys()) + list(out_map.keys()))
        current_holdings = []
        for (sku, color) in all_keys:
            qty = in_map.get((sku, color), 0) - out_map.get((sku, color), 0)
            if qty > 0:
                current_holdings.append({
                    'sku_name': sku, 'color': color,
                    'total_received': in_map.get((sku, color), 0),
                    'total_sent': out_map.get((sku, color), 0),
                    'quantity': qty
                })
        current_holdings.sort(key=lambda x: (x['sku_name'], x['color']))

        activity = list(work_ledger_collection.find(
            {'$or': [{'from_entity': supplier_name}, {'to_entity': supplier_name}]}
        ).sort('created_at', -1).limit(100))

        return jsonify({
            'current_holdings': current_holdings,
            'total_pieces_current': sum(h['quantity'] for h in current_holdings),
            'activity': [serialize(e) for e in activity]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
