import { useEffect, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Link2, Undo2 } from 'lucide-react';
import { cn } from './cn';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
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

      for (const attr of Array.from(child.attributes)) {
        const keep =
          child.tagName === 'A' && attr.name === 'href' && /^https?:/i.test(attr.value);
        if (!keep) child.removeAttribute(attr.name);
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
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

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
          onInput={(e) => onChange(sanitizeHtml(e.currentTarget.innerHTML))}
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
