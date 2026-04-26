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
users_collection = db['users']

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
    
    # Users
    users_collection.create_index('email', unique=True)
    
    print("[DB] Indexes ensured")

# Run on import
ensure_indexes()
