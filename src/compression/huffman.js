/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HUFFMAN CODER
   Role: A custom implementation of Huffman Coding that analyzes 
   byte frequency and assigns shorter binary pathways to common data.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

class HuffmanNode {
  constructor(value, freq) {
    this.value = value;
    this.freq = freq;
    this.left = null;
    this.right = null;
  }
}

class HuffmanCoder {
  // Phase 1: Frequency Analysis. Count byte occurrences within the 0-255 range.
  static getFrequencies(uint8Array) {
    const freqs = {};
    for (let i = 0; i < uint8Array.length; i++) {
      const val = uint8Array[i];
      freqs[val] = (freqs[val] || 0) + 1;
    }
    return freqs;
  }

  // Phase 2: Priority Queue Tree Construction. Lower frequency nodes are merged iteratively.
  static buildTree(uint8Array) {
    const freqs = this.getFrequencies(uint8Array);
    const nodes = Object.keys(freqs).map(
      (val) => new HuffmanNode(Number(val), freqs[val]),
    );
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

  // Phase 3: Traversal to generate binary string mappings for each unique byte.
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

  // Phase 4: Bitwise execution and TypedArray packing.
  static encode(uint8Array) {
    if (!uint8Array || uint8Array.length === 0)
      return { buffer: new Uint8Array(0), tree: null, bitLength: 0 };

    const tree = this.buildTree(uint8Array);
    const codes = this.generateCodes(tree);

    let totalBits = 0;
    for (let i = 0; i < uint8Array.length; i++)
      totalBits += codes[uint8Array[i]].length;

    // PERFORMANCE OPTIMIZATION: By using bitwise shifting, the engine avoids
    // heavy JSON serialization overhead and packs data exactly at the hardware bit level.
    const packedBytes = new Uint8Array(Math.ceil(totalBits / 8));
    let bitIndex = 0;

    for (let i = 0; i < uint8Array.length; i++) {
      const code = codes[uint8Array[i]];
      for (let j = 0; j < code.length; j++) {
        if (code[j] === "1") {
          packedBytes[bitIndex >> 3] |= 1 << (7 - (bitIndex & 7));
        }
        bitIndex++;
      }
    }

    return {
      buffer: Array.from(packedBytes),
      tree: tree,
      bitLength: totalBits,
    };
  }

  // Deserializes the tree mapping after it completes WebRTC JSON transport.
  static reviveTree(node) {
    if (!node) return null;
    const n = new HuffmanNode(node.value, node.freq);
    n.left = this.reviveTree(node.left);
    n.right = this.reviveTree(node.right);
    return n;
  }

  // Phase 5: Receiver Side unpacking using bit extraction.
  static decode(packedArray, bitLength, rootNode) {
    if (!rootNode || bitLength === 0) return new Uint8Array(0);

    const root = this.reviveTree(rootNode);
    const packedBytes = new Uint8Array(packedArray);
    const decoded = new Uint8Array(bitLength);

    let outIdx = 0;
    let current = root;

    // Directly extract bits via bitwise AND masking to navigate the mapping tree
    for (let i = 0; i < bitLength; i++) {
      const bit = (packedBytes[i >> 3] >> (7 - (i & 7))) & 1;
      current = bit === 0 ? current.left : current.right;

      if (current.value !== null) {
        decoded[outIdx++] = current.value;
        current = root;
      }
    }

    return decoded.slice(0, outIdx);
  }
}
