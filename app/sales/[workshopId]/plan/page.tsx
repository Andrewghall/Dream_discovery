'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Sparkles, Mic, FileText, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';

const DEAL_STAGES = [
  'Discovery',
  'Qualification',
  'Demo',
  'Proposal',
  'Negotiation',
  'Close',
  'Renewal',
];

interface MeetingPlanData {
  // The Opportunity
  customerName: string;
  industry: string;
  companySize: string;
  opportunityName: string;
  estimatedValue: string;
  dealStage: string;
  opportunityOrigin: string;
  crmLink: string;
  // Why This Meeting
  meetingIntent: string;
  meetingTrigger: string;
  salesProcessPosition: string;
  requiredNextStep: string;
  // The Goal
  primaryGoal: string;
  secondaryGoals: string;
  endInMind: string;
  minimumOutcome: string;
  definitionOfFailure: string;
  // The People
  ourAttendees: string;
  theirAttendees: string;
  keyDecisionMaker: string;
  keyInfluencer: string;
  champion: string;
  blocker: string;
  // The Customer's World
  knownPainPoints: string;
  currentSolution: string;
  businessDrivers: string;
  successCriteria: string;
  budget: string;
  timeline: string;
  internalPolitics: string;
  // Our Position
  solutionsToDiscuss: string;
  valueProposition: string;
  keyDifferentiators: string;
  proofPoints: string;
  pricingApproach: string;
  // The Competition
  knownCompetitors: string;
  ourStrengths: string;
  ourWeaknesses: string;
  customerSaidAboutAlternatives: string;
  competitiveTraps: string;
  // Anticipated Objections
  anticipatedObjections: string;
  commonStalls: string;
  technicalConcerns: string;
  pricingObjections: string;
  // Must-Ask Questions
  discoveryQuestions: string;
  qualificationQuestions: string;
  hiddenConcernQuestions: string;
  dealAdvanceQuestions: string;
  // Approach & Strategy
  openingApproach: string;
  agendaSuggestion: string;
  keyTalkingPoints: string;
  storiesAnalogies: string;
  presentVsListen: string;
  handleSilence: string;
  closingApproach: string;
  // AI generated (structured agentic strategy)
  generatedStrategy?: {
    gapAnalysis: Array<{ field: string; issue: string; severity: 'critical' | 'warning' | 'info' }>;
    strategy: {
      meetingObjective: string;
      openingApproach: string;
      keyTalkingPoints: Array<{ point: string; priority: number; reasoning: string }>;
      mustAskQuestions: Array<{ question: string; reasoning: string; whenToAsk: string }>;
      objectionHandling: Array<{ objection: string; response: string; triggerPhrase: string }>;
      competitivePositioning: string;
      idealOutcome: string;
      fallbackPosition: string;
      redFlags: string[];
    };
    planReadiness: { score: number; summary: string };
    agentReasoning: string;
  } | string; // string for backward compat with old format
}

const DEFAULT_PLAN: MeetingPlanData = {
  customerName: '', industry: '', companySize: '', opportunityName: '',
  estimatedValue: '', dealStage: '', opportunityOrigin: '', crmLink: '',
  meetingIntent: '', meetingTrigger: '', salesProcessPosition: '', requiredNextStep: '',
  primaryGoal: '', secondaryGoals: '', endInMind: '', minimumOutcome: '', definitionOfFailure: '',
  ourAttendees: '', theirAttendees: '', keyDecisionMaker: '', keyInfluencer: '', champion: '', blocker: '',
  knownPainPoints: '', currentSolution: '', businessDrivers: '', successCriteria: '',
  budget: '', timeline: '', internalPolitics: '',
  solutionsToDiscuss: '', valueProposition: '', keyDifferentiators: '', proofPoints: '', pricingApproach: '',
  knownCompetitors: '', ourStrengths: '', ourWeaknesses: '', customerSaidAboutAlternatives: '', competitiveTraps: '',
  anticipatedObjections: '', commonStalls: '', technicalConcerns: '', pricingObjections: '',
  discoveryQuestions: '', qualificationQuestions: '', hiddenConcernQuestions: '', dealAdvanceQuestions: '',
  openingApproach: '', agendaSuggestion: '', keyTalkingPoints: '', storiesAnalogies: '',
  presentVsListen: '', handleSilence: '', closingApproach: '',
};

