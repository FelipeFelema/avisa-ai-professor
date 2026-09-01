import { queryClient } from '@/config';

describe('query client', () => {
  it('does not retry mutations automatically', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
