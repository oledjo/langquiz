import express from 'express'
import request from 'supertest'
import { describe, expect, test } from 'vitest'
import { errorHandler } from './requestContext'

function appThrowing(error: unknown) {
  const instance = express()
  instance.get('/boom', () => {
    throw error
  })
  instance.use(errorHandler)
  return instance
}

describe('errorHandler', () => {
  test('passes a body-parser rejection through with its own status and message', async () => {
    const tooLarge = Object.assign(new Error('request entity too large'), { status: 413 })

    const response = await request(appThrowing(tooLarge)).get('/boom')

    expect(response.status).toBe(413)
    expect(response.body.error).toBe('request entity too large')
  })

  test('keeps everything else an opaque 500', async () => {
    const response = await request(appThrowing(new Error('connection terminated unexpectedly'))).get('/boom')

    expect(response.status).toBe(500)
    expect(response.body.error).toBe('Internal server error.')
  })

  test('does not leak a 5xx status set on the error itself', async () => {
    const upstream = Object.assign(new Error('gateway said no'), { status: 502 })

    const response = await request(appThrowing(upstream)).get('/boom')

    expect(response.status).toBe(500)
    expect(response.body.error).toBe('Internal server error.')
  })
})
