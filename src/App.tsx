import React, { useState, useEffect, useRef } from "react";
import { GoogleGenAI } from "@google/genai";
import {
  Settings,
  Trash2,
  Send,
  Eye,
  EyeOff,
  Key,
  Bot,
  User as UserIcon,
  X,
  ChevronRight,
  Loader2,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// ============================================================
// STORAGE HELPERS
// ============================================================
const STORAGE_KEYS = {
  API_KEY: 'oc:apikey',
  SYS_PROMPT: 'oc:sysprompt',
  CHATS: 'oc:chats',
  ACTIVE_ID: 'oc:active_id',
  MODEL: 'oc:model'
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  ts: number;
}

const store = (key: string, val: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e: any) {
    console.error('Storage error:', e);
    if (e.name === 'QuotaExceededError') {
      alert('Local storage is full. Please clear some chat history to continue.');
    } else {
      alert('Failed to save data to local storage. Please check your browser settings.');
    }
  }
};

const load = (key: string) => {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  } catch (e) {
    console.error('Load error:', e);
    return null;
  }
};

// ============================================================
// COMPONENTS
// ============================================================

const MarkdownRenderer = ({ text }: { text: string }) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const inlineFormat = (t: string) => {
    const parts = t.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return parts.map((p, idx) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={idx} className="font-bold text-white">{p.slice(2, -2)}</strong>;
      if (p.startsWith('`') && p.endsWith('`')) return <code key={idx} className="bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-sm text-orange-400">{p.slice(1, -1)}</code>;
      if (p.startsWith('*') && p.endsWith('*')) return <em key={idx} className="italic">{p.slice(1, -1)}</em>;
      return p;
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="my-4 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
          {lang && <div className="bg-zinc-900 px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-500 border-bottom border-zinc-800">{lang}</div>}
          <pre className="p-4 overflow-x-auto font-mono text-sm text-zinc-300 leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-lg font-bold text-white mt-6 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-bold text-white mt-8 mb-3">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-extrabold text-orange-500 mt-10 mb-4">{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-3 mt-2">
          <span className="text-orange-500 flex-shrink-0 mt-1.5">
            <ChevronRight size={14} />
          </span>
          <span className="text-zinc-300">{inlineFormat(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)![1];
      elements.push(
        <div key={i} className="flex gap-3 mt-2">
          <span className="text-orange-500 font-mono text-xs flex-shrink-0 mt-1.5 w-4">{num}.</span>
          <span className="text-zinc-300">{inlineFormat(line.slice(num.length + 2))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-4" />);
    } else {
      elements.push(<p key={i} className="text-zinc-300 leading-relaxed mt-1">{inlineFormat(line)}</p>);
    }
    i++;
  }
  return <div className="space-y-1">{elements}</div>;
};

// ============================================================
// PAGES
// ============================================================

const SettingsModal = ({ onClose, apiKey, sysPrompt, onSave }: { onClose: () => void, apiKey: string, sysPrompt: string, onSave: (k: string, s: string) => void }) => {
  const [key, setKey] = useState(apiKey);
  const [prompt, setPrompt] = useState(sysPrompt);
  const [model, setModel] = useState(load(STORAGE_KEYS.MODEL) || 'gemini-2.0-flash');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    store(STORAGE_KEYS.API_KEY, key.trim());
    store(STORAGE_KEYS.SYS_PROMPT, prompt);
    store(STORAGE_KEYS.MODEL, model);
    onSave(key.trim(), prompt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Settings className="text-zinc-400" size={20} />
            <h2 className="text-lg font-bold">Gateway Settings</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">AI Model</label>
            <div className="relative">
              <select
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all appearance-none cursor-pointer text-zinc-300"
                value={model}
                onChange={e => setModel(e.target.value)}
              >
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fastest)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (High Limits)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Most Capable)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <ChevronRight size={16} className="rotate-90" />
              </div>
            </div>
            <p className="text-[9px] text-zinc-600 leading-relaxed">
              If you hit "Rate Limit" errors, try switching to <b>Gemini 1.5 Flash</b> which often has higher quotas for free users.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Gemini API Key</label>
                {process.env.GEMINI_API_KEY && !load(STORAGE_KEYS.API_KEY) && (
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">ENV LOADED</span>
                )}
              </div>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors"
              >
                Get new key <ExternalLink size={10} />
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-10 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                value={key}
                onChange={e => setKey(e.target.value)}
              />
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">System Prompt</label>
            <textarea
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all resize-none"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
            <p className="text-[10px] text-zinc-500 leading-relaxed">Defines the AI's personality and behavior.</p>
          </div>

          <div className="flex gap-3 justify-end pt-6 border-t border-zinc-800">
            <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-zinc-400 hover:text-white transition-colors">Cancel</button>

            <button
              onClick={handleSave}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-2.5 rounded-lg transition-all shadow-lg shadow-orange-500/20"
            >
              {saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================

const ChatApp = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.0-flash');
  const [sysPrompt, setSysPrompt] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeChat = chats.find(c => c.id === activeId);

  useEffect(() => {
    const savedChats = load(STORAGE_KEYS.CHATS) || [];
    const savedActiveId = load(STORAGE_KEYS.ACTIVE_ID) || '';
    const key = load(STORAGE_KEYS.API_KEY) || process.env.GEMINI_API_KEY || '';
    const m = load(STORAGE_KEYS.MODEL) || 'gemini-2.0-flash';
    const sp = load(STORAGE_KEYS.SYS_PROMPT) || '';
    
    setApiKey(key);
    setModel(m);
    setSysPrompt(sp);

    if (savedChats.length > 0) {
      setChats(savedChats);
      setActiveId(savedActiveId || savedChats[0].id);
    } else {
      createNewChat();
    }
  }, []);

  useEffect(() => {
    if (chats.length > 0) {
      store(STORAGE_KEYS.CHATS, chats);
      store(STORAGE_KEYS.ACTIVE_ID, activeId);
    }
  }, [chats, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages, thinking]);

  const createNewChat = () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'New Conversation',
      messages: [],
      ts: Date.now()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveId(newChat.id);
    setError('');
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (chats.length === 1) {
      setChats([{ ...chats[0], messages: [], title: 'New Conversation', ts: Date.now() }]);
      return;
    }
    const newChats = chats.filter(c => c.id !== id);
    setChats(newChats);
    if (activeId === id) {
      setActiveId(newChats[0].id);
    }
  };

  const generateTitle = async (chatId: string, firstMsg: string) => {
    if (!apiKey) return;
    try {
      const genAI = new GoogleGenAI({ apiKey });
      const res = await genAI.models.generateContent({
        model: model,
        contents: [{ role: 'user', parts: [{ text: `Generate a very short, 2-4 word title for a chat that starts with: "${firstMsg}". Return ONLY the title text, no quotes or punctuation.` }] }],
      });
      const title = res.text?.trim() || 'Conversation';
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c));
    } catch (e) {
      console.error('Title generation failed', e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || thinking || !activeChat) return;
    if (!apiKey) {
      setError('No API key configured. Open Settings to add your Gemini key.');
      return;
    }
    setError('');

    const userMsg: Message = { role: 'user', content: input.trim(), ts: Date.now() };
    const updatedMessages = [...activeChat.messages, userMsg];
    
    setChats(prev => prev.map(c => c.id === activeId ? { ...c, messages: updatedMessages } : c));
    setInput('');
    setThinking(true);

    if (inputRef.current) inputRef.current.style.height = 'auto';

    try {
      const genAI = new GoogleGenAI({ apiKey });
      const response = await genAI.models.generateContent({
        model: model,
        config: { systemInstruction: sysPrompt || undefined },
        contents: updatedMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
      });

      const assistantMsg: Message = { role: 'assistant', content: response.text, ts: Date.now() };
      setChats(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...updatedMessages, assistantMsg] } : c));
      
      if (activeChat.messages.length === 0) {
        generateTitle(activeId, input.trim());
      }
    } catch (e: any) {
      console.error('Gemini API Error:', e);
      let userFriendlyMsg = 'Failed to get response from Gemini.';
      let recoveryStep = 'Please try again later.';
      if (e.message?.includes('API_KEY_INVALID')) {
        userFriendlyMsg = 'Invalid API Key.';
        recoveryStep = 'Please check your API key in Settings.';
      } else if (e.message?.includes('quota') || e.message?.includes('429') || e.message?.includes('limit')) {
        userFriendlyMsg = 'Rate limit or quota exceeded.';
        recoveryStep = 'Try switching to "Gemini 1.5 Flash" in Settings for higher limits, or wait a minute.';
      } else if (e.message?.includes('network') || !navigator.onLine) {
        userFriendlyMsg = 'Network error.';
        recoveryStep = 'Check your connection.';
      }
      setError(`${userFriendlyMsg} ${recoveryStep}`);
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div className="h-screen bg-[#0f0f10] text-zinc-100 flex overflow-hidden selection:bg-orange-500/30">
      {/* SIDEBAR */}
      <div className="w-72 bg-zinc-900/50 border-r border-zinc-800 flex flex-col flex-shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-zinc-800/50">
          <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
            <Sparkles className="text-orange-500" size={20} />
          </div>
          <div>
            <h1 className="font-black tracking-tight text-sm">OpenClaw</h1>
            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Personal Gateway</p>
          </div>
        </div>

        <div className="p-4">
          <button 
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl border border-zinc-700/50 transition-all text-sm font-bold"
          >
            <Sparkles size={16} className="text-orange-500" />
            New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setActiveId(chat.id)}
              className={`group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border ${
                activeId === chat.id 
                  ? 'bg-orange-500/10 border-orange-500/20 text-white' 
                  : 'border-transparent text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
            >
              <Bot size={16} className={activeId === chat.id ? 'text-orange-500' : 'text-zinc-600'} />
              <span className="flex-1 truncate text-xs font-medium">{chat.title}</span>
              <button 
                onClick={(e) => deleteChat(chat.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-800/50 flex items-center justify-between">
          <button onClick={() => setShowSettings(true)} className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all">
            <Settings size={20} />
          </button>
          <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest px-2">
            OpenClaw v1.2
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0f0f10]">
        <header className="h-16 border-b border-zinc-800 flex items-center px-8 justify-between bg-zinc-950/30 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest truncate max-w-[200px]">
              {activeChat?.title}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${apiKey ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-zinc-600'}`} />
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Gemini 2.0 Flash</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full py-12 px-6">
            {activeChat?.messages.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
                <div className="text-4xl mb-6 opacity-20">⟡</div>
                <h2 className="text-xl font-bold mb-2">Ready to Assist</h2>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto leading-relaxed">
                  Start a new conversation. Your data remains local and secure.
                </p>
              </motion.div>
            )}

            <div className="space-y-10">
              {activeChat?.messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-6 group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all ${
                    msg.role === 'user' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}>
                    {msg.role === 'user' ? <UserIcon size={20} /> : <Bot size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-bold uppercase tracking-widest ${msg.role === 'user' ? 'text-orange-500' : 'text-zinc-400'}`}>
                        {msg.role === 'user' ? 'You' : 'OpenClaw'}
                      </span>
                    </div>
                    <div className="text-zinc-300">
                      <MarkdownRenderer text={msg.content} />
                    </div>
                  </div>
                </motion.div>
              ))}

              {thinking && (
                <div className="flex gap-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-zinc-800 border border-zinc-700 text-zinc-400">
                    <Bot size={20} />
                  </div>
                  <div className="flex items-center gap-1.5 pt-4">
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  </div>
                </div>
              )}

              {error && (
                <div className="max-w-xl mx-auto bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-xs text-red-400 text-center">
                  {error}
                </div>
              )}
            </div>
          </div>
          <div ref={bottomRef} />
        </div>

        <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto relative">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Message OpenClaw..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-6 pr-16 py-4 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all resize-none max-h-60 custom-scrollbar leading-relaxed"
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 240) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || thinking}
              className={`absolute right-3 bottom-3 p-2.5 rounded-xl transition-all ${
                input.trim() && !thinking ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              {thinking ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            apiKey={apiKey}
            sysPrompt={sysPrompt}
            onClose={() => setShowSettings(false)}
            onSave={(k, sp) => {
              setApiKey(k);
              setSysPrompt(sp);
              setShowSettings(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================
// ROOT
// ============================================================

export default function App() {
  return <ChatApp />;
}
