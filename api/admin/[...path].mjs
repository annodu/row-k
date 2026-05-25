import express from "express";
import { registerAdminStylistRoutes } from "../../server/admin-stylists.mjs";
import { setNoStoreHeaders } from "../../server/salon-index.mjs";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use((_, res, next) => {
  setNoStoreHeaders(res);
  next();
});

registerAdminStylistRoutes(app);

export default function handler(req, res) {
  if (!req.url.startsWith("/api/admin")) {
    req.url = `/api/admin${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }

  return app(req, res);
}
