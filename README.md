# EXP Stats Calculator - Local Setup

## Prerequisites

Make sure you have the following installed on your system:
- **Python 3.7+** (with pip)
- **Node.js 16+** (with npm)

## Step 1: Clone/Download the Project

Download all the project files to a local directory on your computer.

## Step 2: Set Up the Backend (Flask Server)

1. **Navigate to the project directory:**
   ```bash
   cd your-project-directory
   ```

2. **Install Python dependencies:**
   ```bash
   pip install flask flask-cors requests
   ```
   
   If you get permission errors, try:
   ```bash
   pip install --user flask flask-cors requests
   ```

3. **Start the Flask server:**
   ```bash
   python server.py
   ```
   
   You should see output like:
   ```
   * Running on http://127.0.0.1:5000
   * Debug mode: on
   ```

   **Keep this terminal window open** - the Flask server needs to stay running.

## Step 3: Set Up the Frontend (React App)

1. **Open a NEW terminal window** (keep the Flask server running in the first one)

2. **Navigate to the same project directory:**
   ```bash
   cd your-project-directory
   ```

3. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

4. **Start the React development server:**
   ```bash
   npm run dev
   ```

   You should see output like:
   ```
   Local:   http://localhost:5173/
   Network: http://192.168.x.x:5173/
   ```

## Step 4: Access the Application

1. **Open your web browser**
2. **Go to:** `http://localhost:5173/`
3. **You should see the EXP Stats Calculator interface**

## How to Use

1. **Upload Images:** Drag and drop multiple game screenshot images or click to select files
2. **Processing:** The app will automatically process each image using OCR
3. **View Results:** See aggregated player statistics, search functionality, and detailed breakdowns
4. **Player Aggregation:** If the same player appears in multiple images, their EXP will be automatically summed

## Troubleshooting

### Backend Issues:
- **"ModuleNotFoundError: No module named 'flask'"**
  - Run: `pip install flask flask-cors requests`
  - Try with `--user` flag if needed

- **Port 5000 already in use:**
  - Change the port in `server.py`: `app.run(debug=True, port=5001)`
  - Update the frontend URL in `src/utils/imageProcessor.ts` to match

### Frontend Issues:
- **"Failed to fetch" error:**
  - Make sure the Flask server is running on port 5000
  - Check that both servers are running simultaneously

- **CORS errors:**
  - The Flask server includes CORS headers, but if you still get errors, try restarting both servers

### General:
- **Make sure both servers are running at the same time**
- **Flask server:** http://localhost:5000
- **React server:** http://localhost:5173

## File Structure

```
project/
├── server.py              # Flask backend
├── package.json           # Node.js dependencies
├── src/
│   ├── App.tsx           # Main React component
│   ├── components/       # React components
│   ├── types/           # TypeScript types
│   └── utils/           # Utility functions
└── README.md            # This file
```

## API Endpoints

- **POST /process** - Upload and process multiple images
- **GET /health** - Check server status

The backend uses the PaddleOCR API at: `https://yolo12138-paddle-ocr-api.hf.space/ocr?lang=en`