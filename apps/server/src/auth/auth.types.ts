import type { AdminRole, UserType } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  email: string;
  type: UserType;
  adminRole?: AdminRole | null;
};

export type RequestUser = JwtPayload;