type AgenticStrategy = NonNullable<Exclude<MeetingPlanData['generatedStrategy'], string>>;

function StructuredStrategyView({ strategy, onRegenerate, generating }: {
  strategy: AgenticStrategy;
  onRegenerate: () => void;
  generating: boolean;
}) {
  const s = strategy.strategy;
  const criticalGaps = strategy.gapAnalysis.filter(g => g.severity === 'critical');
  const warningGaps = strategy.gapAnalysis.filter(g => g.severity === 'warning');
  const infoGaps = strategy.gapAnalysis.filter(g => g.severity === 'info');
  const readinessColor = strategy.planReadiness.score >= 75 ? 'text-green-600' : strategy.planReadiness.score >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Readiness Score + Gap Analysis */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Plan Readiness
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${readinessColor}`}>{strategy.planReadiness.score}/100</span>
              <Button onClick={onRegenerate} disabled={generating} variant="outline" size="sm">
                <Sparkles className="h-3 w-3 mr-1" />
                {generating ? 'Regenerating...' : 'Regenerate'}
              </Button>
            </div>
          </div>
          <CardDescription>{strategy.planReadiness.summary}</CardDescription>
        </CardHeader>
        {strategy.gapAnalysis.length > 0 && (
          <CardContent className="space-y-2">
            {criticalGaps.map((g, i) => (
              <div key={`c-${i}`} className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-3">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm"><strong>{g.field}:</strong> {g.issue}</div>
              </div>
            ))}
            {warningGaps.map((g, i) => (
              <div key={`w-${i}`} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm"><strong>{g.field}:</strong> {g.issue}</div>
              </div>
            ))}
            {infoGaps.map((g, i) => (
              <div key={`i-${i}`} className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-md p-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm"><strong>{g.field}:</strong> {g.issue}</div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Meeting Objective */}
      <Card>
        <CardHeader><CardTitle>Meeting Objective</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm bg-purple-50 border border-purple-200 rounded-lg p-4">{s.meetingObjective}</p>
        </CardContent>
      </Card>

      {/* Opening Approach */}
      <Card>
        <CardHeader><CardTitle>Opening Approach</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">{s.openingApproach}</p>
        </CardContent>
      </Card>

      {/* Key Talking Points */}
      {s.keyTalkingPoints.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Key Talking Points</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {s.keyTalkingPoints.sort((a, b) => a.priority - b.priority).map((tp, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">#{tp.priority}</Badge>
                  <span className="font-medium text-sm">{tp.point}</span>
                </div>
                <p className="text-sm text-muted-foreground">{tp.reasoning}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Must-Ask Questions */}
      {s.mustAskQuestions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Must-Ask Questions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {s.mustAskQuestions.map((q, i) => (
              <div key={i} className="border rounded-lg p-3">
                <p className="font-medium text-sm mb-1">{q.question}</p>
                <p className="text-sm text-muted-foreground">{q.reasoning}</p>
                <p className="text-xs text-purple-600 mt-1">When: {q.whenToAsk}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Objection Handling */}
      {s.objectionHandling.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Objection Handling</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {s.objectionHandling.map((obj, i) => (
              <div key={i} className="border rounded-lg p-3">
                <p className="font-medium text-sm text-red-700 mb-1">{obj.objection}</p>
                <p className="text-sm mb-1">{obj.response}</p>
                <p className="text-xs text-muted-foreground italic">Trigger: &quot;{obj.triggerPhrase}&quot;</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Competitive Positioning */}
      {s.competitivePositioning && (
        <Card>
          <CardHeader><CardTitle>Competitive Positioning</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{s.competitivePositioning}</p></CardContent>
        </Card>
      )}

      {/* Outcomes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-green-700">Ideal Outcome</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{s.idealOutcome}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-amber-700">Fallback Position</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{s.fallbackPosition}</p></CardContent>
        </Card>
      </div>

      {/* Red Flags */}
      {s.redFlags.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-red-700">Red Flags to Watch</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {s.redFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  {flag}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Agent Reasoning (collapsible) */}
      {strategy.agentReasoning && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Agent Reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{strategy.agentReasoning}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MeetingPlanPage() {
  const router = useRouter();
  const params = useParams();
  const workshopId = params.workshopId as string;

  const [plan, setPlan] = useState<MeetingPlanData>(DEFAULT_PLAN);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('opportunity');

  useEffect(() => {
    fetch(`/api/sales/${workshopId}/plan`)
      .then((r) => r.json())
      .then((data) => {
        if (data.meetingPlan && Object.keys(data.meetingPlan).length > 0) {
          setPlan({ ...DEFAULT_PLAN, ...data.meetingPlan });
        }
      })
      .catch(console.error);
  }, [workshopId]);

  const updateField = useCallback((field: keyof MeetingPlanData, value: string) => {
    setPlan((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const savePlan = async () => {
    setSaving(true);
    try {
      await fetch(`/api/sales/${workshopId}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingPlan: plan }),
      });
      setSaved(true);
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save meeting plan');
    } finally {
      setSaving(false);
    }
  };

  const generateStrategy = async () => {
    setGenerating(true);
    try {
      // Save first
      await fetch(`/api/sales/${workshopId}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingPlan: plan }),
      });
      // Generate
      const res = await fetch(`/api/sales/${workshopId}/plan`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else if (data.strategy) {
        setPlan((prev) => ({ ...prev, generatedStrategy: data.strategy }));
        setActiveTab('strategy');
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to generate strategy');
    } finally {
      setGenerating(false);
    }
  };

  type StringFields = Exclude<keyof MeetingPlanData, 'generatedStrategy'>;

  const renderInput = (field: StringFields, label: string, placeholder?: string) => (
    <div className="space-y-1.5" key={field}>
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        value={(plan[field] as string) || ''}
        onChange={(e) => updateField(field, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const renderTextarea = (field: StringFields, label: string, placeholder?: string, rows = 3) => (
    <div className="space-y-1.5" key={field}>
      <Label className="text-sm font-medium">{label}</Label>
      <Textarea
        value={(plan[field] as string) || ''}
        onChange={(e) => updateField(field, e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Sales Call Planner</h1>
              <p className="text-sm text-muted-foreground">Plan your meeting, then start the live call</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={savePlan} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save Plan'}
            </Button>
            <Button onClick={generateStrategy} disabled={generating} variant="secondary">
              <Sparkles className="h-4 w-4 mr-2" />
              {generating ? 'Generating...' : 'Generate Strategy'}
            </Button>
            <Button onClick={() => { savePlan().then(() => router.push(`/sales/${workshopId}/live`)); }}>
              <Mic className="h-4 w-4 mr-2" />
              Start Call
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 lg:grid-cols-10 w-full mb-6">
            <TabsTrigger value="opportunity">Opportunity</TabsTrigger>
            <TabsTrigger value="why">Why</TabsTrigger>
            <TabsTrigger value="goal">Goal</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="customer">Customer</TabsTrigger>
            <TabsTrigger value="position">Our Position</TabsTrigger>
            <TabsTrigger value="competition">Competition</TabsTrigger>
            <TabsTrigger value="objections">Objections</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="strategy">
              <FileText className="h-3 w-3 mr-1" />
              Strategy
            </TabsTrigger>
          </TabsList>

          {/* THE OPPORTUNITY */}
          <TabsContent value="opportunity">
            <Card>
              <CardHeader>
                <CardTitle>The Opportunity</CardTitle>
                <CardDescription>Who are we meeting and what&apos;s the deal?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderInput("customerName", "Customer / Company Name", "Acme Corp")}
                  {renderInput("industry", "Industry", "Financial Services")}
                  {renderInput("companySize", "Company Size", "500-1000 employees")}
                  {renderInput("opportunityName", "Opportunity Name", "Acme CX Transformation")}
                  {renderInput("estimatedValue", "Estimated Deal Value", "$250,000")}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Deal Stage</Label>
                    <Select value={plan.dealStage} onValueChange={(v) => updateField('dealStage', v)}>
                      <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                      <SelectContent>
                        {DEAL_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {renderInput("opportunityOrigin", "How did this originate?", "Inbound from website / Referral / Outbound")}
                  {renderInput("crmLink", "CRM Link (optional)", "https://...")}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WHY THIS MEETING */}
          <TabsContent value="why">
            <Card>
              <CardHeader>
                <CardTitle>Why This Meeting</CardTitle>
                <CardDescription>Context for why this call is happening now</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderTextarea("meetingIntent", "Intent of the meeting", "Why is this call happening right now?", 3)}
                {renderTextarea("meetingTrigger", "What triggered it?", "What event or conversation led to this being booked?", 3)}
                {renderTextarea("salesProcessPosition", "Where are we in the sales process?", "What happened before this call?", 3)}
                {renderTextarea("requiredNextStep", "What must happen after this call?", "What needs to happen for the deal to progress?", 3)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* THE GOAL */}
          <TabsContent value="goal">
            <Card>
              <CardHeader>
                <CardTitle>The Goal</CardTitle>
                <CardDescription>What does success look like for this call?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderTextarea("primaryGoal", "Primary goal for this call", "What does success look like?", 3)}
                {renderTextarea("secondaryGoals", "Secondary goals", "What else do we want to achieve?", 3)}
                {renderTextarea("endInMind", "The 'end in mind'", "What specific outcome or commitment are we aiming for?", 3)}
                {renderTextarea("minimumOutcome", "Minimum acceptable outcome", "If we can't get the ideal, what's the fallback?", 3)}
                {renderTextarea("definitionOfFailure", "Definition of failure", "What would make this a wasted call?", 2)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* THE PEOPLE */}
          <TabsContent value="people">
            <Card>
              <CardHeader>
                <CardTitle>The People</CardTitle>
                <CardDescription>Who&apos;s in the room and what&apos;s their role?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderTextarea("ourAttendees", "Our attendees", "Names, roles, who leads, who supports", 3)}
                {renderTextarea("theirAttendees", "Their attendees", "Names, roles, seniority, decision-making authority", 3)}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderInput("keyDecisionMaker", "Key decision maker", "Who has final say?")}
                  {renderInput("keyInfluencer", "Key influencer", "Who shapes the DM's opinion?")}
                  {renderInput("champion", "Champion", "Our advocate on their side")}
                  {renderInput("blocker", "Blocker", "Who might resist or push back?")}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* THE CUSTOMER'S WORLD */}
          <TabsContent value="customer">
            <Card>
              <CardHeader>
                <CardTitle>The Customer&apos;s World</CardTitle>
                <CardDescription>What do we know about their situation?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderTextarea("knownPainPoints", "Known pain points & challenges", "What problems are they trying to solve?", 4)}
                {renderTextarea("currentSolution", "Current solution / setup", "What are they using today? Why isn't it working?", 3)}
                {renderTextarea("businessDrivers", "Business drivers", "What's pushing them to act now? (cost, growth, compliance, competitive pressure)", 3)}
                {renderTextarea("successCriteria", "Success criteria", "What does the customer need to see to say yes?", 3)}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderTextarea("budget", "Budget", "What do we know about budget, approval process, fiscal year?", 3)}
                  {renderTextarea("timeline", "Timeline", "When do they need a solution? When is the decision?", 3)}
                </div>
                {renderTextarea("internalPolitics", "Internal politics", "Anything we know about internal dynamics", 2)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* OUR POSITION */}
          <TabsContent value="position">
            <Card>
              <CardHeader>
                <CardTitle>Our Position</CardTitle>
                <CardDescription>What are we bringing to the table?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderTextarea("solutionsToDiscuss", "Solutions / products to discuss", "What are we proposing?", 3)}
                {renderTextarea("valueProposition", "Value proposition", "Why us? What's the core message?", 3)}
                {renderTextarea("keyDifferentiators", "Key differentiators", "What sets us apart from alternatives?", 3)}
                {renderTextarea("proofPoints", "Proof points", "Case studies, references, metrics we can cite", 3)}
                {renderTextarea("pricingApproach", "Pricing approach", "How will we handle pricing if it comes up?", 3)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* THE COMPETITION */}
          <TabsContent value="competition">
            <Card>
              <CardHeader>
                <CardTitle>The Competition</CardTitle>
                <CardDescription>Who else is in the picture?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderTextarea("knownCompetitors", "Known competitors in this deal", "Who are they also talking to?", 3)}
                {renderTextarea("ourStrengths", "Our strengths vs. each competitor", "Where we win", 3)}
                {renderTextarea("ourWeaknesses", "Our weaknesses vs. each competitor", "Where we're vulnerable", 3)}
                {renderTextarea("customerSaidAboutAlternatives", "What the customer has said about alternatives", "Any feedback on other vendors?", 3)}
                {renderTextarea("competitiveTraps", "Competitive traps to avoid", "Things competitors will say about us", 3)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ANTICIPATED OBJECTIONS */}
          <TabsContent value="objections">
            <Card>
              <CardHeader>
                <CardTitle>Anticipated Objections</CardTitle>
                <CardDescription>What pushback do we expect and how will we handle it?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderTextarea("anticipatedObjections", "Expected objections with prepared responses", "Objection 1: ... Response: ...\nObjection 2: ... Response: ...", 6)}
                {renderTextarea("commonStalls", "Common stalls", "'We need to think about it', 'Send me a proposal' — how to handle", 4)}
                {renderTextarea("technicalConcerns", "Technical concerns", "Technical objections and how to address them", 4)}
                {renderTextarea("pricingObjections", "Pricing / budget objections", "Price pushback and reframes", 4)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MUST-ASK QUESTIONS */}
          <TabsContent value="questions">
            <Card>
              <CardHeader>
                <CardTitle>Must-Ask Questions</CardTitle>
                <CardDescription>What do we absolutely need to find out?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderTextarea("discoveryQuestions", "Discovery questions", "Questions to understand their needs deeper", 4)}
                {renderTextarea("qualificationQuestions", "Qualification questions (BANT)", "Budget, Authority, Need, Timeline questions", 4)}
                {renderTextarea("hiddenConcernQuestions", "Questions to uncover hidden concerns", "What might they not be telling us?", 4)}
                {renderTextarea("dealAdvanceQuestions", "Questions to advance the deal", "Questions that move us toward the next step", 4)}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Approach & Strategy</CardTitle>
                <CardDescription>How will we run this call?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderTextarea("openingApproach", "Opening", "How do we start the conversation?", 3)}
                {renderTextarea("agendaSuggestion", "Agenda suggestion", "Proposed flow of the meeting", 3)}
                {renderTextarea("keyTalkingPoints", "Key talking points (priority order)", "1. ...\n2. ...\n3. ...", 4)}
                {renderTextarea("storiesAnalogies", "Stories / analogies to use", "Relevant stories or comparisons", 3)}
                {renderTextarea("presentVsListen", "When to present vs. when to listen", "Balance of talking vs. listening", 2)}
                {renderTextarea("handleSilence", "How to handle silence", "What to do if they go quiet", 2)}
                {renderTextarea("closingApproach", "Closing approach", "How do we ask for the next step?", 3)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI GENERATED STRATEGY */}
          <TabsContent value="strategy">
            {plan.generatedStrategy && typeof plan.generatedStrategy === 'object' ? (
              <StructuredStrategyView
                strategy={plan.generatedStrategy}
                onRegenerate={generateStrategy}
                generating={generating}
              />
            ) : plan.generatedStrategy && typeof plan.generatedStrategy === 'string' ? (
              /* Backward compat: old markdown format */
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    AI Meeting Strategy Brief
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 whitespace-pre-wrap text-sm leading-relaxed">
                    {plan.generatedStrategy}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={generateStrategy} disabled={generating} variant="outline" size="sm">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {generating ? 'Regenerating...' : 'Regenerate (Upgrade to Agentic)'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No strategy generated yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Fill in your meeting plan, then click &quot;Generate Strategy&quot; to get an AI-powered playbook
                  </p>
                  <Button onClick={generateStrategy} disabled={generating}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generating ? 'Generating...' : 'Generate Strategy'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {saved ? 'All changes saved' : 'Unsaved changes'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={savePlan} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button onClick={() => { savePlan().then(() => router.push(`/sales/${workshopId}/live`)); }}>
              <Mic className="h-4 w-4 mr-2" />
              Start Call
            </Button>
          </div>
        </div>

        {/* Bottom padding for fixed bar */}
        <div className="h-20" />
      </div>
    </div>
  );
}
