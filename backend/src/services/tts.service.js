const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const logger = require('../utils/logger');
const audioProcessor = require('../utils/audioProcessor');

/**
 * Text-to-Speech service with multiple provider options
 */
class TTSService {
  constructor() {
    this.cacheDir = path.join(__dirname, '../../tmp/tts_cache');
    this.ensureCacheDirectory();
    
    // API keys
    this.playHTApiKey = process.env.PLAYHT_API_KEY || '';
    this.playHTUserId = process.env.PLAYHT_USER_ID || '';
    
    // Cache settings
    this.maxCacheSize = 500 * 1024 * 1024; // 500MB
    this.cleanCacheIfNeeded();
  }

  /**
   * Ensure the cache directory exists
   * @private
   */
  ensureCacheDirectory() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      logger.info(`Created TTS cache directory: ${this.cacheDir}`);
    }
  }

  /**
   * Clean the cache if it exceeds the maximum size
   * @private
   */
  async cleanCacheIfNeeded() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      
      // Get file stats
      const fileStats = files.map(file => {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        return {
          path: filePath,
          size: stats.size,
          atime: stats.atime.getTime()
        };
      });
      
      // Calculate total size
      const totalSize = fileStats.reduce((sum, file) => sum + file.size, 0);
      
      // If cache is too large, delete oldest files
      if (totalSize > this.maxCacheSize) {
        logger.info(`Cache size (${totalSize / 1024 / 1024}MB) exceeds limit, cleaning...`);
        
        // Sort by access time (oldest first)
        fileStats.sort((a, b) => a.atime - b.atime);
        
        let sizeToFree = totalSize - (this.maxCacheSize * 0.7); // Free up to 70% of max
        
        for (const file of fileStats) {
          if (sizeToFree <= 0) break;
          
          fs.unlinkSync(file.path);
          sizeToFree -= file.size;
          logger.debug(`Removed cached file: ${file.path}`);
        }
        
        logger.info('Cache cleaning completed');
      }
    } catch (error) {
      logger.error(`Error cleaning cache: ${error.message}`);
    }
  }

  /**
   * Generate a cache key for a TTS request
   * @param {string} text - Text to convert to speech
   * @param {string} voiceId - Voice ID to use
   * @param {string} provider - Provider name
   * @returns {string} - Cache key
   * @private
   */
  generateCacheKey(text, voiceId, provider) {
    const hash = crypto
      .createHash('md5')
      .update(`${text}_${voiceId}_${provider}`)
      .digest('hex');
    
    return hash;
  }

  /**
   * Check if audio is cached and return the path if it exists
   * @param {string} cacheKey - Cache key
   * @returns {string|null} - Path to cached audio or null if not cached
   * @private
   */
  checkCache(cacheKey) {
    const cachedPath = path.join(this.cacheDir, `${cacheKey}.wav`);
    
    if (fs.existsSync(cachedPath)) {
      // Update access time
      fs.utimesSync(cachedPath, new Date(), new Date());
      return cachedPath;
    }
    
    return null;
  }

  /**
   * Save audio to cache
   * @param {string} audioPath - Path to audio file
   * @param {string} cacheKey - Cache key
   * @returns {string} - Path to cached audio
   * @private
   */
  saveToCache(audioPath, cacheKey) {
    const cachedPath = path.join(this.cacheDir, `${cacheKey}.wav`);
    
    // Copy file to cache
    fs.copyFileSync(audioPath, cachedPath);
    
    return cachedPath;
  }

  /**
   * Generate speech using Coqui TTS (self-hosted)
   * @param {string} text - Text to convert to speech
   * @param {string} voiceId - Voice ID to use
   * @returns {Promise<string>} - Path to generated audio file
   */
  async generateSpeech(text, voiceId) {
    if (!text) {
      throw new Error('Text is required for speech generation');
    }
    
    const provider = 'coqui';
    const cacheKey = this.generateCacheKey(text, voiceId, provider);
    
    // Check cache first
    const cachedPath = this.checkCache(cacheKey);
    if (cachedPath) {
      logger.debug(`Using cached audio for: ${text.substring(0, 30)}...`);
      return cachedPath;
    }
    
    logger.info(`Generating speech with Coqui TTS: ${text.substring(0, 30)}...`);
    
    // Create a temporary file for the text
    const textFilePath = path.join(this.cacheDir, `${cacheKey}.txt`);
    fs.writeFileSync(textFilePath, text);
    
    // Output path for the generated audio
    const outputPath = path.join(this.cacheDir, `${cacheKey}_temp.wav`);
    
    try {
      // Run Coqui TTS using Python subprocess
      await new Promise((resolve, reject) => {
        // Command to run Coqui TTS
        // Note: This assumes Coqui TTS is installed and configured
        const pythonProcess = spawn('python', [
          '-m', 'TTS.bin.synthesize',
          '--text_file', textFilePath,
          '--model_name', 'tts_models/en/vctk/vits',
          '--speaker_id', voiceId || 'p225', // Default voice if not specified
          '--out_path', outputPath
        ]);
        
        let errorOutput = '';
        
        pythonProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
          // Clean up text file
          fs.unlinkSync(textFilePath);
          
          if (code !== 0) {
            logger.error(`Coqui TTS process exited with code ${code}: ${errorOutput}`);
            reject(new Error(`Coqui TTS failed with code ${code}`));
            return;
          }
          
          resolve();
        });
      });
      
      // Convert to WAV format if needed
      const wavPath = await audioProcessor.convertToWav(outputPath);
      
      // Save to cache
      const finalPath = this.saveToCache(wavPath, cacheKey);
      
      // Clean up temporary file
      if (outputPath !== wavPath) {
        fs.unlinkSync(outputPath);
      }
      
      return finalPath;
    } catch (error) {
      logger.error(`Error generating speech with Coqui: ${error.message}`);
      
      // Fall back to API if Coqui fails
      logger.info('Falling back to PlayHT API');
      return this.generateSpeechAPI(text, voiceId);
    }
  }

  /**
   * Generate speech using PlayHT API (fallback)
   * @param {string} text - Text to convert to speech
   * @param {string} voiceId - Voice ID to use
   * @returns {Promise<string>} - Path to generated audio file
   */
  async generateSpeechAPI(text, voiceId) {
    if (!text) {
      throw new Error('Text is required for speech generation');
    }
    
    if (!this.playHTApiKey || !this.playHTUserId) {
      throw new Error('PlayHT API credentials are not configured');
    }
    
    const provider = 'playht';
    const cacheKey = this.generateCacheKey(text, voiceId, provider);
    
    // Check cache first
    const cachedPath = this.checkCache(cacheKey);
    if (cachedPath) {
      logger.debug(`Using cached audio for: ${text.substring(0, 30)}...`);
      return cachedPath;
    }
    
    logger.info(`Generating speech with PlayHT API: ${text.substring(0, 30)}...`);
    
    try {
      // Make API request to PlayHT
      const response = await axios({
        method: 'post',
        url: 'https://api.play.ht/api/v1/convert',
        headers: {
          'Authorization': this.playHTApiKey,
          'X-User-ID': this.playHTUserId,
          'Content-Type': 'application/json'
        },
        data: {
          text,
          voice: voiceId || 'en-US-GuyNeural', // Default voice if not specified
          output_format: 'wav'
        },
        responseType: 'stream'
      });
      
      // Temporary file path
      const tempPath = path.join(this.cacheDir, `${cacheKey}_temp.wav`);
      
      // Save the audio stream to a file
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      // Convert to WAV format if needed
      const wavPath = await audioProcessor.convertToWav(tempPath);
      
      // Save to cache
      const finalPath = this.saveToCache(wavPath, cacheKey);
      
      // Clean up temporary file
      if (tempPath !== wavPath) {
        fs.unlinkSync(tempPath);
      }
      
      return finalPath;
    } catch (error) {
      logger.error(`Error generating speech with PlayHT API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a complete conversation by combining multiple speech segments
   * @param {Array} segments - Array of {text, voiceId, speaker} objects
   * @returns {Promise<string>} - Path to the combined audio file
   */
  async generateConversation(segments) {
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error('Valid segments array is required for conversation generation');
    }
    
    logger.info(`Generating conversation with ${segments.length} segments`);
    
    try {
      const audioFiles = [];
      
      // Generate speech for each segment
      for (const segment of segments) {
        const { text, voiceId, speaker } = segment;
        
        // Generate speech for this segment
        const audioPath = await this.generateSpeech(text, voiceId);
        
        // Add to the list of files to merge
        audioFiles.push({
          path: audioPath,
          speaker
        });
        
        // Add a short pause between segments
        if (segments.indexOf(segment) < segments.length - 1) {
          const pausePath = path.join(__dirname, '../../assets/audio/pause_500ms.wav');
          audioFiles.push({
            path: pausePath,
            speaker: 'pause'
          });
        }
      }
      
      // Merge all audio files
      const conversationId = crypto.randomUUID();
      const outputPath = path.join(this.cacheDir, `conversation_${conversationId}.wav`);
      
      await audioProcessor.mergeAudioFiles(audioFiles.map(file => file.path), outputPath);
      
      return outputPath;
    } catch (error) {
      logger.error(`Error generating conversation: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new TTSService();