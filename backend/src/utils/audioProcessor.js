const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('./logger');

/**
 * Audio processing utilities
 */
class AudioProcessor {
  /**
   * Convert audio file to WAV format for compatibility
   * @param {string} audioPath - Path to the audio file
   * @returns {Promise<string>} - Path to the converted WAV file
   */
  async convertToWav(audioPath) {
    if (!audioPath) {
      throw new Error('Audio path is required');
    }
    
    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }
    
    // Check if already WAV format with correct parameters
    const fileExt = path.extname(audioPath).toLowerCase();
    if (fileExt === '.wav') {
      // We could check the format details here with ffprobe
      // For simplicity, we'll assume it's already in the correct format
      return audioPath;
    }
    
    // Create output path
    const outputPath = audioPath.replace(fileExt, '.wav');
    
    logger.debug(`Converting audio file to WAV: ${path.basename(audioPath)}`);
    
    try {
      // Use ffmpeg to convert to WAV format compatible with Plivo
      // Plivo requires: WAV, 8kHz, mono, 16-bit PCM
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', audioPath,
          '-ar', '8000',  // 8kHz sample rate
          '-ac', '1',     // mono
          '-acodec', 'pcm_s16le', // 16-bit PCM
          '-y',           // Overwrite output file if it exists
          outputPath
        ]);
        
        let errorOutput = '';
        
        ffmpeg.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
          if (code !== 0) {
            logger.error(`ffmpeg process exited with code ${code}: ${errorOutput}`);
            reject(new Error(`ffmpeg failed with code ${code}`));
            return;
          }
          
          resolve();
        });
      });
      
      return outputPath;
    } catch (error) {
      logger.error(`Error converting audio to WAV: ${error.message}`);
      throw error;
    }
  }

  /**
   * Merge multiple audio files into one
   * @param {Array<string>} audioFiles - Array of paths to audio files
   * @param {string} outputPath - Path for the merged output file
   * @returns {Promise<string>} - Path to the merged audio file
   */
  async mergeAudioFiles(audioFiles, outputPath) {
    if (!audioFiles || !Array.isArray(audioFiles) || audioFiles.length === 0) {
      throw new Error('Valid array of audio files is required');
    }
    
    if (!outputPath) {
      throw new Error('Output path is required');
    }
    
    // Check if all files exist
    for (const file of audioFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Audio file not found: ${file}`);
      }
    }
    
    logger.debug(`Merging ${audioFiles.length} audio files`);
    
    try {
      // Create a temporary file list for ffmpeg
      const tempListPath = path.join(path.dirname(outputPath), 'filelist.txt');
      const fileList = audioFiles.map(file => `file '${file}'`).join('\n');
      fs.writeFileSync(tempListPath, fileList);
      
      // Use ffmpeg to concatenate files
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-f', 'concat',
          '-safe', '0',
          '-i', tempListPath,
          '-c', 'copy',
          '-y',
          outputPath
        ]);
        
        let errorOutput = '';
        
        ffmpeg.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
          // Clean up temp file
          fs.unlinkSync(tempListPath);
          
          if (code !== 0) {
            logger.error(`ffmpeg process exited with code ${code}: ${errorOutput}`);
            reject(new Error(`ffmpeg failed with code ${code}`));
            return;
          }
          
          resolve();
        });
      });
      
      // Convert to proper format for Plivo
      const finalPath = await this.convertToWav(outputPath);
      
      return finalPath;
    } catch (error) {
      logger.error(`Error merging audio files: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the duration of an audio file in seconds
   * @param {string} audioPath - Path to the audio file
   * @returns {Promise<number>} - Duration in seconds
   */
  async getDuration(audioPath) {
    if (!audioPath) {
      throw new Error('Audio path is required');
    }
    
    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }
    
    logger.debug(`Getting duration for audio file: ${path.basename(audioPath)}`);
    
    try {
      // Use ffprobe to get duration
      const duration = await new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          audioPath
        ]);
        
        let output = '';
        let errorOutput = '';
        
        ffprobe.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        ffprobe.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        ffprobe.on('close', (code) => {
          if (code !== 0) {
            logger.error(`ffprobe process exited with code ${code}: ${errorOutput}`);
            reject(new Error(`ffprobe failed with code ${code}`));
            return;
          }
          
          const duration = parseFloat(output.trim());
          resolve(duration);
        });
      });
      
      return duration;
    } catch (error) {
      logger.error(`Error getting audio duration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normalize audio volume to a standard level
   * @param {string} audioPath - Path to the audio file
   * @param {string} outputPath - Path for the normalized output file
   * @returns {Promise<string>} - Path to the normalized audio file
   */
  async normalizeVolume(audioPath, outputPath) {
    if (!audioPath) {
      throw new Error('Audio path is required');
    }
    
    if (!outputPath) {
      throw new Error('Output path is required');
    }
    
    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }
    
    logger.debug(`Normalizing audio volume: ${path.basename(audioPath)}`);
    
    try {
      // Use ffmpeg to normalize audio
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', audioPath,
          '-filter:a', 'loudnorm=I=-16:LRA=11:TP=-1.5',
          '-y',
          outputPath
        ]);
        
        let errorOutput = '';
        
        ffmpeg.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
          if (code !== 0) {
            logger.error(`ffmpeg process exited with code ${code}: ${errorOutput}`);
            reject(new Error(`ffmpeg failed with code ${code}`));
            return;
          }
          
          resolve();
        });
      });
      
      return outputPath;
    } catch (error) {
      logger.error(`Error normalizing audio volume: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add silence to the beginning or end of an audio file
   * @param {string} audioPath - Path to the audio file
   * @param {string} outputPath - Path for the output file
   * @param {number} silenceBefore - Seconds of silence to add before (default: 0)
   * @param {number} silenceAfter - Seconds of silence to add after (default: 0)
   * @returns {Promise<string>} - Path to the modified audio file
   */
  async addSilence(audioPath, outputPath, silenceBefore = 0, silenceAfter = 0) {
    if (!audioPath) {
      throw new Error('Audio path is required');
    }
    
    if (!outputPath) {
      throw new Error('Output path is required');
    }
    
    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }
    
    // If no silence to add, just return the original path
    if (silenceBefore <= 0 && silenceAfter <= 0) {
      return audioPath;
    }
    
    logger.debug(`Adding silence: ${silenceBefore}s before, ${silenceAfter}s after`);
    
    try {
      // Use ffmpeg to add silence
      await new Promise((resolve, reject) => {
        const filterComplex = [];
        const inputs = ['-i', audioPath];
        
        if (silenceBefore > 0) {
          inputs.push('-f', 'lavfi', '-t', silenceBefore.toString(), '-i', 'anullsrc=r=8000:cl=mono');
          filterComplex.push('[1:0][0:0]concat=n=2:v=0:a=1[out]');
        }
        
        if (silenceAfter > 0) {
          inputs.push('-f', 'lavfi', '-t', silenceAfter.toString(), '-i', 'anullsrc=r=8000:cl=mono');
          
          if (silenceBefore > 0) {
            // We already have a filter for before, need to modify it
            filterComplex[0] = '[1:0][0:0][2:0]concat=n=3:v=0:a=1[out]';
          } else {
            // Only adding silence after
            filterComplex.push('[0:0][1:0]concat=n=2:v=0:a=1[out]');
          }
        }
        
        const args = [
          ...inputs,
          '-filter_complex', filterComplex.join(';'),
          '-map', silenceBefore > 0 || silenceAfter > 0 ? '[out]' : '0:a',
          '-y',
          outputPath
        ];
        
        const ffmpeg = spawn('ffmpeg', args);
        
        let errorOutput = '';
        
        ffmpeg.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
          if (code !== 0) {
            logger.error(`ffmpeg process exited with code ${code}: ${errorOutput}`);
            reject(new Error(`ffmpeg failed with code ${code}`));
            return;
          }
          
          resolve();
        });
      });
      
      return outputPath;
    } catch (error) {
      logger.error(`Error adding silence: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AudioProcessor();