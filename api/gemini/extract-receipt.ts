import { GoogleGenAI, Type } from "@google/genai";

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

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
    } else if (type === "safety") {
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          employeeName: { type: Type.STRING, description: "Full name of the employee on the certification or safety card" },
          emiratesIdNumber: { type: Type.STRING, description: "Emirates ID card number in standard UAE format (784-XXXX-XXXXXXX-X) or digits, else empty string" },
          employeeCompanyName: { type: Type.STRING, description: "Company or Employer Name on the certificate if present" },
          certificateName: { type: Type.STRING, description: "Name/Title of the safety training course or certificate (e.g., Working at Heights, Hydrogen Sulfide Safety, HSE Induction, Confined Space Entry)" },
          safetyCertificateNumber: { type: Type.STRING, description: "Certificate, badge, card or registration serial number" },
          certificateIssueDate: { type: Type.STRING, description: "Date of issue in YYYY-MM-DD format (if only month/year is given, use the first date of that month)" },
          certificateExpireDate: { type: Type.STRING, description: "Date of expiry in YYYY-MM-DD format" },
          safetyProviderName: { type: Type.STRING, description: "Academy, company, center or authority body conducting the safety training" },
          safetyProviderContact: { type: Type.STRING, description: "Contact phone, mobile or email of the training provider if present" }
        },
        required: ["employeeName", "certificateName"]
      };
      prompt = "Analyze this safety training certificate or safety permit card image and extract the credential details into a JSON object.";
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
    return res.status(200).json(parsedData);
  } catch (error: any) {
    console.error("Error extracting receipt with Gemini:", error);
    let errMsg = error.message || "Failed to extract receipt";

    try {
      const parsed = JSON.parse(errMsg);
      if (parsed?.error?.message) {
        errMsg = parsed.error.message;
      }
    } catch {
      // Keep original message if it's not a JSON string
    }

    if (errMsg.includes("prepayment credits are depleted") || errMsg.includes("RESOURCE_EXHAUSTED")) {
      errMsg = "Your Google AI Studio prepayment credits are depleted. Please update your billing setup or add prepayment credits in AI Studio (https://ai.studio).";
    }

    return res.status(500).json({ error: errMsg });
  }
}
