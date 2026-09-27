import { Router } from 'express';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Settings from '../models/Settings.js';
import { protect, signToken } from '../middleware/auth.js';
import { ah, HttpError } from '../middleware/error.js';
import { APPROVER_ROLES } from '../utils/roles.js';

const router = Router();

const authResponse = async (user) => {
  const populated = await User.findById(user._id)
    .populate('department', 'name code')
    .populate('reportsTo', 'name email role');
  return { token: signToken(user), user: populated };
};

// Public data needed by the registration form
router.get(
  '/meta',
  ah(async (_req, res) => {
    const [departments, approvers, settings] = await Promise.all([
      Department.find({ isActive: true }).select('name code').sort('name'),
      User.find({ isActive: true, role: { $in: APPROVER_ROLES } }).select('name role department').sort('name'),
      Settings.get(),
    ]);
    res.json({ departments, approvers, organizationName: settings.organizationName });
  })
);

router.post(
  '/register',
  ah(async (req, res) => {
    const { name, email, password, department, reportsTo, designation, phone, gender } = req.body;
    if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required');
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (await User.exists({ email: String(email).toLowerCase() })) throw new HttpError(409, 'An account with this email already exists');

    if (reportsTo) {
      const mgr = await User.findById(reportsTo);
      if (!mgr || !APPROVER_ROLES.includes(mgr.role)) throw new HttpError(400, 'Invalid reporting manager');
    }

    // Self-registration always creates a Team Member; admins promote roles.
    const user = await User.create({
      name, email, password, designation, phone, gender,
      department: department || null,
      reportsTo: reportsTo || null,
      role: 'team_member',
    });
    res.status(201).json(await authResponse(user));
  })
);

router.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new HttpError(400, 'Email and password are required');
    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password))) throw new HttpError(401, 'Invalid email or password');
    if (!user.isActive) throw new HttpError(403, 'Your account has been deactivated. Contact your administrator.');
    res.json(await authResponse(user));
  })
);

router.get(
  '/me',
  protect,
  ah(async (req, res) => {
    const user = await User.findById(req.user._id).populate('department', 'name code').populate('reportsTo', 'name email role');
    res.json(user);
  })
);

router.put(
  '/me',
  protect,
  ah(async (req, res) => {
    const { name, phone, designation } = req.body;
    const user = await User.findById(req.user._id);
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (designation !== undefined) user.designation = designation;
    await user.save();
    res.json((await authResponse(user)).user);
  })
);

router.put(
  '/me/password',
  protect,
  ah(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) throw new HttpError(400, 'New password must be at least 6 characters');
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword || ''))) throw new HttpError(400, 'Current password is incorrect');
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  })
);

export default router;
