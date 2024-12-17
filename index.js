const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Define the port to listen on
const PORT = 28268;

// Create the server
const server = http.createServer((req, res) => {
    // Parse the URL and ignore query parameters
    const parsedUrl = url.parse(req.url);
    let sanitizedPath = decodeURIComponent(parsedUrl.pathname);

    // Resolve the full file path
    let filePath = path.join(__dirname, sanitizedPath);

    // If the path is a directory, check for an index.html file
    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        // Get the file extension
        const ext = path.extname(filePath).toLowerCase();

        // Set MIME types
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
            '.txt': 'text/plain',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        // Check if file exists and serve it
        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found');
                } else {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Server Error');
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            }
        });
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
