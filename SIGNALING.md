<div align="center">

# 🛰️ ECO Signaling Server

_The temporary handshake broker — steps away the moment peers connect._

[![Node.js](https://img.shields.io/badge/Runtime-Node.js-green)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Framework-Express-black)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Transport-Socket.io-white)](https://socket.io/)

</div>

---

## What is the Signaling Server?

WebRTC peers can't find each other on their own — they need a temporary broker to exchange connection details. That's all the ECO signaling server does.

It relays three message types between peers, then **steps away completely**. It never sees, stores, or touches your file data.

---

## Tech Stack

| Technology    | Role                                |
| ------------- | ----------------------------------- |
| **Node.js**   | Runtime environment                 |
| **Express**   | HTTP server & static file serving   |
| **Socket.io** | Real-time bidirectional event relay |

---

## Getting Started

### Prerequisites

- Node.js `v18+`
- Dependencies installed via `npm install`

### Run the Server

```bash
# Using npm
npm start

# Or directly with Node
node src/server/server.js
```

Server starts at → `http://localhost:3000`

---

## Architecture: The 3 Parts

### 1. 🔀 Relay (Forwarder)

Forwards WebRTC negotiation messages between the two peers:

- `offer` — Peer A's connection proposal
- `answer` — Peer B's response
- `ice-candidate` — Network path candidates for NAT traversal

The server **never reads** the content of these messages — it just passes them through like a postman who can't open letters.

### 2. ⚡ Trigger

When exactly **2 peers** join the same session, the server fires a `ready` event automatically. This kicks off the WebRTC handshake without any manual action from the user.

```
peers.length === 2  →  emit("ready")  →  handshake begins
```

### 3. 🧹 Cleanup

When a peer disconnects:

- Removes them from the `peers[]` array
- Notifies the remaining peer that the session has ended

---

## Connection Flow

```
Peer A                  Signaling Server               Peer B
  │                           │                           │
  │── connects ──────────────▶│ peers[] = [A]             │
  │                           │                           │
  │                           │◀────────── connects ──────│
  │                           │ peers[] = [A, B]          │
  │                           │                           │
  │◀──────────── "ready" ─────│──────────── "ready" ──────▶│
  │                           │                           │
  │── offer (SDP) ───────────▶│──────────── offer ────────▶│
  │                           │                           │
  │◀─────────── answer ───────│◀─────── answer (SDP) ─────│
  │                           │                           │
  │◀──── ICE candidates ──────│────── ICE candidates ─────▶│
  │                           │                           │
  │◀══════════ Direct P2P connection established ══════════▶│
  │                           │                           │
  │                    [Server exits]                      │
  │                           │                           │
  │◀══════════════ File streams directly ══════════════════▶│
```

---

## Why Zero Knowledge?

The server only ever relays these three message types:

| Message         | What it contains                         |
| --------------- | ---------------------------------------- |
| `offer`         | SDP — connection metadata, not file data |
| `answer`        | SDP — peer's response to the offer       |
| `ice-candidate` | Network path info for NAT traversal      |

**SDP (Session Description Protocol)** is a standard format describing connection parameters — codec info, network addresses, encryption keys. It contains zero file content.

Once the P2P tunnel is open, all file data flows **directly device-to-device**, bypassing the server entirely. The server has no way to intercept or log your transfer.

---

## File Reference

| File                   | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `src/server/server.js` | Signaling server — the only backend ECO runs         |
| `package.json`         | Project dependencies                                 |
| `package-lock.json`    | Locked dependency versions for reproducible installs |
| `SIGNALING.md`         | This document                                        |

---

## Deployment Note

When deploying, make sure the server reads its port from the environment:

```js
const PORT = process.env.PORT || 3000;
server.listen(PORT);
```

This is required for platforms like **Render**, **Railway**, or **Fly.io** which assign ports dynamically.

---

<div align="center">

_Built by **Piyush Kumar** for ECO — BINARYBINDERS · FOSS Hackathon 2026_

</div>
