// 生成時にHTMLへ埋め込むシンタックスハイライト。ブラウザ表示時に外部CDNやnpmパッケージを必要としない。

import path from 'node:path';
import { escapeHtml } from './common.mjs';

const HIGHLIGHT_KEYWORDS = {
  javascript: new Set('as async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch this throw try typeof var void while with yield true false null undefined'.split(' ')),
  python: new Set('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield match case'.split(' ')),
  java: new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record sealed permits var'.split(' ')),
  c: new Set('auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while _Bool true false null'.split(' ')),
  go: new Set('break default func interface select case defer go map struct chan else goto package switch const fallthrough if range type continue for import return var true false nil'.split(' ')),
  rust: new Set('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'.split(' ')),
  sql: new Set('select from where join inner left right full outer on group by order having limit offset insert into values update set delete create alter drop table view index distinct union all as and or not null is in exists between like case when then else end asc desc primary key foreign references constraint default true false'.split(' ')),
  shell: new Set('if then else elif fi for while until do done case esac function in select time coproc export local readonly declare typeset unset shift return break continue true false'.split(' ')),
  css: new Set('@media @supports @import @font-face @keyframes @layer @container inherit initial unset revert important'.split(' ')),
};

function highlightFamily(file) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file).toLowerCase();
  if (['.ts','.tsx','.js','.jsx','.mjs','.cjs','.vue','.svelte'].includes(ext)) return 'javascript';
  if (ext === '.py') return 'python';
  if (['.java','.kt','.kts','.gradle'].includes(ext)) return 'java';
  if (['.c','.h','.cpp','.cc','.cxx','.hpp','.hh','.cs'].includes(ext)) return 'c';
  if (ext === '.go') return 'go';
  if (ext === '.rs') return 'rust';
  if (ext === '.sql') return 'sql';
  if (['.sh','.bash','.zsh','.ps1','.bat','.cmd'].includes(ext) || base === 'dockerfile') return 'shell';
  if (['.css','.scss','.sass','.less'].includes(ext)) return 'css';
  if (['.html','.htm','.xml','.svg'].includes(ext)) return 'markup';
  if (ext === '.json') return 'json';
  if (['.yaml','.yml','.toml','.ini','.properties'].includes(ext)) return 'config';
  if (ext === '.md') return 'markdown';
  if (['.graphql','.gql'].includes(ext)) return 'graphql';
  return 'plain';
}

function keywordSetFor(family) {
  if (family === 'graphql') return new Set('query mutation subscription fragment on schema type interface union enum input scalar directive extend implements true false null'.split(' '));
  return HIGHLIGHT_KEYWORDS[family] || new Set();
}

export function highlightCode(text, file) {
  const family = highlightFamily(file);
  if (family === 'plain') return escapeHtml(text);
  if (family === 'markup') return highlightMarkup(text);
  if (family === 'markdown') return highlightMarkdown(text);
  if (family === 'config') return highlightConfig(text);
  return highlightCStyle(text, family);
}

function span(cls, value) {
  return escapeHtml(value).split('\n').map(part => `<span class="tok-${cls}">${part}</span>`).join('\n');
}

function highlightMarkup(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      const j = end < 0 ? text.length : end + 3;
      out += span('comment', text.slice(i, j)); i = j; continue;
    }
    if (text[i] === '<') {
      const end = text.indexOf('>', i + 1);
      const j = end < 0 ? text.length : end + 1;
      const raw = text.slice(i, j);
      const escaped = escapeHtml(raw)
        .replace(/(&lt;\/?)([A-Za-z][\w:-]*)/, '$1<span class="tok-tag">$2</span>')
        .replace(/\s([A-Za-z_:][-\w:.]*)(=)/g, ' <span class="tok-attr">$1</span>$2')
        .replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-string">$1</span>');
      out += escaped; i = j; continue;
    }
    const next = text.indexOf('<', i);
    const j = next < 0 ? text.length : next;
    out += escapeHtml(text.slice(i, j)); i = j;
  }
  return out;
}

