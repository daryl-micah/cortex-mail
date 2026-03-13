import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

export default function PolicyPage() {
  const policyPath = path.join(process.cwd(), 'privacy-policy.md');
  const policy = fs.readFileSync(policyPath, 'utf-8');
  const html = marked(policy);
  return (
    <main className="prose mx-auto p-8">
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
