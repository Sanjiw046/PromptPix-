import React, { useState } from "react";
import axios from "axios";
import "./App.css";
import Loader from "./Loader";

const API_URL = import.meta.env.VITE_BACK_END_PORT;

function App() {
  const [textPrompt, setTextPrompt] = useState("");
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [approvedPrompt, setApprovedPrompt] = useState("");
  const [isPromptApproved, setIsPromptApproved] = useState(false);
  const [generatedImage, setGeneratedImage] = useState("");
  const [status, setStatus] = useState("Ready");

  const [uploadedImageFile, setUploadedImageFile] = useState(null);
  const [imageAnalysis, setImageAnalysis] = useState("");
  const [variationImage, setVariationImage] = useState("");
  const [loading, setLoading] = useState(false);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = (error) => reject(error);
    });

  const fetchAIResponse = async (endpoint, payload) => {
    try {
      const response = await axios.post(`${API_URL}/${endpoint}`, payload,
        { headers:{
          "Content-Type": "application/json",
        }}
      );
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      throw new Error(errorMessage);
    }
  };

  const handleEnhancePrompt = async () => {
    setStatus("Enhancing prompt...");
    setEnhancedPrompt("");
    setApprovedPrompt("");
    setIsPromptApproved(false);
    setLoading(true);
    try {
      const data = await fetchAIResponse("enhance-and-analyze", {
        type: "enhance",
        textPrompt,
      });
      setEnhancedPrompt(data.result);
      setApprovedPrompt(data.result);
      setStatus("Prompt enhanced. Review & approve.");
    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageGeneration = async () => {
    if (!approvedPrompt || !isPromptApproved) {
      alert("Please approve the prompt before generating image.");
      return;
    }
    setStatus("Generating image...");
    setGeneratedImage("");
    setLoading(true);
    try {
      const data = await fetchAIResponse("generate-image", { approvedPrompt });
      const fullDataUri = `data:image/png;base64,${data.image}`;
      setGeneratedImage(fullDataUri);
      setStatus("Image generation complete!");
    } catch (err) {
      console.error(err);
      setStatus("Error generating image: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setUploadedImageFile(file);
    setImageAnalysis("");
    setVariationImage("");
    setGeneratedImage("");
    setStatus(file ? "Image uploaded" : "No image selected");
  };

  const handleImageAnalysis = async () => {
    if (!uploadedImageFile) return alert("Upload an image first");
    setStatus("Analyzing image...");
    setImageAnalysis("");
    setLoading(true);
    try {
      const base64Image = await toBase64(uploadedImageFile);
      const data = await fetchAIResponse("enhance-and-analyze", {
        type: "analyze",
        base64Image,
        mimeType: uploadedImageFile.type,
      });
      setImageAnalysis(data.result);
      setStatus("Analysis complete. Ready for variation.");
    } catch (err) {
      console.error(err);
      setStatus("Error analyzing image: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVariationGeneration = async () => {
    if (!imageAnalysis) return alert("Analyze image first");
    setStatus("Generating variation...");
    setVariationImage("");
    setLoading(true);
    try {
      const data = await fetchAIResponse("generate-variation", { imageAnalysis });
      const fullDataUri = `data:image/png;base64,${data.image}`;
      setVariationImage(fullDataUri);
      setStatus("Variation generation complete!");
    } catch (err) {
      console.error(err);
      setStatus("Error generating variation: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      {loading && <Loader />}
      <h2>AI Image Generation</h2>
      <div className="status-bar"><strong>Status:</strong> {status}</div>

      {/* Text → Enhance → Approval → Image */}
      <div className="workflow-section">
        <h3>1. Text → Enhance → Approve → Image</h3>
        <input
          type="text"
          value={textPrompt}
          onChange={(e) => setTextPrompt(e.target.value)}
          placeholder="Enter a prompt..."
        />
        <button onClick={handleEnhancePrompt}>Enhance Prompt</button>

        {enhancedPrompt && (
          <div className="response-box">
            <strong>Enhanced Prompt:</strong>
            <textarea
              className={isPromptApproved ? "approved-prompt" : ""}
              value={approvedPrompt}
              onChange={(e) => {
                setApprovedPrompt(e.target.value);
                setIsPromptApproved(false);
              }}
              rows={3}
            />
            <button
              className="approve-btn"
              onClick={() => {
                setIsPromptApproved(true);
                setStatus("Prompt approved. Ready to generate image.");
              }}
            >
              Approve Prompt
            </button>
          </div>
        )}

        <button
          onClick={handleImageGeneration}
          disabled={!approvedPrompt || !isPromptApproved}
          className={isPromptApproved ? "generate-btn-approved" : "generate-btn"}
        >
          Generate Image
        </button>

        {generatedImage && (
          <div className="image-result">
            <strong>Generated Image:</strong>
            <img src={generatedImage} alt="Generated" />
          </div>
        )}
      </div>

      <hr />

      {/* Image → Analyze → Variation */}
      <div className="workflow-section">
        <h3>2. Image → Analysis → Variation</h3>
        <input type="file" accept="image/*" onChange={handleImageFileChange} />
        <button onClick={handleImageAnalysis} disabled={!uploadedImageFile}>
          Analyze Image
        </button>
        <div className="response-box">
          <strong>Analysis:</strong> {imageAnalysis || "Awaiting analysis..."}
        </div>
        <button onClick={handleVariationGeneration} disabled={!imageAnalysis}>
          Generate Variation
        </button>
        {variationImage && (
          <div className="image-result">
            <strong>Variation:</strong>
            <img src={variationImage} alt="Variation" />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
