import { fireEvent } from '@testing-library/react-native';
import { render } from '@testing-library/react-native';

import { AnnouncementCard } from '@/components/announcements/AnnouncementCard';

function collectText(node: unknown, result: string[] = []): string[] {
  if (typeof node === 'string') {
    result.push(node);
    return result;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, result));
    return result;
  }

  if (node && typeof node === 'object' && 'children' in node) {
    collectText((node as { children?: unknown }).children, result);
  }

  return result;
}

function localDate(dayOffset: number, hour: number) {
  const date = new Date(2026, 9, 1, 12, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 1, 12, 0, 0, 0));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AnnouncementCard', () => {
  it('keeps title, authorship, preview, expiration, and one accessible destination in order', async () => {
    const onPress = jest.fn();
    const content = 'Linha 1\nLinha 2\nLinha 3\nLinha 4';
    const view = await render(
      <AnnouncementCard
        title="Aviso importante"
        content={content}
        author="Prof. Ana"
        expiresAt={localDate(0, 23)}
        onPress={onPress}
      />,
    );
    const text = collectText(view.toJSON());

    const professorIndex = text.findIndex((value) => value.includes('Professor'));
    const authorIndex = text.findIndex((value) => value.includes('Prof. Ana'));
    expect(text.indexOf('Aviso importante')).toBeLessThan(professorIndex);
    expect(professorIndex).toBeLessThan(authorIndex);
    expect(authorIndex).toBeLessThan(text.indexOf(content));
    expect(text.indexOf(content)).toBeLessThan(text.indexOf('Expira hoje'));
    expect(view.getByText(content).props.numberOfLines).toBe(3);
    expect(view.getByText('Expira hoje')).toBeTruthy();
    expect(view.getAllByRole('button')).toHaveLength(1);

    await fireEvent.press(view.getByRole('button', { name: 'Abrir comunicado Aviso importante' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0, 'Expira hoje'],
    [1, 'Expira em 1 dia'],
    [4, 'Expira em 4 dias'],
  ])('shows the exact expiration label for a %s-day calendar difference', async (days, label) => {
    const view = await render(
      <AnnouncementCard
        title="Aviso"
        content="Conteúdo"
        author="Prof. Ana"
        expiresAt={localDate(days, 23)}
      />,
    );

    expect(view.getByText(label)).toBeTruthy();
  });

  it.each([undefined, 'not-a-date', localDate(-1, 23)])(
    'omits an invalid or past expiration label (%s)',
    async (expiresAt) => {
      const view = await render(
        <AnnouncementCard
          title="Aviso"
          content="Conteúdo"
          author="Prof. Ana"
          expiresAt={expiresAt}
        />,
      );

      expect(view.queryByText(/Expira/)).toBeNull();
      expect(view.queryByText('Comunicado ativo')).toBeNull();
    },
  );
});
