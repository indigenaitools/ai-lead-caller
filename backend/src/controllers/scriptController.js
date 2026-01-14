const ScriptTemplate = require('../models/ScriptTemplate');
const logger = require('../utils/logger');

/**
 * Get all script templates for a user
 * @route GET /api/scripts
 * @access Private
 */
exports.getScripts = async (req, res) => {
  try {
    const scripts = await ScriptTemplate.find({ 
      $or: [
        { user: req.user.id },
        { isPublic: true }
      ]
    }).sort({ createdAt: -1 });
    
    res.json({ scripts });
  } catch (error) {
    logger.error('Error in getScripts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get a single script template by ID
 * @route GET /api/scripts/:id
 * @access Private
 */
exports.getScriptById = async (req, res) => {
  try {
    const script = await ScriptTemplate.findById(req.params.id);
    
    if (!script) {
      return res.status(404).json({ message: 'Script template not found' });
    }
    
    // Check if the script belongs to the user or is public
    if (script.user.toString() !== req.user.id && !script.isPublic && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this script template' });
    }
    
    res.json(script);
  } catch (error) {
    logger.error('Error in getScriptById:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Create a new script template
 * @route POST /api/scripts
 * @access Private
 */
exports.createScript = async (req, res) => {
  try {
    const {
      name,
      description,
      industry,
      introduction,
      qualification,
      presentation,
      objectionHandling,
      closing,
      followUp,
      isPublic
    } = req.body;
    
    const script = new ScriptTemplate({
      user: req.user.id,
      name,
      description,
      industry,
      introduction,
      qualification,
      presentation,
      objectionHandling,
      closing,
      followUp,
      isPublic: req.user.role === 'admin' ? isPublic : false // Only admins can create public scripts
    });
    
    const createdScript = await script.save();
    
    res.status(201).json(createdScript);
  } catch (error) {
    logger.error('Error in createScript:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update a script template
 * @route PUT /api/scripts/:id
 * @access Private
 */
exports.updateScript = async (req, res) => {
  try {
    const script = await ScriptTemplate.findById(req.params.id);
    
    if (!script) {
      return res.status(404).json({ message: 'Script template not found' });
    }
    
    // Check if the script belongs to the user
    if (script.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this script template' });
    }
    
    // Update script fields
    const allowedFields = [
      'name', 'description', 'industry', 'introduction', 'qualification',
      'presentation', 'objectionHandling', 'closing', 'followUp'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        script[field] = req.body[field];
      }
    });
    
    // Only admins can update isPublic
    if (req.user.role === 'admin' && req.body.isPublic !== undefined) {
      script.isPublic = req.body.isPublic;
    }
    
    const updatedScript = await script.save();
    
    res.json(updatedScript);
  } catch (error) {
    logger.error('Error in updateScript:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete a script template
 * @route DELETE /api/scripts/:id
 * @access Private
 */
exports.deleteScript = async (req, res) => {
  try {
    const script = await ScriptTemplate.findById(req.params.id);
    
    if (!script) {
      return res.status(404).json({ message: 'Script template not found' });
    }
    
    // Check if the script belongs to the user
    if (script.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this script template' });
    }
    
    await script.deleteOne();
    
    res.json({ message: 'Script template removed' });
  } catch (error) {
    logger.error('Error in deleteScript:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get default script templates
 * @route GET /api/scripts/defaults
 * @access Private
 */
exports.getDefaultScripts = async (req, res) => {
  try {
    const scripts = await ScriptTemplate.find({ isPublic: true })
      .sort({ createdAt: -1 });
    
    res.json({ scripts });
  } catch (error) {
    logger.error('Error in getDefaultScripts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};