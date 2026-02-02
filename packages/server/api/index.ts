import { Hono } from "hono";
import { handle } from "hono/vercel";
import { cors } from "hono/cors";
import chat from "../dist/routes/chat.js";
import threads from "../dist/routes/threads.js";
import digest from "../dist/routes/digest.js";
import channels from "../dist/routes/channels.js";

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
app.route("/digest", digest);
app.route("/channels", channels);

export default handle(app);
