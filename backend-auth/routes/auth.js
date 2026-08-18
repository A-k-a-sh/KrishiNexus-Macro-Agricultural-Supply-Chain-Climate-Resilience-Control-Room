const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connect');
const { ObjectId } = require('mongodb');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDb();
    const user = await db.collection('users').findOne({ email });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ error: 'Account deactivated' });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = {
      userId: user._id.toString(),
      role: user.role,
      assignedRegion: user.assignedRegion,
      name: user.name
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' });
    const refreshToken = jwt.sign({ userId: user._id.toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });

    db.collection('users').updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        assignedRegion: user.assignedRegion
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { email, password, name, role, assignedRegion } = req.body;
    if (!email || !password || !role) return res.status(400).json({ error: 'Missing fields' });

    const validRoles = ['field_officer', 'logistics_manager', 'admin'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const db = getDb();
    const existing = await db.collection('users').findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    
    const newUser = {
      email,
      passwordHash,
      name,
      role,
      assignedRegion: assignedRegion || { type: 'national' },
      isActive: true,
      createdAt: new Date(),
      lastLogin: null
    };

    const result = await db.collection('users').insertOne(newUser);
    res.status(201).json({ message: 'User created', userId: result.insertedId.toString() });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });

    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid user' });

    const payload = {
      userId: user._id.toString(),
      role: user.role,
      assignedRegion: user.assignedRegion,
      name: user.name
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' });
    
    res.json({ accessToken });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    next(err);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid user' });

    res.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      assignedRegion: user.assignedRegion
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

module.exports = router;
