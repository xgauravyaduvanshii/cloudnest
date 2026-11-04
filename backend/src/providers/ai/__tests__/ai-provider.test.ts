/**
 * Phase 3 AI provider tests (no network):
 *  - parseJsonObject tolerates code fences and prose around the JSON object
 *  - cosineSimilarity math + degenerate guards
 *  - OpenAICompatibleProvider.isConfigured gates on AI_ENABLED + key + base URL
 */

import { parseJsonObject, cosineSimilarity } from '../ai-provider';

describe('parseJsonObject', () => {
  it('parses a plain object', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown code fences', () => {
    expect(parseJsonObject('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it('falls back to the first balanced brace block in noisy prose', () => {
    expect(
      parseJsonObject('Here is the result: {"tags":["x","y"]} hope that helps'),
    ).toEqual({ tags: ['x', 'y'] });
  });

  it('returns null for unparseable text', () => {
    expect(parseJsonObject('not json at all')).toBeNull();
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('guards mismatched lengths and zero vectors', () => {
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('OpenAICompatibleProvider.isConfigured', () => {
  const original = process.env;

  const load = (env: Record<string, string>) => {
    jest.resetModules();
    jest.mock('../../../config/env.config', () => ({ Env: env }));
    jest.mock('../../../utils/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OpenAICompatibleProvider } = require('../openai-compatible.provider');
    return new OpenAICompatibleProvider();
  };

  beforeEach(() => {
    process.env = { ...original };
  });

  it('is false when disabled', () => {
    const p = load({ AI_ENABLED: 'false', AI_API_KEY: 'k', AI_BASE_URL: 'https://x' });
    expect(p.isConfigured()).toBe(false);
  });

  it('is false when key or base url missing', () => {
    expect(load({ AI_ENABLED: 'true', AI_API_KEY: '', AI_BASE_URL: 'https://x' }).isConfigured()).toBe(false);
    expect(load({ AI_ENABLED: 'true', AI_API_KEY: 'k', AI_BASE_URL: '' }).isConfigured()).toBe(false);
  });

  it('is true only when all three are present', () => {
    expect(load({ AI_ENABLED: 'true', AI_API_KEY: 'k', AI_BASE_URL: 'https://x' }).isConfigured()).toBe(true);
  });
});
