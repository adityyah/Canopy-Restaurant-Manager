# backend/app/models/__init__.py
# Makes `models` a Python package.
# Importing each model module here makes them available as:
#   from app.models import User, MenuItem, Order, ...
# However the canonical way to ensure tables are registered is to import
# each model file in main.py (see main.py for details).
