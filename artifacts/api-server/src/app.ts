import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware, clerkClient } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, appUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy must be mounted BEFORE body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

// Auto-register authenticated users in app_users on first access
const syncedUsers = new Set<string>();
app.use(async (req: Request, _res: Response, next: NextFunction) => {
  const userId = (req as any).auth?.userId as string | undefined;
  if (userId && !syncedUsers.has(userId)) {
    syncedUsers.add(userId);
    try {
      const [existing] = await db.select({ id: appUsersTable.id }).from(appUsersTable).where(eq(appUsersTable.clerkId, userId));
      if (!existing) {
        const clerkUser = await clerkClient.users.getUser(userId);
        await db.insert(appUsersTable).values({
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
          firstName: clerkUser.firstName ?? null,
          lastName: clerkUser.lastName ?? null,
          role: "user",
        }).onConflictDoNothing();
      }
    } catch { /* non-fatal */ }
  }
  next();
});

app.use("/api", router);

export default app;
