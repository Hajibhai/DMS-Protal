import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  // CORS Headers
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
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, mimeType, type } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is required but missing on Vercel deployment" });
    }

    const ai = new GoogleGenAI({
      apiKey: key,
    });

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

    let responseSchema: any;
    let prompt;

    if (type === "everyday") {
      responseSchema = {
        type: "OBJECT",
        properties: {
          siNo: { type: "STRING", description: "Sequential number/serial number of the invoice if printed, or empty string" },
          date: { type: "STRING", description: "Transaction date in YYYY-MM-DD format" },
          invoiceNo: { type: "STRING", description: "Invoice or reference number on the receipt" },
          trnNo: { type: "STRING", description: "Tax Registration Number (TRN) in UAE format (often 15 digits) or empty if not present" },
          clientName: { type: "STRING", description: "Company or Client Name to whom invoice is billed (e.g. Pioneer General Contracting LLC - SPC)" },
          supplierName: { type: "STRING", description: "Supplier or vendor name selling the items" },
          shopName: { type: "STRING", description: "Shop name or Trading name if different from supplier" },
          billAmount: { type: "NUMBER", description: "Subtotal or net value before tax/VAT" },
          vatAmount: { type: "NUMBER", description: "VAT amount (usually 5% in UAE)" },
          totalAmount: { type: "NUMBER", description: "Total amount including VAT" },
          description: { type: "STRING", description: "Brief description of the goods or services purchased" },
        },
        required: ["date", "billAmount", "totalAmount"]
      };
      prompt = "Analyze this receipt image and extract the following everyday operational invoice details into a JSON object.";
    } else {
      responseSchema = {
        type: "OBJECT",
        properties: {
          date: { type: "STRING", description: "Transaction date in YYYY-MM-DD format" },
          category: { type: "STRING", description: "Book category or ledger category. Must be one of: 'Fuel & Conveyance', 'Office Stationery', 'Site Materials', 'Pantry & Refreshments', 'Repairs & Maintenance' or another relevant category" },
          description: { type: "STRING", description: "Short description of what the expense was for" },
          amount: { type: "NUMBER", description: "Transaction amount" },
          type: { type: "STRING", description: "Must be 'Expense' or 'Income'" },
          contact: { type: "STRING", description: "Recipient, payee or recipient person's name on the receipt" },
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
    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Vercel Gemini extraction error:", error);
    res.status(500).json({ error: error.message || "Failed to extract receipt" });
  }
}
