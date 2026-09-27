import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../../api.js';
import { Empty, Field, Modal, PageHead, Spinner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

export default function Departments() {
  const [items, setItems] = useState(null);
  const [people, setPeople] = useState([]);
  const [editing, setEditing] = useState(undefined);
  const [form, setForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    api.get('/departments').then((r) => setItems(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);
  useEffect(() => {
    load();
    api.get('/users/approvers').then((r) => setPeople(r.data));
  }, [load]);

  const open = (d) => {
    setEditing(d);
    setForm(d ? { name: d.name, code: d.code, description: d.description, head: d.head?._id || '', isActive: d.isActive } : { name: '', code: '', description: '', head: '', isActive: true });
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/departments/${editing._id}`, form);
      else await api.post('/departments', form);
      toast.success('Department saved');
      setEditing(undefined);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/departments/${confirmDelete._id}`);
      toast.success('Department deleted');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div>
      <PageHead title="Departments" subtitle="Organize employees into departments.">
        <button className="btn primary" onClick={() => open(null)}><Icon name="plus" /> Add department</button>
      </PageHead>
      <div className="card">
        {!items ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty>No departments yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Code</th><th>Head</th><th className="num">Employees</th><th>Status</th><th /></tr></thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d._id}>
                    <td><div style={{ fontWeight: 550 }}>{d.name}</div><div className="muted small">{d.description}</div></td>
                    <td>{d.code}</td>
                    <td className="ink-2">{d.head?.name || '—'}</td>
                    <td className="num">{d.employeeCount}</td>
                    <td>{d.isActive ? <span className="badge approved">Active</span> : <span className="badge neutral">Inactive</span>}</td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <button className="icon-btn" aria-label="Edit" onClick={() => open(d)}><Icon name="edit" /></button>
                        <button className="icon-btn" aria-label="Delete" onClick={() => setConfirmDelete(d)}><Icon name="trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== undefined && (
        <Modal
          title={editing ? 'Edit department' : 'Add department'}
          onClose={() => setEditing(undefined)}
          footer={<><button className="btn" onClick={() => setEditing(undefined)}>Cancel</button><button className="btn primary" form="dep-form">Save</button></>}
        >
          <form id="dep-form" className="form-grid" onSubmit={save}>
            <Field label="Name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Code"><input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Description" className="full"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Department head">
              <select className="input" value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })}>
                <option value="">— None —</option>
                {people.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </Field>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
            </div>
          </form>
        </Modal>
      )}
      {confirmDelete && (
        <Modal
          title="Delete department?"
          onClose={() => setConfirmDelete(null)}
          footer={<><button className="btn" onClick={() => setConfirmDelete(null)}>Cancel</button><button className="btn danger" onClick={remove}>Delete</button></>}
        >
          <p>Delete <strong>{confirmDelete.name}</strong>? Departments with active employees cannot be deleted.</p>
        </Modal>
      )}
    </div>
  );
}
