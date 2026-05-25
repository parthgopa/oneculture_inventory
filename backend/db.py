"""
Database connection and collections
"""
from pymongo import MongoClient, ASCENDING, DESCENDING
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME')

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

    print("[DB] Indexes ensured")

# Run on import
ensure_indexes()
