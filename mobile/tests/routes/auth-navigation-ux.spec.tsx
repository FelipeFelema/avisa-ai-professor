import { fireEvent, waitFor, within } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import LoginScreen from '../../app/(auth)/login';
import RegisterScreen from '../../app/(auth)/register';
import { useAuth } from '@/hooks/useAuth';
import { renderWithProviders } from '../helpers/render';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }));

const mockUseRouter = jest.mocked(useRouter);
const mockUseAuth = jest.mocked(useAuth);
const register = jest.fn();
const login = jest.fn();

const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  router.canGoBack.mockReturnValue(false);
  mockUseRouter.mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
  register.mockResolvedValue(undefined);
  login.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ login, register } as never);
});

describe('registration navigation UX', () => {
  it('keeps registration fields reachable, preserves values, and switches the teacher field', async () => {
    const view = await renderWithProviders(<RegisterScreen />);

    await fireEvent.press(view.getByRole('button', { name: /Respons.vel/ }));
    expect(view.getByText('Confirmar senha')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Cadastrar' })).toBeTruthy();
    expect(view.queryByText(/C.digo do professor/)).toBeNull();

    await fireEvent.changeText(view.getByPlaceholderText('Digite seu nome'), 'Ana Souza');
    await fireEvent.changeText(
      view.getByPlaceholderText('seuemail@exemplo.com'),
      'ana@example.com',
    );
    await fireEvent.changeText(view.getByPlaceholderText('Crie uma senha'), 'senha-segura');
    await fireEvent.changeText(view.getByPlaceholderText('Confirme sua senha'), 'senha-segura');

    await fireEvent.press(view.getByRole('button', { name: 'Professor' }));
    expect(view.getByText(/C.digo do professor/)).toBeTruthy();
    expect(view.getByDisplayValue('Ana Souza')).toBeTruthy();
    expect(view.getByDisplayValue('ana@example.com')).toBeTruthy();
    expect(view.getAllByDisplayValue('senha-segura')).toHaveLength(2);

    await fireEvent.changeText(view.getByPlaceholderText('Ex: PROF-XXXXXX'), 'PROF-123');
    await fireEvent.press(view.getByRole('button', { name: /Respons.vel/ }));

    expect(view.getByDisplayValue('Ana Souza')).toBeTruthy();
    expect(view.getByDisplayValue('ana@example.com')).toBeTruthy();
    expect(view.queryByPlaceholderText('Ex: PROF-XXXXXX')).toBeNull();
  });

  it('exposes validation messages and preserves the existing registration payload', async () => {
    const view = await renderWithProviders(<RegisterScreen />);

    await fireEvent.press(view.getByRole('button', { name: 'Professor' }));
    await fireEvent.press(view.getByRole('button', { name: 'Cadastrar' }));

    expect(view.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(register).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByPlaceholderText('Digite seu nome'), 'Professor Teste');
    await fireEvent.changeText(
      view.getByPlaceholderText('seuemail@exemplo.com'),
      'prof@example.com',
    );
    await fireEvent.changeText(view.getByPlaceholderText('Crie uma senha'), 'senha-segura');
    await fireEvent.changeText(view.getByPlaceholderText('Confirme sua senha'), 'senha-segura');
    await fireEvent.changeText(view.getByPlaceholderText('Ex: PROF-XXXXXX'), 'PROF-123');
    await fireEvent.press(view.getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => {
      expect(register).toHaveBeenCalled();
      expect(register.mock.calls[0]?.[0]).toEqual({
        name: 'Professor Teste',
        email: 'prof@example.com',
        password: 'senha-segura',
        teacherCode: 'PROF-123',
      });
    });
    expect(register.mock.calls[0]?.[0]).not.toHaveProperty('confirmPassword');
    expect(register.mock.calls[0]?.[0]).not.toHaveProperty('role');
  });

  it('returns from registration through the visual back control without changing the form flow', async () => {
    const view = await renderWithProviders(<RegisterScreen />);

    await fireEvent.press(view.getByRole('button', { name: 'Voltar' }));

    expect(router.replace).toHaveBeenCalledWith('/login');
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('login navigation UX', () => {
  it('keeps one footer account CTA, opens registration, and has no visual back control', async () => {
    const view = await renderWithProviders(<LoginScreen />);
    const accountCtas = view.getAllByRole('button', { name: 'Criar conta' });
    const footerText = view.getByText(/N.o possui uma conta\?/);
    const footer = footerText.parent;

    expect(accountCtas).toHaveLength(1);
    expect(footer).not.toBeNull();
    expect(within(footer!).getByRole('button', { name: 'Criar conta' })).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Voltar' })).toBeNull();

    await fireEvent.press(accountCtas[0]);

    expect(router.push).toHaveBeenCalledWith('/register');
  });

  it('preserves Login fields, validation feedback, and the Entrar submit flow', async () => {
    const view = await renderWithProviders(<LoginScreen />);
    const email = view.getByPlaceholderText('seuemail@exemplo.com');
    const password = view.getByPlaceholderText('Sua senha');

    await fireEvent.changeText(email, 'email-invalido');
    await fireEvent.changeText(password, '123');
    await fireEvent.press(view.getByRole('button', { name: 'Entrar' }));

    expect(view.getAllByRole('alert')).toHaveLength(2);
    expect(view.getByDisplayValue('email-invalido')).toBeTruthy();
    expect(view.getByDisplayValue('123')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();

    await fireEvent.changeText(email, 'pessoa@example.com');
    await fireEvent.changeText(password, 'senha-segura');
    await fireEvent.press(view.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(login.mock.calls[0]?.[0]).toEqual({
        email: 'pessoa@example.com',
        password: 'senha-segura',
      });
    });
  });
});
