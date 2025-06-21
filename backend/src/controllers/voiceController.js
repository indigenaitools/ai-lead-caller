const Voice = require('../models/Voice');
const logger = require('../utils/logger');

/**
 * Get all voices for a user
 * @route GET /api/voices
 * @access Private
 */
exports.getVoices = async (req, res) => {
  try {
    const voices = await Voice.find({ 
      $or: [
        { user: req.user.id },
        { isPublic: true }
      ]
    }).sort({ createdAt: -1 });
    
    res.json({ voices });
  } catch (error) {
    logger.error('Error in getVoices:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get a single voice by ID
 * @route GET /api/voices/:id
 * @access Private
 */
exports.getVoiceById = async (req, res) => {
  try {
    const voice = await Voice.findById(req.params.id);
    
    if (!voice) {
      return res.status(404).json({ message: 'Voice not found' });
    }
    
    // Check if the voice belongs to the user or is public
    if (voice.user.toString() !== req.user.id && !voice.isPublic && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this voice' });
    }
    
    res.json(voice);
  } catch (error) {
    logger.error('Error in getVoiceById:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Create a new voice
 * @route POST /api/voices
 * @access Private
 */
exports.createVoice = async (req, res) => {
  try {
    const {
      name,
      description,
      provider,
      voiceId,
      language,
      gender,
      accent,
      settings,
      isPublic
    } = req.body;
    
    const voice = new Voice({
      user: req.user.id,
      name,
      description,
      provider,
      voiceId,
      language,
      gender,
      accent,
      settings,
      isPublic: req.user.role === 'admin' ? isPublic : false // Only admins can create public voices
    });
    
    const createdVoice = await voice.save();
    
    res.status(201).json(createdVoice);
  } catch (error) {
    logger.error('Error in createVoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update a voice
 * @route PUT /api/voices/:id
 * @access Private
 */
exports.updateVoice = async (req, res) => {
  try {
    const voice = await Voice.findById(req.params.id);
    
    if (!voice) {
      return res.status(404).json({ message: 'Voice not found' });
    }
    
    // Check if the voice belongs to the user
    if (voice.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this voice' });
    }
    
    // Update voice fields
    const allowedFields = [
      'name', 'description', 'provider', 'voiceId', 'language',
      'gender', 'accent', 'settings'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        voice[field] = req.body[field];
      }
    });
    
    // Only admins can update isPublic
    if (req.user.role === 'admin' && req.body.isPublic !== undefined) {
      voice.isPublic = req.body.isPublic;
    }
    
    const updatedVoice = await voice.save();
    
    res.json(updatedVoice);
  } catch (error) {
    logger.error('Error in updateVoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete a voice
 * @route DELETE /api/voices/:id
 * @access Private
 */
exports.deleteVoice = async (req, res) => {
  try {
    const voice = await Voice.findById(req.params.id);
    
    if (!voice) {
      return res.status(404).json({ message: 'Voice not found' });
    }
    
    // Check if the voice belongs to the user
    if (voice.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this voice' });
    }
    
    await voice.deleteOne();
    
    res.json({ message: 'Voice removed' });
  } catch (error) {
    logger.error('Error in deleteVoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get default voices
 * @route GET /api/voices/defaults
 * @access Private
 */
exports.getDefaultVoices = async (req, res) => {
  try {
    const voices = await Voice.find({ isPublic: true })
      .sort({ createdAt: -1 });
    
    res.json({ voices });
  } catch (error) {
    logger.error('Error in getDefaultVoices:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Test a voice by generating sample audio
 * @route POST /api/voices/:id/test
 * @access Private
 */
exports.testVoice = async (req, res) => {
  try {
    const voice = await Voice.findById(req.params.id);
    
    if (!voice) {
      return res.status(404).json({ message: 'Voice not found' });
    }
    
    // Check if the voice belongs to the user or is public
    if (voice.user.toString() !== req.user.id && !voice.isPublic && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to test this voice' });
    }
    
    const { text = 'Hello, this is a test of the voice synthesis system.' } = req.body;
    
    // Here you would integrate with the TTS service to generate audio
    // For now, we'll just return a success response
    res.json({
      message: 'Voice test initiated',
      voiceId: voice._id,
      voiceName: voice.name,
      text,
      // In a real implementation, you would return the audio URL or data
      audioUrl: null
    });
  } catch (error) {
    logger.error('Error in testVoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};