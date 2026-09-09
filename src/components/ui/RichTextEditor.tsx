import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Link2, Undo2, AtSign } from 'lucide-react';
import { cn } from './cn';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
  /**
   * Recherche des collègues citables. Absent, la saisie de « @ » reste du
   * texte ordinaire : l'éditeur sert aussi là où les mentions n'ont pas de
   * sens.
   */
  onMentionSearch?: (query: string) => Promise<MentionCandidate[]>;
}

/** Balises et attributs conservés au collage et à l'affichage. */
const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'DIV',
  'UL', 'OL', 'LI', 'A', 'SPAN',
]);

/**
 * Nettoie du HTML avant stockage ou affichage.
 *
 * Le contenu vient d'une saisie libre et peut avoir été collé depuis Word ou
 * une page web : sans filtrage, on stockerait des styles indésirables, et
 * surtout un `<script>` ou un `onerror=` réinjecté dans la page. Seules les
 * balises de mise en forme survivent.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      walk(child);

      if (!ALLOWED_TAGS.has(child.tagName)) {
        // La balise disparaît, son texte reste : supprimer le nœud entier
        // ferait perdre le contenu collé.
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }

      // Une mention est un SPAN portant l'identifiant du collègue cité.
      // C'est la seule donnée conservée sur un SPAN : sans elle, la mention
      // perdrait son identité au premier nettoyage et ne serait plus qu'un
      // texte « @Julie » sans destinataire.
      const isMention = child.tagName === 'SPAN' && child.hasAttribute('data-mention');

      for (const attr of Array.from(child.attributes)) {
        const keep =
          (child.tagName === 'A' && attr.name === 'href' && /^https?:/i.test(attr.value)) ||
          (isMention && (attr.name === 'data-mention' || attr.name === 'class'));
        if (!keep) child.removeAttribute(attr.name);
      }

      if (isMention) {
        // Classe imposée plutôt que conservée telle quelle : le HTML stocké
        // peut avoir été forgé, et ne doit pas choisir son propre style.
        child.setAttribute('class', 'mention');
      }

      if (child.tagName === 'A') {
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noreferrer');
      }
    }
  };

  walk(root);
  return root.innerHTML;
}

/** Vrai si le HTML ne porte aucun texte ni liste : un `<br>` seul ne compte pas. */
export function isHtmlEmpty(html: string): boolean {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const text = doc.body.textContent?.trim() ?? '';
  return text.length === 0 && !doc.body.querySelector('li');
}

/** Personne citable dans un commentaire. */
export interface MentionCandidate {
  id: string;
  name: string;
  email?: string | null;
}

/**
 * Texte tapé après un « @ », si le curseur est en train d'en composer un.
 *
 * Le « @ » doit suivre un espace ou un début de ligne : sans cette règle,
 * une adresse de courriel déclencherait le menu à chaque frappe.
 */
function mentionQueryAtCaret(): { query: string; node: Text; start: number } | null {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || !selection.anchorNode) return null;

  const node = selection.anchorNode;
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent ?? '';
  const before = text.slice(0, selection.anchorOffset);
  const match = /(^|\s)@([\p{L}\p{N}._-]*)$/u.exec(before);
  if (!match) return null;

  return {
    query: match[2],
    node: node as Text,
    start: before.length - match[2].length - 1,
  };
}

