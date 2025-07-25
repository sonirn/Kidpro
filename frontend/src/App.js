import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [currentStep, setCurrentStep] = useState('script');
  const [script, setScript] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voices, setVoices] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [generationId, setGenerationId] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [generationStatus, setGenerationStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const wsRef = useRef(null);

  // Load voices on component mount
  useEffect(() => {
    loadVoices();
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (generationId && isGenerating) {
      connectWebSocket();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [generationId, isGenerating]);

  const loadVoices = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/voices`);
      if (response.ok) {
        const voicesData = await response.json();
        setVoices(voicesData);
        if (voicesData.length > 0) {
          setSelectedVoice(voicesData[0].voice_id);
        }
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
      // Set default voice if loading fails
      setVoices([{ voice_id: 'default', name: 'Default Voice' }]);
      setSelectedVoice('default');
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${BACKEND_URL.replace('http', 'ws')}/api/ws/${generationId}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress || 0);
      setProgressMessage(data.message || '');
      setGenerationStatus(data.status || '');
      
      if (data.status === 'completed' && data.video_url) {
        setVideoUrl(data.video_url);
        setIsGenerating(false);
        setCurrentStep('result');
      } else if (data.status === 'failed') {
        setError(data.message || 'Generation failed');
        setIsGenerating(false);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket connection closed');
    };
  };

  const handleScriptSubmit = async () => {
    if (!script.trim()) {
      setError('Please enter a script');
      return;
    }

    try {
      setError('');
      
      // Create project
      const projectResponse = await fetch(`${BACKEND_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: script.trim(),
          aspect_ratio: aspectRatio,
          voice_id: selectedVoice,
          voice_name: voices.find(v => v.voice_id === selectedVoice)?.name || 'Default'
        }),
      });

      if (!projectResponse.ok) {
        throw new Error('Failed to create project');
      }

      const projectData = await projectResponse.json();
      setProjectId(projectData.project_id);
      setCurrentStep('settings');
    } catch (error) {
      console.error('Error creating project:', error);
      setError('Failed to create project. Please try again.');
    }
  };

  const handleGenerateVideo = async () => {
    if (!projectId) {
      setError('No project found. Please start over.');
      return;
    }

    try {
      setError('');
      setIsGenerating(true);
      setProgress(0);
      setProgressMessage('Starting generation...');
      setCurrentStep('generating');

      // Start generation
      const response = await fetch(`${BACKEND_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          script: script.trim(),
          aspect_ratio: aspectRatio,
          voice_id: selectedVoice
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      const data = await response.json();
      setGenerationId(data.generation_id);
      setGenerationStatus(data.status);
    } catch (error) {
      console.error('Error starting generation:', error);
      setError('Failed to start generation. Please try again.');
      setIsGenerating(false);
    }
  };

  const handleStartOver = () => {
    setCurrentStep('script');
    setScript('');
    setProjectId('');
    setGenerationId('');
    setProgress(0);
    setProgressMessage('');
    setGenerationStatus('');
    setVideoUrl('');
    setIsGenerating(false);
    setError('');
    
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const renderScriptStep = () => (
    <div className="step-container">
      <div className="step-header">
        <h2>✍️ Write Your Script</h2>
        <p>Enter the script you want to convert to video</p>
      </div>
      
      <div className="script-input-container">
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Enter your script here... 

For example:
Welcome to our product demo. Today we'll show you how our revolutionary app transforms the way you work. 

First, let's see the beautiful dashboard where all your projects come together in one place.

Next, we'll explore the powerful automation features that save you hours every day.

Finally, we'll demonstrate the real-time collaboration tools that keep your team connected."
          className="script-textarea"
          rows={12}
        />
        
        <div className="script-stats">
          <span>Characters: {script.length}</span>
          <span>Words: {script.trim().split(/\s+/).filter(word => word.length > 0).length}</span>
          <span>Est. Duration: {Math.ceil(script.trim().split(/\s+/).filter(word => word.length > 0).length / 150)} min</span>
        </div>
      </div>

      <div className="action-buttons">
        <button 
          onClick={handleScriptSubmit}
          disabled={!script.trim()}
          className="primary-button"
        >
          Continue to Settings →
        </button>
      </div>
    </div>
  );

  const renderSettingsStep = () => (
    <div className="step-container">
      <div className="step-header">
        <h2>⚙️ Video Settings</h2>
        <p>Configure your video preferences</p>
      </div>

      <div className="settings-grid">
        <div className="setting-group">
          <label>Aspect Ratio</label>
          <div className="aspect-ratio-selector">
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`aspect-button ${aspectRatio === '16:9' ? 'active' : ''}`}
            >
              <div className="aspect-preview landscape"></div>
              <span>16:9 Landscape</span>
            </button>
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`aspect-button ${aspectRatio === '9:16' ? 'active' : ''}`}
            >
              <div className="aspect-preview portrait"></div>
              <span>9:16 Portrait</span>
            </button>
          </div>
        </div>

        <div className="setting-group">
          <label>Voice Selection</label>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="voice-selector"
          >
            {voices.map(voice => (
              <option key={voice.voice_id} value={voice.voice_id}>
                {voice.name}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-group">
          <label>Script Preview</label>
          <div className="script-preview">
            {script.substring(0, 200)}...
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button 
          onClick={() => setCurrentStep('script')}
          className="secondary-button"
        >
          ← Back to Script
        </button>
        <button 
          onClick={handleGenerateVideo}
          className="primary-button"
        >
          Generate Video 🎬
        </button>
      </div>
    </div>
  );

  const renderGeneratingStep = () => (
    <div className="step-container">
      <div className="step-header">
        <h2>🎬 Generating Your Video</h2>
        <p>This may take a few minutes. You can safely leave this page - your video will continue processing in the background.</p>
      </div>

      <div className="progress-container">
        <div className="progress-circle">
          <div 
            className="progress-fill" 
            style={{ '--progress': `${progress}%` }}
          ></div>
          <div className="progress-text">
            {Math.round(progress)}%
          </div>
        </div>

        <div className="progress-details">
          <div className="progress-status">
            Status: <span className={`status-${generationStatus}`}>{generationStatus}</span>
          </div>
          <div className="progress-message">
            {progressMessage}
          </div>
        </div>

        <div className="progress-steps">
          <div className={`progress-step ${progress > 10 ? 'completed' : progress > 0 ? 'active' : ''}`}>
            <div className="step-icon">📝</div>
            <span>Analyzing Script</span>
          </div>
          <div className={`progress-step ${progress > 40 ? 'completed' : progress > 30 ? 'active' : ''}`}>
            <div className="step-icon">🎥</div>
            <span>Generating Video Clips</span>
          </div>
          <div className={`progress-step ${progress > 80 ? 'completed' : progress > 70 ? 'active' : ''}`}>
            <div className="step-icon">🎙️</div>
            <span>Creating Voice Over</span>
          </div>
          <div className={`progress-step ${progress > 95 ? 'completed' : progress > 85 ? 'active' : ''}`}>
            <div className="step-icon">🎬</div>
            <span>Final Assembly</span>
          </div>
        </div>
      </div>

      <div className="generation-info">
        <div className="info-card">
          <h3>What's happening?</h3>
          <ul>
            <li>AI is analyzing your script and breaking it into scenes</li>
            <li>Each scene is being converted into a video clip</li>
            <li>Voice over is being generated from your script</li>
            <li>Everything is being combined into your final video</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderResultStep = () => (
    <div className="step-container">
      <div className="step-header">
        <h2>🎉 Your Video is Ready!</h2>
        <p>Your script has been successfully converted to video</p>
      </div>

      <div className="video-result">
        {videoUrl && (
          <div className="video-player">
            <video
              controls
              className="result-video"
              src={videoUrl}
              poster="/api/placeholder/800/450"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        <div className="video-info">
          <div className="video-stats">
            <div className="stat">
              <span className="stat-label">Aspect Ratio:</span>
              <span className="stat-value">{aspectRatio}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Voice:</span>
              <span className="stat-value">{voices.find(v => v.voice_id === selectedVoice)?.name || 'Default'}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Status:</span>
              <span className="stat-value success">Completed</span>
            </div>
          </div>

          <div className="video-actions">
            <a
              href={videoUrl}
              download="generated-video.mp4"
              className="download-button"
            >
              📥 Download Video
            </a>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button 
          onClick={handleStartOver}
          className="primary-button"
        >
          Create Another Video
        </button>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'script':
        return renderScriptStep();
      case 'settings':
        return renderSettingsStep();
      case 'generating':
        return renderGeneratingStep();
      case 'result':
        return renderResultStep();
      default:
        return renderScriptStep();
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🎬 Script to Video</h1>
          <p>Transform your scripts into engaging videos with AI</p>
        </div>
      </header>

      <nav className="step-nav">
        <div className="nav-container">
          <div className={`nav-step ${currentStep === 'script' ? 'active' : currentStep !== 'script' ? 'completed' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Script</span>
          </div>
          <div className="nav-connector"></div>
          <div className={`nav-step ${currentStep === 'settings' ? 'active' : ['generating', 'result'].includes(currentStep) ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Settings</span>
          </div>
          <div className="nav-connector"></div>
          <div className={`nav-step ${currentStep === 'generating' ? 'active' : currentStep === 'result' ? 'completed' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Generate</span>
          </div>
          <div className="nav-connector"></div>
          <div className={`nav-step ${currentStep === 'result' ? 'active' : ''}`}>
            <span className="step-number">4</span>
            <span className="step-label">Result</span>
          </div>
        </div>
      </nav>

      <main className="app-main">
        {error && (
          <div className="error-message">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
              <button 
                onClick={() => setError('')}
                className="error-close"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {renderCurrentStep()}
      </main>

      <footer className="app-footer">
        <p>Powered by AI • Wan 2.1 • Stable Audio • ElevenLabs • Gemini</p>
      </footer>
    </div>
  );
}

export default App;