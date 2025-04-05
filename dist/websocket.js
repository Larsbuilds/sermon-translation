"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanup = exports.safeRedisOp = exports.redis = exports.getRedis = exports.startStandaloneHealthServer = void 0;
exports.startServer = startServer;
var ws_1 = require("ws");
var http_1 = require("http");
var dotenv_1 = require("dotenv");
var path_1 = require("path");
var fs_1 = require("fs");
var url_1 = require("url");
var http_2 = require("http");
var ioredis_1 = require("ioredis");
var env_js_1 = require("./env.js");
var express_rate_limit_1 = require("express-rate-limit");
var url_2 = require("url");
// Get the directory name in ESM module
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = (0, path_1.dirname)(__filename);
// Store server instances for cleanup
var server = null;
var healthServer = null;
var backupHealthServer = null;
// Store active connections
var connections = new Map();
// Define WebSocket close codes
var WS_CLOSE_CODES = {
    NORMAL_CLOSURE: 1000,
    BAD_REQUEST: 4000,
    MAX_CONNECTIONS: 4001,
    INTERNAL_ERROR: 1011,
    INVALID_ORIGIN: 4003,
    NOT_FOUND: 4004
};
// Broadcast message to all clients in a session except the sender
var broadcastToSession = function (sessionId, senderDeviceId, message) {
    var sessionConnections = connections.get(sessionId);
    if (!sessionConnections)
        return;
    for (var _i = 0, sessionConnections_1 = sessionConnections; _i < sessionConnections_1.length; _i++) {
        var _a = sessionConnections_1[_i], deviceId = _a[0], ws = _a[1];
        if (deviceId !== senderDeviceId && ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
};
// Create a dedicated standalone health server
var startStandaloneHealthServer = function () {
    // Only start health server in production
    if (process.env.NODE_ENV === 'test') {
        console.log('Skipping health server in test environment');
        return;
    }
    try {
        healthServer = http_2.default.createServer(function (req, res) {
            console.log("[Standalone Health Server] Request received: ".concat(req.url));
            if (req.url === '/health' || req.url === '/') {
                var health = {
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    server: 'standalone-health-server'
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(health));
            }
            else {
                res.writeHead(404);
                res.end();
            }
        });
        // Listen on port 0 to let the OS assign a random port
        healthServer.listen(0, 'localhost', function () {
            var addr = healthServer === null || healthServer === void 0 ? void 0 : healthServer.address();
            if (addr && typeof addr === 'object') {
                console.log("Standalone health server running on localhost:".concat(addr.port));
            }
        });
        healthServer.on('error', function (err) {
            console.error('Failed to start standalone health server:', err);
            // Try backup port
            backupHealthServer = http_2.default.createServer(function (req, res) {
                if (req.url === '/health' || req.url === '/') {
                    var health = {
                        status: 'ok',
                        timestamp: new Date().toISOString(),
                        server: 'backup-health-server'
                    };
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(health));
                }
                else {
                    res.writeHead(404);
                    res.end();
                }
            });
            // Listen on port 0 to let the OS assign a random port
            backupHealthServer.listen(0, 'localhost', function () {
                var addr = backupHealthServer === null || backupHealthServer === void 0 ? void 0 : backupHealthServer.address();
                if (addr && typeof addr === 'object') {
                    console.log("Backup health server running on localhost:".concat(addr.port));
                }
            });
        });
    }
    catch (err) {
        console.error('Error creating standalone health server:', err);
    }
};
exports.startStandaloneHealthServer = startStandaloneHealthServer;
// Only start the health server if this is the main module
if (import.meta.url.endsWith((0, url_1.fileURLToPath)(import.meta.url))) {
    (0, exports.startStandaloneHealthServer)();
}
// Load environment variables from .env.ws if it exists
var envPath = (0, path_1.resolve)(__dirname, '../../.env.ws');
if ((0, fs_1.existsSync)(envPath)) {
    (0, dotenv_1.config)({ path: envPath });
    console.log('Loaded environment variables from .env.ws');
}
else {
    console.log('No .env.ws file found, using default environment variables');
    // Set default values for required environment variables
    // Don't set WS_PORT if it's already set by Railway as PORT
    if (!process.env.PORT) {
        process.env.WS_PORT = process.env.WS_PORT || '8080';
    }
    process.env.WS_HOST = process.env.WS_HOST || '0.0.0.0';
}
function startServer() {
    var server = (0, http_1.createServer)(function (req, res) {
        if (req.url === '/health') {
            var health = {
                status: 'degraded',
                environment: process.env.NODE_ENV || 'development',
                redis: 'reconnecting'
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health));
            return;
        }
        res.writeHead(404);
        res.end();
    });
    var wss = new ws_1.WebSocketServer({ noServer: true });
    // Track connections per session
    var connections = new Map();
    var MAX_CONNECTIONS_PER_SESSION = Number(process.env.MAX_CONNECTIONS_PER_SESSION) || 3;
    // Handle upgrade requests
    server.on('upgrade', function (request, socket, head) {
        var pathname = (0, url_2.parse)(request.url || '').pathname;
        var origin = request.headers.origin;
        // Check CORS
        if (origin !== 'http://localhost:3000') {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
        }
        // Only handle /webrtc path
        if (pathname !== '/webrtc') {
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
            socket.destroy();
            return;
        }
        var url = new URL(request.url || '', "http://".concat(request.headers.host));
        var sessionId = url.searchParams.get('sessionId');
        var deviceId = url.searchParams.get('deviceId');
        var isMain = url.searchParams.get('isMain') === 'true';
        // Validate required parameters
        if (!sessionId || !deviceId) {
            wss.handleUpgrade(request, socket, head, function (ws) {
                ws.emit('customClose', { code: WS_CLOSE_CODES.BAD_REQUEST });
                ws.terminate();
            });
            return;
        }
        // Check max connections per session
        var sessionConnections = connections.get(sessionId) || new Set();
        if (sessionConnections.size >= MAX_CONNECTIONS_PER_SESSION) {
            wss.handleUpgrade(request, socket, head, function (ws) {
                ws.emit('customClose', { code: WS_CLOSE_CODES.MAX_CONNECTIONS });
                ws.terminate();
            });
            return;
        }
        wss.handleUpgrade(request, socket, head, function (ws) {
            handleConnection(ws, sessionId, deviceId, isMain);
        });
    });
    function handleConnection(ws, sessionId, deviceId, isMain) {
        // Initialize session connections if not exists
        if (!connections.has(sessionId)) {
            connections.set(sessionId, new Set());
        }
        var sessionConnections = connections.get(sessionId);
        sessionConnections.add(ws);
        // Handle messages
        ws.on('message', function (message) {
            try {
                var data_1 = JSON.parse(message.toString());
                // Broadcast to all clients in the same session except sender
                sessionConnections.forEach(function (client) {
                    if (client !== ws && client.readyState === ws_1.WebSocket.OPEN) {
                        client.send(JSON.stringify(data_1));
                    }
                });
            }
            catch (error) {
                console.error('Error processing message:', error);
                ws.emit('customClose', { code: WS_CLOSE_CODES.INTERNAL_ERROR });
                ws.terminate();
            }
        });
        // Handle connection close
        ws.on('close', function () {
            var sessionConnections = connections.get(sessionId);
            if (sessionConnections) {
                sessionConnections.delete(ws);
                if (sessionConnections.size === 0) {
                    connections.delete(sessionId);
                }
            }
        });
        // Handle errors
        ws.on('error', function (error) {
            console.error('WebSocket error:', error);
            ws.emit('customClose', { code: WS_CLOSE_CODES.INTERNAL_ERROR });
            ws.terminate();
        });
    }
    // Start cleanup interval
    var cleanupInterval = setInterval(function () {
        connections.forEach(function (sessionConnections, sessionId) {
            sessionConnections.forEach(function (ws) {
                if (ws.readyState === ws_1.WebSocket.CLOSED) {
                    sessionConnections.delete(ws);
                }
            });
            if (sessionConnections.size === 0) {
                connections.delete(sessionId);
            }
        });
    }, 30000);
    function cleanup() {
        return __awaiter(this, void 0, void 0, function () {
            var _i, connections_1, _a, sessionId, sessionConnections, _b, sessionConnections_2, ws;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        clearInterval(cleanupInterval);
                        // Close all connections
                        for (_i = 0, connections_1 = connections; _i < connections_1.length; _i++) {
                            _a = connections_1[_i], sessionId = _a[0], sessionConnections = _a[1];
                            for (_b = 0, sessionConnections_2 = sessionConnections; _b < sessionConnections_2.length; _b++) {
                                ws = sessionConnections_2[_b];
                                if (ws.readyState === ws_1.WebSocket.OPEN) {
                                    ws.terminate();
                                }
                            }
                            connections.delete(sessionId);
                        }
                        // Close the WebSocket server and wait for all clients to finish
                        return [4 /*yield*/, new Promise(function (resolve) {
                                wss.close();
                                resolve();
                            })];
                    case 1:
                        // Close the WebSocket server and wait for all clients to finish
                        _c.sent();
                        // Close the HTTP server
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                server.close(function (err) {
                                    if (err)
                                        reject(err);
                                    else
                                        resolve();
                                });
                            })];
                    case 2:
                        // Close the HTTP server
                        _c.sent();
                        // Add a small delay to ensure all connections are properly closed
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                    case 3:
                        // Add a small delay to ensure all connections are properly closed
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    // Start listening on port 3002
    server.listen(3002, 'localhost', function () {
        console.log('WebSocket server listening on ws://localhost:3002');
    });
    return server;
}
// Initialize Redis client with retry strategy
var redisClient = null;
var redisStatus = 'not_initialized';
var getRedis = function () {
    if (!redisClient) {
        console.log('===== REDIS CONNECTION DETAILS =====');
        console.log('Initializing Redis connection to:', env_js_1.env.REDIS_URL);
        console.log('Redis TLS enabled:', env_js_1.env.REDIS_TLS);
        console.log('Redis password set:', env_js_1.env.REDIS_PASSWORD ? 'Yes' : 'No');
        try {
            // Check if we're using the Railway internal network
            var isRailwayInternal = env_js_1.env.REDIS_URL.includes('.railway.internal');
            var redisOptions = {
                maxRetriesPerRequest: 3,
                connectTimeout: 10000,
                retryStrategy: function (times) {
                    var delay = Math.min(times * 100, 3000);
                    console.log("Redis connection retry ".concat(times, ", delaying ").concat(delay, "ms"));
                    return delay;
                }
            };
            if (isRailwayInternal) {
                console.log('Using Railway internal networking for Redis connection');
                // When using Railway internal DNS, use the URL directly
                redisClient = new ioredis_1.default.default(env_js_1.env.REDIS_URL, redisOptions);
            }
            else {
                // For local development or when using explicit host/port
                console.log('Using direct Redis connection (localhost or custom)');
                // Parse Redis URL to get host and port
                var redisUrl = new URL(env_js_1.env.REDIS_URL);
                // Force localhost connection with explicit port instead of using URI
                // This avoids potential DNS resolution issues inside the container
                redisClient = new ioredis_1.default.default(__assign({ host: redisUrl.hostname, port: parseInt(redisUrl.port || '6379'), password: env_js_1.env.REDIS_PASSWORD, tls: env_js_1.env.REDIS_TLS ? {} : undefined }, redisOptions));
            }
            console.log('Redis client created with configuration:', {
                url: env_js_1.env.REDIS_URL,
                tls: env_js_1.env.REDIS_TLS,
                password: env_js_1.env.REDIS_PASSWORD ? 'set' : 'not set'
            });
            if (redisClient) {
                redisClient.on('connect', function () {
                    console.log('Redis client connected');
                    redisStatus = 'connected';
                });
                redisClient.on('ready', function () {
                    console.log('Redis client ready');
                    redisStatus = 'ready';
                });
                redisClient.on('error', function (error) {
                    console.error('Redis client error:', error);
                    redisStatus = 'error';
                });
                redisClient.on('close', function () {
                    console.log('Redis client closed');
                    redisStatus = 'closed';
                });
                redisClient.on('reconnecting', function () {
                    console.log('Redis client reconnecting...');
                    redisStatus = 'reconnecting';
                });
            }
        }
        catch (error) {
            console.error('Error creating Redis client:', error);
            redisStatus = 'error';
        }
    }
    return redisClient;
};
exports.getRedis = getRedis;
// Export Redis client for testing
exports.redis = (0, exports.getRedis)();
// Safe Redis operations with fallbacks
var safeRedisOp = function (operation, fallback) { return __awaiter(void 0, void 0, void 0, function () {
    var error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!redisClient || redisStatus === 'error' || redisStatus === 'closed') {
                    console.log('Redis not available, using fallback');
                    return [2 /*return*/, fallback];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, operation()];
            case 2: return [2 /*return*/, _a.sent()];
            case 3:
                error_1 = _a.sent();
                console.error('Redis operation failed:', error_1);
                return [2 /*return*/, fallback];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.safeRedisOp = safeRedisOp;
// Session cleanup interval
var cleanupInterval = null;
// Start cleanup interval
var startCleanupInterval = function () {
    cleanupInterval = setInterval(function () {
        var now = Date.now();
        for (var _i = 0, connections_2 = connections; _i < connections_2.length; _i++) {
            var _a = connections_2[_i], sessionId = _a[0], sessionConnections = _a[1];
            for (var _b = 0, sessionConnections_3 = sessionConnections; _b < sessionConnections_3.length; _b++) {
                var _c = sessionConnections_3[_b], deviceId = _c[0], ws = _c[1];
                if (ws.lastActivity && now - ws.lastActivity > 30000) {
                    ws.terminate();
                    sessionConnections.delete(deviceId);
                }
            }
            if (sessionConnections.size === 0) {
                connections.delete(sessionId);
            }
        }
    }, 10000);
    // Prevent the interval from keeping the process alive
    cleanupInterval.unref();
};
// Stop cleanup interval
var stopCleanupInterval = function () {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
};
// Rate limiting setup
var rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
// Redis key prefixes
var SESSION_PREFIX = 'ws:session:';
var CONNECTION_PREFIX = 'ws:connection:';
// Export cleanup function
var cleanup = function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, connections_3, _a, sessionId, sessionConnections, _b, sessionConnections_4, _c, deviceId, ws, error_2, closeServer;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                // Stop cleanup interval
                stopCleanupInterval();
                // Close all WebSocket connections
                for (_i = 0, connections_3 = connections; _i < connections_3.length; _i++) {
                    _a = connections_3[_i], sessionId = _a[0], sessionConnections = _a[1];
                    for (_b = 0, sessionConnections_4 = sessionConnections; _b < sessionConnections_4.length; _b++) {
                        _c = sessionConnections_4[_b], deviceId = _c[0], ws = _c[1];
                        if (ws.readyState === ws_1.WebSocket.OPEN) {
                            ws.terminate();
                        }
                    }
                    connections.delete(sessionId);
                }
                if (!redisClient) return [3 /*break*/, 5];
                _d.label = 1;
            case 1:
                _d.trys.push([1, 3, , 4]);
                return [4 /*yield*/, redisClient.quit()];
            case 2:
                _d.sent();
                return [3 /*break*/, 4];
            case 3:
                error_2 = _d.sent();
                console.error('Error closing Redis connection:', error_2);
                return [3 /*break*/, 4];
            case 4:
                redisClient = null;
                _d.label = 5;
            case 5:
                closeServer = function (server) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        if (!server)
                            return [2 /*return*/];
                        return [2 /*return*/, new Promise(function (resolve) {
                                if (!server.listening) {
                                    resolve();
                                    return;
                                }
                                server.close(function () { return resolve(); });
                                // Force close any remaining connections
                                server.emit('close');
                            })];
                    });
                }); };
                return [4 /*yield*/, Promise.all([
                        closeServer(server),
                        closeServer(healthServer),
                        closeServer(backupHealthServer)
                    ])];
            case 6:
                _d.sent();
                server = null;
                healthServer = null;
                backupHealthServer = null;
                // Wait for all operations to complete
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
            case 7:
                // Wait for all operations to complete
                _d.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.cleanup = cleanup;
