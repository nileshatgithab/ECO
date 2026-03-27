/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HUFFMAN NODE
   Represents a single value (byte) or a merged parent
   node in the Huffman Tree.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
class HuffmanNode {
  constructor(value, freq) {
    this.value = value; // Stores actual byte values (0-255)
    this.freq = freq;
    this.left = null;
    this.right = null;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HUFFMAN CODER (TRUE BIT-LEVEL COMPRESSION)
   Handles frequency analysis, tree building, and
   packing 1s and 0s into raw binary Arrays.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
class HuffmanCoder {
  // 1. Scan the raw bytes and count how often each byte (0-255) appears
  static getFrequencies(uint8Array) {
    const freqs = {};
    for (let i = 0; i < uint8Array.length; i++) {
      const val = uint8Array[i];
      freqs[val] = (freqs[val] || 0) + 1;
    }
    return freqs;
  }

  // 2. Build the binary tree based on byte frequencies
  static buildTree(uint8Array) {
    const freqs = this.getFrequencies(uint8Array);
    const nodes = Object.keys(freqs).map(
      (val) => new HuffmanNode(Number(val), freqs[val]),
    );

    // Merge nodes until only the root remains
    while (nodes.length > 1) {
      nodes.sort((a, b) => a.freq - b.freq);
      const left = nodes.shift();
      const right = nodes.shift();
      const parent = new HuffmanNode(null, left.freq + right.freq);
      parent.left = left;
      parent.right = right;
      nodes.push(parent);
    }
    return nodes[0];
  }

  // 3. Generate the "0" and "1" string codes for each byte
  static generateCodes(node, currentCode = "", codes = {}) {
    if (!node) return codes;
    if (node.value !== null) {
      codes[node.value] = currentCode;
      return codes;
    }
    this.generateCodes(node.left, currentCode + "0", codes);
    this.generateCodes(node.right, currentCode + "1", codes);
    return codes;
  }

  // 4. PACKING: Convert the string of "0"s and "1"s into actual 8-bit bytes
  static packBits(bitString) {
    const bytes = new Uint8Array(Math.ceil(bitString.length / 8));
    for (let i = 0; i < bitString.length; i++) {
      if (bitString[i] === "1") {
        // Shift the 1 into the correct bit position within the byte
        bytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
      }
    }
    return bytes;
  }

  // 5. UNPACKING: Read the raw bytes and turn them back into "0"s and "1"s
  static unpackBits(bytes, bitLength) {
    let bitString = "";
    for (let i = 0; i < bitLength; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = 7 - (i % 8);
      const bit = (bytes[byteIndex] >> bitIndex) & 1;
      bitString += bit;
    }
    return bitString;
  }

  // ── ENCODE REAL BYTES ──
  static encode(uint8Array) {
    if (!uint8Array || uint8Array.length === 0)
      return { buffer: [], tree: null, bitLength: 0 };

    const tree = this.buildTree(uint8Array);
    const codes = this.generateCodes(tree);

    // Create the long string of bits
    let bitString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      bitString += codes[uint8Array[i]];
    }

    // Pack into real bytes to shrink the payload size
    const packedBytes = this.packBits(bitString);

    // Convert to standard Array so JSON.stringify can send it over WebRTC
    return {
      buffer: Array.from(packedBytes),
      tree: tree,
      bitLength: bitString.length,
    };
  }

  // ── DECODE REAL BYTES ──
  static decode(packedArray, bitLength, rootNode) {
    if (!rootNode || bitLength === 0) return new Uint8Array(0);

    const packedBytes = new Uint8Array(packedArray);
    const bitString = this.unpackBits(packedBytes, bitLength);

    const decoded = [];
    let current = rootNode;

    // Walk the tree to reconstruct the original bytes
    for (let i = 0; i < bitString.length; i++) {
      current = bitString[i] === "0" ? current.left : current.right;

      if (current.value !== null) {
        decoded.push(current.value);
        current = rootNode; // Reset to root for next character
      }
    }

    return new Uint8Array(decoded);
  }
}
