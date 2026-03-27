/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RUN-LENGTH ENCODER (RLE)
   Pre-processes data by squishing repeating bytes 
   into [Count, Value] pairs before Huffman coding.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
class RLEncoder {
  // ── SQUISH REPEATING BYTES ──
  static encode(uint8Array) {
    if (!uint8Array || uint8Array.length === 0) return new Uint8Array(0);

    const encoded = [];
    let count = 1;
    let currentByte = uint8Array[0];

    for (let i = 1; i < uint8Array.length; i++) {
      // If the byte repeats, and we haven't hit the 1-byte max limit of 255
      if (uint8Array[i] === currentByte && count < 255) {
        count++;
      } else {
        // Run ended: push the Count, then the Byte
        encoded.push(count, currentByte);
        currentByte = uint8Array[i];
        count = 1;
      }
    }
    // Push the final run
    encoded.push(count, currentByte);

    return new Uint8Array(encoded);
  }

  // ── EXPAND BACK TO ORIGINAL ──
  static decode(encodedArray) {
    if (!encodedArray || encodedArray.length === 0) return new Uint8Array(0);

    const decoded = [];
    // Read in pairs of two: [Count, Byte]
    for (let i = 0; i < encodedArray.length; i += 2) {
      const count = encodedArray[i];
      const byte = encodedArray[i + 1];

      // Reconstruct the original repeating pattern
      for (let j = 0; j < count; j++) {
        decoded.push(byte);
      }
    }
    return new Uint8Array(decoded);
  }
}
