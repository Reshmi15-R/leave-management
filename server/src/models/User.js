import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['team_member', 'team_leader', 'team_manager', 'general_manager', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    employeeId: { type: String, unique: true, trim: true },
    role: { type: String, enum: ROLES, default: 'team_member' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    designation: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    joinDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('validate', function () {
  if (!this.employeeId) {
    this.employeeId =
      'EMP' +
      Date.now().toString(36).slice(-4).toUpperCase() +
      Math.random().toString(36).slice(2, 5).toUpperCase();
  }
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
