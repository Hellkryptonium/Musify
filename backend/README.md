# Musify Backend

This is the backend server for Musify, providing real-time communication, audio streaming, and API endpoints.

## Features
- Express.js server
- Socket.io for real-time events
- CORS enabled for frontend integration
- Ready for mediasoup (WebRTC SFU) integration

## Development

### Start in development mode (with auto-reload):
```
npm run dev
```

### Start in production mode:
```
npm start
```

## Environment Variables
- `PORT`: Port to run the backend server (default: 5000)

## Next Steps
- Integrate mediasoup for real-time DJ audio streaming
- Add authentication endpoints (Firebase integration)
- Expand API for chat, reactions, and user management
