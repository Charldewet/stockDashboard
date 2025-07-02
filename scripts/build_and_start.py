#!/usr/bin/env python3
"""
Build script for the TLC Dashboard application.
This script builds the React frontend and then starts the Flask backend.
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and handle errors."""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully!")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed!")
        print(f"Error: {e}")
        if e.stdout:
            print(f"stdout: {e.stdout}")
        if e.stderr:
            print(f"stderr: {e.stderr}")
        return False

def main():
    """Main build and start process."""
    print("🚀 Starting TLC Dashboard build process...")
    
    # Check if we're in the right directory
    if not os.path.exists('package.json'):
        print("❌ Error: package.json not found. Please run this script from the project root.")
        sys.exit(1)
    
    # Build the React app
    if not run_command("npm run build", "Building React frontend"):
        print("❌ Build failed. Exiting.")
        sys.exit(1)
    
    # Check if dist/index.html exists
    if not os.path.exists('dist/index.html'):
        print("❌ Error: dist/index.html not found after build. Build may have failed.")
        sys.exit(1)
    
    print("✅ React app built successfully!")
    print("🚀 Starting Flask server...")
    
    # Start the Flask app
    try:
        # Use the Flask CLI to run the app
        subprocess.run([
            sys.executable, "-m", "flask", 
            "--app", "app", 
            "run", 
            "--host=0.0.0.0", 
            "--port=5000"
        ], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start Flask server: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n👋 Shutting down gracefully...")
        sys.exit(0)

if __name__ == "__main__":
    main() 