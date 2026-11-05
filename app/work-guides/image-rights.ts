const xml = (value: string) => value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char]!));

/** Add attribution without retaining upload metadata such as GPS coordinates. */
export function addImageRights(bytes: Uint8Array, width: number, height: number, artistName: string) {
  const encoder = new TextEncoder();
  const xmp = encoder.encode(`<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"><dc:creator><rdf:Seq><rdf:li>${xml(artistName)}</rdf:li></rdf:Seq></dc:creator><dc:rights><rdf:Alt><rdf:li xml:lang="x-default">Copyright ${xml(artistName)}. Permission required for reuse. Contact: rjbcom4263@gmail.com</rdf:li></rdf:Alt></dc:rights><xmpRights:Marked>True</xmpRights:Marked><xmpRights:WebStatement>https://artist-map.com/</xmpRights:WebStatement></rdf:Description></rdf:RDF></x:xmpmeta>`);
  const extended = String.fromCharCode(...bytes.subarray(12, 16)) === "VP8X";
  const output = new Uint8Array(bytes.length + (extended ? 0 : 18) + 8 + xmp.length + (xmp.length % 2));
  output.set(bytes.subarray(0, 12));
  const view = new DataView(output.buffer);
  if (extended) {
    output.set(bytes.subarray(12), 12);
    output[20] |= 4;
  } else {
    output.set(encoder.encode("VP8X"), 12);
    view.setUint32(16, 10, true);
    // Photon emits lossless VP8L. Preserve its alpha-used flag in VP8X.
    const alpha = String.fromCharCode(...bytes.subarray(12, 16)) === "VP8L" && !!(bytes[24] & 16);
    output[20] = 4 | (alpha ? 16 : 0);
    for (let i = 0; i < 3; i++) { output[24 + i] = ((width - 1) >>> (i * 8)) & 255; output[27 + i] = ((height - 1) >>> (i * 8)) & 255; }
    output.set(bytes.subarray(12), 30);
  }
  const offset = bytes.length + (extended ? 0 : 18);
  output.set(encoder.encode("XMP "), offset);
  view.setUint32(offset + 4, xmp.length, true);
  output.set(xmp, offset + 8);
  view.setUint32(4, output.length - 8, true);
  return output;
}
