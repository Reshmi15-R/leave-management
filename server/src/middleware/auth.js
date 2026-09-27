import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError } from './error.js';

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

export async function protect(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Not authenticated');
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new HttpError(401, 'Session expired, please log in again');
    }
    const user = await User.findById(payload.id).populate('department', 'name code');
    if (!user || !user.isActive) throw new HttpError(401, 'Account not found or deactivated');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission for this action'));
  next();
};
