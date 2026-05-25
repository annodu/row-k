import express from "express";
import { registerAdminStylistRoutes } from "../server/admin-stylists.mjs";
import { setNoStoreHeaders } from "../server/salon-index.mjs";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use((_, res, next) => {
  setNoStoreHeaders(res);
  next();
});

registerAdminStylistRoutes(app);

export default function handler(req, res) {
  const { path, ...query } = req.query || {};
  const adminPath = Array.isArray(path) ? path.join("/") : String(path || "");
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  req.url = `/api/admin${adminPath ? `/${adminPath}` : ""}${queryString ? `?${queryString}` : ""}`;

  return app(req, res);
}
