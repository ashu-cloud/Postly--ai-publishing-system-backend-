/**
 * tests/auth.test.ts
 *
 * Auth middleware tests.
 * Tests JWT verification behaviour — valid, expired, missing tokens.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';

// ---- Test helpers --------------------------------------------------

const TEST_SECRET = process.env.JWT_SECRET ?? 'test-secret-key-that-is-at-least-32-chars-long!';
const TEST_USER_ID = 'test-user-id-12345';
const TEST_EMAIL = 'test@postly.test';

function generateTestJWT(userId: string, email = TEST_EMAIL): string {
  return jwt.sign(
    { sub: userId, email },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' }
  );
}

function generateExpiredJWT(userId: string, email = TEST_EMAIL): string {
  return jwt.sign(
    { sub: userId, email },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '-1s' } // Already expired
  );
}

// ---- Tests ---------------------------------------------------------

describe('Auth Middleware', () => {
  it('should allow request with valid JWT', async () => {
    const token = generateTestJWT(TEST_USER_ID);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    // The endpoint returns 404 (user not in DB) — but that's fine.
    // What matters is the middleware didn't return 401 or 403.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('should reject request with expired JWT (401)', async () => {
    const expiredToken = generateExpiredJWT(TEST_USER_ID);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('should reject request with missing token (401)', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should reject request with invalid signature (403)', async () => {
    const tamperedToken = jwt.sign(
      { sub: TEST_USER_ID, email: TEST_EMAIL },
      'wrong-secret-entirely',
      { algorithm: 'HS256', expiresIn: '15m' }
    );
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('should reject malformed Bearer token format (401)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Token not-bearer-format');

    expect(res.status).toBe(401);
  });
});

describe('Auth Register Endpoint', () => {
  it('should reject registration with short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'short', name: 'Test User' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject registration with invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123', name: 'Test User' });

    expect(res.status).toBe(400);
  });
});
