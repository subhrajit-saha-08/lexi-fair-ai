import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

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

    try:
        model = genai.GenerativeModel('gemini-1.5-pro')
        prompt = f"""
You are an Enterprise AI Ethics Auditor. 
Analyze the following schema headers to identify "Hidden Proxies" for protected classes (race, gender, socioeconomic status) that could bias the prediction of the target variable '{target_variable}'.

Schema headers: {schema_headers}

Return your analysis in a STRICT JSON format containing EXACTLY the following structure:
{{
  "fairness_score": <int between 0 and 100>,
  "flagged_columns": [
    {{
      "column_name": "<name>",
      "risk_reason": "<reasoning>"
    }}
  ]
}}
"""
        response = model.generate_content(
            prompt, 
            generation_config={"response_mime_type": "application/json"}
        )
        analysis = json.loads(response.text)
        
        return jsonify({
            "target_variable": target_variable,
            "schema_headers": schema_headers,
            "analysis": analysis
        }), 200

    except Exception as e:
        return jsonify({
            "target_variable": target_variable,
            "schema_headers": schema_headers,
            "analysis": {
                "fairness_score": 0,
                "error": "AI processing failed"
            }
        }), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
