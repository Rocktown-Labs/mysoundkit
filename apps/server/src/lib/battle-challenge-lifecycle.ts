export const BATTLE_CHALLENGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000,
  getBattleChallengeExpiryCutoff = (now = new Date()) =>
    new Date(now.getTime() - BATTLE_CHALLENGE_EXPIRY_MS),
  getBattleChallengeExpiresAt = (createdAt: Date) =>
    new Date(createdAt.getTime() + BATTLE_CHALLENGE_EXPIRY_MS),
  hasBattleChallengeExpired = ({
    createdAt,
    now = new Date(),
  }: {
    createdAt: Date;
    now?: Date;
  }) => getBattleChallengeExpiresAt(createdAt).getTime() <= now.getTime();
