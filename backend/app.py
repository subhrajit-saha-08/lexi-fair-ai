from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/v1/analyze', methods=['POST'])
def analyze():
    payload = request.get_json()
    
    if not payload or 'data' not in payload or 'target_variable' not in payload:
        return jsonify({"error": "Missing 'data' or 'target_variable'"}), 400
        
    data = payload['data']
    target_variable = payload['target_variable']
    
    schema_headers = []
    if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
        schema_headers = list(data[0].keys())
        
    return jsonify({
        "target_variable": target_variable,
        "schema_headers": schema_headers
    }), 200

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
