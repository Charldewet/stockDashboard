#!/bin/bash
set -e

echo "🔧 Setting up Python environment..."

# Force Python 3.11
export PYTHON_VERSION=3.11.18

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

echo "✅ Build completed successfully!" 