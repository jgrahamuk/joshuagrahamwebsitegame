#!/usr/bin/env python3
"""
Local development server with routing support.

Features:
- Serves static files from the current directory
- Proxies /api/* requests to Supabase Edge Functions
- Routes /<username> paths to game.html for SPA-style routing

Usage:
    python server.py [port]
    python server.py 8080
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import os
import sys
from urllib.parse import urlparse, urljoin

# Configuration
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
SUPABASE_URL = 'http://127.0.0.1:54321/functions/v1'

# Static file extensions
STATIC_EXTENSIONS = {
    '.html', '.css', '.js', '.json', '.png', '.gif', '.jpg', '.jpeg',
    '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map'
}

# Known static paths (files and directories)
STATIC_PATHS = {'resources', 'js', 'css', 'index.html', 'game.html', 'favicon.ico'}


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info')
        self.end_headers()

    def do_GET(self):
        """Handle GET requests with routing."""
        path = urlparse(self.path).path

        # API proxy
        if path.startswith('/api/'):
            self.proxy_to_supabase('GET')
            return

        # Check if it's a static file or known path
        if self.is_static_path(path):
            super().do_GET()
            return

        # SPA routing: serve game.html for username paths
        # Pattern: /<username> where username is alphanumeric with hyphens
        path_parts = path.strip('/').split('/')
        if len(path_parts) == 1 and path_parts[0] and self.looks_like_username(path_parts[0]):
            self.serve_file('game.html')
            return

        # Default: try to serve as static file
        super().do_GET()

    def do_POST(self):
        """Handle POST requests (API proxy only)."""
        path = urlparse(self.path).path

        if path.startswith('/api/'):
            self.proxy_to_supabase('POST')
            return

        self.send_error(405, 'Method Not Allowed')

    def is_static_path(self, path):
        """Check if path is a static file or directory."""
        path = path.strip('/')

        # Root path
        if not path:
            return True

        # Check file extension
        _, ext = os.path.splitext(path)
        if ext.lower() in STATIC_EXTENSIONS:
            return True

        # Check known static paths
        first_segment = path.split('/')[0]
        if first_segment in STATIC_PATHS:
            return True

        # Check if file exists
        if os.path.exists(path):
            return True

        return False

    def looks_like_username(self, segment):
        """Check if a path segment looks like a username."""
        if not segment or len(segment) < 2:
            return False
        # Usernames: alphanumeric and hyphens, 2+ chars
        return all(c.isalnum() or c == '-' for c in segment)

    def serve_file(self, filename):
        """Serve a specific file."""
        try:
            with open(filename, 'rb') as f:
                content = f.read()

            self.send_response(200)
            if filename.endswith('.html'):
                self.send_header('Content-Type', 'text/html')
            elif filename.endswith('.js'):
                self.send_header('Content-Type', 'application/javascript')
            elif filename.endswith('.css'):
                self.send_header('Content-Type', 'text/css')
            self.send_header('Content-Length', len(content))
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404, 'File Not Found')

    def proxy_to_supabase(self, method):
        """Proxy request to Supabase Edge Functions."""
        path = urlparse(self.path).path
        function_path = path[4:]  # Remove '/api' prefix

        target_url = SUPABASE_URL + function_path
        query = urlparse(self.path).query
        if query:
            target_url += '?' + query

        try:
            # Read request body for POST
            body = None
            if method == 'POST':
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length) if content_length > 0 else None

            # Build proxy request
            req = urllib.request.Request(target_url, data=body, method=method)

            # Forward relevant headers
            for header in ['Content-Type', 'Authorization', 'apikey', 'x-client-info']:
                if header in self.headers:
                    req.add_header(header, self.headers[header])

            # Make request
            with urllib.request.urlopen(req, timeout=30) as response:
                response_body = response.read()

                self.send_response(response.status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
                self.send_header('Content-Length', len(response_body))
                self.end_headers()
                self.wfile.write(response_body)

        except urllib.error.HTTPError as e:
            error_body = e.read()
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', len(error_body))
            self.end_headers()
            self.wfile.write(error_body)

        except urllib.error.URLError as e:
            error_msg = f'{{"error": "Supabase connection failed: {str(e)}"}}'.encode()
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', len(error_msg))
            self.end_headers()
            self.wfile.write(error_msg)

    def log_message(self, format, *args):
        """Custom log format."""
        path = args[0].split()[1] if args else ''
        if path.startswith('/api/'):
            prefix = '→ API'
        elif self.looks_like_username(path.strip('/').split('/')[0] if path != '/' else ''):
            prefix = '→ SPA'
        else:
            prefix = '     '
        print(f"{prefix} {args[0]}")


def run():
    with socketserver.TCPServer(("", PORT), DevHandler) as httpd:
        print(f"🗺️  maap.to dev server running at http://localhost:{PORT}")
        print(f"   API proxy: /api/* → {SUPABASE_URL}/*")
        print(f"   SPA routes: /<username> → game.html")
        print(f"   Press Ctrl+C to stop\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")


if __name__ == '__main__':
    run()
