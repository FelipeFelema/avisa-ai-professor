export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  sid: string;
  jti?: string;
};
