/**
 * Production Server Configuration
 * Serves the React application with proper routing for SPA behavior
 */

import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the dist directory
app.use(express.static(join(__dirname, 'dist')));

// Handle all GET requests by serving the index.html file
// This ensures that client-side routing works properly
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Create HTTP server
const server = createServer(app);

// Start the server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Application served from http://localhost:${PORT}`);
  console.log(`📂 Serving files from: ${join(__dirname, 'dist')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});