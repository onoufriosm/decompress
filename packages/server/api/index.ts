import { Hono } from "hono";
import { handle } from "hono/vercel";
import { cors } from "hono/cors";
import chat from "../src/routes/chat.js";
import threads from "../src/routes/threads.js";

const app = new Hono().basePath("/api");

// Middleware
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/chat", chat);
app.route("/threads", threads);

export default handle(app);
