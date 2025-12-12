import { UsersService } from './users.service';

describe('UsersService', () => {
  const repo = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    create: jest.fn(),
    updateProfile: jest.fn(),
    updatePassword: jest.fn(),
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(repo as any);
  });

  it('should delegate getById', async () => {
    repo.findById.mockResolvedValue({ id: 'u1' } as any);

    const result = await service.getById('u1');

    expect(repo.findById).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ id: 'u1' });
  });

  it('should delegate getByEmail', async () => {
    repo.findByEmail.mockResolvedValue({ id: 'u1', email: 'user@example.com' } as any);

    const result = await service.getByEmail('user@example.com');

    expect(repo.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(result).toEqual({ id: 'u1', email: 'user@example.com' });
  });

  it('should delegate getByUsername', async () => {
    repo.findByUsername.mockResolvedValue({ id: 'u1', username: 'ratingo_fan' } as any);

    const result = await service.getByUsername('ratingo_fan');

    expect(repo.findByUsername).toHaveBeenCalledWith('ratingo_fan');
    expect(result).toEqual({ id: 'u1', username: 'ratingo_fan' });
  });

  it('should delegate updateProfile with all profile fields', async () => {
    const payload = {
      avatarUrl: 'https://cdn.example.com/avatar.png',
      username: 'ratingo_fan',
      bio: 'bio',
      location: 'Kyiv',
      website: 'https://instagram.com/profile',
      preferredLanguage: 'uk',
      preferredRegion: 'UA',
      isProfilePublic: true,
      showWatchHistory: false,
      showRatings: true,
      allowFollowers: true,
    };
    repo.updateProfile.mockResolvedValue({ id: 'u1', ...payload } as any);

    const result = await service.updateProfile('u1', payload);

    expect(repo.updateProfile).toHaveBeenCalledWith('u1', payload);
    expect(result).toMatchObject({ id: 'u1', ...payload });
  });

  it('should delegate updatePassword', async () => {
    repo.updatePassword.mockResolvedValue(undefined);

    await service.updatePassword('u1', 'hash');

    expect(repo.updatePassword).toHaveBeenCalledWith('u1', 'hash');
  });
});
