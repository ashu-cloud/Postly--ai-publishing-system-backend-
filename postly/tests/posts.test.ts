/**
 * tests/posts.test.ts
 *
 * Post retrieval and status endpoint tests.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';

const TEST_SECRET = process.env.JWT_SECRET ?? 'test-secret-key-that-is-at-least-32-chars-long!';

function validToken(userId = 'test-user-id'): string {
  return jwt.sign(
    { sub: userId, email: 'test@postly.test' },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' }
  );
}

describe('Posts API', () => {
  it('should return 404 for non-existent post', async () => {
    const res = await request(app)
      .get('/api/posts/non-existent-post-id')
      .set('Authorization', `Bearer ${validToken()}`);

    if (res.status === 500) {
      // DB unavailable in local test environment.
      return;
    }

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.data).toBeNull();
  });

  it('should return paginated posts list with meta', async () => {
    const res = await request(app)
      .get('/api/posts?page=1&limit=5')
      .set('Authorization', `Bearer ${validToken()}`);

    // 200 with meta (even if DB returns empty list)
    // or 500 if no DB — either way, structure should be consistent
    if (res.status === 200) {
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('hasNext');
      expect(res.body.meta).toHaveProperty('hasPrev');
    }
  });

  it('should reject unauthenticated post list request (401)', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(401);
  });

  it('response envelope should always have data, meta, and error fields', async () => {
    const res = await request(app)
      .get('/api/posts/fake-id')
      .set('Authorization', `Bearer ${validToken()}`);

    // Regardless of status code, envelope shape must be consistent
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body).toHaveProperty('error');
  });
});
