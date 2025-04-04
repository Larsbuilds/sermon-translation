# Test Cases TODO List

## WebRTCSignaling Tests

### Core Functionality
- [ ] ICE candidate handling and queueing
- [ ] Message parsing error scenarios
- [ ] Maximum reconnection attempts
- [ ] Connection timeout scenarios
- [ ] Concurrent connections
- [ ] Message ordering and delivery guarantees

### Edge Cases
- [ ] Network interruption during signaling
- [ ] Invalid message formats
- [ ] Memory leaks in long-running connections
- [ ] Race conditions in state transitions

## WebSocket Server Tests

### Session Management
- [ ] Maximum connections per session (2 devices)
- [ ] Session expiry and cleanup
- [ ] Session data persistence in Redis
- [ ] Concurrent session creation/deletion

### Error Handling
- [ ] Invalid message formats
- [ ] Large message handling (>16KB)
- [ ] Redis connection failures
- [ ] Server shutdown with active connections

### Security & Infrastructure
- [ ] CORS policy enforcement
- [ ] Health check endpoint
- [ ] Rate limiting
- [ ] Load balancing scenarios

## End-to-End Tests

### Signaling Flow
- [ ] Complete flow: offer -> answer -> ICE
- [ ] Reconnection with session recovery
- [ ] Multiple devices in same session
- [ ] Browser compatibility matrix

### Media Streaming
- [ ] Audio quality assessment
- [ ] Network condition handling
- [ ] Bandwidth adaptation
- [ ] Echo cancellation

## Performance Tests

### Latency & Throughput
- [ ] Message latency under load
- [ ] Connection establishment time
- [ ] Redis operation performance
- [ ] Maximum concurrent sessions

### Resource Usage
- [ ] Memory usage patterns
- [ ] CPU utilization during streaming
- [ ] Network bandwidth consumption
- [ ] Redis memory footprint

## Integration Tests

### External Services
- [ ] MongoDB connection resilience
- [ ] Redis failover scenarios
- [ ] Railway deployment verification
- [ ] CDN integration (if applicable)

### Client-Side
- [ ] Browser compatibility matrix
- [ ] Mobile device support
- [ ] Progressive Web App behavior
- [ ] Offline mode handling

## Notes

### Test Environment Setup
- Need Docker compose for local Redis and MongoDB
- Consider using k6 for load testing
- Set up browser testing matrix with Playwright
- Configure CI pipeline timeouts for long-running tests

### Metrics to Track
- Test coverage percentage
- Performance benchmarks
- Memory leak detection
- Error rate thresholds 