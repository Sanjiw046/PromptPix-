
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');

const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold
} = require('@google/generative-ai');



// Load environment variables
dotenv.config();

const app = express();
const PORT = 3001;

// --- MODEL CONSTANTS ---
const MULTIMODAL_MODEL = "gemini-2.5-flash";
const T2I_MODEL = "gemini-2.5-flash-image-preview"; // Image generation


const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

// Initialize Gemini client 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
    model: MULTIMODAL_MODEL,
    safetySettings: safetySettings
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONT_END_PORT || "*", 
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Allow preflight requests for all routes
app.options("*", cors());


app.use(express.json({ limit: '50mb' }));

// Helper for multimodal image part
function fileToGenerativePart(base64Data, mimeType) {
    return {
        inlineData: {
            data: base64Data,
            mimeType,
        },
    };
}

app.post('/api/enhance-and-analyze', async (req, res) => {
    const { type, textPrompt, base64Image, mimeType } = req.body;
    let instruction;
    let response;

    try {
        if (type === 'enhance' && textPrompt) {
            instruction = `Imagine an image of a promotional poster for a professional "${textPrompt}". 
            Describe the visual scene in vivid, cinematic detail, suitable for an image generator. 
            The description MUST NOT include any text overlays, contact information, dates, or prices. 
            The output must be ONLY the descriptive scene.`;

            response = await geminiModel.generateContent(instruction);

        } 
        else if (type === 'analyze' && base64Image && mimeType) {
            
            instruction = "Describe this image in a single, vivid, and detailed sentence suitable for a 'style variation' image generator prompt. Output only the sentence.";

            const imagePart = {
                inlineData: {
                    data: base64Image,
                    mimeType,
                }
            };

            response = await geminiModel.generateContent([
                { text: instruction },
                imagePart
            ]);
        }
         else {
            return res.status(400).json({ error: "Invalid request type or missing parameters." });
        }

        try {
            const textResult = response.response.text().trim();
            return res.json({ result: textResult });
        } catch (e) {
            throw new Error("Model did not return text. Content may have been blocked or the generation failed.");
        }

    } catch (error) {
        console.error("Gemini API Error:", error.message);
        return res.status(500).json({ error: error.message || "AI service failed to process the request." });
    }
});

app.post('/api/generate-image', async (req, res) => {
  const { approvedPrompt } = req.body;

  if (!approvedPrompt) {
    return res.status(400).json({ error: "Approved prompt is required." });
  }

  try {
    // Get T2I model instance
    const model = await genAI.getGenerativeModel({ model: T2I_MODEL });

    // Generate image
    const response = await model.generateContent(approvedPrompt);

    let imageBase64 = null;
    for (const part of response.response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageBase64 = part.inlineData.data;

        // Optional: save locally
        // const buffer = Buffer.from(imageBase64, "base64");
        // fs.writeFileSync("gemini-generated-test.png", buffer);
      }
    }

    if (!imageBase64) throw new Error("No image returned from Gemini.");

    res.json({
      status: "Image generated successfully",
      finalPrompt: approvedPrompt,
      image: imageBase64,
    });

  } catch (error) {
    console.error("Gemini Image Gen Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});


// Variation generation endpoint
app.post('/api/generate-variation', async (req, res) => {
    const { imageAnalysis } = req.body;

    if (!imageAnalysis) {
        return res.status(400).json({ error: "Image analysis description is required." });
    }

    try {
        // Create a variation prompt
        const variationPrompt = `Create a stylized, artistic variation of the following image description, for a futuristic cyberpunk art piece: ${imageAnalysis}`;

        // const ai = new GoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
        const model = await genAI.getGenerativeModel({ model: T2I_MODEL });

        const response = await model.generateContent(variationPrompt);

        let imageBase64 = null;
        for (const part of response.response.candidates[0].content.parts) {
            if (part.inlineData) {
                imageBase64 = part.inlineData.data;
            }
        }

        if (!imageBase64) {
            throw new Error("No image data returned from Gemini.");
        }

        res.json({
            status: "Variation generated successfully",
            finalPrompt: variationPrompt,
            image: imageBase64
        });

    } catch (error) {
        console.error("Gemini Variation Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});


// app.listen(PORT, () => {
//     console.log(`Server running on http://localhost:${PORT}`);
// });

// ✅ Vercel doesn’t need listen(), just export
module.exports = app;