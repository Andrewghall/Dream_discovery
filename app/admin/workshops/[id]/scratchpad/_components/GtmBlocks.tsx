/**
 * GTM Scratchpad Blocks
 *
 * React components for rendering the Go-To-Market output intelligence
 * across the four phases: Reality, Ideal State, Constraints, Way Forward,
 * plus the Executive View.
 */

'use client';

import type {
  GtmOutputIntelligence,
  GtmRealityMap,
  GtmIdealState,
  GtmConstraints,
  GtmWayForward,
  GtmExecutiveView,
  GtmRiskColour,
} from '@/lib/output-intelligence/gtm/types';

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children, accentColor = '#1E3A5F' }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 28, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `4px solid ${accentColor}` }}>
      <div style={{ marginBottom: subtitle ? 6 : 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</h3>
        {subtitle && <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6B7280' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Pill({ label, color = '#EEF2FF', textColor = '#4338CA' }: { label: string; color?: string; textColor?: string }) {
  return (
    <span style={{
      display: 'inline-block', background: color, color: textColor,
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      marginRight: 6, marginBottom: 4, letterSpacing: 0.3
    }}>
      {label}
    </span>
  );
}

const LENS_COLOURS: Record<string, { bg: string; text: string }> = {
  'People':          { bg: '#DBEAFE', text: '#1E40AF' },
  'Commercial':      { bg: '#D1FAE5', text: '#065F46' },
  'Operations':      { bg: '#FEF3C7', text: '#92400E' },
  'Technology':      { bg: '#E0E7FF', text: '#3730A3' },
  'Partners':        { bg: '#FCE7F3', text: '#9D174D' },
  'Risk/Compliance': { bg: '#FEE2E2', text: '#991B1B' },
};

function LensPill({ lens }: { lens: string }) {
  const c = LENS_COLOURS[lens] ?? { bg: '#F3F4F6', text: '#374151' };
  return <Pill label={lens} color={c.bg} textColor={c.text} />;
}

const RISK_CONFIG: Record<GtmRiskColour, { bg: string; text: string; label: string }> = {
  red:   { bg: '#FEE2E2', text: '#991B1B', label: 'High Risk' },
  amber: { bg: '#FEF3C7', text: '#92400E', label: 'Moderate' },
  green: { bg: '#D1FAE5', text: '#065F46', label: 'Solid' },
};

function RiskBadge({ colour }: { colour: GtmRiskColour }) {
  const c = RISK_CONFIG[colour];
  return (
    <span style={{ display: 'inline-block', background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
      {c.label}
    </span>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '8px 12px', textAlign: 'left', background: '#F9FAFB', color: '#6B7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #E5E7EB' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid #F3F4F6' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '10px 12px', color: '#374151', verticalAlign: 'top', lineHeight: 1.5 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulletList({ items, color = '#6B7280' }: { items: string[]; color?: string }) {
  if (!items?.length) return <p style={{ color: '#9CA3AF', fontSize: 13, fontStyle: 'italic', margin: 0 }}>None identified</p>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
      {items.map((item, i) => (
        <li key={i} style={{ color, fontSize: 13, lineHeight: 1.7, marginBottom: 3 }}>{item}</li>
      ))}
    </ul>
  );
}

// ── Executive View ─────────────────────────────────────────────────────────────

export function GtmExecutiveBlock({ view }: { view: GtmExecutiveView }) {
  return (
    <div style={{ background: '#1E3A5F', borderRadius: 12, padding: 32, marginBottom: 24, color: '#FFFFFF' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: '0 0 4px 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#93C5FD' }}>Executive View</p>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.3, color: '#FFFFFF' }}>
          {view.headline || 'GTM Analysis Complete'}
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 16 }}>
          <p style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#93C5FD' }}>North Star</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#F1F5F9' }}>{view.northStar}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 16 }}>
          <p style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#93C5FD' }}>ICP</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#F1F5F9' }}>{view.icpOneLiner}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {[
          { label: '3 Truths', items: view.threeTruths, accent: '#60A5FA' },
          { label: '3 Blockers', items: view.threeBlockers, accent: '#F87171' },
          { label: '3 Actions', items: view.threeActions, accent: '#34D399' },
        ].map(({ label, items, accent }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 16 }}>
            <p style={{ margin: '0 0 10px 0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: accent }}>
              {label}
            </p>
            {items?.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <span style={{ color: accent, fontWeight: 700, flexShrink: 0, fontSize: 13 }}>{i + 1}.</span>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#E2E8F0' }}>{item}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Phase 1: Reality Map ──────────────────────────────────────────────────────

export function GtmRealityBlock({ reality }: { reality: GtmRealityMap }) {
  return (
    <div>
      {/* Reality Summary */}
      <SectionCard title="Commercial Reality Today" accentColor="#DC2626">
        <p style={{ margin: 0, color: '#374151', fontSize: 14, lineHeight: 1.7 }}>{reality.realitySummary}</p>
      </SectionCard>

      {/* Truth Statements */}
      {reality.truthStatements?.length > 0 && (
        <SectionCard title="Truth Statements" subtitle="What is actually true today — by lens" accentColor="#DC2626">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reality.truthStatements.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: t.significance === 'high' ? '#FEF2F2' : '#F9FAFB', borderRadius: 8 }}>
                <LensPill lens={t.lens} />
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, flex: 1 }}>{t.text}</p>
                {t.significance === 'high' && <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, flexShrink: 0 }}>HIGH</span>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Win / Loss Patterns */}
      {reality.winLossPatterns?.length > 0 && (
        <SectionCard title="Win / Loss Patterns" accentColor="#DC2626">
          <Table
            headers={['Pattern', 'When We Win', 'When We Lose', 'Poor-Fit Wins']}
            rows={reality.winLossPatterns.map((p) => [p.pattern, p.wins, p.losses, p.shouldNotWin ?? '—'])}
          />
        </SectionCard>
      )}

      {/* Core Patterns */}
      <SectionCard title="Core Patterns" subtitle="The essential commercial truth" accentColor="#DC2626">
        {[
          { label: 'Where We Win & Why', value: reality.corePatterns.whereWeWinAndWhy },
          { label: 'Where We Lose & Why', value: reality.corePatterns.whereWeLoseAndWhy },
          { label: 'Where We Are Inconsistent', value: reality.corePatterns.whereWeAreInconsistent },
        ].map(({ label, value }) => (
          <div key={label} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #F3F4F6' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 14, color: '#111827', lineHeight: 1.6 }}>{value || '—'}</p>
          </div>
        ))}
      </SectionCard>

      {/* Delivery Contradictions */}
      {reality.deliveryContradictions?.length > 0 && (
        <SectionCard title="Delivery Contradictions" subtitle="Where the sale and the delivery don't match" accentColor="#DC2626">
          <Table
            headers={['Sold', 'Delivered', 'Gap', 'Impact']}
            rows={reality.deliveryContradictions.map((d) => [d.sold, d.delivered, d.gap, d.impact])}
          />
        </SectionCard>
      )}

      {/* Deal Flow Reality */}
      {reality.dealFlowReality?.stages?.length > 0 && (
        <SectionCard title="Deal Flow Reality" subtitle={reality.dealFlowReality.summary} accentColor="#DC2626">
          {reality.dealFlowReality.stages.map((s, i) => (
            <div key={i} style={{ marginBottom: 16, padding: 14, background: '#F9FAFB', borderRadius: 8 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: '#111827' }}>{s.stage}</p>
              {s.stallPoints?.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Stall Points: </span>
                  <span style={{ fontSize: 12, color: '#374151' }}>{s.stallPoints.join(' · ')}</span>
                </div>
              )}
              {s.trustDropPoints?.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>Trust Drop: </span>
                  <span style={{ fontSize: 12, color: '#374151' }}>{s.trustDropPoints.join(' · ')}</span>
                </div>
              )}
              {s.reshapingPoints?.length > 0 && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Reshaping: </span>
                  <span style={{ fontSize: 12, color: '#374151' }}>{s.reshapingPoints.join(' · ')}</span>
                </div>
              )}
            </div>
          ))}
        </SectionCard>
      )}

      {/* Implicit ICP patterns */}
      {reality.implicitIcpPatterns?.length > 0 && (
        <SectionCard title="Implicit ICP Patterns" subtitle="What the win/loss patterns reveal about who you're really for" accentColor="#DC2626">
          <BulletList items={reality.implicitIcpPatterns} />
        </SectionCard>
      )}
    </div>
  );
}

