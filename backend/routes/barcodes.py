"""
Barcode generation routes
Optimized for batch operations and document generation
"""
from flask import Blueprint, request, jsonify, send_file
from datetime import datetime
import io
import base64
import barcode
from barcode.writer import ImageWriter
import zipfile
from db import barcodes_collection, scan_events_collection

barcodes_bp = Blueprint('barcodes', __name__)


def generate_barcode_base64(barcode_id, compact=False):
    """
    Generate barcode image and return as base64 string.
    compact=True produces smaller images suitable for multi-column layouts.
    """
    EAN = barcode.get_barcode_class('code128')
    
    # Configure writer options for compact output
    writer_options = {
        'module_width': 0.25 if compact else 0.4,  # Width of barcode bars
        'module_height': 8 if compact else 15,      # Height of bars in mm
        'quiet_zone': 2 if compact else 6.5,        # Whitespace on sides
        'font_size': 8 if compact else 10,          # Text size
        'text_distance': 3 if compact else 5,       # Distance between bars and text
        'write_text': not compact,                  # Hide text in compact mode (we add it in HTML)
    }
    
    ean = EAN(barcode_id, writer=ImageWriter())
    img_buffer = io.BytesIO()
    ean.write(img_buffer, options=writer_options)
    img_buffer.seek(0)
    return base64.b64encode(img_buffer.read()).decode('utf-8')


@barcodes_bp.route('/api/barcode-batches', methods=['POST'])
def create_barcode_batch():
    """Create a new batch of barcodes with optional product image"""
    data = request.json
    company_name = data.get('company_name')
    sku_name = data.get('sku_name')
    mrp = data.get('mrp')
    size = data.get('size', '')
    color = data.get('color', '')
    quantity = int(data.get('quantity', 1))
    product_image = data.get('product_image')  # Base64 image (optional)

    if not all([company_name, sku_name, mrp]):
        return jsonify({'error': 'Missing required fields'}), 400

    # Find the last barcode for this SKU to continue numbering
    last_barcode = barcodes_collection.find_one(
        {'sku_name': sku_name},
        sort=[('barcode_id', -1)]
    )
    
    # Use pure numeric format for better scanner compatibility
    timestamp = datetime.now().strftime('%y%m%d%H%M%S')
    batch_id = f"B{timestamp}"
    created_barcodes = []
    
    # Determine starting number
    if last_barcode and last_barcode.get('barcode_id'):
        # Extract the last 4 digits from the previous barcode
        last_number = int(last_barcode['barcode_id'][-4:])
        start_number = last_number + 1
    else:
        start_number = 1

    for i in range(quantity):
        barcode_id = f"{timestamp}{str(start_number + i).zfill(4)}"

        barcode_doc = {
            'barcode_id': barcode_id,
            'company_name': company_name,
            'sku_name': sku_name,
            'mrp': float(mrp),
            'size': size,
            'color': color,
            'batch_id': batch_id,
            'created_at': datetime.now()
        }

        # Add product image to first barcode of batch (acts as batch metadata)
        if i == 0 and product_image:
            barcode_doc['product_image'] = product_image

        result = barcodes_collection.insert_one(barcode_doc)
        barcode_doc['_id'] = str(result.inserted_id)
        barcode_doc['created_at'] = barcode_doc['created_at'].isoformat()
        if 'product_image' in barcode_doc:
            del barcode_doc['product_image']  # Don't return in response
        created_barcodes.append(barcode_doc)

    return jsonify({
        'message': f'Created {quantity} barcodes',
        'batch_id': batch_id,
        'barcodes': created_barcodes
    }), 201


