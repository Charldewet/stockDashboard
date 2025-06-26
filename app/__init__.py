from flask import Flask
from flask_cors import CORS
import app.app as routes_module # Import the app.py module specifically

# Create the main Flask application instance
app = Flask(__name__)

# CORS is configured in app.py with specific origins
# CORS(app)  # Removed to avoid conflicts

# Register the Blueprint from the imported module
# Access api_bp as an attribute of routes_module
app.register_blueprint(routes_module.api_bp)

# The if __name__ == '__main__': block is generally not needed here
# when using the 'flask run' command with FLASK_APP, as 'flask run'
# handles running the app. It's more for direct execution like 'python -m app'.
# if __name__ == '__main__':
#     app.run(debug=True) 