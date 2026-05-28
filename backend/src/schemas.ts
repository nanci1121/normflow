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

export const setApprovalWorkflowSchema = {
  body: {
    type: "object",
    required: ["steps"],
    properties: {
      steps: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["approverId", "responsibility"],
          properties: {
            approverId: { type: "string", minLength: 1 },
            responsibility: { type: "string", minLength: 2 },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
} as const;
