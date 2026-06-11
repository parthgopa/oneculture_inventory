"""
Main Flask Application
Modular backend with separate route files
"""
from flask import Flask, make_response
from flask_cors import CORS
import json
from bson import ObjectId
from datetime import datetime

# Import blueprints
from routes.scanner import scanner_bp
from routes.inventory import inventory_bp
from routes.barcodes import barcodes_bp
from routes.alerts import alerts_bp
from routes.dashboard import dashboard_bp
from routes.auth import auth_bp
from routes.production import production_bp
from routes.skus import skus_bp

app = Flask(__name__)
# Explicit CORS configuration for local dev + ngrok tunneling
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:5173",          # Your local React/Vite dev server
            "http://inventory.oneculture.in", # Your Coolify HTTP frontend
            "https://inventory.oneculture.in" # Your future Coolify HTTPS frontend
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        "allow_headers": ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
        "supports_credentials": True
    }
})

class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for MongoDB ObjectId and datetime"""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super(JSONEncoder, self).default(obj)


app.json_encoder = JSONEncoder

# Register blueprints
app.register_blueprint(scanner_bp)
app.register_blueprint(inventory_bp)
app.register_blueprint(barcodes_bp)
app.register_blueprint(alerts_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(production_bp)
app.register_blueprint(skus_bp)


if __name__ == '__main__':
    print("=" * 50)
    print("Inventory Management System - Backend")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
