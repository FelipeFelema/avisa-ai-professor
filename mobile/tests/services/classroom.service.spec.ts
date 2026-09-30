import { api } from '@/lib';
import {
  deleteClassroom,
  getAvailableClassrooms,
  getMyClassrooms,
} from '@/services/classes/classroom.service';
import type { ClassroomSummary } from '@/types/classroom';

jest.mock('@/lib', () => ({
  api: {
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = jest.mocked(api);

describe('classroom service deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends DELETE and accepts the empty 204 response contract', async () => {
    mockedApi.delete.mockResolvedValue({ status: 204, data: undefined } as never);

    await expect(deleteClassroom('classroom-1')).resolves.toBeUndefined();

    expect(mockedApi.delete).toHaveBeenCalledTimes(1);
    expect(mockedApi.delete).toHaveBeenCalledWith('/classrooms/classroom-1');
  });

  it('does not convert a DELETE 404 into a successful deletion', async () => {
    const notFound = new Error('classroom not found');
    mockedApi.delete.mockRejectedValue(notFound);

    await expect(deleteClassroom('missing-classroom')).rejects.toBe(notFound);
  });
});

describe('classroom summary services', () => {
  const classroom: ClassroomSummary = {
    id: 'classroom-1',
    name: '1º Ano A',
    ownerId: 'teacher-1',
    teacher: { id: 'teacher-1', name: 'Professora Ana' },
    lastAnnouncement: {
      id: 'announcement-1',
      title: 'Avaliação',
      createdAt: '2026-09-26T12:00:00.000Z',
      expiresAt: '2026-09-29T23:59:59.000Z',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes through expiresAt from the my-classrooms response', async () => {
    mockedApi.get.mockResolvedValue({ data: [classroom] } as never);

    await expect(getMyClassrooms()).resolves.toEqual([classroom]);

    expect(mockedApi.get).toHaveBeenCalledWith('/classrooms/my');
  });

  it('keeps the search query while passing through expiresAt for available classrooms', async () => {
    mockedApi.get.mockResolvedValue({ data: [classroom] } as never);

    await expect(getAvailableClassrooms('mat')).resolves.toEqual([classroom]);

    expect(mockedApi.get).toHaveBeenCalledWith('/classrooms', {
      params: { search: 'mat' },
    });
  });
});
