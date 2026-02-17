import type { SalesReportData } from './sales-report-generator';

export function generateSalesReportHtml(report: SalesReportData): string {
  const { meetingSummary, keyDiscussionPoints, customerNeeds, solutionsDiscussed,
    objectionsAndConcerns, opportunityAssessment, actions, decisionTimeline,
    competitiveIntelligence, coachingNotes, planVsActual } = report;

  const dealHealthColor = {
    Hot: '#22c55e', Warm: '#eab308', Cool: '#3b82f6', Cold: '#6b7280',
  }[opportunityAssessment.dealHealth] || '#6b7280';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; line-height: 1.5; padding: 40px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
  h3 { font-size: 14px; margin: 16px 0 8px; color: #4b5563; }
  .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
  .deal-health { display: inline-block; padding: 4px 16px; border-radius: 16px; color: white; font-weight: 600; font-size: 18px; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 16px; }
  .summary-grid .label { color: #6b7280; }
  .summary-grid .value { font-weight: 500; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0; }
  th { text-align: left; padding: 8px; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #4b5563; }
  td { padding: 8px; border-bottom: 1px solid #f3f4f6; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 500; }
  .badge-critical { background: #fecaca; color: #991b1b; }
  .badge-high { background: #fed7aa; color: #9a3412; }
  .badge-medium { background: #fef3c7; color: #92400e; }
  .badge-low { background: #e5e7eb; color: #374151; }
  .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 8px 0; }
  .check { color: #22c55e; } .cross { color: #ef4444; }
  .section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  ul { padding-left: 20px; font-size: 13px; }
  li { margin: 4px 0; }
  .page-break { page-break-before: always; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>

<h1>Sales Call Report</h1>
<p class="subtitle">${meetingSummary.customerName} &mdash; ${meetingSummary.opportunityName}</p>

<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
  <div class="summary-grid" style="flex: 1;">
    <span class="label">Date:</span><span class="value">${meetingSummary.date}</span>
    <span class="label">Duration:</span><span class="value">${meetingSummary.duration}</span>
    <span class="label">Deal Stage:</span><span class="value">${meetingSummary.dealStage}</span>
    <span class="label">Speakers:</span><span class="value">${meetingSummary.speakers.length}</span>
  </div>
  <div style="text-align: center;">
    <div class="deal-health" style="background: ${dealHealthColor};">${opportunityAssessment.dealHealth}</div>
    <p style="font-size: 11px; color: #6b7280; margin-top: 4px;">Deal Health</p>
  </div>
</div>

<p style="font-size: 13px; color: #4b5563; margin-bottom: 24px;">${opportunityAssessment.reasoning}</p>

<h2>Key Discussion Points</h2>
${keyDiscussionPoints.map((p) => `
<div class="card">
  <span class="badge badge-medium">${p.category}</span>
  <strong style="margin-left: 8px;">${p.topic}</strong>
  <p style="font-size: 13px; color: #4b5563; margin-top: 4px;">${p.summary}</p>
</div>`).join('')}

<h2>Customer Needs &amp; Pain Points</h2>
${customerNeeds.map((n) => `
<div class="card">
  <span class="badge badge-${n.priority === 'high' ? 'critical' : n.priority === 'medium' ? 'medium' : 'low'}">${n.priority}</span>
  <strong style="margin-left: 8px;">${n.need}</strong>
  <p style="font-size: 12px; color: #6b7280; font-style: italic; margin-top: 4px;">"${n.evidence}"</p>
</div>`).join('')}

<div class="section-grid">
<div>
<h2>Solutions Discussed</h2>
${solutionsDiscussed.map((s) => `
<div class="card">
  <strong>${s.solution}</strong>
  <p style="font-size: 13px; color: #4b5563;">${s.customerReaction}</p>
</div>`).join('')}
</div>
<div>
<h2>Objections &amp; Concerns</h2>
${objectionsAndConcerns.map((o) => `
<div class="card">
  <span class="${o.resolved ? 'check' : 'cross'}">${o.resolved ? '&#10003;' : '&#10007;'}</span>
  <strong style="margin-left: 4px;">${o.objection}</strong>
  <p style="font-size: 13px; color: #4b5563;">${o.howHandled}</p>
</div>`).join('')}
</div>
</div>

<h2>Actions &amp; Next Steps</h2>
<table>
<thead><tr><th>#</th><th>Action</th><th>Owner</th><th>Deadline</th><th>Priority</th></tr></thead>
<tbody>
${actions.map((a, i) => `
<tr>
  <td>${i + 1}</td>
  <td>${a.action}</td>
  <td>${a.owner}</td>
  <td>${a.deadline}</td>
  <td><span class="badge badge-${a.priority.toLowerCase()}">${a.priority}</span></td>
</tr>`).join('')}
</tbody>
</table>

<h2>Decision Timeline</h2>
<p style="font-size: 13px;">${decisionTimeline}</p>

${competitiveIntelligence.length > 0 ? `
<h2>Competitive Intelligence</h2>
${competitiveIntelligence.map((c) => `
<div class="card">
  <strong>${c.competitor}</strong>
  <p style="font-size: 13px; color: #4b5563;">${c.context}</p>
</div>`).join('')}
` : ''}

${planVsActual.objectivesCovered.length > 0 ? `
<h2>Plan vs. Actual</h2>
<h3>Objectives</h3>
<ul>
${planVsActual.objectivesCovered.map((o) => `
<li><span class="${o.covered ? 'check' : 'cross'}">${o.covered ? '&#10003;' : '&#10007;'}</span> ${o.objective}${o.evidence ? ` &mdash; ${o.evidence}` : ''}</li>
`).join('')}
</ul>
${planVsActual.missedItems.length > 0 ? `
<h3 style="color: #dc2626;">Missed Items</h3>
<ul>${planVsActual.missedItems.map((m) => `<li>${m}</li>`).join('')}</ul>
` : ''}
${planVsActual.unexpectedTopics.length > 0 ? `
<h3>Unexpected Topics</h3>
<ul>${planVsActual.unexpectedTopics.map((t) => `<li>${t}</li>`).join('')}</ul>
` : ''}
` : ''}

${coachingNotes.length > 0 ? `
<h2>Coaching Notes</h2>
<ul>${coachingNotes.map((n) => `<li>&#9733; ${n}</li>`).join('')}</ul>
` : ''}

<div class="footer">
  Generated by Sales Call Intelligence &mdash; ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
</div>

</body>
</html>`;
}