// Error handler for server startup
var handleServerError = function (err) {
    if (err.code === 'EADDRINUSE') {
        console.error("Port ".concat(err.port || 'unknown', " is already in use"));
        if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
        }
    }
    else {
        console.error('Server error:', err);
    }
};
// Handle process termination
process.on('SIGTERM', function () {
    console.log('SIGTERM signal received. Starting graceful shutdown...');
    (0, exports.cleanup)().catch(function (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    });
});
process.on('SIGINT', function () {
    console.log('SIGINT signal received. Starting graceful shutdown...');
    (0, exports.cleanup)().catch(function (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    });
});
// Start server if this is the main module
if (import.meta.url.endsWith((0, url_1.fileURLToPath)(import.meta.url))) {
    console.log('===== STARTING MAIN WEBSOCKET SERVER MODULE =====');
    // Create the HTTP server
    var server_1 = (0, http_1.createServer)();
    // Use Railway's PORT first, then WS_PORT if set, then default to 8080
    var port_1 = parseInt(process.env.PORT || '') || env_js_1.env.WS_PORT || 8080;
    var host_1 = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    console.log('Server configuration:');
    console.log("PORT env: ".concat(process.env.PORT || 'not set'));
    console.log("WS_PORT env: ".concat(env_js_1.env.WS_PORT || 'not set'));
    console.log("Using port: ".concat(port_1));
    console.log("Using host: ".concat(host_1));
    // Test Redis connection before starting WebSocket server
    var checkRedisAndStart = function () { return __awaiter(void 0, void 0, void 0, function () {
        var client, value, redisOpError_1, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Testing Redis connection before starting WebSocket server...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    client = (0, exports.getRedis)();
                    if (!!client) return [3 /*break*/, 2];
                    console.error('Redis client could not be created. Starting WebSocket server anyway...');
                    return [3 /*break*/, 7];
                case 2:
                    console.log('Redis client created successfully.');
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 6, , 7]);
                    console.log('Testing Redis SET operation...');
                    return [4 /*yield*/, client.set('startup_test', 'ok', 'EX', 60)];
                case 4:
                    _a.sent();
                    console.log('Redis SET operation successful');
                    console.log('Testing Redis GET operation...');
                    return [4 /*yield*/, client.get('startup_test')];
                case 5:
                    value = _a.sent();
                    console.log('Redis GET operation successful, value:', value);
                    return [3 /*break*/, 7];
                case 6:
                    redisOpError_1 = _a.sent();
                    console.error('Error testing Redis operations:', redisOpError_1);
                    console.log('Continuing with WebSocket server startup despite Redis operation errors');
                    return [3 /*break*/, 7];
                case 7:
                    // Start WebSocket server regardless of Redis status
                    console.log('Starting WebSocket server...');
                    startServer(server_1);
                    // Listen on configured port and host
                    server_1.listen(port_1, host_1, function () {
                        console.log("WebSocket server is running on ".concat(host_1, ":").concat(port_1));
                        console.log("WebRTC endpoint: ws://".concat(host_1, ":").concat(port_1, "/webrtc"));
                        console.log("WebSocket endpoint: ws://".concat(host_1, ":").concat(port_1, "/ws"));
                        console.log("Health endpoint: http://".concat(host_1, ":").concat(port_1, "/health"));
                        console.log("Dedicated health endpoint: http://".concat(host_1, ":").concat(port_1 + 1, "/health"));
                        console.log('Environment:', process.env.NODE_ENV || 'development');
                        console.log('Server is ready to accept connections');
                    }).on('error', handleServerError);
                    return [3 /*break*/, 9];
                case 8:
                    error_3 = _a.sent();
                    console.error('Error during Redis check:', error_3);
                    // Start WebSocket server despite Redis errors
                    console.log('Starting WebSocket server despite Redis errors...');
                    startServer(server_1);
                    // Listen on configured port and host
                    server_1.listen(port_1, host_1, function () {
                        console.log("WebSocket server is running on ".concat(host_1, ":").concat(port_1));
                        console.log("WebRTC endpoint: ws://".concat(host_1, ":").concat(port_1, "/webrtc"));
                        console.log("WebSocket endpoint: ws://".concat(host_1, ":").concat(port_1, "/ws"));
                        console.log("Health endpoint: http://".concat(host_1, ":").concat(port_1, "/health"));
                        console.log("Dedicated health endpoint: http://".concat(host_1, ":").concat(port_1 + 1, "/health"));
                        console.log('Environment:', process.env.NODE_ENV || 'development');
                        console.log('Server is ready to accept connections');
                    }).on('error', handleServerError);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); };
    checkRedisAndStart();
}
