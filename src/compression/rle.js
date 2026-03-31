/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RUN-LENGTH ENCODER
   Role: Pre-processes streams by collapsing repeating sequential bytes
   (e.g., compressing large blocks of blank space in a bitmap).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

class RLEncoder {
  static encode(uint8Array) {
    if (!uint8Array || uint8Array.length === 0) return new Uint8Array(0);

    // PRE-ALLOCATION OPTIMIZATION: Maxing out initial memory prevents the JavaScript Engine's
    // Garbage Collector from frequently halting execution to dynamically resize the array.
    const encoded = new Uint8Array(uint8Array.length * 2);
    let outIdx = 0;
    let count = 1;
    let currentByte = uint8Array[0];

    for (let i = 1; i < uint8Array.length; i++) {
      // Counter peaks at 255 to fit within a standard 8-bit unsigned integer limitation
      if (uint8Array[i] === currentByte && count < 255) {
        count++;
      } else {
        // Run ended. Save count and value sequence
        encoded[outIdx++] = count;
        encoded[outIdx++] = currentByte;
        currentByte = uint8Array[i];
        count = 1;
      }
    }
    encoded[outIdx++] = count;
    encoded[outIdx++] = currentByte;

    // Discard unused memory bounds before network transport
    return encoded.slice(0, outIdx);
  }

  static decode(encodedArray) {
    if (!encodedArray || encodedArray.length === 0) return new Uint8Array(0);

    // Exact memory prediction to prevent array resizing overhead on the receiver
    let totalLen = 0;
    for (let i = 0; i < encodedArray.length; i += 2)
      totalLen += encodedArray[i];

    const decoded = new Uint8Array(totalLen);
    let outIdx = 0;

    for (let i = 0; i < encodedArray.length; i += 2) {
      const count = encodedArray[i];
      const byte = encodedArray[i + 1];
      for (let j = 0; j < count; j++) decoded[outIdx++] = byte;
    }
    return decoded;
  }
}
