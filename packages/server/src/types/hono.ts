import type { AuthUser } from "../middleware/auth.js";

// Custom Hono environment with typed variables
export type AppEnv = {
  Variables: {
    user: AuthUser;
  };
};
