import os
from flask import Flask, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='.')
CORS(app)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"Server AWS Quiz in esecuzione su http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
