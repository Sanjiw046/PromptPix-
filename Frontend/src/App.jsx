// App.jsx
import React, { useState } from "react";
import axios from "axios";
import "./App.css";
import Loader from "./Loader"; // Loader component (Loader.jsx + Loader.css should exist)

// Backend API URL
const API_URL = "http://localhost:3001/api";

function App() {
  const [textPrompt, setTextPrompt] = useState("");
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [approvedPrompt, setApprovedPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [status, setStatus] = useState("Ready");

  const [uploadedImageFile, setUploadedImageFile] = useState(null);
  const [imageAnalysis, setImageAnalysis] = useState("");
  const [variationImage, setVariationImage] = useState("");

  const [loading, setLoading] = useState(false);

  // Helper: Convert file to base64
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = (error) => reject(error);
    });

  // Generic Axios handler
  const fetchAIResponse = async (endpoint, payload) => {
    try {
      const response = await axios.post(`${API_URL}/${endpoint}`, payload);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      throw new Error(errorMessage);
    }
  };

  // Enhance text prompt
  const handleEnhancePrompt = async () => {
    setStatus("Enhancing prompt via backend...");
    setEnhancedPrompt("");
    setLoading(true);
    try {
      const payload = { type: "enhance", textPrompt };
      const data = await fetchAIResponse("enhance-and-analyze", payload);
      const newEnhancedPrompt = data.result;
      setEnhancedPrompt(newEnhancedPrompt);
      setApprovedPrompt(newEnhancedPrompt);
      setStatus("Prompt Enhanced. Review and Approve/Generate.");
    } catch (err) {
      console.error(err);
      setStatus("Error during prompt enhancement: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate image from approved prompt
  const handleImageGeneration = async () => {
    if (!approvedPrompt) {
      alert("Please enhance and approve a prompt first.");
      return;
    }
    setStatus("Sending request to backend for image generation...");
    setGeneratedImage("");
    setLoading(true);

    try {
      const payload = { approvedPrompt };
      const data = await fetchAIResponse("generate-image", payload);

      const fullDataUri = `data:image/png;base64,${data.image}`;
      setGeneratedImage(fullDataUri);
      setStatus(`Image Generation Complete! Status: ${data.status}`);
    } catch (err) {
      console.error(err);
      setStatus("Error: T2I failed. " + err.message + ". Check console and ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // <<< FIXED: handleImageFileChange >>>
  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setUploadedImageFile(file);

    // Clear previous analysis / generated images when new file is chosen
    setImageAnalysis("");
    setVariationImage("");
    setGeneratedImage("");

    if (file) {
      setStatus("Image uploaded, ready for analysis.");
    } else {
      setStatus("No image selected.");
    }
  };

  // Analyze uploaded image
  const handleImageAnalysis = async () => {
    if (!uploadedImageFile) {
      alert("Please upload an image first.");
      return;
    }
    setStatus("Analyzing image via backend...");
    setImageAnalysis("");
    setLoading(true);

    try {
      const base64Image = await toBase64(uploadedImageFile);
      const payload = {
        type: "analyze",
        base64Image,
        mimeType: uploadedImageFile.type,
      };
      const data = await fetchAIResponse("enhance-and-analyze", payload);
      setImageAnalysis(data.result);
      setStatus("Analysis Complete. Ready to Generate Variation.");
    } catch (err) {
      console.error(err);
      setStatus("Error during image analysis: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate stylized variation from analysis
  const handleVariationGeneration = async () => {
  if (!imageAnalysis) {
    alert("Please analyze the image first.");
    return;
  }

  setStatus("Sending request to backend for variation generation...");
  setVariationImage("");
  setLoading(true);

  try {
    const payload = { imageAnalysis };
    const data = await fetchAIResponse("generate-variation", payload);
    const fullDataUri = `data:image/png;base64,${data.image}`;
    setVariationImage(fullDataUri);
    setStatus(`Variation Generation Complete! Status: ${data.status}`);
  } catch (err) {
    console.error(err);
    setStatus("Error: Variation T2I failed. " + err.message + ". Check backend logs.");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="page">
      {loading && <Loader />}

      <h2>AI Image generation</h2>
      <div className="status-bar">
        <strong>Status:</strong> {status}
      </div>

      {/* Workflow 1: Text -> Image */}
      <div className="workflow-section">
        <h3>1. Text Prompt → Image Generation</h3>
        <input
          type="text"
          value={textPrompt}
          onChange={(e) => setTextPrompt(e.target.value)}
          placeholder="Enter a simple prompt..."
        />
        <button onClick={handleEnhancePrompt}>Enhance Prompt</button>
        <div className="response-box">
          <strong>Enhanced Prompt:</strong> {enhancedPrompt || "Awaiting enhancement..."}
        </div>
        <button onClick={handleImageGeneration} disabled={!approvedPrompt}>
          Generate Image
        </button>
        {generatedImage && (
          <div className="image-result">
            <strong>Generated Image:</strong>
            <img src={generatedImage} alt="Generated from Text Prompt" />
          </div>
        )}
      </div>

      <hr />

      {/* Workflow 2: Image -> Variation */}
      <div className="workflow-section">
        <h3>2. Image → Analysis → Variation Generation</h3>
        <input type="file" accept="image/*" onChange={handleImageFileChange} />
        <button onClick={handleImageAnalysis} disabled={!uploadedImageFile}>
          Analyze Image
        </button>
        <div className="response-box">
          <strong>Analysis Prompt:</strong> {imageAnalysis || "Awaiting analysis..."}
        </div>
        <button onClick={handleVariationGeneration} disabled={!imageAnalysis}>
          Generate Variation
        </button>
        {variationImage && (
          <div className="image-result">
            <strong>Generated Variation:</strong>
            <img src={variationImage} alt="Generated Image Variation" />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
