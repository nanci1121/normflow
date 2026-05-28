import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import { Prisma } from "./generated/prisma/client";
import { CreateUserInput, HttpError, LoginInput, PublicUser, UserRole } from "./types";

const JWT_EXPIRES_IN = "8h";

interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
}

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error("JWT_SECRET no configurado");
  }
  return secret;
}

function toPublicUser(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

export class AuthService {
  async login(input: LoginInput): Promise<{ accessToken: string }> {
    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      throw new HttpError(401, "Credenciales inválidas");
    }

    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new HttpError(401, "Credenciales inválidas");
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
    };

    const accessToken = jwt.sign(payload, getJwtSecret(), {
      expiresIn: JWT_EXPIRES_IN,
    });

    return { accessToken };
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    return toPublicUser({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      isActive: user.isActive,
    });
  }

  async createUser(currentUserRole: UserRole, input: CreateUserInput): Promise<PublicUser> {
    if (currentUserRole !== "admin") {
      throw new HttpError(403, "No autorizado");
    }

    const email = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 12);

    try {
      const created = await prisma.user.create({
        data: {
          email,
          name: input.name.trim(),
          role: input.role,
          passwordHash,
        },
      });

      return toPublicUser({
        id: created.id,
        email: created.email,
        name: created.name,
        role: created.role as UserRole,
        isActive: created.isActive,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HttpError(409, "El email ya existe");
      }
      throw error;
    }
  }

  async toggleUserActive(currentUserRole: UserRole, userId: string): Promise<PublicUser> {
    if (currentUserRole !== "admin") {
      throw new HttpError(403, "No autorizado");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });

    return toPublicUser({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role as UserRole,
      isActive: updated.isActive,
    });
  }

  verifyToken(authorizationHeader?: string): TokenPayload {
    if (!authorizationHeader) {
      throw new HttpError(401, "Token requerido");
    }

    const [scheme, token] = authorizationHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new HttpError(401, "Token inválido");
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
      return decoded;
    } catch {
      throw new HttpError(401, "Token inválido");
    }
  }
}
