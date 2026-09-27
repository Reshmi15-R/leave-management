import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../../api.js';
import { Empty, Field, Modal, PageHead, Spinner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { ROLES, ROLE_LABELS, plural } from '../../utils.js';

// Categorical palette in fixed order
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

const blank = {
  name: '', code: '', description: '', color: PALETTE[0], defaultDays: 0,
  roleEntitlements: Object.fromEntries(ROLES.map((r) => [r, ''])),
  isPaid: true, carryForward: false, maxCarryForward: 0, allowHalfDay: true, requiresDocument: false,
  docRequiredAfterDays: 2, minNoticeDays: 0, maxConsecutiveDays: 0, gender: 'all', isActive: true,
};

function TypeModal({ type, usedColors, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    if (!type) return { ...blank, color: PALETTE.find((c) => !usedColors.includes(c)) || PALETTE[0] };
    const re = Object.fromEntries(ROLES.map((r) => [r, type.roleEntitlements?.[r] ?? '']));
    return { ...blank, ...type, roleEntitlements: re };
  });
  const set = (k, num) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : num ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [k]: v });
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const { _id, createdAt, updatedAt, __v, ...payload } = form;
      if (type) await api.put(`/leave-types/${type._id}`, payload);
      else await api.post('/leave-types', payload);
      toast.success('Leave type saved');
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Modal
      title={type ? `Edit ${type.name}` : 'New leave type'}
      onClose={onClose}
      size="lg"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="lt-form">Save</button></>}
    >
      <form id="lt-form" className="form-grid" onSubmit={save}>
        <Field label="Name"><input className="input" required value={form.name} onChange={set('name')} /></Field>
        <Field label="Code"><input className="input" required maxLength={6} value={form.code} onChange={set('code')} /></Field>
        <Field label="Description" className="full"><input className="input" value={form.description} onChange={set('description')} /></Field>
        <div className="field full">
          <span className="label-text">Color</span>
          <div className="row">
            {PALETTE.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({ ...form, color: c })}
                aria-label={`Color ${c}`}
                style={{ width: 26, height: 26, borderRadius: 6, background: c, border: form.color === c ? '3px solid var(--ink)' : '2px solid var(--surface)', cursor: 'pointer', boxShadow: '0 0 0 1px var(--border)' }}
              />
            ))}
          </div>
        </div>

        <h3 className="full" style={{ marginTop: 6 }}>Entitlement</h3>
        <Field label="Default days per year"><input className="input" type="number" min={0} step={0.5} value={form.defaultDays} onChange={set('defaultDays', true)} /></Field>
        <Field label="Applies to">
          <select className="input" value={form.gender} onChange={set('gender')}>
            <option value="all">All employees</option>
            <option value="female">Female employees</option>
            <option value="male">Male employees</option>
          </select>
        </Field>
        <div className="full">
          <span className="label-text">Role-specific entitlements (blank = default)</span>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 6 }}>
            {ROLES.map((r) => (
              <Field key={r} label={ROLE_LABELS[r]}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder={String(form.defaultDays)}
                  value={form.roleEntitlements[r]}
                  onChange={(e) => setForm({ ...form, roleEntitlements: { ...form.roleEntitlements, [r]: e.target.value } })}
                />
              </Field>
            ))}
          </div>
        </div>

        <h3 className="full" style={{ marginTop: 6 }}>Policy rules</h3>
        <Field label="Minimum notice (days)" help="0 = can apply same day"><input className="input" type="number" min={0} value={form.minNoticeDays} onChange={set('minNoticeDays', true)} /></Field>
        <Field label="Max consecutive days" help="0 = no limit"><input className="input" type="number" min={0} value={form.maxConsecutiveDays} onChange={set('maxConsecutiveDays', true)} /></Field>
        <div className="full row" style={{ gap: 20 }}>
          <label className="check"><input type="checkbox" checked={form.isPaid} onChange={set('isPaid')} /> Paid (balance enforced)</label>
          <label className="check"><input type="checkbox" checked={form.allowHalfDay} onChange={set('allowHalfDay')} /> Allow half day</label>
          <label className="check"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Active</label>
        </div>
        <label className="check"><input type="checkbox" checked={form.carryForward} onChange={set('carryForward')} /> Carry forward unused days</label>
        {form.carryForward ? (
          <Field label="Max carry forward (days)"><input className="input" type="number" min={0} value={form.maxCarryForward} onChange={set('maxCarryForward', true)} /></Field>
        ) : <div />}
        <label className="check"><input type="checkbox" checked={form.requiresDocument} onChange={set('requiresDocument')} /> Requires supporting document</label>
        {form.requiresDocument ? (
          <Field label="Required when longer than (days)"><input className="input" type="number" min={0} value={form.docRequiredAfterDays} onChange={set('docRequiredAfterDays', true)} /></Field>
        ) : <div />}
      </form>
    </Modal>
  );
}

