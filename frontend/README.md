# Inventory Management System - Frontend

React.js frontend built with Vite for the Inventory Management System.

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure API endpoint in `src/config.js`:
```javascript
export const API_BASE_URL = 'http://localhost:5000'
```

3. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 📁 Project Structure

```
src/
├── components/
│   ├── Dashboard.jsx        # Analytics and statistics
│   ├── Scanner.jsx          # Barcode scanning interface
│   ├── Inventory.jsx        # Inventory listing and management
│   ├── BarcodeGenerator.jsx # Barcode batch generation
│   └── Alerts.jsx           # Alert notifications
├── App.jsx                  # Main application with routing
├── theme.css                # Professional UI styling
├── config.js                # API configuration
└── index.css                # Base CSS reset
```

## 🎨 Features

- **Dashboard:** Real-time statistics and analytics
- **Scanner:** Stock IN/OUT with barcode support
- **Inventory:** Complete product listing with search/filter
- **Barcode Generator:** Create and download barcode batches
- **Alerts:** Low stock and out-of-stock notifications

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 📝 License

Proprietary software for OneCulture Inventory Management.
