(function () {
  'use strict';

  // Get configuration from script tag
  var script = document.currentScript;
  var agentId = script.getAttribute('data-agent-id');
  var apiUrl = script.getAttribute('data-api-url') || '/api/chat';

  // Colors
  var primaryColor = script.getAttribute('data-primary-color') || '#2563eb';
  var secondaryColor = script.getAttribute('data-secondary-color') || darkenColor(primaryColor, 15);
  var textColor = script.getAttribute('data-text-color') || '#ffffff';
  var bgColor = script.getAttribute('data-bg-color') || '#ffffff';

  // Branding  
  var widgetTitle = script.getAttribute('data-title') || 'AI Assistant';
  var widgetSubtitle = script.getAttribute('data-subtitle') || 'Online';
  var logoUrl = script.getAttribute('data-logo-url') || '';
  var avatarUrl = script.getAttribute('data-avatar-url') || '';

  // Layout
  var position = script.getAttribute('data-position') || 'bottom-right';
  var widgetWidth = script.getAttribute('data-width') || '380px';
  var widgetHeight = script.getAttribute('data-height') || '520px';
  var borderRadius = script.getAttribute('data-border-radius') || '12px';

  // Behavior
  var welcomeMessage = script.getAttribute('data-welcome-message') || 'How can I help you today?';
  var placeholder = script.getAttribute('data-placeholder') || 'Type your message...';

  // Client Info (for tracking purposes)
  var clientName = script.getAttribute('data-client-name') || '';
  var clientLevel = script.getAttribute('data-client-level') || '';

  if (!agentId) {
    console.error('AI Chat Widget: data-agent-id is required');
    return;
  }

  // Helper: darken a hex color
  function darkenColor(hex, percent) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    r = Math.floor(r * (100 - percent) / 100);
    g = Math.floor(g * (100 - percent) / 100);
    b = Math.floor(b * (100 - percent) / 100);
    return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
  }

  // Helper: get shadow color from primary
  function getShadowColor(hex, alpha) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  // Storage key for this agent
  var STORAGE_KEY = 'ai_chat_' + agentId;

  // Styles
  var styles = `
    .ai-chat-widget {
      position: fixed;
      z-index: 999999;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .ai-chat-widget.bottom-right {
      bottom: 24px;
      right: 24px;
    }
    .ai-chat-widget.bottom-left {
      bottom: 24px;
      left: 24px;
    }
    .ai-chat-widget.maximized {
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999999;
    }
    .ai-chat-widget.maximized::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
    }
    .ai-chat-toggle {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background-color: ${primaryColor};
      color: ${textColor};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px ${getShadowColor(primaryColor, 0.4)};
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .ai-chat-toggle:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px ${getShadowColor(primaryColor, 0.5)};
    }
    .ai-chat-toggle.hidden {
      display: none;
    }
    .ai-chat-window {
      position: absolute;
      bottom: 72px;
      right: 0;
      width: ${widgetWidth};
      height: ${widgetHeight};
      background-color: ${bgColor};
      border-radius: ${borderRadius};
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.2s ease;
      transition: all 0.3s ease;
    }
    .ai-chat-window.open {
      display: flex;
    }
    .ai-chat-window.maximized {
      position: fixed;
      top: 5%;
      left: 5%;
      right: 5%;
      bottom: 5%;
      width: 90%;
      height: 90%;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      animation: scaleIn 0.3s ease;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .ai-chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background-color: ${primaryColor};
      color: ${textColor};
    }
    .ai-chat-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ai-chat-header-icon {
      width: 40px;
      height: 40px;
      background-color: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ai-chat-header-title {
      font-size: 16px;
      font-weight: 600;
    }
    .ai-chat-header-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      opacity: 0.9;
    }
    .ai-chat-status-dot {
      width: 8px;
      height: 8px;
      background-color: #10b981;
      border-radius: 50%;
    }
    .ai-chat-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .ai-chat-header-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background-color: transparent;
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease;
    }
    .ai-chat-header-btn:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
    .ai-chat-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background-color: #f9fafb;
    }
    .ai-chat-empty {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
    }
    .ai-chat-message {
      display: flex;
      gap: 8px;
      max-width: 85%;
      margin-bottom: 12px;
    }
    .ai-chat-message.user {
      margin-left: auto;
      flex-direction: row-reverse;
    }
    .ai-chat-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .ai-chat-message.user .ai-chat-avatar {
      background-color: ${primaryColor};
      color: white;
    }
    .ai-chat-message.assistant .ai-chat-avatar {
      background-color: #e5e7eb;
      color: #4b5563;
    }
    .ai-chat-content {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
    }
    .ai-chat-message.user .ai-chat-content {
      background-color: ${primaryColor};
      color: white;
      border-bottom-right-radius: 4px;
    }
    .ai-chat-message.assistant .ai-chat-content {
      background-color: #ffffff;
      color: #111827;
      border: 1px solid #e5e7eb;
      border-bottom-left-radius: 4px;
    }
    /* Thinking Status */
    .ai-chat-thinking {
      padding: 12px 16px;
      border-radius: 12px;
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 1px solid #bae6fd;
      border-bottom-left-radius: 4px;
      min-width: 200px;
    }
    .ai-chat-thinking-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .ai-chat-thinking-icon {
      color: #0284c7;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .ai-chat-thinking-label {
      font-size: 12px;
      font-weight: 600;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ai-chat-thinking-step-num {
      font-size: 11px;
      color: #0ea5e9;
      background: rgba(14, 165, 233, 0.1);
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }
    .ai-chat-thinking-text {
      font-size: 13px;
      color: #0c4a6e;
      line-height: 1.5;
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .ai-chat-thinking-dots {
      display: flex;
      gap: 4px;
    }
    .ai-chat-thinking-dots span {
      width: 6px;
      height: 6px;
      background-color: #0ea5e9;
      border-radius: 50%;
      animation: pulse 1.4s infinite ease-in-out;
    }
    .ai-chat-thinking-dots span:nth-child(1) { animation-delay: 0s; }
    .ai-chat-thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
    .ai-chat-thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse {
      0%, 80%, 100% { opacity: 0.4; transform: scale(1); }
      40% { opacity: 1; transform: scale(1.2); }
    }
    /* Markdown Styles */
    .ai-chat-content p { margin: 0 0 8px 0; }
    .ai-chat-content p:last-child { margin-bottom: 0; }
    .ai-chat-content strong { font-weight: 600; }
    .ai-chat-content em { font-style: italic; }
    .ai-chat-content code {
      background-color: rgba(0, 0, 0, 0.08);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
    }
    .ai-chat-message.user .ai-chat-content code {
      background-color: rgba(255, 255, 255, 0.2);
    }
    .ai-chat-content pre {
      background-color: #1f2937;
      color: #e5e7eb;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 8px 0;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
    }
    .ai-chat-content pre code {
      background: none;
      padding: 0;
      color: inherit;
    }
    .ai-chat-content ul, .ai-chat-content ol {
      margin: 4px 0;
      padding-left: 18px;
      line-height: 1.4;
    }
    .ai-chat-content li {
      margin-bottom: 2px;
      padding-left: 4px;
    }
    .ai-chat-content li::marker {
      color: ${primaryColor};
    }
    .ai-chat-content blockquote {
      border-left: 3px solid ${primaryColor};
      margin: 8px 0;
      padding-left: 12px;
      color: #6b7280;
    }
    .ai-chat-content a {
      color: ${primaryColor};
      text-decoration: underline;
    }
    .ai-chat-message.user .ai-chat-content a {
      color: white;
    }
    .ai-chat-content h1, .ai-chat-content h2, .ai-chat-content h3 {
      margin: 12px 0 8px 0;
      font-weight: 600;
    }
    .ai-chat-content h1 { font-size: 18px; }
    .ai-chat-content h2 { font-size: 16px; }
    .ai-chat-content h3 { font-size: 14px; }
    .ai-chat-content hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 12px 0;
    }
    .ai-chat-content table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 8px 0;
      font-size: 12px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .ai-chat-content th, .ai-chat-content td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #f1f5f9;
    }
    .ai-chat-content th {
      background-color: #f8fafc;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    .ai-chat-content td:first-child {
      font-weight: 500;
      color: #64748b;
      background: #fafbfc;
    }
    .ai-chat-content tr:last-child td {
      border-bottom: none;
    }
    .ai-chat-typing {
      display: flex;
      gap: 4px;
      padding: 4px 0;
    }
    .ai-chat-typing span {
      width: 8px;
      height: 8px;
      background-color: #9ca3af;
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out;
    }
    .ai-chat-typing span:nth-child(1) { animation-delay: 0s; }
    .ai-chat-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ai-chat-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }
    .ai-chat-input-form {
      display: flex;
      gap: 8px;
      padding: 16px;
      background-color: #ffffff;
      border-top: 1px solid #e5e7eb;
    }
    .ai-chat-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }
    .ai-chat-input:focus {
      border-color: ${primaryColor};
    }
    .ai-chat-send {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background-color: ${primaryColor};
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ai-chat-send:disabled {
      background-color: #9ca3af;
      cursor: not-allowed;
    }
    @media (max-width: 480px) {
      .ai-chat-widget { bottom: 16px; right: 16px; }
      .ai-chat-window {
        width: calc(100vw - 32px);
        height: calc(100vh - 120px);
        max-height: 600px;
      }
    }
  `;

  // Icons
  var icons = {
    message: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    bot: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
    user: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    maximize: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    minimize: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    loader: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
    brain: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>',
    wrench: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
  };

  // Simple Markdown parser
  function parseMarkdown(text) {
    if (!text) return '';

    // Escape HTML first
    var escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Tables - improved parser
    escaped = escaped.replace(/(^\|.+\|$\n?)+/gm, function (tableBlock) {
      var lines = tableBlock.trim().split('\n').filter(function (l) { return l.trim(); });
      if (lines.length < 2) return tableBlock;

      var html = '<table>';
      var isHeader = true;

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        // Skip separator row (|---|---|)
        if (/^\|[-:\s|]+\|$/.test(line)) {
          isHeader = false;
          continue;
        }

        // Parse cells
        var cells = line.slice(1, -1).split('|').map(function (c) { return c.trim(); });

        if (isHeader) {
          html += '<thead><tr>' + cells.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
          isHeader = false;
        } else {
          html += '<tr>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
        }
      }

      html += '</tbody></table>';
      return html;
    });

    // Code blocks (``` ... ```)
    escaped = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, function (match, lang, code) {
      return '<pre><code>' + code.trim() + '</code></pre>';
    });

    // Inline code (`code`)
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    escaped = escaped.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    escaped = escaped.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    escaped = escaped.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold (**text** or __text__)
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_)
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Links [text](url)
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Blockquotes
    escaped = escaped.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists
    escaped = escaped.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    escaped = escaped.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Ordered lists
    escaped = escaped.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Horizontal rules
    escaped = escaped.replace(/^---$/gm, '<hr>');

    // Line breaks (double newline = paragraph)
    escaped = escaped.replace(/\n\n/g, '</p><p>');
    escaped = escaped.replace(/\n/g, '<br>');

    // Wrap in paragraph if not already wrapped
    if (!escaped.startsWith('<')) {
      escaped = '<p>' + escaped + '</p>';
    }

    // Clean up
    escaped = escaped.replace(/<p><\/p>/g, '');
    escaped = escaped.replace(/<p>(<h[123]>)/g, '$1');
    escaped = escaped.replace(/(<\/h[123]>)<\/p>/g, '$1');
    escaped = escaped.replace(/<p>(<pre>)/g, '$1');
    escaped = escaped.replace(/(<\/pre>)<\/p>/g, '$1');
    escaped = escaped.replace(/<p>(<ul>)/g, '$1');
    escaped = escaped.replace(/(<\/ul>)<\/p>/g, '$1');
    escaped = escaped.replace(/<p>(<table>)/g, '$1');
    escaped = escaped.replace(/(<\/table>)<\/p>/g, '$1');
    escaped = escaped.replace(/<p>(<blockquote>)/g, '$1');
    escaped = escaped.replace(/(<\/blockquote>)<\/p>/g, '$1');

    return escaped;
  }

  // Storage functions
  function loadChatData() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load chat data:', e);
    }
    return { messages: [], sessionId: null };
  }

  function saveChatData(messages, sessionId) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        messages: messages,
        sessionId: sessionId,
        lastUpdated: Date.now()
      }));
    } catch (e) {
      console.error('Failed to save chat data:', e);
    }
  }

  function clearChatData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear chat data:', e);
    }
  }

  // Create widget
  function createWidget() {
    // Add styles
    var styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Create widget container
    var container = document.createElement('div');
    container.className = 'ai-chat-widget ' + position;

    // Logo/icon HTML
    var headerIconHtml = logoUrl
      ? '<img src="' + logoUrl + '" alt="Logo" style="width:28px;height:28px;border-radius:6px;object-fit:cover;">'
      : icons.bot;

    // Bot avatar HTML  
    var botAvatarHtml = avatarUrl
      ? '<img src="' + avatarUrl + '" alt="Bot" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">'
      : icons.bot;

    container.innerHTML = `
      <div class="ai-chat-window">
        <div class="ai-chat-header">
          <div class="ai-chat-header-info">
            <div class="ai-chat-header-icon">${headerIconHtml}</div>
            <div>
              <div class="ai-chat-header-title">${widgetTitle}</div>
              <div class="ai-chat-header-status">
                <span class="ai-chat-status-dot"></span>
                ${widgetSubtitle}
              </div>
            </div>
          </div>
          <div class="ai-chat-header-actions">
            <button class="ai-chat-header-btn ai-chat-clear" title="Clear chat history">${icons.trash}</button>
            <button class="ai-chat-header-btn ai-chat-maximize" title="Maximize">${icons.maximize}</button>
            <button class="ai-chat-header-btn ai-chat-close" title="Close">${icons.close}</button>
          </div>
        </div>
        <div class="ai-chat-messages">
          <div class="ai-chat-empty">
            ${botAvatarHtml}
            <p style="margin-top: 12px;">${welcomeMessage}</p>
          </div>
        </div>
        <form class="ai-chat-input-form">
          <input type="text" class="ai-chat-input" placeholder="${placeholder}" />
          <button type="submit" class="ai-chat-send">${icons.send}</button>
        </form>
      </div>
      <button class="ai-chat-toggle">${icons.message}</button>
    `;

    document.body.appendChild(container);

    // Load saved chat data
    var savedData = loadChatData();

    // Widget state
    var isOpen = false;
    var isMaximized = false;
    var isLoading = false;
    var messages = savedData.messages || [];
    var sessionId = savedData.sessionId || null;
    var thinkingStatus = { step: '', iteration: 0, type: 'processing' };

    // DOM elements
    var toggle = container.querySelector('.ai-chat-toggle');
    var chatWindow = container.querySelector('.ai-chat-window');
    var closeBtn = container.querySelector('.ai-chat-close');
    var clearBtn = container.querySelector('.ai-chat-clear');
    var maximizeBtn = container.querySelector('.ai-chat-maximize');
    var messagesEl = container.querySelector('.ai-chat-messages');
    var form = container.querySelector('.ai-chat-input-form');
    var input = container.querySelector('.ai-chat-input');
    var sendBtn = container.querySelector('.ai-chat-send');

    // Toggle chat
    function toggleChat() {
      isOpen = !isOpen;
      chatWindow.classList.toggle('open', isOpen);
      toggle.innerHTML = isOpen ? icons.close : icons.message;

      // Reset maximize state when closing
      if (!isOpen && isMaximized) {
        isMaximized = false;
        container.classList.remove('maximized');
        chatWindow.classList.remove('maximized');
        toggle.classList.remove('hidden');
        maximizeBtn.innerHTML = icons.maximize;
        maximizeBtn.title = 'Maximize';
      }

      if (isOpen) {
        input.focus();
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    toggle.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    // Maximize/Minimize
    function toggleMaximize() {
      isMaximized = !isMaximized;
      container.classList.toggle('maximized', isMaximized);
      chatWindow.classList.toggle('maximized', isMaximized);
      toggle.classList.toggle('hidden', isMaximized);
      maximizeBtn.innerHTML = isMaximized ? icons.minimize : icons.maximize;
      maximizeBtn.title = isMaximized ? 'Minimize' : 'Maximize';
    }

    maximizeBtn.addEventListener('click', toggleMaximize);

    // Clear chat
    function clearChat() {
      if (confirm('Clear all chat history?')) {
        messages = [];
        sessionId = null;
        clearChatData();
        renderMessages();
      }
    }

    clearBtn.addEventListener('click', clearChat);

    // Render messages
    function renderMessages() {
      if (messages.length === 0 && !isLoading) {
        messagesEl.innerHTML = `
          <div class="ai-chat-empty">
            ${botAvatarHtml}
            <p style="margin-top: 12px;">${welcomeMessage}</p>
          </div>
        `;
        return;
      }

      var html = messages.map(function (msg) {
        var avatarContent = msg.role === 'user' ? icons.user : botAvatarHtml;
        var content = msg.role === 'user'
          ? escapeHtml(msg.content)
          : parseMarkdown(msg.content);
        return `
          <div class="ai-chat-message ${msg.role}">
            <div class="ai-chat-avatar">${avatarContent}</div>
            <div class="ai-chat-content">${content}</div>
          </div>
        `;
      }).join('');

      if (isLoading) {
        var thinkingIcon = thinkingStatus.type === 'tool' ? icons.wrench :
          thinkingStatus.type === 'thinking' ? icons.brain : icons.loader;
        var thinkingLabel = thinkingStatus.type === 'tool' ? 'Using Tool' :
          thinkingStatus.type === 'thinking' ? 'Thinking' : 'Processing';
        html += `
          <div class="ai-chat-message assistant">
            <div class="ai-chat-avatar">${botAvatarHtml}</div>
            <div class="ai-chat-thinking">
              <div class="ai-chat-thinking-header">
                <span class="ai-chat-thinking-icon">${thinkingIcon}</span>
                <span class="ai-chat-thinking-label">${thinkingLabel}</span>
                ${thinkingStatus.iteration > 0 ? `<span class="ai-chat-thinking-step-num">Step ${thinkingStatus.iteration}</span>` : ''}
              </div>
              <div class="ai-chat-thinking-text">${thinkingStatus.step || 'Starting...'}</div>
              <div class="ai-chat-thinking-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        `;
      }

      messagesEl.innerHTML = html;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Send message with streaming support
    async function sendMessage(content) {
      messages.push({ role: 'user', content: content });
      saveChatData(messages, sessionId);
      renderMessages();

      isLoading = true;
      sendBtn.disabled = true;
      thinkingStatus = { step: 'Starting...', iteration: 0, type: 'processing' };
      renderMessages();

      try {
        // Try streaming first
        var streamRequest = {
          messages: messages.map(function (m) {
            return { role: m.role, content: m.content };
          })
        };

        // Include sessionId if we have one
        if (sessionId) {
          streamRequest.sessionId = sessionId;
        }

        // Include client info for tracking
        if (clientName) {
          streamRequest.clientName = clientName;
        }
        if (clientLevel) {
          streamRequest.clientLevel = clientLevel;
        }

        var streamResponse = await fetch(apiUrl + '/' + agentId + '/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(streamRequest)
        });

        if (streamResponse.ok && streamResponse.body) {
          var reader = streamResponse.body.getReader();
          var decoder = new TextDecoder();
          var finalContent = '';

          while (true) {
            var result = await reader.read();
            if (result.done) break;

            var chunk = decoder.decode(result.value, { stream: true });
            var lines = chunk.split('\n');

            for (var i = 0; i < lines.length; i++) {
              var line = lines[i];
              if (line.startsWith('data: ')) {
                try {
                  var data = JSON.parse(line.slice(6));

                  if (data.type === 'iteration_start') {
                    thinkingStatus = { step: 'Analyzing request...', iteration: data.iteration || 1, type: 'thinking' };
                    renderMessages();
                  } else if (data.type === 'thinking') {
                    var firstLine = (data.content || '').split('\n')[0].slice(0, 80);
                    thinkingStatus = { step: firstLine || 'Thinking...', iteration: data.iteration || 1, type: 'thinking' };
                    renderMessages();
                  } else if (data.type === 'tool_call') {
                    thinkingStatus = { step: 'Calling ' + data.toolName + '...', iteration: data.iteration || 1, type: 'tool' };
                    renderMessages();
                  } else if (data.type === 'tool_result') {
                    thinkingStatus = { step: 'Processing ' + data.toolName + ' result...', iteration: data.iteration || 1, type: 'processing' };
                    renderMessages();
                  } else if (data.type === 'content') {
                    thinkingStatus = { step: 'Generating response...', iteration: data.iteration || 1, type: 'processing' };
                    renderMessages();
                  } else if (data.type === 'complete') {
                    finalContent = data.finalResponse || '';
                    // Save sessionId from server
                    if (data.sessionId) {
                      sessionId = data.sessionId;
                    }
                  } else if (data.type === 'error') {
                    finalContent = data.content || 'An error occurred';
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }

          if (finalContent) {
            messages.push({ role: 'assistant', content: finalContent });
            saveChatData(messages, sessionId);
          }
        } else {
          // Fallback to non-streaming
          thinkingStatus = { step: 'Processing your request...', iteration: 1, type: 'processing' };
          renderMessages();

          var requestBody = {
            messages: messages.map(function (m) {
              return { role: m.role, content: m.content };
            })
          };

          if (sessionId) {
            requestBody.sessionId = sessionId;
          }

          // Include client info for tracking
          if (clientName) {
            requestBody.clientName = clientName;
          }
          if (clientLevel) {
            requestBody.clientLevel = clientLevel;
          }

          var response = await fetch(apiUrl + '/' + agentId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) throw new Error('Failed to get response');

          var data = await response.json();

          if (data.sessionId) {
            sessionId = data.sessionId;
          }

          messages.push({ role: 'assistant', content: data.message });
          saveChatData(messages, sessionId);
        }
      } catch (error) {
        console.error('Chat error:', error);
        messages.push({
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.'
        });
        saveChatData(messages, sessionId);
      } finally {
        isLoading = false;
        sendBtn.disabled = false;
        renderMessages();
      }
    }

    // Form submit
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var content = input.value.trim();
      if (!content || isLoading) return;
      input.value = '';
      sendMessage(content);
    });

    // Initial render
    renderMessages();
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