function highlightMarkdown(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let fenced = false;
  return lines.map(line => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return span('keyword', line); }
    if (fenced) return escapeHtml(line);
    let e = escapeHtml(line);
    e = e.replace(/^(\s{0,3}#{1,6}\s+)(.*)$/,'<span class="tok-keyword">$1</span><span class="tok-title">$2</span>');
    e = e.replace(/(`[^`]+`)/g,'<span class="tok-string">$1</span>');
    e = e.replace(/(\*\*[^*]+\*\*|__[^_]+__)/g,'<span class="tok-title">$1</span>');
    e = e.replace(/(\[[^\]]+\]\([^\)]+\))/g,'<span class="tok-link">$1</span>');
    return e;
  }).join('\n');
}

function highlightConfig(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(line => {
    const m = line.match(/^(\s*)(#|;)(.*)$/);
    if (m) return escapeHtml(m[1]) + span('comment', m[2] + m[3]);
    const kv = line.match(/^(\s*)([^:=\s][^:=]*?)(\s*[:=]\s*)(.*)$/);
    if (kv) return escapeHtml(kv[1]) + span('attr', kv[2]) + escapeHtml(kv[3]) + highlightCStyle(kv[4], 'json');
    return highlightCStyle(line, 'json');
  }).join('\n');
}

function highlightCStyle(text, family) {
  const keywords = keywordSetFor(family);
  let out = '';
  let i = 0;
  let blockComment = false;
  const hashComments = ['python','shell','graphql'].includes(family);
  const slashComments = !['python','shell','graphql','sql','css','json'].includes(family);
  while (i < text.length) {
    if (blockComment) {
      const end = text.indexOf('*/', i);
      const j = end < 0 ? text.length : end + 2;
      out += span('comment', text.slice(i, j)); i = j; blockComment = end < 0; continue;
    }
    if (text.startsWith('/*', i) && !['python','shell','graphql','json'].includes(family)) {
      const end = text.indexOf('*/', i + 2);
      const j = end < 0 ? text.length : end + 2;
      out += span('comment', text.slice(i, j)); i = j; blockComment = end < 0; continue;
    }
    if ((slashComments && text.startsWith('//', i)) || (family === 'sql' && text.startsWith('--', i)) || (hashComments && text[i] === '#')) {
      const end = text.indexOf('\n', i);
      const j = end < 0 ? text.length : end;
      out += span('comment', text.slice(i, j)); i = j; continue;
    }
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch; let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === quote) { j++; break; }
        j++;
      }
      out += span('string', text.slice(i, j)); i = j; continue;
    }
    const num = text.slice(i).match(/^(?:0x[0-9a-fA-F]+|0b[01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
    if (num) { out += span('number', num[0]); i += num[0].length; continue; }
    const word = text.slice(i).match(/^[A-Za-z_$][\w$]*/);
    if (word) {
      const w = word[0];
      if (keywords.has(family === 'sql' ? w.toLowerCase() : w)) out += span('keyword', w);
      else if (/^(true|false|null|undefined|nil|None|True|False)$/i.test(w)) out += span('literal', w);
      else {
        const tail = text.slice(i + w.length);
        out += /^\s*\(/.test(tail) ? span('function', w) : escapeHtml(w);
      }
      i += w.length; continue;
    }
    out += escapeHtml(ch); i++;
  }
  return out;
}

export function languageFor(file) {
  const ext = path.extname(file).toLowerCase();
  const map = {
    '.ts':'TypeScript','.tsx':'TSX','.js':'JavaScript','.jsx':'JSX','.mjs':'JavaScript','.cjs':'JavaScript',
    '.java':'Java','.kt':'Kotlin','.kts':'Kotlin','.py':'Python','.rb':'Ruby','.go':'Go','.rs':'Rust',
    '.c':'C','.h':'C Header','.cpp':'C++','.cc':'C++','.hpp':'C++ Header','.cs':'C#','.php':'PHP',
    '.html':'HTML','.htm':'HTML','.css':'CSS','.scss':'SCSS','.sass':'Sass','.less':'Less',
    '.json':'JSON','.yaml':'YAML','.yml':'YAML','.xml':'XML','.toml':'TOML','.ini':'INI','.properties':'Properties',
    '.md':'Markdown','.sql':'SQL','.sh':'Shell','.bash':'Shell','.zsh':'Shell','.ps1':'PowerShell','.bat':'Batch','.cmd':'Batch',
    '.gradle':'Gradle','.graphql':'GraphQL','.gql':'GraphQL','.vue':'Vue','.svelte':'Svelte'
  };
  return map[ext] || (path.basename(file).toLowerCase() === 'dockerfile' ? 'Dockerfile' : 'Plain Text');
}
