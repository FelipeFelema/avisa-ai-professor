import { api } from '@/lib';
import { deleteClassroom } from '@/services/classes/classroom.service';

jest.mock('@/lib', () => ({
  api: {
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
