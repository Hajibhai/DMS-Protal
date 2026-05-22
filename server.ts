import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cookieParser from "cookie-parser";

// Import Vercel-compatible serverless API handlers
import extractReceiptHandler from "./api/gemini/extract-receipt";
import authUrlHandler from "./api/auth/google/url";
import authCallbackHandler from "./api/auth/callback";
import driveFilesHandler from "./api/drive/files";

const app = express();
const PORT = 3000;

// Set up JSON body parser with increased limit to handle base64 images
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());

// Wire up API endpoints
app.post("/api/gemini/extract-receipt", extractReceiptHandler);
app.get("/api/auth/google/url", authUrlHandler);
app.get("/auth/callback", authCallbackHandler);
app.get("/api/drive/files", driveFilesHandler);

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
