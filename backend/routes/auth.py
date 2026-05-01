"""
Authentication routes - signup and login
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import hashlib
import re
from db import db

auth_bp = Blueprint('auth', __name__)

# Users collection
users_collection = db['users']


def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_password(password):
    """
    Validate password requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    return True, "Password is valid"


@auth_bp.route('/api/auth/signup', methods=['POST'])
def signup():
    """Register a new user"""
    try:
        data = request.json
        
        full_name = data.get('full_name', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')
        
        # Validation
        if not full_name:
            return jsonify({'error': 'Full name is required'}), 400
        
        if len(full_name) < 2:
            return jsonify({'error': 'Full name must be at least 2 characters'}), 400
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Validate password strength
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'error': message}), 400
        
        if password != confirm_password:
            return jsonify({'error': 'Passwords do not match'}), 400
        
        # Check if user already exists
        existing_user = users_collection.find_one({'email': email})
        if existing_user:
            return jsonify({'error': 'Email already registered'}), 409
        
        # Create user
        user_doc = {
            'full_name': full_name,
            'email': email,
            'password': hash_password(password),
            'created_at': datetime.now(),
            'last_login': None,
            'is_active': True
        }
        
        result = users_collection.insert_one(user_doc)
        
        print(f"[AUTH] New user registered: {email}")
        
        return jsonify({
            'message': 'Account created successfully',
            'user': {
                'id': str(result.inserted_id),
                'full_name': full_name,
                'email': email
            }
        }), 201
        
    except Exception as e:
        print(f"[AUTH] Signup error: {str(e)}")
        return jsonify({'error': 'Registration failed. Please try again.'}), 500


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """Login user"""
    try:
        data = request.json
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # Validation
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Find user
        user = users_collection.find_one({'email': email})
        
        if not user:
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Check password
        if user['password'] != hash_password(password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Check if account is active
        if not user.get('is_active', True):
            return jsonify({'error': 'Account is deactivated'}), 403
        
        # Update last login
        users_collection.update_one(
            {'_id': user['_id']},
            {'$set': {'last_login': datetime.now()}}
        )
        
        print(f"[AUTH] User logged in: {email}")
        
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': str(user['_id']),
                'full_name': user['full_name'],
                'email': user['email']
            }
        }), 200
        
    except Exception as e:
        print(f"[AUTH] Login error: {str(e)}")
        return jsonify({'error': 'Login failed. Please try again.'}), 500


@auth_bp.route('/api/auth/preferences', methods=['GET'])
def get_preferences():
    """Get user preferences from users collection"""
    try:
        from bson import ObjectId
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'error': 'user_id required'}), 400

        user = users_collection.find_one({'_id': ObjectId(user_id)}, {'preferences': 1})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        prefs = user.get('preferences', {'lowStockThreshold': 50})
        return jsonify(prefs), 200

    except Exception as e:
        print(f"[AUTH] get_preferences error: {str(e)}")
        return jsonify({'error': 'Failed to fetch preferences'}), 500


@auth_bp.route('/api/auth/preferences', methods=['PUT'])
def update_preferences():
    """Save user preferences to users collection"""
    try:
        from bson import ObjectId
        data = request.json
        user_id = data.get('user_id')
        preferences = data.get('preferences')

        if not user_id or preferences is None:
            return jsonify({'error': 'user_id and preferences required'}), 400

        users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'preferences': preferences}},
            upsert=False
        )
        print(f"[AUTH] Preferences updated for user: {user_id}")
        return jsonify({'message': 'Preferences saved'}), 200

    except Exception as e:
        print(f"[AUTH] update_preferences error: {str(e)}")
        return jsonify({'error': 'Failed to save preferences'}), 500


@auth_bp.route('/api/auth/verify', methods=['POST'])
def verify_session():
    """Verify if stored user session is valid"""
    try:
        data = request.json
        user_id = data.get('user_id')
        email = data.get('email')
        
        if not user_id or not email:
            return jsonify({'valid': False}), 200
        
        from bson import ObjectId
        
        try:
            user = users_collection.find_one({
                '_id': ObjectId(user_id),
                'email': email,
                'is_active': True
            })
        except:
            return jsonify({'valid': False}), 200
        
        if user:
            return jsonify({
                'valid': True,
                'user': {
                    'id': str(user['_id']),
                    'full_name': user['full_name'],
                    'email': user['email']
                }
            }), 200
        
        return jsonify({'valid': False}), 200
        
    except Exception as e:
        print(f"[AUTH] Verify error: {str(e)}")
        return jsonify({'valid': False}), 200
