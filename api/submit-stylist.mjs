import express from "express";
import { registerPublicStylistSubmissionRoutes } from "../server/admin-stylists.mjs";
import { setNoStoreHeaders } from "../server/salon-index.mjs";
import { requestLogger, sanitizeErrorMessage } from "../server/security.mjs";

const app = express();

app.use(express.json({ limit: "256kb" }));
app.use((_, res, next) => {
  setNoStoreHeaders(res);
  next();
});
app.use(requestLogger);

registerPublicStylistSubmissionRoutes(app);

app.use((error, _req, res, _next) => {
  console.error("Stylist submission API failed", error);
  res.status(500).json({ ok: false, message: sanitizeErrorMessage(error, "Submission failed.") });
});

export default function handler(req, res) {
  return app(req, res);
}