// ── Phase 2: Ideal State ──────────────────────────────────────────────────────

export function GtmIdealStateBlock({ idealState }: { idealState: GtmIdealState }) {
  return (
    <div>
      {/* North Star + End Point */}
      <SectionCard title="North Star" accentColor="#059669">
        <div style={{ background: '#ECFDF5', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#065F46', lineHeight: 1.5 }}>
            {idealState.northStar}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'Business End State', value: idealState.endPoint.desiredBusinessEndState },
            { label: 'Growth / Exit Logic', value: idealState.endPoint.growthOrExitLogic },
            { label: 'Value Creation Logic', value: idealState.endPoint.valueCreationLogic },
            { label: 'Commercial Conditions', value: idealState.endPoint.whatMustBeTrueCommercially },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: 14, background: '#F9FAFB', borderRadius: 8 }}>
              <p style={{ margin: '0 0 4px 0', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#111827', lineHeight: 1.5 }}>{value || '—'}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ICP Definition */}
      <SectionCard title="ICP Definition" subtitle="Explicit: who you are for and who you are not" accentColor="#059669">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <p style={{ margin: '0 0 12px 0', fontSize: 12, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', background: '#D1FAE5', padding: '6px 12px', borderRadius: 6 }}>We Are For</p>
            {Object.entries(idealState.icpDefinition.weAreFor).map(([key, val]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 2px 0', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'capitalize' }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#111827', lineHeight: 1.5 }}>{val || '—'}</p>
              </div>
            ))}
          </div>
          <div>
            <p style={{ margin: '0 0 12px 0', fontSize: 12, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', background: '#FEE2E2', padding: '6px 12px', borderRadius: 6 }}>We Are NOT For</p>
            {Object.entries(idealState.icpDefinition.weAreNotFor).map(([key, val]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 2px 0', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'capitalize' }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#111827', lineHeight: 1.5 }}>{val || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Proposition Card */}
      <SectionCard title="Proposition" subtitle="What you do, for whom, and why they buy" accentColor="#059669">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'We Help', value: idealState.propositionCard.weHelp },
            { label: 'Solve', value: idealState.propositionCard.solve },
            { label: 'By', value: idealState.propositionCard.by },
            { label: 'So That', value: idealState.propositionCard.soThat },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: 14, background: '#ECFDF5', borderRadius: 8 }}>
              <p style={{ margin: '0 0 4px 0', fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</p>
              <p style={{ margin: 0, fontSize: 14, color: '#065F46', lineHeight: 1.5, fontWeight: 500 }}>{value || '—'}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Target Segments */}
      {idealState.targetSegments?.length > 0 && (
        <SectionCard title="Target Segments" subtitle="Repeatable market clusters" accentColor="#059669">
          {idealState.targetSegments.map((s, i) => (
            <div key={i} style={{ padding: 14, background: '#F9FAFB', borderRadius: 8, marginBottom: 10 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.segmentName}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12 }}>
                <div><span style={{ color: '#6B7280', fontWeight: 600 }}>Problem: </span><span style={{ color: '#374151' }}>{s.problemType}</span></div>
                <div><span style={{ color: '#6B7280', fontWeight: 600 }}>Buyer: </span><span style={{ color: '#374151' }}>{s.buyerType}</span></div>
                <div><span style={{ color: '#6B7280', fontWeight: 600 }}>Trigger: </span><span style={{ color: '#374151' }}>{s.triggerEvent}</span></div>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#059669' }}>
                <strong>Why we win: </strong>{s.whyWeWin}
              </p>
            </div>
          ))}
        </SectionCard>
      )}

      {/* Sellable / Deliverable Overlap */}
      <SectionCard title="Sellable vs Deliverable" subtitle="The sweet spot — and where misalignment lives" accentColor="#059669">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div style={{ padding: 14, background: '#FEF3C7', borderRadius: 8 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Sellable Only</p>
            <BulletList items={idealState.sellableDeliverableOverlap.sellableOnly} color="#92400E" />
          </div>
          <div style={{ padding: 14, background: '#ECFDF5', borderRadius: 8 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>✓ Both</p>
            <BulletList items={idealState.sellableDeliverableOverlap.sellableAndDeliverable} color="#065F46" />
          </div>
          <div style={{ padding: 14, background: '#EFF6FF', borderRadius: 8 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>Deliverable Only</p>
            <BulletList items={idealState.sellableDeliverableOverlap.deliverableOnly} color="#1E40AF" />
          </div>
        </div>
      </SectionCard>

      {/* Partner Ownership Model */}
      <SectionCard title="Partner Ownership Model" subtitle="Owned, shared, or dependent" accentColor="#059669">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div style={{ padding: 14, background: '#ECFDF5', borderRadius: 8 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>Owned</p>
            <BulletList items={idealState.partnerOwnershipModel.owned} color="#065F46" />
          </div>
          <div style={{ padding: 14, background: '#FEF3C7', borderRadius: 8 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Shared</p>
            <BulletList items={idealState.partnerOwnershipModel.shared} color="#92400E" />
          </div>
          <div style={{ padding: 14, background: '#FEE2E2', borderRadius: 8 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>Dependent ⚠</p>
            <BulletList items={idealState.partnerOwnershipModel.dependent} color="#991B1B" />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Phase 3: Constraints ──────────────────────────────────────────────────────

export function GtmConstraintsBlock({ constraints }: { constraints: GtmConstraints }) {
  const riskDimensions: [string, GtmRiskColour][] = [
    ['Buyer Trust', constraints.failureExposure.buyerTrust],
    ['Delivery Confidence', constraints.failureExposure.deliveryConfidence],
    ['Commercial Viability', constraints.failureExposure.commercialViability],
    ['Technology Proof', constraints.failureExposure.technologyProof],
    ['Partner Dependency', constraints.failureExposure.partnerDependency],
    ['Risk Position', constraints.failureExposure.riskPosition],
  ];

  return (
    <div>
      {/* Constraint Summary */}
      <SectionCard title="Constraint Diagnosis" accentColor="#7C3AED">
        <p style={{ margin: 0, color: '#374151', fontSize: 14, lineHeight: 1.7 }}>{constraints.constraintSummary}</p>
      </SectionCard>

      {/* Failure Exposure */}
      <SectionCard title="Failure Exposure" subtitle="Risk assessment across GTM dimensions" accentColor="#7C3AED">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {riskDimensions.map(([label, colour]) => (
            <div key={label} style={{ padding: 14, background: '#F9FAFB', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</p>
              <RiskBadge colour={colour} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Constraint Stack */}
      {constraints.constraintStack?.length > 0 && (
        <SectionCard title="Constraint Stack" subtitle="Blockers by lens, ordered from hardest to softest" accentColor="#7C3AED">
          {constraints.constraintStack.map((cs, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <LensPill lens={cs.lens} />
              </div>
              {cs.blockers.map((b, j) => (
                <div key={j} style={{
                  padding: 12, background: b.severity === 'critical' ? '#FEF2F2' : b.severity === 'significant' ? '#FEF3C7' : '#F9FAFB',
                  borderRadius: 8, marginBottom: 8, borderLeft: `3px solid ${b.severity === 'critical' ? '#DC2626' : b.severity === 'significant' ? '#F59E0B' : '#D1D5DB'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>{b.title}</p>
                    <span style={{ fontSize: 11, fontWeight: 700, color: b.severity === 'critical' ? '#DC2626' : b.severity === 'significant' ? '#D97706' : '#6B7280', flexShrink: 0, marginLeft: 8 }}>
                      {b.severity.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{b.description}</p>
                </div>
              ))}
            </div>
          ))}
        </SectionCard>
      )}

      {/* Contradiction Map */}
      {constraints.contradictionMap?.length > 0 && (
        <SectionCard title="Contradiction Map" subtitle="Where the ideal state conflicts with current reality" accentColor="#7C3AED">
          <Table
            headers={['Target State Requires', 'Current Reality', 'Conflict']}
            rows={constraints.contradictionMap.map((c) => [c.target, c.reality, c.conflict])}
          />
        </SectionCard>
      )}

      {/* Trade-Off Map */}
      {constraints.tradeOffMap?.length > 0 && (
        <SectionCard title="Required Trade-Offs" subtitle="What must be given up for the GTM to change" accentColor="#7C3AED">
          <Table
            headers={['Keep', 'Stop / Lose', 'Commercial Consequence']}
            rows={constraints.tradeOffMap.map((t) => [t.keep, t.lose, t.commercialConsequence])}
          />
        </SectionCard>
      )}

      {/* Dependency Map */}
      {constraints.dependencyMap?.length > 0 && (
        <SectionCard title="Dependency Risks" subtitle="Fragile, unproven, or over-relied-upon dependencies" accentColor="#7C3AED">
          {constraints.dependencyMap.map((d, i) => (
            <div key={i} style={{ padding: 12, background: '#F9FAFB', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>{d.name}</p>
                <Pill label={d.riskMarker.replace('_', ' ')} color="#FEE2E2" textColor="#991B1B" />
                <Pill label={d.type.replace(/_/g, ' ')} color="#EEF2FF" textColor="#4338CA" />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{d.description}</p>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  );
}

// ── Phase 4: Way Forward ──────────────────────────────────────────────────────

export function GtmWayForwardBlock({ wayForward }: { wayForward: GtmWayForward }) {
  return (
    <div>
      {/* Action Stack */}
      {wayForward.actionStack?.length > 0 && (
        <SectionCard title="Action Stack" subtitle={`${wayForward.actionStack.length} priority action${wayForward.actionStack.length > 1 ? 's' : ''} — maximum 5`} accentColor="#1D4ED8">
          {wayForward.actionStack.slice(0, 5).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: 16, background: '#F8FAFF', borderRadius: 10, marginBottom: 10, borderLeft: `4px solid ${i === 0 ? '#1D4ED8' : '#93C5FD'}` }}>
              <div style={{ flexShrink: 0, width: 28, height: 28, background: '#1D4ED8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 700 }}>{a.priority}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>{a.action}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Owner: </span>
                    <span style={{ fontSize: 12, color: '#374151' }}>{a.owner}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Linked to: </span>
                    <span style={{ fontSize: 12, color: '#374151' }}>{a.linkedConstraint}</span>
                  </div>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#1D4ED8' }}>
                  <strong>Testable outcome: </strong>{a.testableOutcome}
                </p>
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* GTM Activation */}
      {wayForward.gtmActivation?.length > 0 && (
        <SectionCard title="GTM Activation" subtitle="Before and after — what changes in live deals" accentColor="#1D4ED8">
          <Table
            headers={['Current Behaviour (Before)', 'Required Behaviour (After)', 'Expected Signal']}
            rows={wayForward.gtmActivation.map((a) => [a.before, a.after, a.expectedSignal])}
          />
        </SectionCard>
      )}

      {/* ICP Enforcement Tool */}
      <SectionCard title="ICP Enforcement Tool" subtitle="Binary filter — pursue vs reject" accentColor="#1D4ED8">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ padding: 16, background: '#ECFDF5', borderRadius: 8 }}>
            <p style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>✓ Pursue — all must be true</p>
            <BulletList items={wayForward.icpEnforcementTool.pursueCriteria} color="#065F46" />
          </div>
          <div style={{ padding: 16, background: '#FEF2F2', borderRadius: 8 }}>
            <p style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>✗ Reject — any one = out</p>
            <BulletList items={wayForward.icpEnforcementTool.rejectCriteria} color="#991B1B" />
          </div>
        </div>
        {wayForward.icpEnforcementTool.exceptionRules?.length > 0 && (
          <div style={{ padding: 14, background: '#FEF3C7', borderRadius: 8 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Exception Rules</p>
            <BulletList items={wayForward.icpEnforcementTool.exceptionRules} color="#92400E" />
          </div>
        )}
      </SectionCard>

      {/* Delivery Fix Map */}
      {wayForward.deliveryFixMap?.length > 0 && (
        <SectionCard title="Delivery Fix Map" subtitle="Stop selling what can't be delivered" accentColor="#1D4ED8">
          <Table
            headers={['Promise', 'Current Capability', 'Required Fix', 'Recommendation']}
            rows={wayForward.deliveryFixMap.map((d) => [
              d.promise, d.currentCapability, d.requiredFix,
              <Pill
                key={d.promise}
                label={d.sellOrStop === 'sell' ? 'SELL' : d.sellOrStop === 'stop' ? 'STOP' : 'FIX FIRST'}
                color={d.sellOrStop === 'sell' ? '#D1FAE5' : d.sellOrStop === 'stop' ? '#FEE2E2' : '#FEF3C7'}
                textColor={d.sellOrStop === 'sell' ? '#065F46' : d.sellOrStop === 'stop' ? '#991B1B' : '#92400E'}
              />
            ])}
          />
        </SectionCard>
      )}

      {/* Sequence Map */}
      {wayForward.sequenceMap?.length > 0 && (
        <SectionCard title="Sequence Map" subtitle="What must happen first and what each move unlocks" accentColor="#1D4ED8">
          {wayForward.sequenceMap.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, background: '#1D4ED8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 700 }}>{s.step}</span>
                </div>
                {i < (wayForward.sequenceMap.length - 1) && (
                  <div style={{ width: 2, flex: 1, background: '#DBEAFE', minHeight: 20, marginTop: 4 }} />
                )}
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 600, color: '#111827' }}>{s.action}</p>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  <span style={{ marginRight: 12 }}><strong>Owner:</strong> {s.owner}</span>
                  <span><strong>Unlocks:</strong> {s.unlock}</span>
                </div>
                {s.dependency && <p style={{ margin: '3px 0 0 0', fontSize: 11, color: '#9CA3AF' }}>Requires: {s.dependency}</p>}
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* Failure Pre-mortem */}
      {wayForward.failurePremortem?.length > 0 && (
        <SectionCard title="Failure Pre-mortem" subtitle="Where the way forward will stall — and how to prevent it" accentColor="#1D4ED8">
          {wayForward.failurePremortem.map((f, i) => (
            <div key={i} style={{ padding: 14, background: '#FEF2F2', borderRadius: 8, marginBottom: 8 }}>
              <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 700, color: '#DC2626' }}>{f.failurePoint}</p>
              <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#991B1B' }}><strong>Why:</strong> {f.whyItWillHappen}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#065F46' }}><strong>Prevention:</strong> {f.preventionAction}</p>
            </div>
          ))}
        </SectionCard>
      )}

      {/* Success Signals */}
      <SectionCard title="Success Signals" subtitle="Observable indicators at 30 / 60 / 90 days" accentColor="#1D4ED8">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {[
            { label: '30 Days', items: wayForward.successSignals.thirtyDays, bg: '#F0FDF4' },
            { label: '60 Days', items: wayForward.successSignals.sixtyDays, bg: '#ECFDF5' },
            { label: '90 Days', items: wayForward.successSignals.ninetyDays, bg: '#D1FAE5' },
          ].map(({ label, items, bg }) => (
            <div key={label} style={{ padding: 14, background: bg, borderRadius: 8 }}>
              <p style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>{label}</p>
              <BulletList items={items} color="#065F46" />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Risk Shift Map */}
      {wayForward.riskShiftMap?.length > 0 && (
        <SectionCard title="Risk Shift Map" subtitle="Move risk earlier in the deal cycle" accentColor="#1D4ED8">
          <Table
            headers={['Late-Stage Risk', 'Early-Stage Control', 'Owner']}
            rows={wayForward.riskShiftMap.map((r) => [r.lateStageRisk, r.earlyStageControl, r.owner])}
          />
        </SectionCard>
      )}

      {/* Partner Action Map */}
      {(wayForward.partnerActionMap.keep.length > 0 ||
        wayForward.partnerActionMap.fix.length > 0 ||
        wayForward.partnerActionMap.remove.length > 0) && (
        <SectionCard title="Partner Actions" subtitle="Keep, fix, or remove" accentColor="#1D4ED8">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div style={{ padding: 14, background: '#ECFDF5', borderRadius: 8 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>Keep</p>
              <BulletList items={wayForward.partnerActionMap.keep} color="#065F46" />
            </div>
            <div style={{ padding: 14, background: '#FEF3C7', borderRadius: 8 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Fix</p>
              <BulletList items={wayForward.partnerActionMap.fix} color="#92400E" />
            </div>
            <div style={{ padding: 14, background: '#FEE2E2', borderRadius: 8 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>Remove</p>
              <BulletList items={wayForward.partnerActionMap.remove} color="#991B1B" />
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Master GTM Report View ────────────────────────────────────────────────────

export function GtmReportView({ intelligence }: { intelligence: GtmOutputIntelligence }) {
  const phases = [
    { id: 'executive', label: 'Executive View' },
    { id: 'reality', label: 'Phase 1 — Reality' },
    { id: 'idealstate', label: 'Phase 2 — Ideal State' },
    { id: 'constraints', label: 'Phase 3 — Constraints' },
    { id: 'wayforward', label: 'Phase 4 — Way Forward' },
  ];

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 4px' }}>
      {/* Phase nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {phases.map((p) => (
          <a key={p.id} href={`#gtm-${p.id}`} style={{
            display: 'inline-block', padding: '6px 14px', background: '#F3F4F6',
            color: '#374151', borderRadius: 20, fontSize: 12, fontWeight: 600,
            textDecoration: 'none', border: '1px solid #E5E7EB',
          }}>
            {p.label}
          </a>
        ))}
      </div>

      <div id="gtm-executive"><GtmExecutiveBlock view={intelligence.executiveView} /></div>

      <div id="gtm-reality">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '32px 0 16px 0', paddingTop: 8, borderTop: '2px solid #F3F4F6' }}>
          Phase 1 — Reality Map
        </h2>
        <GtmRealityBlock reality={intelligence.realityMap} />
      </div>

      <div id="gtm-idealstate">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '32px 0 16px 0', paddingTop: 8, borderTop: '2px solid #F3F4F6' }}>
          Phase 2 — Ideal State
        </h2>
        <GtmIdealStateBlock idealState={intelligence.idealState} />
      </div>

      <div id="gtm-constraints">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '32px 0 16px 0', paddingTop: 8, borderTop: '2px solid #F3F4F6' }}>
          Phase 3 — Constraints
        </h2>
        <GtmConstraintsBlock constraints={intelligence.constraints} />
      </div>

      <div id="gtm-wayforward">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '32px 0 16px 0', paddingTop: 8, borderTop: '2px solid #F3F4F6' }}>
          Phase 4 — Way Forward
        </h2>
        <GtmWayForwardBlock wayForward={intelligence.wayForward} />
      </div>
    </div>
  );
}
