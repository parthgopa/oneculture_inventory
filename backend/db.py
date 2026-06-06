"""
Database connection and collections
"""
from pymongo import MongoClient, ASCENDING, DESCENDING
import os
from dotenv import load_dotenv

load_dotenv()


MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME')
print("MONGO_URI:", MONGO_URI)
print("DB_NAME:", DB_NAME)

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# Collections
barcodes_collection = db['barcodes']
scan_events_collection = db['scan_events']
alerts_collection = db['alerts']
scanners_collection = db['scanners']
app_preferences_collection = db['app_preferences']

# Production workflow collections
cloth_orders_collection = db['cloth_orders']
work_ledger_collection = db['work_ledger']
workers_collection = db['workers']

# SKU catalog — global product name/description/image registry
sku_catalog_collection = db['sku_catalog']

# Suppliers registry
suppliers_collection = db['suppliers']

# Constants
STOCK_THRESHOLD = 10

# Create indexes for fast queries (runs once, idempotent)
def ensure_indexes():
    """Create indexes for optimal query performance"""
    # Barcodes - fast lookup by barcode_id
    barcodes_collection.create_index('barcode_id', unique=True)
    barcodes_collection.create_index([('sku_name', ASCENDING), ('company_name', ASCENDING)])
    barcodes_collection.create_index('batch_id')
    
    # Scan events - critical for fast stock calculation
    scan_events_collection.create_index([('barcode_id', ASCENDING), ('timestamp', DESCENDING)])
    scan_events_collection.create_index([('barcode_id', ASCENDING), ('action_type', ASCENDING)])
    scan_events_collection.create_index('timestamp')
    
    # Alerts - fast lookup for unresolved alerts
    alerts_collection.create_index([('barcode_id', ASCENDING), ('resolved', ASCENDING)])
    alerts_collection.create_index('created_at')
    
    # Scanners
    scanners_collection.create_index('scanner_id', unique=True)
    
    # Production workflow
    cloth_orders_collection.create_index('order_id', unique=True)
    cloth_orders_collection.create_index('status')
    work_ledger_collection.create_index('order_id')
    work_ledger_collection.create_index([('from_entity', ASCENDING), ('sku_name', ASCENDING)])
    work_ledger_collection.create_index([('to_entity', ASCENDING), ('sku_name', ASCENDING)])
    workers_collection.create_index('worker_id', unique=True)
    workers_collection.create_index('name')

    # SKU catalog
    sku_catalog_collection.create_index('sku_name', unique=True)

    # Suppliers
    suppliers_collection.create_index('supplier_id', unique=True)
    suppliers_collection.create_index('name')

    print("[DB] Indexes ensured")


def migrate_stock_fields():
    """
    ONE-TIME MIGRATION: Initialize current_stock and last_action fields on barcodes.
    This calculates stock from scan_events and stores it directly on the barcode document
    for O(1) lookups instead of O(n) aggregation.
    Safe to run multiple times - only updates documents missing the fields.
    """
    # Find barcodes without current_stock field
    barcodes_to_migrate = list(barcodes_collection.find(
        {'current_stock': {'$exists': False}},
        {'barcode_id': 1}
    ))
    
    if not barcodes_to_migrate:
        print("[DB] No barcodes need stock migration")
        return
    
    print(f"[DB] Migrating {len(barcodes_to_migrate)} barcodes...")
    
    for barcode in barcodes_to_migrate:
        barcode_id = barcode['barcode_id']
        
        # Calculate stock from scan events
        pipeline = [
            {'$match': {'barcode_id': barcode_id}},
            {'$sort': {'timestamp': -1}},
            {'$group': {
                '_id': '$barcode_id',
                'last_action': {'$first': '$action_type'},
                'in_count': {'$sum': {'$cond': [{'$eq': ['$action_type', 'IN']}, 1, 0]}},
                'out_count': {'$sum': {'$cond': [{'$eq': ['$action_type', 'OUT']}, 1, 0]}}
            }}
        ]
        
        result = list(scan_events_collection.aggregate(pipeline))
        
        if result:
            current_stock = result[0]['in_count'] - result[0]['out_count']
            last_action = result[0]['last_action']
        else:
            current_stock = 0
            last_action = None
        
        # Update barcode document
        barcodes_collection.update_one(
            {'barcode_id': barcode_id},
            {'$set': {
                'current_stock': current_stock,
                'last_action': last_action
            }}
        )
    
    print(f"[DB] Migrated {len(barcodes_to_migrate)} barcodes with stock data")


# Run on import
ensure_indexes()
migrate_stock_fields()
