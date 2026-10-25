/**
 * unzip.ts
 *
 * Reads the first file of a .zip archive (the broker symbol lists come zipped, one file
 * each). Handles "stored" and "deflate" entries; enough for those lists, not a general unzip.
 */
import zlib from 'zlib'

const EOCD_SIG = 0x06054b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50

export function unzipFirstFile(zip: Buffer): Buffer {
  // End of central directory: 22 bytes plus an optional comment of up to 64 KB, at the end
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === EOCD_SIG) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not a zip file')
  const central = zip.readUInt32LE(eocd + 16)
  if (zip.readUInt32LE(central) !== CENTRAL_SIG) throw new Error('zip central directory not found')

  const method = zip.readUInt16LE(central + 10)
  const compressedSize = zip.readUInt32LE(central + 20)
  const local = zip.readUInt32LE(central + 42)
  if (zip.readUInt32LE(local) !== LOCAL_SIG) throw new Error('zip entry header not found')
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
  const data = zip.subarray(start, start + compressedSize)

  if (method === 0) return Buffer.from(data)
  if (method === 8) return zlib.inflateRawSync(data)
  throw new Error(`unsupported zip compression method ${method}`)
}
