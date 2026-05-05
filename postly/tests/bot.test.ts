import { Context } from 'grammy';

jest.mock('../src/config/redis', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
  },
  createRedisConnection: jest.fn(),
}));

import { startCommand } from '../src/modules/bot/commands/start.command';

describe('Telegram /post command', () => {
  it('starts the publish flow and replies with the first prompt', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const ctx = {
      chat: { id: 123456 },
      from: { first_name: 'Ashu' },
      reply,
    } as unknown as Context;

    await startCommand(ctx);

    expect(reply).toHaveBeenCalledWith(
      'Hey Ashu 👋 What type of post is this?',
      expect.objectContaining({ reply_markup: expect.any(Object) })
    );
  });
});