export interface SanitizerEnv {
  IMAGES: ImagesBinding
}

class UnsupportedImageError extends Error {
  constructor() {
    super('Unsupported image format')
    this.name = 'UnsupportedImageError'
  }
}

const invalidImageErrorCodes = new Set([
  9402, // input cannot be processed
  9412, // input is not an image
  9413, // input image area is too large
  9520, // image format is unsupported
  9523, // image format cannot be decoded
])

function isInvalidImageError(error: unknown): boolean {
  if (error instanceof UnsupportedImageError) {
    return true
  }

  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false
  }

  const { code } = error
  return typeof code === 'number' && invalidImageErrorCodes.has(code)
}

function hasSupportedImageSignature(bytes: ArrayBuffer): boolean {
  const value = new Uint8Array(bytes)

  const isJpeg = value.length >= 3
    && value[0] === 0xff
    && value[1] === 0xd8
    && value[2] === 0xff

  const isPng = value.length >= 8
    && value[0] === 0x89
    && value[1] === 0x50
    && value[2] === 0x4e
    && value[3] === 0x47
    && value[4] === 0x0d
    && value[5] === 0x0a
    && value[6] === 0x1a
    && value[7] === 0x0a

  const isWebp = value.length >= 12
    && value[0] === 0x52
    && value[1] === 0x49
    && value[2] === 0x46
    && value[3] === 0x46
    && value[8] === 0x57
    && value[9] === 0x45
    && value[10] === 0x42
    && value[11] === 0x50

  return isJpeg || isPng || isWebp
}

function toReadableStream(bytes: ArrayBuffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes))
      controller.close()
    },
  })
}

export async function sanitizeImage(bytes: ArrayBuffer, images: ImagesBinding): Promise<Response> {
  if (!hasSupportedImageSignature(bytes)) {
    throw new UnsupportedImageError()
  }

  const transformOptions: ImageTransform & { metadata: 'none' } = {
    width: 1600,
    height: 1600,
    fit: 'scale-down',
    metadata: 'none',
  }

  const output = await images
    .input(toReadableStream(bytes))
    .transform(transformOptions)
    .output({ format: 'image/webp' })

  const response = output.response()
  if (!response.ok) {
    throw new Error('Images transformation did not return a successful response')
  }

  return new Response(response.body, {
    headers: { 'content-type': 'image/webp' },
  })
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      return await sanitizeImage(await request.arrayBuffer(), env.IMAGES)
    } catch (error) {
      if (isInvalidImageError(error)) {
        return new Response('Unsupported image format', { status: 415 })
      }

      return new Response('Image sanitization unavailable', { status: 502 })
    }
  },
} satisfies ExportedHandler<SanitizerEnv>
