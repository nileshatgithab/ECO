<p align="center">
  <img src="assets/logo.jpeg" width="300" alt="BINARYBINDERS Logo">
</p>

# ECO (Efficient Compressed Operations)

# ECO
ECO: A private, P2P file-sharing utility using bit-level compression for lightning-fast, serverless data exchange.


ECO (Efficient Compressed Operations):

One-Line Pitch: A privacy-first, Peer-to-Peer (P2P) file transfer utility that shrinks data using custom bit-level compression for ultra-fast, serverless sharing.

Core Pillars
Zero-Knowledge Privacy: Unlike cloud services (Drive/Dropbox), ECO never "holds" your data. Files are streamed directly from the sender's RAM to the receiver's RAM. No middleman, no logs, no leaks.

Ultra-Fast Transfer: By implementing a custom Huffman Coding algorithm in JavaScript, we compress text-heavy data (logs, code, JSON) locally before it enters the network. Smaller files = faster arrival.

True P2P "Binding": Utilizing WebRTC Data Channels, we establish a direct encrypted "pipe" between two laptops. Once the connection is "plugged in" (as shown in our logo), the server is completely bypassed.

The "BINARYBINDERS" Edge (Technical Stack)

The Logic: Huffman Coding for bit-level data optimization (no standard libraries).

The Connection: WebRTC for direct browser-to-browser transport.

The Interface: A lightweight, professional UI built with Tailwind CSS.
