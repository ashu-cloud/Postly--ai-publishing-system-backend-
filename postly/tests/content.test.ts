/**
 * tests/content.test.ts
 *
 * Content generation endpoint input validation tests.
 * These test the validation layer (Zod schemas) — no real AI calls made.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';

const TEST_SECRET = process.env.JWT_SECRET ?? 'test-secret-key-that-is-at-least-32-chars-long!';

function validToken(): string {
  return jwt.sign(
    { sub: 'test-user-id', email: 'test@postly.test' },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' }
  );
}

const validGenerateBody = {
  idea: 'Building a new AI startup',
  postType: 'ANNOUNCEMENT',
  platforms: ['TWITTER'],
  tone: 'PROFESSIONAL',
  language: 'en',
  model: 'openai',
};

describe('Content Generation — Input Validation', () => {
  it('should reject idea longer than 500 characters (400)', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ ...validGenerateBody, idea: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('500');
  });

  it('should reject empty platforms array (400)', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ ...validGenerateBody, platforms: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject invalid postType (400)', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ ...validGenerateBody, postType: 'INVALID_TYPE' });

    expect(res.status).toBe(400);
  });

  it('should reject invalid model value (400)', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ ...validGenerateBody, model: 'gpt-5' });

    expect(res.status).toBe(400);
  });

  it('should reject missing required field (400)', async () => {
    const { idea: _idea, ...bodyWithoutIdea } = validGenerateBody;
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${validToken()}`)
      .send(bodyWithoutIdea);

    expect(res.status).toBe(400);
  });

  it('should reject unauthenticated request (401)', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .send(validGenerateBody);

    expect(res.status).toBe(401);
  });
});
