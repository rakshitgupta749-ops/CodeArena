import json
import os
import sys
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import predict

class PredictHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req = json.loads(post_data.decode('utf-8'))
            
            text = req.get("text", "")
            res = predict.predict(text)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(res).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

    def log_message(self, format, *args):
        # Suppress standard HTTP logs for performance/noise reduction
        pass

def run_server(port=5005):
    print("Loading model...")
    predict.load_model()
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, PredictHandler)
    print(f"Server running on port {port}")
    httpd.serve_forever()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5005)
    args = parser.parse_args()
    run_server(port=args.port)
