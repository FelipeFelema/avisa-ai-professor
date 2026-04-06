export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  tokenId?: string;
};