export default function LeaveTypes() {
  const [types, setTypes] = useState(null);
  const [editing, setEditing] = useState(undefined);

  const load = useCallback(() => {
    api.get('/leave-types', { params: { all: true } }).then((r) => setTypes(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  const remove = async (t) => {
    try {
      const { data } = await api.delete(`/leave-types/${t._id}`);
      toast.success(data.message);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHead title="Leave types & policies" subtitle="Configure leave types, yearly entitlements and the rules applied when employees apply.">
        <button className="btn primary" onClick={() => setEditing(null)}><Icon name="plus" /> New leave type</button>
      </PageHead>
      <div className="card">
        {!types ? (
          <Spinner />
        ) : types.length === 0 ? (
          <Empty>No leave types configured.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Leave type</th><th className="num">Days / year</th><th>Rules</th><th>Carry forward</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {types.map((t) => {
                  const overrides = ROLES.filter((r) => t.roleEntitlements?.[r] !== null && t.roleEntitlements?.[r] !== undefined);
                  const rules = [
                    !t.isPaid && 'Unpaid',
                    t.allowHalfDay && 'Half day',
                    t.minNoticeDays > 0 && `${plural(t.minNoticeDays, 'day')} notice`,
                    t.maxConsecutiveDays > 0 && `max ${t.maxConsecutiveDays} at once`,
                    t.requiresDocument && `doc > ${t.docRequiredAfterDays}d`,
                    t.gender !== 'all' && `${t.gender} only`,
                  ].filter(Boolean);
                  return (
                    <tr key={t._id}>
                      <td>
                        <div className="type-chip" style={{ fontWeight: 550 }}><span className="swatch" style={{ background: t.color }} />{t.name} <span className="muted">({t.code})</span></div>
                        <div className="muted small">{t.description}</div>
                      </td>
                      <td className="num">
                        {t.defaultDays}
                        {overrides.length > 0 && (
                          <div className="muted small">{overrides.map((r) => `${ROLE_LABELS[r]}: ${t.roleEntitlements[r]}`).join(', ')}</div>
                        )}
                      </td>
                      <td className="small ink-2">{rules.join(' · ') || '—'}</td>
                      <td className="small">{t.carryForward ? `Up to ${t.maxCarryForward}` : 'No'}</td>
                      <td>{t.isActive ? <span className="badge approved">Active</span> : <span className="badge neutral">Inactive</span>}</td>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <button className="icon-btn" aria-label="Edit" onClick={() => setEditing(t)}><Icon name="edit" /></button>
                          {t.isActive && <button className="icon-btn" aria-label="Delete" title="Delete (deactivates if used)" onClick={() => remove(t)}><Icon name="trash" /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        Entitlement changes apply to balances created from now on. Use System Settings → Initialise balances for a new year, or Team Balances to adjust existing ones.
      </p>
      {editing !== undefined && (
        <TypeModal
          type={editing}
          usedColors={(types || []).map((t) => t.color)}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
