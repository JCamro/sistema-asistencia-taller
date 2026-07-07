#!/bin/bash
set -e

# Activate virtual environment
source /app/.venv/bin/activate

# Apply migrations
python manage.py migrate --noinput

# Collect static files (if whitenoise is configured)
python manage.py collectstatic --noinput --clear

# Start gunicorn
gunicorn config.asgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4
