"""
SKU Catalog routes — global product name/description/image registry.
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from db import sku_catalog_collection

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
    """Return all SKUs, optionally filtered by ?q= for autocomplete."""
    q = (request.args.get('q') or '').strip()
    query = {}
    if q:
        query['sku_name'] = {'$regex': q, '$options': 'i'}
    docs = list(sku_catalog_collection.find(query).sort('sku_name', 1))
    return jsonify([serialize(d) for d in docs]), 200


@skus_bp.route('/api/skus/names', methods=['GET'])
def list_sku_names():
    """Lightweight endpoint — returns just sku_name strings for autocomplete."""
    docs = list(sku_catalog_collection.find({}, {'sku_name': 1, '_id': 0}).sort('sku_name', 1))
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
    """Update description, image, color, fabric, and/or mrp."""
    data = request.json or {}
    update = {'updated_at': datetime.now()}
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
    doc = sku_catalog_collection.find_one({'sku_name': sku_name})
    return jsonify(serialize(doc)), 200


@skus_bp.route('/api/skus/<sku_name>', methods=['DELETE'])
def delete_sku(sku_name):
    result = sku_catalog_collection.delete_one({'sku_name': sku_name})
    if result.deleted_count == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'message': f'Deleted "{sku_name}"'}), 200
