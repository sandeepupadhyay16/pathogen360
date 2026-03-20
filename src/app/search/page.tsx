'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ChartRenderer from '@/components/ChartRenderer';
import DiagnosticFlowchart from "@/components/DiagnosticFlowchart";
import ChatMessage, { Message } from '@/components/ChatMessage';
import { Search as SearchIcon, MessageSquare, Plus, PenSquare, Trash2, ArrowRight, Brain, CornerDownLeft, Copy, CheckCircle2, RotateCcw, Image as ImageIcon, Map as MapIcon, Stethoscope, Share2, Download, Search, Sparkles } from 'lucide-react';

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  
  const [availableTopics, setAvailableTopics] = useState<any[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicSearchQuery, setTopicSearchQuery] = useState('');
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [suggestingLoading, setSuggestingLoading] = useState(false);
  
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Fetch all conversations on mount
  useEffect(() => {
    fetchConversations();
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setAvailableTopics(data || []);
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    }
  };

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (currentConversationId) {
      fetchMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  useEffect(() => {
    // Only auto-scroll to the bottom when the user sends a message
    // This allows the user to stay at the question and scroll down as they read the AI response
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Fetch suggested questions when exactly one topic is selected
  useEffect(() => {
    if (selectedTopics.length === 1) {
      const topicId = selectedTopics[0];
      const fetchSuggestedQuestions = async () => {
        setSuggestingLoading(true);
        try {
          const res = await fetch(`/api/admin/medical-term/${topicId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.logicalQuestions) {
              setSuggestedQuestions(data.logicalQuestions.map((q: any) => q.question));
            } else {
              setSuggestedQuestions([]);
            }
          }
        } catch (err) {
          console.error('Failed to fetch suggested questions:', err);
          setSuggestedQuestions([]);
        } finally {
          setSuggestingLoading(false);
        }
      };
      fetchSuggestedQuestions();
    } else {
      setSuggestedQuestions([]);
    }
  }, [selectedTopics]);

  // Handle outside click for suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2 && !loading) {
        try {
          // Note: Assuming we create /api/medical-terms/search later
          const res = await fetch(`/api/medical-terms/search?q=${encodeURIComponent(query)}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.suggestions) {
            setSuggestions(data.suggestions);
            setShowSuggestions(data.suggestions.length > 0);
          }
        } catch (err) {
          console.error('Failed to fetch suggestions:', err);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, loading]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations', { cache: 'no-store' });
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  };

  const fetchMessages = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.conversation) {
        const uiMessages = data.conversation.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          text: m.content,
          sources: m.sources,
          reasoning: m.reasoning,
          usage: m.usage,
          routingPath: m.routingPath,
          diagnostic: m.diagnostic
        }));
        setMessages(uiMessages);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setQuery('');
    setSelectedTopics([]);
  };

  const handleDeleteConversation = (conv: Conversation, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setConversationToDelete(conv);
  };

  const executeDeleteConversation = async () => {
    if (!conversationToDelete) return;
    const { id } = conversationToDelete;
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      fetchConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setConversationToDelete(null);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setShowSuggestions(false);
    const currentQuery = query;
    setMessages(prev => [...prev, { role: 'user', text: currentQuery }]);
    setLoading(true);
    setStatus('Initializing...');
    setQuery('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery, conversationId: currentConversationId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiMessage: Message = { role: 'ai', text: '' };
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'status') {
              setStatus(data.message);
            } else if (data.type === 'metadata') {
              setStatus(null);
              if (data.conversationId && data.conversationId !== currentConversationId) {
                setCurrentConversationId(data.conversationId);
                fetchConversations();
              }
              aiMessage = {
                ...aiMessage,
                sources: data.sources,
                visuals: data.visuals,
                matchedMedicalTerm: data.matchedMedicalTerm,
                reasoning: data.reasoning,
                diagnostic: data.diagnostic,
                routingPath: data.routingPath
              };
            } else if (data.type === 'text') {
              setStatus(null);
              aiMessage.text += data.content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'ai') {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { ...aiMessage };
                  return newMessages;
                } else {
                  return [...prev, { ...aiMessage }];
                }
              });
            } else if (data.type === 'done') {
              aiMessage.usage = data.usage;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { ...aiMessage };
                return newMessages;
              });
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (e) {
            console.warn("Error parsing stream chunk:", e, line);
          }
        }
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: `Sorry, an error occurred: ${error.message || 'Unknown error'}. Please try again.` 
      }]);
    }
    setLoading(false);
    setStatus(null);
  };

  const handleSuggestionClick = (suggestion: any) => {
    setQuery(suggestion.name);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && activeSuggestionIndex !== -1) {
      e.preventDefault();
      handleSuggestionClick(suggestions[activeSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleIngest = async (medicalTerm: string) => {
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', text: `Research data for ${medicalTerm}` }]);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicalTerm }),
      });
      const data = await res.json();
      let responseText = data.message || `Research complete for ${medicalTerm}. Sources analyzed from PubMed and ClinicalTrials.gov.`;
      setMessages(prev => [...prev, { role: 'ai', text: responseText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error performing research.' }]);
    }
    setLoading(false);
    setStatus(null);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 font-sans text-gray-900 overflow-hidden relative">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="md:hidden fixed bottom-24 left-4 z-50 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all active:scale-95"
        title="Toggle History"
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      {/* Sidebar Overlay (Mobile) */}
      {showSidebar && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-80 bg-white border-r border-gray-200 flex flex-col shadow-xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:shadow-none
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        <div className="p-4">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2.5 px-4 rounded-xl transition duration-200 shadow-sm"
          >
            <Plus className="h-5 w-5" />
            New Research
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">History</h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-4">No research history</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setCurrentConversationId(conv.id);
                    setShowSidebar(false);
                  }}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${currentConversationId === conv.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'}`}
                >
                  <div className="truncate text-sm font-medium mr-2 flex-1">{conv.title}</div>
                  <button
                    onClick={(e) => handleDeleteConversation(conv, e)}
                    title="Delete conversation"
                    className={`p-1.5 rounded hover:bg-red-500 hover:text-white transition ${currentConversationId === conv.id ? 'text-blue-200 hover:text-white hover:bg-blue-500' : 'text-gray-400'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-full w-full min-w-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-40">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center mt-10">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-blue-100">
                  <Brain className="h-10 w-10" />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-800 mb-3 tracking-tight">How can I assist your research?</h2>
                <p className="text-gray-500 max-w-xl text-lg leading-relaxed mb-8">
                  I synthesize medical intelligence from PubMed and ClinicalTrials.gov. Ask me about drugs, diseases, molecular biology, or clinical states.
                </p>

                {availableTopics.length > 0 && (
                  <div className="w-full max-w-2xl bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-left">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Available Intelligence Topics</h3>
                      {selectedTopics.length > 1 && (
                        <button
                          onClick={() => {
                            const topicNames = selectedTopics.map(id => availableTopics.find(t => t.id === id)?.name).filter(Boolean);
                            const q = `Compare and correlate the clinical data for ${topicNames.join(' and ')} highlighting any cross-entity insights.`;
                            setQuery(q);
                          }}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg transition-colors"
                        >
                          Compare Selected ({selectedTopics.length})
                        </button>
                      )}
                    </div>

                    <div className="relative mb-4">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Search for drugs, diseases, or targets..."
                        value={topicSearchQuery}
                        onChange={(e) => setTopicSearchQuery(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {availableTopics.filter(t => t.name.toLowerCase().includes(topicSearchQuery.toLowerCase())).map(t => {
                        const isSelected = selectedTopics.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              setSelectedTopics(prev => 
                                prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                              );
                            }}
                            className={`px-3 py-1.5 text-sm rounded-xl border transition-all ${
                              isSelected 
                                ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-sm' 
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-white hover:border-gray-300'
                            }`}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                    {selectedTopics.length === 1 && (
                      <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="h-3.5 w-3.5 text-blue-500" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Knowledge Nucleus: Suggested Interrogations</h4>
                        </div>
                        
                        {suggestingLoading ? (
                          <div className="space-y-3 animate-pulse">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="flex gap-3 items-start">
                                <div className="h-8 w-8 bg-slate-100 rounded-full flex-shrink-0" />
                                <div className="h-10 w-full bg-slate-50 rounded-2xl rounded-tl-none" />
                              </div>
                            ))}
                          </div>
                        ) : suggestedQuestions.length > 0 ? (
                          <div className="max-h-72 overflow-y-auto pr-3 space-y-3 custom-scrollbar">
                            {suggestedQuestions.map((question, i) => (
                              <div key={i} className="flex gap-3 items-start group/q">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-100 group-hover/q:bg-blue-100 transition-colors">
                                  <Sparkles className="w-4 h-4 text-blue-500" />
                                </div>
                                <button
                                  onClick={() => {
                                    setQuery(question);
                                    const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
                                    if (searchInput) searchInput.focus();
                                  }}
                                  className="flex-1 text-left px-4 py-3 bg-white hover:bg-blue-50 border border-slate-100 hover:border-blue-200 text-slate-700 hover:text-blue-800 text-sm font-semibold rounded-2xl rounded-tl-none transition-all shadow-sm hover:shadow-md"
                                >
                                  {question}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">No pre-defined questions found for this topic. Try asking your own!</p>
                        )}
                        
                        <p className="text-[10px] text-gray-400 mt-4 italic font-medium">Select another topic to compare, or click a suggestion above to ask about {availableTopics.find(t => t.id === selectedTopics[0])?.name}.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className="animate-in slide-in-from-bottom-2 duration-300 space-y-4">
                  <ChatMessage message={msg} />
                  {!msg.role.includes('user') && msg.visuals && (
                    <div className="max-w-3xl mx-auto">
                      <ChartRenderer visuals={msg.visuals} medicalTermName={msg.matchedMedicalTerm || ''} />
                    </div>
                  )}
                  {msg.unrecognizedMedicalTerm && (
                    <div className="max-w-[85%] ml-0 mr-auto p-4 bg-orange-50 border border-orange-100 rounded-xl rounded-tl-none">
                      <p className="text-sm font-medium text-orange-900 mb-3">
                        I noticed you're asking about <span className="font-bold">{msg.unrecognizedMedicalTerm}</span>, which isn't in our nucleus yet.
                      </p>
                      <button
                        onClick={() => handleIngest(msg.unrecognizedMedicalTerm!)}
                        disabled={loading}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold py-2 px-5 rounded-lg transition disabled:opacity-50 shadow-sm"
                      >
                        Research {msg.unrecognizedMedicalTerm}
                      </button>
                    </div>
                  )}
                  {msg.pdfReportId && (
                    <div className="mt-2 ml-0 mr-auto">
                      <button
                        onClick={() => window.open(`/pdf/${msg.pdfReportId}`, '_blank')}
                        className="flex items-center gap-2 text-white bg-red-500 hover:bg-red-600 px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm"
                      >
                        <Download className="h-5 w-5" />
                        Download Research Report
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white border border-gray-100 rounded-[1.5rem] rounded-tl-md p-5 shadow-sm shadow-gray-200/50 flex space-x-4 items-center text-gray-400">
                  <div className="flex space-x-1.5">
                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce"></div>
                  </div>
                  {status && (
                    <span className="text-sm font-medium text-gray-500 animate-in fade-in slide-in-from-left-2 duration-300">
                      {status}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute flex flex-col items-center justify-center bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent pointer-events-none">
          <div className="w-full max-w-3xl pointer-events-auto flex flex-col gap-3 relative">
            
            {showSuggestions && (
              <div 
                ref={suggestionRef}
                className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
              >
                <div className="max-h-60 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <div
                      key={s.id || i}
                      onClick={() => handleSuggestionClick(s)}
                      onMouseEnter={() => setActiveSuggestionIndex(i)}
                      className={`px-4 py-3 cursor-pointer flex items-center justify-between transition ${i === activeSuggestionIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${s.type === 'Category' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                          {s.type === 'Category' ? 'C' : 'T'}
                        </span>
                        <div>
                          <div className="font-semibold text-sm">{s.label}</div>
                          {s.type === 'Category' && <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Medical Category</div>}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSearch} className="relative group">
              <input
                type="search"
                className="block w-full p-4 pl-6 pr-14 text-base text-gray-900 border border-gray-200/60 rounded-[2rem] bg-white shadow-lg shadow-gray-200/50 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none placeholder-gray-400 transition-all duration-300"
                placeholder="Ask Research Intelligence..."
                title="Search research intelligence"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                autoComplete="off"
                required
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                title="Send query"
                className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all duration-300 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shadow-sm group-focus-within:bg-blue-600"
              >
                <Sparkles className="h-5 w-5 ml-0.5" />
              </button>
            </form>
            <div className="text-center mt-3 text-xs text-gray-400 font-medium tracking-wide">Research Intelligence synthesizes data from PubMed and ClinicalTrials.gov.</div>
          </div>
        </div>
      </div>

      {conversationToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Conversation</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete "{conversationToDelete.title}"? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConversationToDelete(null)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition">Cancel</button>
              <button onClick={executeDeleteConversation} className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