/**
 * Éditeur de texte enrichi minimal, sans dépendance.
 *
 * `contentEditable` avec `document.execCommand` : l'API est marquée obsolète
 * mais reste implémentée par tous les navigateurs, et elle évite d'ajouter
 * une bibliothèque de plusieurs centaines de kilo-octets pour du gras, de
 * l'italique et deux listes.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = '96px',
  disabled,
  onMentionSearch,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  // Position du menu, calculée depuis le curseur : un menu ancré au champ
  // se retrouverait loin du texte sur un commentaire de plusieurs lignes.
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const closeMenu = () => {
    setMentionQuery(null);
    setCandidates([]);
    setHighlighted(0);
    setMenuPos(null);
  };

  /** Cherche les collègues correspondant au texte tapé après le « @ ». */
  useEffect(() => {
    if (mentionQuery === null || !onMentionSearch) return;

    let cancelled = false;
    // Court délai : sans lui, chaque frappe interrogerait l'annuaire.
    const timer = window.setTimeout(async () => {
      try {
        const found = await onMentionSearch(mentionQuery);
        if (!cancelled) {
          setCandidates(found);
          setHighlighted(0);
        }
      } catch {
        // Annuaire indisponible : le menu reste vide, la saisie continue.
        if (!cancelled) setCandidates([]);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mentionQuery, onMentionSearch]);

  /** Détecte un « @ » en cours de frappe et positionne le menu. */
  const detectMention = () => {
    if (!onMentionSearch) return;

    const found = mentionQueryAtCaret();
    if (!found) return closeMenu();

    setMentionQuery(found.query);

    const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect();
    const host = ref.current?.getBoundingClientRect();
    if (rect && host) {
      setMenuPos({ top: rect.bottom - host.top + 4, left: rect.left - host.left });
    }
  };

  /**
   * Remplace le « @texte » en cours par une mention.
   *
   * La mention est suivie d'une espace insécable : sans elle, le curseur
   * resterait à l'intérieur du span et la suite du texte hériterait du
   * style de la mention.
   */
  const insertMention = (user: MentionCandidate) => {
    const found = mentionQueryAtCaret();
    if (!found || !ref.current) return closeMenu();

    const range = document.createRange();
    range.setStart(found.node, found.start);
    range.setEnd(found.node, found.start + found.query.length + 1);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const span = document.createElement('span');
    span.setAttribute('data-mention', user.id);
    span.className = 'mention';
    span.textContent = `@${user.name}`;

    document.execCommand('insertHTML', false, `${span.outerHTML}&nbsp;`);

    onChange(sanitizeHtml(ref.current.innerHTML));
    closeMenu();
  };

  /** Navigation au clavier dans le menu, sans quitter la saisie. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mentionQuery === null || !candidates.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % candidates.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + candidates.length) % candidates.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(candidates[highlighted]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    }
  };

  // La valeur n'est réécrite que lorsqu'elle diverge du DOM : réaffecter
  // innerHTML à chaque frappe replacerait le curseur en tête de champ.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    if (ref.current) onChange(sanitizeHtml(ref.current.innerHTML));
  };

  const addLink = () => {
    const url = window.prompt('Adresse du lien (https://…)');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      window.alert('Le lien doit commencer par http:// ou https://');
      return;
    }
    exec('createLink', url);
  };

  const empty = isHtmlEmpty(value);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[--k-border] bg-[--k-surface]',
        'focus-within:border-[--k-primary] focus-within:ring-2 focus-within:ring-[--k-primary]/10',
        disabled && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[--k-border] bg-[--k-surface-2] px-1.5 py-1">
        <ToolbarButton label="Gras" onClick={() => exec('bold')} disabled={disabled}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Italique" onClick={() => exec('italic')} disabled={disabled}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-[--k-border]" />
        <ToolbarButton
          label="Liste à puces"
          onClick={() => exec('insertUnorderedList')}
          disabled={disabled}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Liste numérotée"
          onClick={() => exec('insertOrderedList')}
          disabled={disabled}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-[--k-border]" />
        <ToolbarButton label="Insérer un lien" onClick={addLink} disabled={disabled}>
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Annuler" onClick={() => exec('undo')} disabled={disabled}>
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        {onMentionSearch && (
          // Indication plutôt que bouton : la mention se déclenche en tapant
          // « @ », et un bouton laisserait croire qu'il y a deux façons de faire.
          <span className="ml-auto flex items-center gap-1 pr-1 text-[11px] text-[--k-muted]">
            <AtSign className="h-3 w-3" />
            pour mentionner
          </span>
        )}
      </div>

      <div className="relative">
        {empty && placeholder && (
          // Le placeholder est un calque : `contentEditable` n'en accepte pas.
          <p className="pointer-events-none absolute left-3 top-2 text-[13px] text-[--k-muted]">
            {placeholder}
          </p>
        )}
        <div
          ref={ref}
          contentEditable={!disabled}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          suppressContentEditableWarning
          onInput={(e) => {
            onChange(sanitizeHtml(e.currentTarget.innerHTML));
            detectMention();
          }}
          onKeyDown={onKeyDown}
          // Le menu suit le curseur : un clic ailleurs le rend caduc.
          onBlur={() => window.setTimeout(closeMenu, 150)}
          // Collage en texte brut puis remise en forme : le HTML de Word
          // arriverait sinon avec ses styles et ses balises propriétaires.
          onPaste={(e) => {
            e.preventDefault();
            const html = e.clipboardData.getData('text/html');
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertHTML', false, html ? sanitizeHtml(html) : text);
            if (ref.current) onChange(sanitizeHtml(ref.current.innerHTML));
          }}
          className="prose-comment max-h-72 overflow-y-auto px-3 py-2 text-[13px] text-[--k-text] outline-none"
          style={{ minHeight }}
        />

        {mentionQuery !== null && candidates.length > 0 && menuPos && (
          <ul
            role="listbox"
            aria-label="Collègues à mentionner"
            className="absolute z-20 max-h-56 w-64 overflow-y-auto rounded-xl border border-[--k-border] bg-[--k-surface] py-1 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {candidates.map((user, i) => (
              <li key={user.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlighted}
                  // onMouseDown : onClick arriverait après le onBlur du champ,
                  // qui aurait déjà fermé le menu.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(user);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={cn(
                    'flex w-full flex-col items-start px-3 py-1.5 text-left text-[13px]',
                    i === highlighted ? 'bg-[--k-primary]/10 text-[--k-text]' : 'text-[--k-text]',
                  )}
                >
                  <span className="font-medium">{user.name}</span>
                  {user.email && (
                    <span className="text-[11px] text-[--k-muted]">{user.email}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      // onMouseDown plutôt que onClick : le clic ferait perdre le focus de
      // l'éditeur, et la commande s'appliquerait hors de toute sélection.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="rounded-md p-1.5 text-[--k-muted] transition hover:bg-[--k-surface] hover:text-[--k-text] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