@barcodes_bp.route('/api/barcode-batches/<batch_id>/image', methods=['PUT'])
def update_batch_image(batch_id):
    """Update or add product image for a batch"""
    try:
        data = request.json
        product_image = data.get('product_image')
        
        if not product_image:
            return jsonify({'error': 'No image provided'}), 400
        
        # Update the first barcode of the batch with the image
        result = barcodes_collection.update_one(
            {'batch_id': batch_id},
            {'$set': {'product_image': product_image}},
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Batch not found'}), 404
        
        return jsonify({'message': 'Image updated successfully'}), 200
    except Exception as e:
        print(f"[BARCODE] Error updating image: {str(e)}")
        return jsonify({'error': str(e)}), 500


@barcodes_bp.route('/api/barcode-batches/<batch_id>/image', methods=['GET'])
def get_batch_image(batch_id):
    """Get product image for a batch"""
    try:
        barcode = barcodes_collection.find_one(
            {'batch_id': batch_id, 'product_image': {'$exists': True}},
            {'product_image': 1}
        )
        
        if not barcode or not barcode.get('product_image'):
            return jsonify({'image': None}), 200
        
        return jsonify({'image': barcode['product_image']}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@barcodes_bp.route('/api/barcode-batches', methods=['GET'])
def get_all_batches():
    """Get all barcode batches"""
    try:
        pipeline = [
            {
                '$group': {
                    '_id': '$batch_id',
                    'company_name': {'$first': '$company_name'},
                    'sku_name': {'$first': '$sku_name'},
                    'size': {'$first': '$size'},
                    'color': {'$first': '$color'},
                    'mrp': {'$first': '$mrp'},
                    'created_at': {'$first': '$created_at'},
                    'quantity': {'$sum': 1}
                }
            },
            {'$sort': {'created_at': -1}}
        ]

        batches = list(barcodes_collection.aggregate(pipeline))

        for batch in batches:
            batch['batch_id'] = batch.pop('_id')
            if batch.get('created_at'):
                batch['created_at'] = batch['created_at'].isoformat()

        return jsonify(batches), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@barcodes_bp.route('/api/barcode-batches/<batch_id>', methods=['GET'])
def get_batch_details(batch_id):
    """Get details of a specific batch with optional base64 images"""
    try:
        include_images = request.args.get('include_images', 'false').lower() == 'true'
        
        barcodes = list(barcodes_collection.find({'batch_id': batch_id}))
        
        if not barcodes:
            return jsonify({'error': 'Batch not found'}), 404
        
        # Get all barcode IDs for batch stock calculation
        barcode_ids = [bc['barcode_id'] for bc in barcodes]
        
        # Single aggregation for all stock calculations
        stock_pipeline = [
            {'$match': {'barcode_id': {'$in': barcode_ids}}},
            {'$group': {
                '_id': '$barcode_id',
                'in_count': {'$sum': {'$cond': [{'$eq': ['$action_type', 'IN']}, 1, 0]}},
                'out_count': {'$sum': {'$cond': [{'$eq': ['$action_type', 'OUT']}, 1, 0]}}
            }}
        ]
        stock_results = {r['_id']: r['in_count'] - r['out_count'] 
                        for r in scan_events_collection.aggregate(stock_pipeline)}
        
        # Get batch info
        batch_info = {
            'company_name': barcodes[0]['company_name'],
            'sku_name': barcodes[0]['sku_name'],
            'mrp': barcodes[0]['mrp'],
            'size': barcodes[0].get('size', ''),
            'color': barcodes[0].get('color', ''),
            'created_at': barcodes[0]['created_at'].isoformat() if barcodes[0].get('created_at') else None,
            'quantity': len(barcodes)
        }
        
        for bc in barcodes:
            bc['_id'] = str(bc['_id'])
            if bc.get('created_at'):
                bc['created_at'] = bc['created_at'].isoformat()
            bc['current_stock'] = stock_results.get(bc['barcode_id'], 0)
            
            # Include base64 image if requested
            if include_images:
                bc['image_base64'] = generate_barcode_base64(bc['barcode_id'])
        
        return jsonify({
            'batch_id': batch_id,
            'batch_info': batch_info,
            'barcodes': barcodes
        }), 200
    except Exception as e:
        print(f"[BARCODE] Error getting batch details: {str(e)}")
        return jsonify({'error': str(e)}), 500


@barcodes_bp.route('/api/barcode-batches/<batch_id>/download', methods=['GET'])
def download_barcode_batch(batch_id):
    """Download barcode images as ZIP"""
    barcodes_list = list(barcodes_collection.find({'batch_id': batch_id}))
    
    if not barcodes_list:
        return jsonify({'error': 'Batch not found'}), 404
    
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for bc in barcodes_list:
            barcode_id = bc['barcode_id']
            
            EAN = barcode.get_barcode_class('code128')
            ean = EAN(barcode_id, writer=ImageWriter())
            
            img_buffer = io.BytesIO()
            ean.write(img_buffer)
            img_buffer.seek(0)
            
            zip_file.writestr(f"{barcode_id}.png", img_buffer.read())
    
    zip_buffer.seek(0)
    
    return send_file(
        zip_buffer,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'{batch_id}.zip'
    )


@barcodes_bp.route('/api/barcode-image/<barcode_id>', methods=['GET'])
def get_barcode_image(barcode_id):
    """Get barcode image"""
    try:
        EAN = barcode.get_barcode_class('code128')
        ean = EAN(barcode_id, writer=ImageWriter())
        
        img_buffer = io.BytesIO()
        ean.write(img_buffer)
        img_buffer.seek(0)
        
        return send_file(
            img_buffer,
            mimetype='image/png',
            as_attachment=False
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@barcodes_bp.route('/api/barcode-batches/<batch_id>/document', methods=['GET'])
def generate_barcode_document(batch_id):
    """
    Generate Word/PDF document with barcodes in grid layout.
    Query params:
    - columns: number of barcodes per row (default: 3)
    - show_details: include barcode ID (default: true)
    - format: 'word' or 'pdf' (default: word)
    """
    try:
        columns = int(request.args.get('columns', 3))
        show_details = request.args.get('show_details', 'true').lower() == 'true'
        doc_format = request.args.get('format', 'word').lower()
        
        columns = max(1, min(columns, 6))  # Limit 1-6 columns
        
        barcodes_list = list(barcodes_collection.find({'batch_id': batch_id}))
        
        if not barcodes_list:
            return jsonify({'error': 'Batch not found'}), 404
        
        batch_info = barcodes_list[0]
        
        # A4 width is 210mm, with 10mm margins = 190mm usable = ~720px at 96dpi
        # Calculate pixel widths that Word will respect
        usable_width_px = 700  # Safe width in pixels
        cell_width_px = usable_width_px // columns
        img_width_px = cell_width_px - 20  # Account for padding/borders
        
        # Font sizes based on columns
        font_sizes = {1: 12, 2: 10, 3: 8, 4: 7, 5: 6, 6: 5}
        font_size = font_sizes.get(columns, 8)
        
        use_compact = columns >= 2  # Use compact barcodes for 2+ columns
        
        # Generate HTML with inline styles for Word compatibility
        html_content = f'''<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns:v="urn:schemas-microsoft-com:vml">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>Barcodes - {batch_id}</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {{ size: A4; margin: 10mm; }}
        body {{ font-family: Arial, sans-serif; margin: 0; padding: 10px; }}
    </style>
</head>
<body>
    <div style="text-align:center; margin-bottom:10px; padding-bottom:8px; border-bottom:2px solid #333;">
        <h1 style="margin:0 0 5px 0; font-size:14px;">{batch_info['sku_name']}</h1>
        <p style="margin:2px 0; font-size:9px; color:#666;">
            <b>Company:</b> {batch_info['company_name']} | 
            <b>MRP:</b> Rs.{batch_info['mrp']:.2f} |
            {batch_info.get('size') and f"<b>Size:</b> {batch_info['size']} | " or ""}
            {batch_info.get('color') and f"<b>Color:</b> {batch_info['color']} | " or ""}
            <b>Batch:</b> {batch_id} |
            <b>Total:</b> {len(barcodes_list)}
        </p>
    </div>
    <table width="100%" cellpadding="3" cellspacing="0" border="0" style="border-collapse:collapse;">
'''
        
        # Generate barcode images in table rows
        for i, bc in enumerate(barcodes_list):
            if i % columns == 0:
                if i > 0:
                    html_content += '        </tr>\n'
                html_content += '        <tr>\n'
            
            # Generate compact base64 image
            img_base64 = generate_barcode_base64(bc['barcode_id'], compact=use_compact)
            
            # Use inline width attribute that Word respects
            html_content += f'''            <td width="{100 // columns}%" align="center" valign="middle" style="border:1px dashed #ccc; padding:5px;">
                <img src="data:image/png;base64,{img_base64}" width="{img_width_px}" style="display:block;">'''
            if show_details:
                html_content += f'''
                <p style="font-family:Consolas,monospace; font-size:{font_size}px; margin:3px 0 0 0; color:#333;">{bc["barcode_id"]}</p>'''
            html_content += '''
            </td>
'''
        
        # Fill remaining cells in last row
        remaining = len(barcodes_list) % columns
        if remaining > 0:
            for _ in range(columns - remaining):
                html_content += f'            <td width="{100 // columns}%" style="border:1px dashed #ccc;"></td>\n'
        
        html_content += '''        </tr>
    </table>
</body>
</html>'''
        
        buffer = io.BytesIO(html_content.encode('utf-8'))
        buffer.seek(0)
        
        if doc_format == 'pdf':
            # Return HTML for browser print-to-PDF (not as attachment)
            return send_file(
                buffer,
                mimetype='text/html',
                as_attachment=False  # Opens in browser for print
            )
        else:
            return send_file(
                buffer,
                mimetype='application/msword',
                as_attachment=True,
                download_name=f'{batch_id}_barcodes.doc'
            )
    except Exception as e:
        print(f"[BARCODE] Error generating document: {str(e)}")
        return jsonify({'error': str(e)}), 500
