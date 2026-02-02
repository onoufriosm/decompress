import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono().basePath("/api");

// Health check - minimal test
app.get("/health", (c) => c.json({ status: "ok", time: new Date().toISOString() }));

export default handle(app);
