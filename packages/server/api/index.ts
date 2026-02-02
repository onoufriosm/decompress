import { Hono } from "hono";
import { handle } from "hono/vercel";
import { cors } from "hono/cors";
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

// Routes - chat and threads disabled due to AI SDK initialization timeout
// TODO: Re-enable with lazy loading or separate functions
// app.route("/chat", chat);
// app.route("/threads", threads);
app.route("/digest", digest);
app.route("/channels", channels);

export default handle(app);
