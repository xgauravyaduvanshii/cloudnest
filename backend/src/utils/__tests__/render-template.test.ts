/**
 * Unit tests for the lightweight `{{token}}` template renderer used by every
 * transactional email. Confirms substitution, optional inner whitespace, and
 * that unknown/empty tokens never leak raw placeholders to recipients.
 */
import { renderTemplate, withSystemVars } from '../render-template';

describe('renderTemplate', () => {
  it('replaces known tokens with their values', () => {
    const out = renderTemplate('Hello {{userName}}, your code is {{otpCode}}', {
      userName: 'Ada',
      otpCode: 123456,
    });
    expect(out).toBe('Hello Ada, your code is 123456');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(renderTemplate('{{ userName }}', { userName: 'Ada' })).toBe('Ada');
    expect(renderTemplate('{{userName}}', { userName: 'Ada' })).toBe('Ada');
  });

  it('replaces unknown tokens with an empty string', () => {
    expect(renderTemplate('Hi {{missing}}!')).toBe('Hi !');
  });

  it('renders null/undefined variable values as empty', () => {
    expect(renderTemplate('Hi {{name}}', { name: undefined })).toBe('Hi ');
    expect(renderTemplate('Hi {{name}}', { name: null })).toBe('Hi ');
  });

  it('coerces numeric and zero values to strings', () => {
    expect(renderTemplate('Expires in {{mins}} minutes', { mins: 15 })).toBe(
      'Expires in 15 minutes',
    );
    expect(renderTemplate('count={{count}}', { count: 0 })).toBe('count=0');
  });

  it('supports dotted token names', () => {
    expect(renderTemplate('{{user.name}}', { 'user.name': 'Grace' })).toBe(
      'Grace',
    );
  });

  it('handles empty and null inputs without throwing', () => {
    expect(renderTemplate('')).toBe('');
    expect(renderTemplate(undefined as unknown as string)).toBe('');
  });

  it('replaces every occurrence of a repeated token', () => {
    expect(renderTemplate('{{x}}-{{x}}-{{x}}', { x: 'a' })).toBe('a-a-a');
  });
});

describe('withSystemVars', () => {
  it('supplies currentYear without the caller passing it', () => {
    expect(withSystemVars({ userName: 'Ada' }).currentYear).toBe(
      String(new Date().getFullYear()),
    );
  });

  it('keeps caller-supplied values and other vars intact', () => {
    expect(withSystemVars({ userName: 'Ada', otpCode: 123456 })).toEqual({
      currentYear: String(new Date().getFullYear()),
      userName: 'Ada',
      otpCode: 123456,
    });
  });

  it('lets a caller override currentYear explicitly', () => {
    expect(withSystemVars({ currentYear: 1999 }).currentYear).toBe(1999);
  });

  it('renders the footer copyright line end to end', () => {
    const out = renderTemplate(
      'CloudNest by FlyingDarkDev / Urmate. (c) {{currentYear}} CloudNest.',
      withSystemVars({}),
    );
    expect(out).toBe(
      `CloudNest by FlyingDarkDev / Urmate. (c) ${new Date().getFullYear()} CloudNest.`,
    );
  });
});
