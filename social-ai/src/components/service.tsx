import React, { useState } from 'react';

const SocialDashboard = () => {
  const [topic, setTopic] = useState('');
  const [platforms, setPlatforms] = useState({ twitter: false, linkedin: false, instagram: false });
  const [length, setLength] = useState('Short');
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    // This would call your Node.js backend on Render
    try {
      const response = await fetch('https://your-backend-url.render.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, length })
      });
      const data = await response.json();
      setPreview(data.content);
    } catch (error) {
      console.error("Generation failed", error);
    }
    setLoading(false);
  };

  const handlePost = async () => {
    // This calls the posting logic via Ayrshare/Buffer
    alert(`Posting to selected platforms: ${preview}`);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto bg-white shadow-lg rounded-xl">
      <h1 className="text-2xl font-bold mb-6">Elijah's Content AI</h1>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">What is the topic?</label>
        <input 
          type="text" 
          className="w-full p-2 border rounded" 
          placeholder="e.g. The future of Bitcoin in 2026"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      <div className="mb-4 flex gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" onChange={() => setPlatforms({...platforms, twitter: !platforms.twitter})} /> X (Twitter)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" onChange={() => setPlatforms({...platforms, instagram: !platforms.instagram})} /> Instagram
        </label>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Length</label>
        <select className="w-full p-2 border rounded" onChange={(e) => setLength(e.target.value)}>
          <option>Short (Tweet)</option>
          <option>Medium (Post)</option>
          <option>Long (Article)</option>
        </select>
      </div>

      <button 
        onClick={handleGenerate}
        className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition"
      >
        {loading ? 'Generating...' : 'Generate Content'}
      </button>

      {preview && (
        <div className="mt-8 p-4 bg-gray-50 border rounded-lg">
          <h3 className="font-bold mb-2">Preview:</h3>
          <p className="text-gray-700">{preview}</p>
          <button 
            onClick={handlePost}
            className="mt-4 w-full bg-green-600 text-white p-2 rounded font-bold"
          >
            Post Now
          </button>
        </div>
      )}
    </div>
  );
};

export default SocialDashboard;