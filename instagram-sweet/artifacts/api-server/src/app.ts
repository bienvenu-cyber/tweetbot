import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { createProxyMiddleware } from "http-proxy-middleware";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BOT_API_URL = process.env.BOT_API_URL || "http://localhost:8000";

app.use(
  "/api/bot-api",
  createProxyMiddleware({
    target: BOT_API_URL,
    changeOrigin: true,
    pathRewrite: (path) => path.replace("/api/bot-api", "/bot-api"),
  })
);

app.use("/api", router);

export default app;
