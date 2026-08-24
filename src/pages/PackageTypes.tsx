import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  Star,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { api, type PackageTypePayload } from '../services/api';
import type { PackageType } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, SelectField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { cn } from '../components/ui/cn';
import { describe } from '../components/ui/PackageTypePicker';

const EMPTY: PackageTypePayload = {
  label: '',
  weight: '',
  length: '',
  width: '',
  height: '',
  description: '',
  packagingType: '02',
  reference: '',
};

export default function PackageTypes() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<PackageType | null>(null);
  const [draft, setDraft] = useState<PackageTypePayload | null>(null);

  const types = useQuery({
    queryKey: ['package-types', { search, includeArchived }],
    queryFn: () => api.listPackageTypes({ search: search || undefined, includeArchived }),
    retry: false,
  });

  const codes = useQuery({
    queryKey: ['packaging-codes'],
    queryFn: () => api.getPackagingCodes(),
    staleTime: Infinity,
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['package-types'] });

  const save = useMutation({
    mutationFn: (payload: PackageTypePayload) =>
      editing ? api.updatePackageType(editing.id, payload) : api.createPackageType(payload),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const archive = useMutation({
    mutationFn: ({ id, hard }: { id: number; hard: boolean }) => api.archivePackageType(id, hard),
    onSuccess: invalidate,
  });

  const restore = useMutation({
    mutationFn: (id: number) => api.restorePackageType(id),
    onSuccess: invalidate,
  });

  const setDefault = useMutation({
    mutationFn: (type: PackageType) =>
      api.updatePackageType(type.id, { isDefault: !type.isDefault }),
    onSuccess: invalidate,
  });

  const items = types.data?.types ?? [];

  function openCreate() {
    setEditing(null);
    setDraft({ ...EMPTY });
  }

  function openEdit(type: PackageType) {
    setEditing(type);
    setDraft({
      label: type.label,
      weight: type.weight,
      length: type.length,
      width: type.width,
      height: type.height,
      description: type.description ?? '',
      packagingType: type.packagingType,
      reference: type.reference ?? '',
    });
  }

  function closeForm() {
    setEditing(null);
    setDraft(null);
    save.reset();
  }

  const set = (patch: Partial<PackageTypePayload>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  // Seuls le nom et le poids sont exigés, comme côté backend.
  const missing = draft
    ? (['label', 'weight'] as const).filter((key) => !String(draft[key] ?? '').trim())
    : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft || missing.length) return;
    save.mutate(draft);
  };

  if (types.isError) {
    return (
      <div>
        <PageHeader
          title="Types de colis"
          subtitle="Le matériel que vous expédiez régulièrement, avec son poids."
        />
        <Alert type="error">{(types.error as Error).message}</Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Types de colis"
        subtitle="Enregistrez le matériel que vous expédiez régulièrement : son poids et ses dimensions se remplissent ensuite en un clic."
        action={
          <Button type="button" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            Nouveau type
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-1 items-center gap-2 rounded-xl border border-[--k-border] bg-[--k-surface-2] px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-[--k-muted]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un matériel…"
                  className="w-full bg-transparent text-[13px] outline-none placeholder:text-[--k-muted]"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')}>
                    <X className="h-4 w-4 text-[--k-muted] hover:text-[--k-text]" />
                  </button>
                )}
              </label>

              <label className="inline-flex items-center gap-2 text-[13px] text-[--k-muted]">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                />
                Afficher les archivés
              </label>
            </div>
          </Card>

          {types.isLoading ? (
            <Card>
              <p className="text-[13px] text-[--k-muted]">Chargement du catalogue…</p>
            </Card>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={search ? 'Aucun type ne correspond' : 'Catalogue vide'}
              description={
                search
                  ? 'Essayez un autre terme de recherche.'
                  : 'Enregistrez votre matériel courant pour ne plus ressaisir son poids à chaque envoi.'
              }
            >
              {!search && (
                <Button type="button" onClick={() => openCreate()}>
                  <Plus className="h-4 w-4" />
                  Ajouter le premier type
                </Button>
              )}
            </EmptyState>
          ) : (
            <Card>
              <CardTitle
                title="Matériel enregistré"
                hint={`${items.length} type${items.length > 1 ? 's' : ''}`}
              />
              <div className="divide-y divide-[--k-border]">
                {items.map((type) => (
                  <TypeRow
                    key={type.id}
                    type={type}
                    packagingName={
                      codes.data?.find((c) => c.code === type.packagingType)?.name ?? null
                    }
                    onEdit={() => openEdit(type)}
                    onArchive={() => archive.mutate({ id: type.id, hard: false })}
                    onDelete={() => archive.mutate({ id: type.id, hard: true })}
                    onRestore={() => restore.mutate(type.id)}
                    onToggleDefault={() => setDefault.mutate(type)}
                  />
                ))}
              </div>
            </Card>
          )}

          {(archive.isError || restore.isError || setDefault.isError) && (
            <Alert type="error">
              {((archive.error || restore.error || setDefault.error) as Error).message}
            </Alert>
          )}
        </div>

        <div className="lg:sticky lg:top-4">
          <Card>
            <CardTitle title="À quoi ça sert" />
            <p className="text-[13px] text-[--k-muted]">
              Sur les pages <strong className="text-[--k-text]">Étiquettes</strong> et{' '}
              <strong className="text-[--k-text]">Tarifs</strong>, un sélecteur « Charger un type
              de colis » remplit poids et dimensions en un clic. Indiquez une quantité pour
              ajouter plusieurs colis identiques d’un coup.
            </p>
            <p className="mt-3 text-[13px] text-[--k-muted]">
              Dans l’envoi groupé, une colonne <code>type</code> du CSV suffit : le poids est
              retrouvé automatiquement.
            </p>
            <p className="mt-3 text-[12px] text-[--k-muted]">
              Les valeurs restent modifiables au moment de l’envoi : un cas particulier se corrige
              à la main, sans créer un type dédié.
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={draft !== null}
        onClose={closeForm}
        title={editing ? 'Modifier le type' : 'Nouveau type de colis'}
        hint={editing ? editing.label : 'Poids et dimensions préremplis sur les pages d’expédition.'}
        footer={
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="package-type-form"
              isLoading={save.isPending}
              disabled={missing.length > 0}
            >
              {editing ? 'Enregistrer' : 'Ajouter au catalogue'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Annuler
            </Button>
            {missing.length > 0 && (
              <p className="ml-auto text-right text-[12px] text-[--k-muted]">
                Champs obligatoires manquants : {missing.join(', ')}
              </p>
            )}
          </div>
        }
      >
        {draft && (
          // Le bouton d'envoi vit dans le pied du modal : `form` l'y rattache
          // pour que la barre d'actions reste visible pendant le défilement.
          <form id="package-type-form" onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Nom"
                required
                placeholder="DS620, Borne Spherik…"
                value={draft.label}
                onChange={(e) => set({ label: e.target.value })}
              />
              <Field
                label="Poids (kg)"
                required
                type="number"
                step="0.1"
                min="0.1"
                placeholder="12.5"
                value={draft.weight}
                onChange={(e) => set({ weight: e.target.value })}
              />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[--k-muted]">
                Dimensions (facultatives)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Field
                  label="Longueur"
                  type="number"
                  min="1"
                  value={draft.length ?? ''}
                  onChange={(e) => set({ length: e.target.value })}
                />
                <Field
                  label="Largeur"
                  type="number"
                  min="1"
                  value={draft.width ?? ''}
                  onChange={(e) => set({ width: e.target.value })}
                />
                <Field
                  label="Hauteur"
                  type="number"
                  min="1"
                  value={draft.height ?? ''}
                  onChange={(e) => set({ height: e.target.value })}
                />
              </div>
              <p className="mt-1 text-[12px] text-[--k-muted]">
                En centimètres. UPS ne les prend en compte que si les trois sont renseignées.
              </p>
            </div>

            <Field
              label="Description"
              placeholder="Imprimante photo DS620"
              value={draft.description ?? ''}
              onChange={(e) => set({ description: e.target.value })}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Type d'emballage"
                value={draft.packagingType ?? '02'}
                onChange={(e) => set({ packagingType: e.target.value })}
              >
                {(codes.data ?? [{ code: '02', name: 'Colis client' }]).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <Field
                label="Référence par défaut"
                placeholder="Laissez vide si elle change"
                value={draft.reference ?? ''}
                onChange={(e) => set({ reference: e.target.value })}
              />
            </div>

            {save.isError && <Alert type="error">{(save.error as Error).message}</Alert>}
          </form>
        )}
      </Modal>
    </div>
  );
}

interface TypeRowProps {
  type: PackageType;
  packagingName: string | null;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onToggleDefault: () => void;
}

function TypeRow({
  type,
  packagingName,
  onEdit,
  onArchive,
  onDelete,
  onRestore,
  onToggleDefault,
}: TypeRowProps) {
  const archived = Boolean(type.archivedAt);

  return (
    <div className={cn('flex items-start justify-between gap-3 py-2.5', archived && 'opacity-60')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-[--k-text]">{type.label}</span>
          {type.isDefault && (
            <Badge tone="warning">
              <Star className="h-3 w-3 fill-current" />
              Par défaut
            </Badge>
          )}
          {archived && <Badge tone="neutral">Archivé</Badge>}
          {/* Le colis client est le cas courant : inutile de l'afficher. */}
          {packagingName && type.packagingType !== '02' && (
            <Badge tone="primary">{packagingName}</Badge>
          )}
          {type.usageCount > 0 && (
            <Badge tone="neutral">
              {type.usageCount} utilisation{type.usageCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[--k-muted]">{describe(type)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {archived ? (
          <>
            <Button type="button" variant="ghost" size="sm" title="Restaurer" onClick={onRestore}>
              <ArchiveRestore className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Supprimer définitivement"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={type.isDefault ? 'Retirer le défaut' : 'Définir par défaut'}
              onClick={onToggleDefault}
            >
              <Star className={cn('h-4 w-4', type.isDefault && 'fill-amber-400 text-amber-400')} />
            </Button>
            <Button type="button" variant="ghost" size="sm" title="Modifier" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" title="Archiver" onClick={onArchive}>
              <Archive className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
