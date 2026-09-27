// Meter: used (solid type colour) + pending (tinted) against the total entitlement.
export default function BalanceCard({ balance }) {
  const { leaveType: t, total, used, pending, available } = balance;
  const unpaid = !t.isPaid;
  const denom = Math.max(total, used + pending, 1);
  const usedPct = (used / denom) * 100;
  const pendPct = (pending / denom) * 100;

  return (
    <div className="card balance">
      <div className="top">
        <span className="swatch" style={{ background: t.color }} />
        <h3 className="grow">{t.name}</h3>
        <span className="muted small">{t.code}</span>
      </div>
      {unpaid ? (
        <>
          <div className="big num">
            {used} <small>days taken</small>
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>Unpaid — no balance limit</div>
        </>
      ) : (
        <>
          <div className="big num">
            <span className={available < 0 ? 'neg' : ''}>{available}</span> <small>of {total} days left</small>
          </div>
          <div className="meter" role="img" aria-label={`${used} used, ${pending} pending, ${available} available of ${total}`}>
            {usedPct > 0 && <span style={{ width: `${usedPct}%`, background: t.color }} />}
            {pendPct > 0 && <span style={{ width: `${pendPct}%`, background: t.color, opacity: 0.4 }} />}
          </div>
          <div className="legend-line">
            <span><i style={{ background: t.color }} />Used {used}</span>
            <span><i style={{ background: t.color, opacity: 0.4 }} />Pending {pending}</span>
            {balance.carriedForward > 0 && <span>Carried fwd {balance.carriedForward}</span>}
            {balance.adjusted !== 0 && <span>Adjusted {balance.adjusted > 0 ? '+' : ''}{balance.adjusted}</span>}
          </div>
        </>
      )}
    </div>
  );
}
