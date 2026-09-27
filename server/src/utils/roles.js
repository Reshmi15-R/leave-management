export const APPROVER_ROLES = ['team_leader', 'team_manager', 'general_manager', 'admin'];
export const OVERRIDE_ROLES = ['team_manager', 'general_manager', 'admin'];
export const ADMIN_ROLES = ['general_manager', 'admin'];

export const isAdmin = (user) => ADMIN_ROLES.includes(user.role);
export const isApprover = (user) => APPROVER_ROLES.includes(user.role);
export const canOverride = (user) => OVERRIDE_ROLES.includes(user.role);

export const ROLE_LABELS = {
  team_member: 'Team Member',
  team_leader: 'Team Leader',
  team_manager: 'Team Manager',
  general_manager: 'General Manager',
  admin: 'Administrator',
};
