export const authLoginSchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 6 },
    },
    additionalProperties: false,
  },
} as const;

export const createUserSchema = {
  body: {
    type: "object",
    required: ["email", "name", "password", "role"],
    properties: {
      email: { type: "string", format: "email" },
      name: { type: "string", minLength: 2 },
      password: { type: "string", minLength: 8 },
      role: { type: "string", enum: ["admin", "owner", "approver", "reader"] },
    },
    additionalProperties: false,
  },
} as const;
