import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, AlertCircle, MessageSquarePlus } from 'lucide-react';
import { aiApi } from '../services/api';
import { useSubscriptionStore } from '../store/subscriptionStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ThreadItem {
  id: string;
  title: string;
  updated_at: string;
  last_message_snippet: string;
}

const WELCOME_MESSAGE =
  'Hello! I am your AI CFO. I can help you understand your financial data, analyze trends, and provide recommendations. What would you like to know?';

export default function AIChat() {
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [threadError, setThreadError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isExpired, refresh } = useSubscriptionStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const mapApiMessage = (message: any): Message => ({
    id: String(message.id),
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: String(message.content || ''),
    timestamp: message.created_at ? new Date(message.created_at) : new Date(),
  });

  const loadThread = useCallback(async (threadId: string) => {
    try {
      setThreadError('');
      const response = await aiApi.getThread(threadId);
      const apiMessages = response?.data?.data?.messages || [];
      setMessages(apiMessages.map(mapApiMessage));
      setActiveThreadId(threadId);
    } catch (err) {
      console.error('Failed to load thread:', err);
      setThreadError('Failed to load chat thread');
    }
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      setThreadsLoading(true);
      setThreadError('');
      const response = await aiApi.listThreads();
      const list: ThreadItem[] = response?.data?.data || [];
      setThreads(list);

      if (list.length === 0) {
        setActiveThreadId(null);
        setMessages([]);
        return;
      }

      if (activeThreadId && list.some((thread) => thread.id === activeThreadId)) {
        return;
      }

      await loadThread(list[0].id);
    } catch (err) {
      console.error('Failed to load threads:', err);
      setThreadError('Failed to load chat history');
    } finally {
      setThreadsLoading(false);
    }
  }, [activeThreadId, loadThread]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const createNewThread = async () => {
    try {
      setThreadError('');
      const response = await aiApi.createThread();
      const threadId = response?.data?.data?.id;
      if (!threadId) {
        throw new Error('Thread id missing');
      }
      await loadThreads();
      setActiveThreadId(threadId);
      setMessages([]);
    } catch (err) {
      console.error('Failed to create thread:', err);
      setThreadError('Failed to create a new chat');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const text = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      let threadId = activeThreadId;
      if (!threadId) {
        const createResponse = await aiApi.createThread(text);
        threadId = createResponse?.data?.data?.id || null;
        if (!threadId) {
          throw new Error('Failed to create chat thread');
        }
        setActiveThreadId(threadId);
      }

      const response = await aiApi.chat(text, threadId || undefined);
      const responseThreadId = response?.data?.data?.threadId || threadId;
      if (responseThreadId && responseThreadId !== activeThreadId) {
        setActiveThreadId(responseThreadId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response?.data?.data?.message || 'No response',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      await loadThreads();
    } catch (err: any) {
      if (err.response?.status === 403) {
        await refresh();
        setError(err.response?.data?.error || 'Your free trial has expired. Please upgrade.');
      } else {
        setError('Failed to get response. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    'What is my cash runway?',
    'How is my revenue trending?',
    'What are my top expenses?',
    'Should I be concerned about my cash flow?',
  ];

  if (error && isExpired) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI CFO Chat</h1>
          <p className="text-gray-600">Chat with your AI CFO</p>
        </div>
        <div className="card text-center py-12">
          <div className="text-amber-600 mb-4">
            <AlertCircle className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Upgrade Required</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button className="btn-primary">Upgrade to Paid Plan</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-[calc(100vh-120px)]">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI CFO Chat</h1>
        <p className="text-gray-600">Ask questions about your financial data</p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          {error}
        </div>
      )}

      <div className="card flex h-full overflow-hidden p-0">
        <div className="w-72 border-r border-gray-200 p-4">
          <button onClick={createNewThread} className="btn-primary mb-4 flex w-full items-center justify-center gap-2">
            <MessageSquarePlus className="h-4 w-4" />
            New Chat
          </button>

          {threadError && <p className="mb-3 text-xs text-red-600">{threadError}</p>}

          <div className="space-y-2 overflow-y-auto h-[calc(100%-52px)] pr-1">
            {threadsLoading ? (
              <p className="text-sm text-gray-500">Loading threads...</p>
            ) : threads.length === 0 ? (
              <p className="text-sm text-gray-500">No chats yet</p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => loadThread(thread.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left ${
                    activeThreadId === thread.id
                      ? 'border-primary-200 bg-primary-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <p className="truncate text-sm font-medium text-gray-900">{thread.title || 'Untitled chat'}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{thread.last_message_snippet || 'No messages yet'}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-6">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {messages.length === 0 && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-green-600" />
                </div>
                <div className="bg-gray-100 text-gray-900 max-w-[80%] rounded-lg p-4">
                  <p className="whitespace-pre-wrap">{WELCOME_MESSAGE}</p>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user' ? 'bg-primary-100' : 'bg-green-100'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-5 h-5 text-primary-600" />
                  ) : (
                    <Bot className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <span
                    className={`text-xs mt-2 block ${
                      message.role === 'user' ? 'text-primary-200' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-green-600" />
                </div>
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {messages.length === 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => setInput(question)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your AI CFO..."
              className="flex-1 input"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4 disabled:opacity-50">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
