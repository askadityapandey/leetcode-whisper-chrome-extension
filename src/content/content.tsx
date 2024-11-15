import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, SendHorizontal } from 'lucide-react';
import OpenAI from 'openai';

import './style.css';
import { Input } from '@/components/ui/input';
import { SYSTEM_PROMPT } from '@/constants/prompt';
import { extractCode } from './util';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Markdown from 'react-markdown';

function createOpenAISDK(apiKey: string) {
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

interface ChatBoxProps {
  context: {
    programmingLanguage: string;
    problemStatement: string;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  message: string;
  type: 'text' | 'markdown';
  code?: string;
}

const injectCodeToEditor = (code: string) => {
  const editor = document.querySelector('[role="presentation"]');
  if (editor) {
    const event = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      composed: true
    });

    editor.textContent = code;
    editor.dispatchEvent(event);
  } else {
    console.error('Editor not found');
    alert('Could not find the code editor');
  }
};

function ChatBox({ context }: ChatBoxProps) {
  const [value, setValue] = React.useState('');
  const [chatHistory, setChatHistory] = React.useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState('gpt-4'); 
  const chatBoxRef = useRef<HTMLDivElement>(null);

  const handleGenerateAIResponse = async () => {
    try {
      setIsLoading(true);
      const openAIAPIKey = (await chrome.storage.local.get('apiKey')) as {
        apiKey?: string;
      };

      if (!openAIAPIKey.apiKey) {
        alert('OpenAI API Key is required');
        return;
      }

      const openai = createOpenAISDK(openAIAPIKey.apiKey);

      const userMessage = value;
      const userCurrentCodeContainer = document.querySelector('.view-line');

      const extractedCode = extractCode(
        userCurrentCodeContainer?.innerHTML ?? ''
      );

      const systemPromptModified = SYSTEM_PROMPT.replace(
        '{{problem_statement}}',
        context.problemStatement
      )
        .replace('{{programming_language}}', context.programmingLanguage)
        .replace('{{user_code}}', extractedCode);

      const apiResponse = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPromptModified },
          ...chatHistory.map(
            (chat) =>
              ({
                role: chat.role,
                content: chat.message,
              } as ChatCompletionMessageParam)
          ),
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
      });

      if (apiResponse.choices[0].message.content) {
        try {
          const result = JSON.parse(apiResponse.choices[0].message.content);
          setChatHistory((prev) => [
            ...prev,
            {
              message: result.output,
              role: 'assistant',
              type: 'markdown',
              code: result.code
            },
          ]);
          chatBoxRef.current?.scrollIntoView({ behavior: 'smooth' });
        } catch (e) {
          setChatHistory((prev) => [
            ...prev,
            {
              message: apiResponse.choices[0].message.content!,
              role: 'assistant',
              type: 'markdown'
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      alert('Error generating AI response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onSendMessage = () => {
    if (!value.trim()) return;
    
    setChatHistory((prev) => [
      ...prev,
      { role: 'user', message: value, type: 'text' },
    ]);
    setValue('');
    chatBoxRef.current?.scrollIntoView({ behavior: 'smooth' });
    handleGenerateAIResponse();
  };

  return (
    <div className="w-[400px] h-[550px] mb-2 rounded-xl relative text-wrap overflow-auto">
      <div className="h-[510px] overflow-auto" ref={chatBoxRef}>
        {chatHistory.map((message, index) => (
          <div
            key={index.toString()}
            className="flex gap-4 mt-3 w-[400px] text-wrap"
          >
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <div className="w-[100%]">
              <p>{message.role.toLocaleUpperCase()}</p>
              {message.type === 'markdown' ? (
                <div>
                  <Markdown>{message.message}</Markdown>
                  {message.code && (
                    <Button
                      onClick={() => injectCodeToEditor(message.code!)}
                      className="mt-2"
                    >
                      Insert Code
                    </Button>
                  )}
                </div>
              ) : (
                <p>{message.message}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && <div className="text-center mt-4">Generating response...</div>}
      </div>

      <div className="absolute bottom-0 w-full flex items-center gap-2">
        <select 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)} 
          className="bg-black text-white rounded-lg"
        >
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          <option value="gpt-4">GPT-4</option>
        </select>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSendMessage();
          }}
          className="rounded-lg bg-black"
          placeholder="Type your message here"
          disabled={isLoading}
        />
        <SendHorizontal 
          onClick={onSendMessage} 
          className={`cursor-pointer ${isLoading ? 'opacity-50' : ''}`}
        />
      </div>
    </div>
  );
}

const ContentPage: React.FC = () => {
  const [chatboxExpanded, setChatboxExpanded] = React.useState(false);

  const metaDescriptionEl = document.querySelector('meta[name=description]');
  const problemStatement = metaDescriptionEl?.getAttribute('content') as string;

  return (
    <div className="__chat-container dark">
      {chatboxExpanded && (
        <ChatBox context={{ problemStatement, programmingLanguage: 'C++' }} />
      )}
      <div className="flex justify-end">
        <Button onClick={() => setChatboxExpanded(!chatboxExpanded)}>
          <Bot />
          Ask AI
        </Button>
      </div>
    </div>
  );
};

export default ContentPage;
