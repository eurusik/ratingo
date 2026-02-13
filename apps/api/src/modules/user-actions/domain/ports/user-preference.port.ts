export const USER_PREFERENCE_PORT = Symbol('USER_PREFERENCE_PORT');

export interface IUserPreferencePort {
  getAutoSubscribeOnWatch(userId: string): Promise<boolean>;
}
