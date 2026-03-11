import { readFileSync } from 'fs';
import { join } from 'path';

const agentsDir = join(__dirname, '../agents');

describe('Agent prompt schemas contain no numeric anchors', () => {
  test('strategic-impact-agent SCHEMA has no fabricated percentage anchors', () => {
    const content = readFileSync(join(agentsDir, 'strategic-impact-agent.ts'), 'utf-8');
    expect(content).not.toContain('"percentage": 35');
    expect(content).not.toContain('"percentage": 45');
    expect(content).not.toContain('"percentage": 20');
    expect(content).not.toContain('"confidenceScore": 70');
  });

  test('discovery-validation-agent SCHEMA has no fabricated accuracy anchor', () => {
    const content = readFileSync(join(agentsDir, 'discovery-validation-agent.ts'), 'utf-8');
    expect(content).not.toContain('"hypothesisAccuracy": 75');
  });
});
