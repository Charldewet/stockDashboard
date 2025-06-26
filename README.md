# Mobile Dashboard

## Overview

This project is a mobile dashboard application with a Flask backend serving API endpoints and a React-based frontend for displaying data.

## Prerequisites

*   Python (version 3.11+ recommended)
*   pip (Python package installer)
*   Node.js and npm (Node Package Manager)

## Backend Setup

1.  **Navigate to Project Root:**
    Open your terminal and navigate to the main project directory (e.g., `mobileDashboard`).

2.  **Create and Activate Python Virtual Environment (Recommended):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On macOS/Linux
    # For Windows (Git Bash or WSL): source venv/bin/activate
    # For Windows (Command Prompt): venv\Scripts\activate
    ```

3.  **Install Python Dependencies:**
    Ensure your virtual environment is activated, then run:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Start the Backend Server:**
    From the project root directory, run the following command:
    ```bash
    FLASK_APP=app flask run --host=0.0.0.0 --port=5001
    ```
    The backend API will typically be accessible on your local network at `http://<your_local_ip>:5001` (e.g., `http://192.168.0.104:5001`). The server logs will indicate the running IP and port.

## Frontend Setup

1.  **Navigate to Frontend Directory:**
    Open a new terminal window or tab. Navigate into the `frontend` directory:
    ```bash
    cd frontend
    ```

2.  **Install Node.js Dependencies:**
    If you haven't already, or if dependencies have changed, run:
    ```bash
    npm install
    ```

3.  **Start the Frontend Development Server:**
    ```bash
    npm run dev
    ```
    The frontend application will typically be available at:
    *   Local: `http://localhost:5173`
    *   Network: `http://<your_local_ip>:5173` (e.g., `http://192.168.0.104:5173`)
    The Vite server output in the terminal will show the exact URLs.

## Accessing the Application

*   Open your web browser and navigate to the frontend URL (e.g., `http://localhost:5173`).
*   The frontend application will make requests to the backend API. Ensure both servers are running.

## Database
The application uses an SQLite database located at `db/dashboard.db`. The backend server must be started from the project root directory for the relative database path to be resolved correctly. 