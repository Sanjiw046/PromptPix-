const express = require('express');
const cors = require('cors');
// fs is not needed for serverless deployment if not writing files
// const fs = require('fs'); 
const serverless = require('serverless-http'); 

const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold
} = require('@google/generative-ai');


// --- MODEL CONSTANTS ---
const MULTIMODAL_MODEL = "gemini-2.5-flash";
const T2I_MODEL = "gemini-2.5-flash-image-preview"; // Image generation

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- LAZY INITIALIZATION & SINGLETON PATTERN ---
// Initialize outside of the handler but inside a function to check API key safety.
let geminiModelInstance = null;
let t2iModelInstance = null;
let genAIInstance = null;

function getGenAI() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not set or accessible.");
    }
    if (!genAIInstance) {
        // Initialize once per execution context (cold start)
        genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAIInstance;
}

function getGeminiModel() {
    if (!geminiModelInstance) {
        const genAI = getGenAI();
        geminiModelInstance = genAI.getGenerativeModel({
            model: MULTIMODAL_MODEL,
            safetySettings: safetySettings
        });
    }
    return geminiModelInstance;
}

function getT2IModel() {
    if (!t2iModelInstance) {
        const genAI = getGenAI();
        t2iModelInstance = genAI.getGenerativeModel({ model: T2I_MODEL });
    }
    return t2iModelInstance;
}
// --------------------------------------------------

const app = express();

// Middleware
app.use(
    cors({
        // Use environment variable for Vercel or fallback to specific origin
        origin: process.env.FRONT_END_PORT || "http://localhost:5173", 
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);
app.options("*", cors()); // Handle preflight requests
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

// Endpoint for Text Enhancement (NLP) and Image Analysis (Vision)
app.post('/api/enhance-and-analyze', async (req, res) => {
    const { type, textPrompt, base64Image, mimeType } = req.body;
    
    try {
        const geminiModel = getGeminiModel();
        let instruction;
        let response;

        if (type === 'enhance' && textPrompt) {
            instruction = `You are a world-class creative director specializing in high-fidelity generative art prompts. Take the user's brief text and expand it into a detailed, descriptive prompt suitable for a modern image generation AI, including style, lighting, composition, and mood. Keep it under 100 words. The output must be ONLY the descriptive scene.`;
            
            // Generate content using a simple prompt array
            response = await geminiModel.generateContent([
                instruction, 
                `User brief: "${textPrompt}"`
            ]);

        } else if (type === 'analyze' && base64Image && mimeType) {
            
            instruction = "Analyze this image. Describe its primary subject, style, color palette, and mood. Generate a high-quality, creative prompt of 50-70 words suitable for an image generation model to create similar variations. Output ONLY the generated prompt text.";
            
            const imagePart = fileToGenerativePart(base64Image, mimeType);

            response = await geminiModel.generateContent([
                { text: instruction },
                imagePart
            ]);
            
        } else {
            return res.status(400).json({ error: "Invalid request type or missing parameters." });
        }

        // CORRECT SDK RESPONSE PARSING: Accessing the text directly
        const textResult = response.text.trim();
        return res.json({ result: textResult });

    } catch (error) {
        console.error("Gemini API Error:", error.message);
        // Return 500 status with specific error message
        return res.status(500).json({ error: error.message || "AI service failed to process the request." });
    }
});

// Endpoint for Text-to-Image Generation (Workflow 1, Step 3)
app.post('/api/generate-image', async (req, res) => {
    const { approvedPrompt } = req.body;

    if (!approvedPrompt) {
        return res.status(400).json({ error: "Approved prompt is required." });
    }

    try {
        const t2iModel = getT2IModel();

        // Generate image
        const response = await t2iModel.generateContent({
            contents: [{ parts: [{ text: approvedPrompt }] }],
            config: {
                responseModalities: ["IMAGE"],
            }
        });

        // CORRECT SDK RESPONSE PARSING: Find the image part in candidates
        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType.startsWith('image/'));
        
        if (!imagePart || !imagePart.inlineData?.data) {
             throw new Error("No image data returned from Gemini.");
        }
        
        const imageBase64 = imagePart.inlineData.data;

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


// Variation generation endpoint (Workflow 2, Step 3)
app.post('/api/generate-variation', async (req, res) => {
    const { imageAnalysis } = req.body;

    if (!imageAnalysis) {
        return res.status(400).json({ error: "Image analysis description is required." });
    }

    try {
        const t2iModel = getT2IModel();
        
        // Construct a stylized prompt based on the analysis
        const variationPrompt = `Create a stylized, artistic variation of the following image description, rendered as a cinematic digital painting with neon lighting and deep shadow: ${imageAnalysis}`;

        const response = await t2iModel.generateContent({
            contents: [{ parts: [{ text: variationPrompt }] }],
            config: {
                responseModalities: ["IMAGE"],
            }
        });

        // CORRECT SDK RESPONSE PARSING: Find the image part in candidates
        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType.startsWith('image/'));

        if (!imagePart || !imagePart.inlineData?.data) {
            throw new Error("No image data returned from Gemini.");
        }

        const imageBase64 = imagePart.inlineData.data;

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


// Export the Express app as a serverless function handler
module.exports.handler = serverless(app);
