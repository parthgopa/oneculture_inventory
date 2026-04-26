# Inventory Management System

A full-stack barcode-based inventory management system with real-time event tracking.

## 🎯 Core Features

### ✅ Barcode Batch Generation (Module 1)
- Generate multiple barcodes in batches
- Store: Barcode ID, Company Name, SKU, MRP, Batch ID, Timestamp
- Download barcodes as printable images (ZIP format)

### ✅ Enhanced Scanner System (Module 2) 🆕
- **Stock IN Mode** (Green) - Increase inventory
- **Stock OUT Mode** (Red) - Decrease inventory
- **Multi-Scanner Support:**
  - Keyboard emulation mode (universal)
  - USB/HID scanners (WebHID API)
  - Bluetooth scanners (Web Bluetooth API)
- **Device Management:**
  - Auto-detection on page load
  - Manual refresh capability
  - Save/remove scanner configurations
  - Connection status monitoring
- **Scanner Persistence:** Saved devices in localStorage
- Real-time event logging with timestamps
- Last scan tracking and statistics

### ✅ Inventory Engine (Module 3)
- Computed stock levels from scan events
- No manual stock editing (admin-only for bug fixes)
- Event-driven inventory management

### ✅ Dashboard & Analytics (Module 4)
- Total products and stock levels
- Low stock and out-of-stock alerts
- Most scanned products
- 7-day stock movement trends
- Real-time updates

### ✅ Inventory Page (Module 5)
- Complete SKU listing with search and filters
- Display: Barcode, Company, SKU, MRP, Stock, Last Scan
- Stock status indicators
- Real-time stock updates

### ✅ Alerts System (Module 6)
- Automatic low stock notifications (< 10 units)
- Out of stock alerts
- Alert resolution tracking
- Critical SKU highlighting

## 🏗️ Tech Stack

**Frontend:**
- React.js (Vite)
- React Icons (Material Design)
- Real-time UI updates
- Professional white theme with blue accents

**Backend:**
- Python Flask
- REST API
- Event-driven architecture

**Database:**
- MongoDB
- Collections: barcodes, scan_events, alerts

## 📁 Project Structure

```
App2/
├── backend/
│   ├── app.py              # Flask application with all API endpoints
│   ├── requirements.txt    # Python dependencies
│   └── README.md          # Backend setup instructions
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Dashboard.jsx        # Analytics dashboard
    │   │   ├── Scanner.jsx          # Barcode scanning interface
    │   │   ├── Inventory.jsx        # Inventory listing
    │   │   ├── BarcodeGenerator.jsx # Barcode batch generation
    │   │   └── Alerts.jsx           # Alert management
    │   ├── App.jsx          # Main application
    │   ├── theme.css        # Professional styling
    │   ├── config.js        # API configuration
    │   └── index.css        # Base styles
    ├── package.json
    └── README.md           # Frontend setup instructions
```

## 🚀 Quick Start

### Backend Setup

1. Navigate to backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Update MongoDB connection in `app.py`:
```python
MONGO_URI = "your_mongodb_connection_string"
```

4. Run the server:
```bash
python app.py
```

Server runs on: `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend folder:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Update API URL in `src/config.js` if needed:
```javascript
export const API_BASE_URL = 'http://localhost:5000'
```

4. Run the development server:
```bash
npm run dev
```

Frontend runs on: `http://localhost:5173`

## 📡 API Endpoints

### Barcode Management
- `POST /api/barcode-batches` - Create barcode batch
- `GET /api/barcode-batches/<batch_id>/download` - Download barcodes

### Scanning
- `POST /api/scan` - Record scan event (IN/OUT)
- `GET /api/scan-events` - Get scan history

### Inventory
- `GET /api/inventory` - Get all inventory items
- `GET /api/inventory/<barcode_id>` - Get specific item

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Alerts
- `GET /api/alerts` - Get all alerts
- `PUT /api/alerts/<alert_id>/resolve` - Resolve alert

### Admin
- `POST /api/admin/adjust-stock` - Manual stock adjustment (bug fixes only)

## 🔧 Scanner Configuration

The system supports keyboard-emulated barcode scanners:

1. Focus on the scan input field
2. Scanner automatically inputs barcode
3. Press Enter or click button to process
4. System records event and updates inventory

## 🎨 UI Features

- **Clean & Professional Design** - White theme with blue accents
- **Real-time Updates** - Auto-refresh every 5-10 seconds
- **Responsive Layout** - Works on desktop and mobile
- **Stock Indicators** - Visual status (In Stock, Low Stock, Out of Stock)
- **Mode Selection** - Clear IN/OUT mode switching
- **Search & Filters** - Easy inventory navigation

## 🔒 Important Constraints

1. **No Manual Stock Editing** - Inventory derived only from scan events
2. **Admin Override** - Available only for bug fixes via API
3. **Event-Driven** - All stock changes logged as events
4. **Scalable Architecture** - Ready for hardware integrations

## 📊 Database Schema

### Barcodes Collection
```javascript
{
  barcode_id: String,
  company_name: String,
  sku_name: String,
  mrp: Number,
  batch_id: String,
  created_at: DateTime
}
```

### Scan Events Collection
```javascript
{
  barcode_id: String,
  action_type: String, // 'IN' or 'OUT'
  timestamp: DateTime,
  company_name: String,
  sku_name: String,
  is_admin_adjustment: Boolean,
  reason: String
}
```

### Alerts Collection
```javascript
{
  barcode_id: String,
  company_name: String,
  sku_name: String,
  alert_type: String, // 'LOW_STOCK' or 'OUT_OF_STOCK'
  message: String,
  current_stock: Number,
  created_at: DateTime,
  resolved: Boolean,
  resolved_at: DateTime
}
```

## 🔄 Stock Calculation Logic

Current Stock = (Total IN Events) - (Total OUT Events)

The system computes stock in real-time by counting scan events, ensuring data integrity and audit trail.

## 📈 Future Enhancements

- Batch-wise analytics
- Export reports (PDF/Excel)
- Multi-user authentication
- Hardware scanner integration
- Mobile app
- Barcode printing integration
- Advanced analytics and forecasting

## 🐛 Troubleshooting

**Backend not connecting to MongoDB:**
- Verify MongoDB connection string
- Check MongoDB service is running
- Ensure network connectivity

**Frontend not fetching data:**
- Verify backend is running on port 5000
- Check CORS settings
- Update API_BASE_URL in config.js

**Scanner not working:**
- Ensure input field is focused
- Check scanner is in keyboard emulation mode
- Verify scanner outputs Enter key after barcode

## 📝 License

This project is proprietary software for OneCulture Inventory Management.

## 👥 Support

For issues or questions, contact the development team.
