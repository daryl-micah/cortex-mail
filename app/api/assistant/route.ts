import Groq from 'groq-sdk';
import { NextRequest } from 'next/server';
import type { AssistantAction } from '@/types/assistant';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const systemPrompt = `You are an AI assistant that controls an email client UI through structured actions.

Your job is to interpret user commands and return ONLY a valid JSON action object.

Available actions:

1. OPEN_COMPOSE - Open the compose email view
   { "type": "OPEN_COMPOSE" }

2. FILL_COMPOSE - Fill compose form fields
   { "type": "FILL_COMPOSE", "payload": { "to": "email@example.com", "subject": "Subject", "body": "Body text" } }

3. SEND_EMAIL - Send the currently composed email
   { "type": "SEND_EMAIL" }

4. FILTER_EMAILS - Filter emails by criteria
   { "type": "FILTER_EMAILS", "payload": { "unread": true, "dateRange": "last-7-days", "sender": "john@example.com" } }
   
   Valid dateRange values: "today", "yesterday", "last-7-days", "last-30-days", "last-3-months"
   Use unread: true for unread only, unread: false for read only, or omit for all

5. OPEN_EMAIL - Open a specific email by ID
   { "type": "OPEN_EMAIL", "payload": { "id": "email-id" } }

6. REPLY_TO_CURRENT - Reply to the currently open email
   { "type": "REPLY_TO_CURRENT" }

Context provided:
- emails: List of available emails
- currentView: Current UI view (INBOX, EMAIL_DETAIL, OPEN_COMPOSE, SEARCH)
- selectedEmailId: ID of currently open email (if any)

Examples:

User: "Send an email to john@test.com about the meeting"
Response: { "type": "OPEN_COMPOSE" }
Then: { "type": "FILL_COMPOSE", "payload": { "to": "john@test.com", "subject": "Meeting", "body": "" } }

User: "Show me unread emails"
Response: { "type": "FILTER_EMAILS", "payload": { "unread": true } }

User: "Open the email from GitHub"
Response: { "type": "OPEN_EMAIL", "payload": { "id": "matching-email-id" } }

User: "Reply to this"
Response: { "type": "REPLY_TO_CURRENT" }

IMPORTANT: 
- Return ONLY valid JSON, no markdown code blocks
- For compose actions, you may need multiple actions (first open, then fill)
- Match email IDs from the provided context
- Be smart about inferring user intent`;

export async function POST(req: NextRequest) {
  try {
    const { message, context } = await req.json();

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Context: ${JSON.stringify(context)}\n\nUser message: ${message}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse the action from the response
    let actions: AssistantAction[] = [];
    try {
      // Try to parse as single action first
      const parsed = JSON.parse(content);
      actions = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // If JSON parsing fails, try to extract JSON from text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        actions = Array.isArray(parsed) ? parsed : [parsed];
      }
    }

    return Response.json({
      actions,
      message: response.choices[0]?.message?.content,
    });
  } catch (error) {
    console.error('AI Assistant error:', error);
    return Response.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
