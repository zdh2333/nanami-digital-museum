import { describe, expect, it } from 'vitest'
import worker, { sanitizeImage, type SanitizerEnv } from './index'

const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]).buffer
const sanitizedWebpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer

type TransformOptions = {
  width: number
  height: number
  fit: 'scale-down'
  metadata: 'none'
}

function readBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Response(stream).bytes()
}

function createImagesBinding() {
  const calls: Array<['transform' | 'output', Record<string, unknown>]> = []
  const inputPayloads: Array<Promise<Uint8Array>> = []

  const binding = {
    input(stream: ReadableStream<Uint8Array>) {
      inputPayloads.push(readBytes(stream))

      return {
        transform(options: TransformOptions) {
          calls.push(['transform', options])
          return this
        },
        async output(options: { format: 'image/webp' }) {
          calls.push(['output', options])
          return {
            response: () => new Response(sanitizedWebpBytes.slice(0), {
              headers: { 'content-type': 'image/webp' },
            }),
          }
        },
      }
    },
  } as unknown as ImagesBinding

  return { binding, calls, inputPayloads }
}

type WorkerRequest = Parameters<NonNullable<typeof worker.fetch>>[0]

function callWorker(request: Request, env: SanitizerEnv): Promise<Response> {
  return worker.fetch!(request as unknown as WorkerRequest, env)
}

describe('Nanami image sanitizer', () => {
  it('requests metadata-free 1600px WebP output from a byte stream', async () => {
    const images = createImagesBinding()

    const response = await sanitizeImage(validJpegBytes, images.binding)

    expect(await images.inputPayloads[0]).toEqual(new Uint8Array(validJpegBytes))
    expect(images.calls).toEqual([
      ['transform', { width: 1600, height: 1600, fit: 'scale-down', metadata: 'none' }],
      ['output', { format: 'image/webp' }],
    ])
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(await response.bytes()).toEqual(new Uint8Array(sanitizedWebpBytes))
  })

  it('exposes the transformer only to Pages service-binding POSTs', async () => {
    const images = createImagesBinding()
    const env: SanitizerEnv = { IMAGES: images.binding }

    const unauthorized = await callWorker(
      new Request('https://sanitizer.invalid/', { method: 'POST', body: validJpegBytes }),
      env,
    )
    const accepted = await callWorker(
      new Request('https://sanitizer.invalid/', {
        method: 'POST',
        headers: { 'x-nanami-internal': 'pages' },
        body: validJpegBytes,
      }),
      env,
    )

    expect(unauthorized.status).toBe(404)
    expect(accepted.status).toBe(200)
    expect(accepted.headers.get('content-type')).toBe('image/webp')
  })

  it('rejects image bytes without a JPEG, PNG, or WebP signature', async () => {
    const images = createImagesBinding()

    const response = await callWorker(
      new Request('https://sanitizer.invalid/', {
        method: 'POST',
        headers: { 'x-nanami-internal': 'pages' },
        body: new Uint8Array([0x3c, 0x73, 0x76, 0x67]),
      }),
      { IMAGES: images.binding },
    )

    expect(response.status).toBe(415)
    expect(await response.text()).toBe('Unsupported image format')
    expect(images.calls).toEqual([])
  })
})
