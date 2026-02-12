import { dispatchAIAction } from '@/lib/assistantDispatcher';
import { fakeAI } from '@/lib/fakeAI';
import { aiGenerating } from '@/store/composeSlice';
import { useState } from 'react';
import { useDispatch } from 'react-redux';

export default function AssistantPanel() {
  const dispatch = useDispatch();
  const [prompt, setPrompt] = useState('');

  function handleSubmit() {
    if (!prompt.trim()) return;

    dispatch(aiGenerating());

    // Simulated AI response (replace later)
    setTimeout(() => {
      const action = fakeAI(prompt);

      dispatchAIAction(action, dispatch);
    }, 600);
  }

  return (
    <div className="w-90 border-l h-screen flex flex-col">
      <header className="p-4 border-b font-medium">AI Assistant</header>

      <div className="flex-1 p-4 space-y-3">
        <textarea
          placeholder="Ask AI..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full h-32"
        />

        <button onClick={handleSubmit}>Generate</button>
      </div>
    </div>
  );
}
