import { FormField } from '@/components/ui';
import { renderWithProviders } from '../helpers/render';

describe('FormField', () => {
  it('connects its label and error message to the input', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(
      <FormField label="E-mail" error="E-mail inválido" />,
    );
    expect(getByLabelText('E-mail')).toBeTruthy();
    expect(getByText('E-mail inválido')).toBeTruthy();
  });
});
