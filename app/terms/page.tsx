import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

export default function TermsPage() {
  const termsPath = path.join(process.cwd(), 'terms-of-service.md');
  const terms = fs.readFileSync(termsPath, 'utf-8');
  const html = marked(terms);
  return (
    <main className="prose mx-auto p-8">
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
