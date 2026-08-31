# Khusomaty (Daily Deal) - Showcase Portfolio

An automated web scraping and price aggregation system designed to extract daily promotional offers from major e-commerce platforms like Amazon and Noon.

*(Note: This repository is a showcase of the frontend interfaces, database architecture, and project structure. The core automation bots and AI-bypass logic are kept private to protect proprietary intellectual property).*

**Key Features Demonstrated:**
* **Database Architecture:** Secure, optimized handlers for Firebase integration (`database_handler.py`).
* **Frontend Interfaces:** Responsive dashboards (`index.html`, `radar.html`, `admin.html`) for user tracking and admin controls.
* **Environment Setup:** Clear dependency management and containerization structure (`Dockerfile`, `requirements.txt`).

**Tech Stack**
* **Backend:** Python (Firebase Admin API)
* **Frontend:** HTML, CSS, Vanilla JavaScript
* **Infrastructure:** Docker, Batch/VBScript for local background execution

**How to Run the Frontend Locally:**
To view the static dashboards and UI structure:

1. Clone this repository.
2. Open `index.html` or `radar.html` directly in your browser.

Or use a simple Python server (recommended for local testing):
`bash
python -m http.server 8000
# then open http://localhost:8000 in your browser
`
