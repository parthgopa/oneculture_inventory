"""
SKU Catalog routes — global product name/description/image registry.
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from db import (
    sku_catalog_collection,
    barcodes_collection,
    cloth_orders_collection,
    work_ledger_collection,
    dead_stock_collection,
)

skus_bp = Blueprint('skus', __name__)


def serialize(doc):
    doc['_id'] = str(doc['_id'])
    if isinstance(doc.get('created_at'), datetime):
        doc['created_at'] = doc['created_at'].isoformat()
    if isinstance(doc.get('updated_at'), datetime):
        doc['updated_at'] = doc['updated_at'].isoformat()
    return doc


@skus_bp.route('/api/skus', methods=['GET'])
def list_skus():
    """Return all SKUs without heavy image payload for ultra-fast loading, optionally filtered by ?q= for autocomplete."""
    q = (request.args.get('q') or '').strip()
    include_images = request.args.get('include_images', 'false').lower() == 'true'
    query = {}
    if q:
        query['sku_name'] = {'$regex': q, '$options': 'i'}
    
    if include_images:
        docs = list(sku_catalog_collection.find(query))
    else:
        pipeline = []
        if query:
            pipeline.append({'$match': query})
        pipeline.append({
            '$project': {
                'sku_name': 1,
                'description': 1,
                'color': 1,
                'fabric': 1,
                'mrp': 1,
                'created_at': 1,
                'updated_at': 1,
                'has_image': {
                    '$cond': {
                        'if': {'$and': [{'$ne': ['$image', None]}, {'$ne': ['$image', '']}]},
                        'then': True,
                        'else': False
                    }
                }
            }
        })
        docs = list(sku_catalog_collection.aggregate(pipeline))

    docs.sort(key=lambda d: (d.get('sku_name') or '').lower())
    return jsonify([serialize(d) for d in docs]), 200


@skus_bp.route('/api/skus/<sku_name>/image', methods=['GET'])
def get_sku_image(sku_name):
    """Fetch just the image for a specific SKU."""
    doc = sku_catalog_collection.find_one({'sku_name': sku_name}, {'image': 1, '_id': 0})
    if not doc or not doc.get('image'):
        return jsonify({'image': None}), 404
    return jsonify({'image': doc.get('image')}), 200


@skus_bp.route('/api/skus/names', methods=['GET'])
def list_sku_names():
    """Lightweight endpoint — returns just sku_name strings for autocomplete."""
    docs = list(sku_catalog_collection.find({}, {'sku_name': 1, '_id': 0}))
    docs.sort(key=lambda d: (d.get('sku_name') or '').lower())
    return jsonify([d['sku_name'] for d in docs]), 200


@skus_bp.route('/api/skus', methods=['POST'])
def create_sku():
    """Create a new SKU entry. Body: { sku_name, description?, image?, color?, fabric?, mrp? }"""
    data = request.json or {}
    sku_name = (data.get('sku_name') or '').strip()
    if not sku_name:
        return jsonify({'error': 'sku_name is required'}), 400
    if sku_catalog_collection.find_one({'sku_name': sku_name}):
        return jsonify({'error': f'SKU "{sku_name}" already exists'}), 409
    mrp_raw = data.get('mrp')
    try:
        mrp = float(mrp_raw) if mrp_raw not in (None, '') else None
    except (ValueError, TypeError):
        return jsonify({'error': 'mrp must be a number'}), 400
    doc = {
        'sku_name': sku_name,
        'description': (data.get('description') or '').strip(),
        'image': data.get('image') or None,
        'color': (data.get('color') or '').strip(),
        'fabric': (data.get('fabric') or '').strip(),
        'mrp': mrp,
        'created_at': datetime.now(),
        'updated_at': datetime.now(),
    }
    sku_catalog_collection.insert_one(doc)
    return jsonify(serialize(doc)), 201


@skus_bp.route('/api/skus/<sku_name>', methods=['GET'])
def get_sku(sku_name):
    doc = sku_catalog_collection.find_one({'sku_name': sku_name})
    if not doc:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(serialize(doc)), 200


@skus_bp.route('/api/skus/<sku_name>', methods=['PATCH'])
def update_sku(sku_name):
    """Update sku_name, description, image, color, fabric, and/or mrp."""
    data = request.json or {}
    update = {'updated_at': datetime.now()}
    new_sku_name = (data.get('sku_name') or '').strip() if 'sku_name' in data else None
    
    if new_sku_name is not None and not new_sku_name:
        return jsonify({'error': 'SKU name cannot be empty'}), 400

    if new_sku_name and new_sku_name != sku_name:
        if sku_catalog_collection.find_one({'sku_name': new_sku_name}):
            return jsonify({'error': f'SKU "{new_sku_name}" already exists'}), 409
        update['sku_name'] = new_sku_name

    if 'description' in data:
        update['description'] = (data['description'] or '').strip()
    if 'image' in data:
        update['image'] = data['image'] or None
    if 'color' in data:
        update['color'] = (data['color'] or '').strip()
    if 'fabric' in data:
        update['fabric'] = (data['fabric'] or '').strip()
    if 'mrp' in data:
        mrp_raw = data['mrp']
        try:
            update['mrp'] = float(mrp_raw) if mrp_raw not in (None, '') else None
        except (ValueError, TypeError):
            return jsonify({'error': 'mrp must be a number'}), 400

    result = sku_catalog_collection.update_one({'sku_name': sku_name}, {'$set': update})
    if result.matched_count == 0:
        return jsonify({'error': 'Not found'}), 404

    target_name = new_sku_name if new_sku_name else sku_name

    # If renamed, cascade the rename to related collections
    if new_sku_name and new_sku_name != sku_name:
        barcodes_collection.update_many({'sku_name': sku_name}, {'$set': {'sku_name': new_sku_name}})
        cloth_orders_collection.update_many(
            {'items.sku_name': sku_name},
            {'$set': {'items.$[elem].sku_name': new_sku_name}},
            array_filters=[{'elem.sku_name': sku_name}]
        )
        work_ledger_collection.update_many({'sku_name': sku_name}, {'$set': {'sku_name': new_sku_name}})
        dead_stock_collection.update_many({'sku_name': sku_name}, {'$set': {'sku_name': new_sku_name}})

    doc = sku_catalog_collection.find_one({'sku_name': target_name})
    return jsonify(serialize(doc)), 200


@skus_bp.route('/api/skus/<sku_name>', methods=['DELETE'])
def delete_sku(sku_name):
    result = sku_catalog_collection.delete_one({'sku_name': sku_name})
    if result.deleted_count == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'message': f'Deleted "{sku_name}"'}), 200
