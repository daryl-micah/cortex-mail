import Groq from 'groq-sdk';
import { NextRequest } from 'next/server';
import type { AssistantAction } from '@/types/assistant';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const systemPrompt = `AI assistant controlling email UI via JSON actions.

Actions:
1. {"type":"OPEN_COMPOSE"}
2. {"type":"FILL_COMPOSE","payload":{"to":"email","subject":"text","body":"text"}}
3. {"type":"SEND_EMAIL"}
4. {"type":"FILTER_EMAILS","payload":{"unread":true,"dateRange":"last-7-days","sender":"email"}}
   valid dateRange: "today"|"yesterday"|"last-7-days"|"last-30-days"|"last-3-months"
5. {"type":"OPEN_EMAIL","payload":{"id":"email-id"}}
6. {"type":"REPLY_TO_CURRENT"}

Context: emails array, currentView, selectedEmailId

Examples:
"Send email to x@y.com" → [{"type":"OPEN_COMPOSE"},{"type":"FILL_COMPOSE","payload":{"to":"x@y.com"}}]
"Show unread" → {"type":"FILTER_EMAILS","payload":{"unread":true}}
"Reply to this email" → {"type":"REPLY_TO_CURRENT"},
"Send this mail" → {"type":"SEND_EMAIL"}

Return valid JSON only. Match email IDs from context.`;

export async function POST(req: NextRequest) {
  try {
    const { message, context } = await req.json();

    // Limit context to reduce token usage
    const limitedContext = {
      ...context,
      emails: context.emails?.slice(0, 15).map((e: any) => ({
        id: e.id,
        from: e.from,
        subject: e.subject,
        unread: e.unread,
      })),
    };

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile', // Higher rate limits than compound
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Context: ${JSON.stringify(limitedContext)}\n\nUser: ${message}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse the action from the response
    let actions: AssistantAction[] = [];
    try {
      // Clean content - remove markdown code blocks and extra whitespace
      let cleanContent = content.trim();
      cleanContent = cleanContent
        .replace(/```(?:json)?\s*/g, '')
        .replace(/```\s*/g, '');

      // Try to parse cleaned content
      const parsed = JSON.parse(cleanContent);
      actions = Array.isArray(parsed) ? parsed : [parsed];
    } catch (firstError) {
      // If that fails, try to extract first valid JSON object
      try {
        // Match first complete JSON object (non-greedy, handles nested objects)
        const jsonMatch = content.match(/(\{(?:[^{}]|(?:\{[^{}]*\}))*\})/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          actions = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          console.error('No valid JSON found in response:', content);
        }
      } catch (secondError) {
        console.error('Failed to parse AI response:', content);
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
