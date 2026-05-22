import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

// Set up custom CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Set up JSON body parser with increased limit to handle base64 images
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing");
    }
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

// Gemini Receipt Extraction Endpoint
app.post("/api/gemini/extract-receipt", async (req, res) => {
  try {
    const { image, mimeType, type } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const ai = getGeminiClient();

    // Clean up base64 image
    let base64Data = image;
    let actualMimeType = mimeType || "image/jpeg";
    if (image.includes(";base64,")) {
      const parts = image.split(";base64,");
      const match = parts[0].match(/data:(.*)/);
      if (match) {
        actualMimeType = match[1];
      }
      base64Data = parts[1];
    }

    const imagePart = {
      inlineData: {
        mimeType: actualMimeType,
        data: base64Data,
      },
    };

    let responseSchema;
    let prompt;

    if (type === "everyday") {
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          siNo: { type: Type.STRING, description: "Sequential number/serial number of the invoice if printed, or empty string" },
          date: { type: Type.STRING, description: "Transaction date in YYYY-MM-DD format" },
          invoiceNo: { type: Type.STRING, description: "Invoice or reference number on the receipt" },
          trnNo: { type: Type.STRING, description: "Tax Registration Number (TRN) in UAE format (often 15 digits) or empty if not present" },
          clientName: { type: Type.STRING, description: "Company or Client Name to whom invoice is billed (e.g. Pioneer General Contracting LLC - SPC)" },
          supplierName: { type: Type.STRING, description: "Supplier or vendor name selling the items" },
          shopName: { type: Type.STRING, description: "Shop name or Trading name if different from supplier" },
          billAmount: { type: Type.NUMBER, description: "Subtotal or net value before tax/VAT" },
          vatAmount: { type: Type.NUMBER, description: "VAT amount (usually 5% in UAE)" },
          totalAmount: { type: Type.NUMBER, description: "Total amount including VAT" },
          description: { type: Type.STRING, description: "Brief description of the goods or services purchased" },
        },
        required: ["date", "billAmount", "totalAmount"]
      };
      prompt = "Analyze this receipt image and extract the following everyday operational invoice details into a JSON object.";
    } else {
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "Transaction date in YYYY-MM-DD format" },
          category: { type: Type.STRING, description: "Book category or ledger category. Must be one of: 'Fuel & Conveyance', 'Office Stationery', 'Site Materials', 'Pantry & Refreshments', 'Repairs & Maintenance' or another relevant category" },
          description: { type: Type.STRING, description: "Short description of what the expense was for" },
          amount: { type: Type.NUMBER, description: "Transaction amount" },
          type: { type: Type.STRING, description: "Must be 'Expense' or 'Income'" },
          contact: { type: Type.STRING, description: "Recipient, payee or recipient person's name on the receipt" },
        },
        required: ["date", "amount", "category"]
      };
      prompt = "Analyze this receipt image and extract the petty cash transaction details into a JSON object.";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [imagePart, { text: prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text || "{}";
    const parsedData = JSON.parse(text);
    res.json(parsedData);
  } catch (error: any) {
    console.error("Error extracting receipt with Gemini:", error);
    res.status(500).json({ error: error.message || "Failed to extract receipt" });
  }
});

const getOAuth2Client = (req?: express.Request) => {
  const redirectUri = process.env.APP_URL 
    ? `${process.env.APP_URL}/auth/callback`
    : req ? `${req.protocol}://${req.get('host')}/auth/callback` : '';

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

// Auth URL endpoint
app.get("/api/auth/google/url", (req, res) => {
  const client = getOAuth2Client(req);
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.json({ url: authUrl });
});

// Callback endpoint
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  const client = getOAuth2Client(req);
  try {
    const { tokens } = await client.getToken(code as string);
    // In a real app, you'd store this in a database linked to the user
    // For this demo, we'll use a cookie (not ideal for production but works for the preview)
    res.cookie('google_tokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: true,
      sameSite: 'none'
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    res.status(500).send("Authentication failed");
  }
});

// Drive API endpoints
app.get("/api/drive/files", async (req, res) => {
  const tokens = req.cookies.google_tokens;
  if (!tokens) return res.status(401).json({ error: "Not authenticated" });

  try {
    const client = getOAuth2Client(req);
    client.setCredentials(JSON.parse(tokens));
    const drive = google.drive({ version: 'v3', auth: client });
    const response = await drive.files.list({
      pageSize: 20,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, iconLink)',
      q: "trashed = false"
    });
    res.json(response.data.files);
  } catch (error) {
    console.error("Error fetching drive files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

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
