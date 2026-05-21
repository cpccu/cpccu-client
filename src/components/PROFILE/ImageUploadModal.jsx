"use client";

import { useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloudUploadAlt, faTimes, faImage } from "@fortawesome/free-solid-svg-icons";

export default function ImageUploadModal({ isOpen, onClose, onUpload, isUploading }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  if (!isOpen) return null;

  const handleFile = (file) => {
    setError(null);
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, etc.)");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size too large. Profile picture must be less than 5MB.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-800">Update Profile Picture</h3>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8">
          {!previewUrl ? (
            <div 
              className={`relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all ${
                dragActive ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current.click()}
            >
              <input 
                ref={inputRef}
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handleChange}
              />
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <FontAwesomeIcon icon={faCloudUploadAlt} size="2x" />
              </div>
              <p className="text-gray-700 font-bold text-center">Click or drag photo here</p>
              <p className="text-gray-400 text-xs mt-2 text-center">
                Supported: JPG, PNG, WEBP (Max: 5MB)
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-blue-50 shadow-lg mb-6">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <button 
                onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                className="text-blue-600 text-sm font-bold hover:underline mb-2"
              >
                Choose a different photo
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-gray-50 flex gap-3">
          <button 
            onClick={handleClose}
            className="flex-1 py-3 bg-white text-gray-700 font-bold rounded-2xl border border-gray-200 hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!selectedFile || isUploading}
            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
          >
            {isUploading ? "Uploading..." : "Upload Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
