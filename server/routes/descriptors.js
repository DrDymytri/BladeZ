const express = require('express');
const router = express.Router();
const { Descriptor } = require('../models'); // Adjust the path to your models

// Update a descriptor by ID
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    const descriptor = await Descriptor.findByPk(id);
    if (!descriptor) {
      return res.status(404).json({ error: 'Descriptor not found' });
    }

    descriptor.name = name;
    await descriptor.save();

    res.status(200).json({ message: 'Descriptor updated successfully', descriptor });
  } catch (error) {
    console.error('Error updating descriptor:', error);
    res.status(500).json({ error: 'An error occurred while updating the descriptor' });
  }
});

module.exports = router;
