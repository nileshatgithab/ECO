# ECO Signaling Server Documentation

## What is the Signaling Server?

The signaling server is a temporary middleman that helps
two peers find each other. Once the P2P connection is
established, the server steps away completely and never
sees the file.

---

## Tech Stack

- Node.js
- Express
- Socket.io

---

## How to Run

- Open your terminal and then run this command
- node server.js

Server runs on → _http://localhost:3000_

---

## The 3 Parts

### 1. Relay (Forwarder)

- Forwards offer, answer and ICE candidates between peers.
- Server never reads the data — just passes it through.

### 2. Trigger

- Fires a "ready" event when exactly 2 peers connect.
- This starts the WebRTC handshake automatically.

### 3. Cleanup

When a peer disconnects:

- Removes them from peers[] array
- Notifies the other peer they left

---

## Connection Flow

1. Peer A opens ECO → added to peers[]
2. Peer B opens ECO → added to peers[]
3. peers.length === 2 → "ready" fires
4. Peer A creates offer → server relays to Peer B
5. Peer B creates answer → server relays to Peer A
6. ICE (Interactive Connectivity Establishment) candidates exchange through server
7. P2P connection established
8. Server steps away completely

---

## Why Zero Knowledge?

The server only relays 3 message types:

- offer (SDP)
- answer (SDP)
- ice-candidate

Software-Defined Perimeter (SDP) is a framework that hides network infrastructure to prevent unauthorized access. It acts as a "black cloud" that only allows authenticated users to see specific resources.

It never sees, stores or logs your file.
The file goes directly device to device.

---

## Files

| File              | Purpose                          |
| ----------------- | -------------------------------- |
| server.js         | Signaling server                 |
| package.json      | Dependencies list                |
| package-lock.json | Exact locked dependency versions |

---

_Built by Piyush Kumar for ECO — FOSS Hackathon 2026_
