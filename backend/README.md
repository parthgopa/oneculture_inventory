# Inventory Management System - Backend

## Setup Instructions

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Update MongoDB connection string in `app.py`:
```python
MONGO_URI = "your_mongodb_connection_string"
```

3. Run the Flask server:
```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### Barcode Management
- `POST /api/barcode-batches` - Create barcode batch
- `GET /api/barcode-batches/<batch_id>/download` - Download barcode images

### Scanning
- `POST /api/scan` - Record scan event (IN/OUT)

### Inventory
- `GET /api/inventory` - Get all inventory items
- `GET /api/inventory/<barcode_id>` - Get specific item

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Alerts
- `GET /api/alerts` - Get all alerts
- `PUT /api/alerts/<alert_id>/resolve` - Resolve alert

### Events
- `GET /api/scan-events` - Get scan event history

### Admin
- `POST /api/admin/adjust-stock` - Manual stock adjustment (for bug fixes)
