import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import { Prisma } from "./generated/prisma/client";
import { ChangePasswordInput, CreateUserInput, HttpError, LoginInput, PublicUser, ResetPasswordInput, UserRole } from "./types";

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
  mustChangePassword: boolean;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

export class AuthService {
  async login(input: LoginInput): Promise<{ accessToken: string; mustChangePassword: boolean }> {
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

    return { accessToken, mustChangePassword: user.mustChangePassword };
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
      mustChangePassword: user.mustChangePassword,
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
        mustChangePassword: created.mustChangePassword,
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
      mustChangePassword: updated.mustChangePassword,
    });
  }

  async resetPassword(
    currentUserRole: UserRole,
    targetUserId: string,
    input: ResetPasswordInput
  ): Promise<{ message: string; temporaryPassword: string }> {
    if (currentUserRole !== "admin") {
      throw new HttpError(403, "No autorizado");
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);

    await prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash, mustChangePassword: true },
    });

    return { message: "Contraseña restablecida correctamente", temporaryPassword: input.newPassword };
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new HttpError(400, "La contraseña actual no es correcta");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return { message: "Contraseña cambiada correctamente" };
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
