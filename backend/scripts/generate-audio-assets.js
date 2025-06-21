#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Generate audio assets for the TTS service
 */
async function generateAudioAssets() {
  const assetsDir = path.join(__dirname, '../assets/audio');
  
  // Ensure directory exists
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log('Generating audio assets...');

  try {
    // Generate 500ms pause
    await generateSilence(path.join(assetsDir, 'pause_500ms.wav'), 0.5);
    console.log('✓ Generated pause_500ms.wav');

    // Generate 1000ms pause
    await generateSilence(path.join(assetsDir, 'pause_1000ms.wav'), 1.0);
    console.log('✓ Generated pause_1000ms.wav');

    // Generate 2000ms pause
    await generateSilence(path.join(assetsDir, 'pause_2000ms.wav'), 2.0);
    console.log('✓ Generated pause_2000ms.wav');

    console.log('All audio assets generated successfully!');
  } catch (error) {
    console.error('Error generating audio assets:', error.message);
    process.exit(1);
  }
}

/**
 * Generate silence audio file
 * @param {string} outputPath - Output file path
 * @param {number} duration - Duration in seconds
 */
function generateSilence(outputPath, duration) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'lavfi',
      '-i', 'anullsrc=r=8000:cl=mono',
      '-t', duration.toString(),
      '-acodec', 'pcm_s16le',
      '-y', // Overwrite if exists
      outputPath
    ]);

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed with code ${code}: ${errorOutput}`));
        return;
      }
      resolve();
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
    });
  });
}

// Run if called directly
if (require.main === module) {
  generateAudioAssets();
}

module.exports = { generateAudioAssets, generateSilence };