import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookUser,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  Star,
  Trash2,
  FolderPlus,
  Search,
  X,
  Upload,
  FileDown,
  Warehouse,
} from 'lucide-react';
import { api, type AddressPayload } from '../services/api';
import type { SavedAddress } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, SelectField } from '../components/ui/Field';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';
import { Modal } from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { cn } from '../components/ui/cn';

const EMPTY: AddressPayload = {
  label: '',
  groupId: null,
  name: '',
  attentionName: '',
  phone: '',
  addressLine1: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'FR',
};

const CSV_HEADER = 'nom;destinataire;adresse;ville;code_postal;pays;telephone;groupe';
const CSV_EXAMPLE = `${CSV_HEADER}
Antenne Lyon;Antenne Lyon Part-Dieu;10 rue Victor Hugo;Lyon;69001;FR;0102030405;Antennes
Client Dupont;Jean Dupont;5 avenue de la Gare;Nantes;44000;FR;;Partenaires`;

interface ParsedRow {
  payload: AddressPayload;
  groupName?: string;
}

/**
 * Lit un CSV point-virgule. Même convention que l'envoi groupé : en-tête
 * facultatif, colonnes dans un ordre fixe, une erreur par ligne fautive
 * plutôt qu'un rejet global du fichier.
 */
function parseCsv(text: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const [i, line] of lines.entries()) {
    // Ignore la ligne d'en-tête si elle est présente.
    if (i === 0 && /nom\s*;/i.test(line)) continue;

    const cols = line.split(';').map((c) => c.trim());
    const [label, name, address, city, postalCode, country, phone, groupName] = cols;

    if (!label || !address || !city || !postalCode) {
      errors.push(`Ligne ${i + 1} : nom, adresse, ville et code postal sont obligatoires.`);
      continue;
    }

    const iso = (country || 'FR').toUpperCase();
    if (iso.length !== 2) {
      errors.push(`Ligne ${i + 1} : pays « ${country} » — un code ISO à 2 lettres est attendu.`);
      continue;
    }

    rows.push({
      payload: {
        label,
        // Sans destinataire explicite, le nom du carnet fait office d'étiquette.
        name: name || label,
        addressLine1: address,
        city,
        postalCode,
        country: iso,
        phone: phone || undefined,
      },
      groupName: groupName || undefined,
    });
  }

  return { rows, errors };
}

export default function AddressBook() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [draft, setDraft] = useState<AddressPayload | null>(null);
  const [newGroup, setNewGroup] = useState('');
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const addresses = useQuery({
    queryKey: ['addresses', { search, includeArchived }],
    queryFn: () => api.listAddresses({ search: search || undefined, includeArchived }),
    retry: false,
  });

  const groups = useQuery({
    queryKey: ['address-groups'],
    queryFn: () => api.listAddressGroups(),
    retry: false,
  });

  /** Toute écriture invalide les listes : le carnet est partagé, il doit rester à jour. */
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['addresses'] });
    queryClient.invalidateQueries({ queryKey: ['address-groups'] });
  };

  const saveAddress = useMutation({
    mutationFn: (payload: AddressPayload) =>
      editing ? api.updateAddress(editing.id, payload) : api.createAddress(payload),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const archive = useMutation({
    mutationFn: ({ id, hard }: { id: number; hard: boolean }) => api.archiveAddress(id, hard),
    onSuccess: invalidate,
  });

  const restore = useMutation({
    mutationFn: (id: number) => api.restoreAddress(id),
    onSuccess: invalidate,
  });

  const setDefault = useMutation({
    mutationFn: (address: SavedAddress) =>
      api.updateAddress(address.id, { isDefault: !address.isDefault }),
    onSuccess: invalidate,
  });

  const setDefaultShipper = useMutation({
    mutationFn: (address: SavedAddress) =>
      api.updateAddress(address.id, { isDefaultShipper: !address.isDefaultShipper }),
    onSuccess: invalidate,
  });

  const createGroup = useMutation({
    mutationFn: (name: string) => api.createAddressGroup(name),
    onSuccess: () => {
      invalidate();
      setNewGroup('');
      setShowGroupForm(false);
    },
  });

  const deleteGroup = useMutation({
    mutationFn: (id: number) => api.deleteAddressGroup(id),
    onSuccess: invalidate,
  });


  /**
   * Import CSV : les lignes sont créées une par une, et un échec isolé
   * (nom déjà pris, par exemple) n'interrompt pas le reste du fichier.
   * Les groupes nommés dans le CSV sont créés s'ils n'existent pas encore.
   */
  const importCsv = useMutation({
    mutationFn: async (rows: ParsedRow[]) => {
      const existing = new Map(
        (await api.listAddressGroups()).map((g) => [g.name.toLowerCase(), g.id]),
      );
      const failures: string[] = [];
      let created = 0;

      for (const [i, row] of rows.entries()) {
        try {
          let groupId: number | null = null;

          if (row.groupName) {
            const key = row.groupName.toLowerCase();
            if (!existing.has(key)) {
              const group = await api.createAddressGroup(row.groupName);
              existing.set(key, group.id);
            }
            groupId = existing.get(key) ?? null;
          }

          await api.createAddress({ ...row.payload, groupId });
          created += 1;
        } catch (err) {
          failures.push(`Ligne ${i + 1} (${row.payload.label}) : ${(err as Error).message}`);
        }
      }

      return { created, failures };
    },
    onSuccess: (result) => {
      invalidate();
      setCsvErrors(result.failures);
    },
  });

  function onCsvFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const { rows, errors } = parseCsv(String(reader.result));
      setCsvErrors(errors);
      if (rows.length) importCsv.mutate(rows);
    };
    reader.readAsText(file);
    // Permet de réimporter le même fichier après correction.
    e.target.value = '';
  }

  function downloadCsvModel() {
    const blob = new Blob([CSV_EXAMPLE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele-carnet-adresses.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const items = addresses.data?.addresses ?? [];

  /** Regroupe pour l'affichage ; « Sans groupe » en dernier. */
  const sections = useMemo(() => {
    const names = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
    const bucket = new Map<string, SavedAddress[]>();

    for (const address of items) {
      const key = address.groupId ? (names.get(address.groupId) ?? 'Autres') : 'Sans groupe';
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key)!.push(address);
    }

    return [...bucket.entries()].sort(([a], [b]) =>
      a === 'Sans groupe' ? 1 : b === 'Sans groupe' ? -1 : a.localeCompare(b),
    );
  }, [items, groups.data]);

  function openCreate() {
    setEditing(null);
    setDraft({ ...EMPTY });
  }

  function openEdit(address: SavedAddress) {
    setEditing(address);
    setDraft({
      label: address.label,
      groupId: address.groupId,
      name: address.name ?? '',
      attentionName: address.attentionName ?? '',
      phone: address.phone ?? '',
      addressLine1: address.addressLine1 ?? '',
      addressLine2: address.addressLine2 ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      postalCode: address.postalCode ?? '',
      country: address.country ?? 'FR',
      residential: address.residential,
    });
  }

  function closeForm() {
    setEditing(null);
    setDraft(null);
    saveAddress.reset();
  }

  const set = (patch: Partial<AddressPayload>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const missing = draft
    ? (['label', 'name', 'addressLine1', 'city', 'postalCode', 'country'] as const).filter(
        (key) => !String(draft[key] ?? '').trim(),
      )
    : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft || missing.length) return;
    saveAddress.mutate(draft);
  };

  // Sans base, le carnet entier est indisponible : on l'explique plutôt que
  // d'afficher une liste vide trompeuse.
  if (addresses.isError) {
    return (
      <div>
        <PageHeader
          title="Carnet d'adresses"
          subtitle="Adresses réutilisables, partagées par toute l'équipe."
        />
        <Alert type="error">{(addresses.error as Error).message}</Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Carnet d'adresses"
        subtitle="Adresses réutilisables, partagées par toute l'équipe. Organisez-les en groupes (antennes, partenaires…)."
        action={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvelle adresse
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
                  placeholder="Rechercher par nom, ville, code postal…"
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
                Afficher les archivées
              </label>

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[--k-border] bg-white px-3 py-2 text-[13px] font-medium text-[--k-text] transition hover:bg-[--k-surface-2]">
                <Upload className="h-4 w-4" />
                {importCsv.isPending ? 'Import en cours…' : 'Importer un CSV'}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  disabled={importCsv.isPending}
                  onChange={onCsvFile}
                />
              </label>

              <Button type="button" variant="ghost" size="sm" onClick={downloadCsvModel}>
                <FileDown className="h-4 w-4" />
                Modèle
              </Button>
            </div>
            {importCsv.isSuccess && importCsv.data.created > 0 && (
              <Alert type="success" className="mt-3">
                {importCsv.data.created} adresse{importCsv.data.created > 1 ? 's' : ''} importée
                {importCsv.data.created > 1 ? 's' : ''}.
              </Alert>
            )}

            {csvErrors.length > 0 && (
              <Alert type="error" className="mt-3">
                <p className="font-semibold">
                  {csvErrors.length} ligne{csvErrors.length > 1 ? 's' : ''} non importée
                  {csvErrors.length > 1 ? 's' : ''} :
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {csvErrors.slice(0, 8).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                {csvErrors.length > 8 && (
                  <p className="mt-1">… et {csvErrors.length - 8} autre(s).</p>
                )}
              </Alert>
            )}

            {importCsv.isError && (
              <Alert type="error" className="mt-3">{(importCsv.error as Error).message}</Alert>
            )}

            <p className="mt-3 text-[12px] text-[--k-muted]">
              Format CSV : <code>{CSV_HEADER}</code> — point-virgule, en-tête facultatif.
              Le groupe est créé s’il n’existe pas.
            </p>
          </Card>

          {addresses.isLoading ? (
            <Card>
              <p className="text-[13px] text-[--k-muted]">Chargement du carnet…</p>
            </Card>
          ) : items.length === 0 ? (
            <EmptyState
              icon={BookUser}
              title={search ? 'Aucune adresse ne correspond' : 'Carnet vide'}
              description={
                search
                  ? 'Essayez un autre terme de recherche.'
                  : 'Enregistrez vos antennes et partenaires pour les réutiliser en un clic sur les pages d’expédition.'
              }
            >
              {!search && (
                <Button type="button" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Ajouter la première adresse
                </Button>
              )}
            </EmptyState>
          ) : (
            sections.map(([groupName, groupItems]) => (
              <Card key={groupName}>
                <CardTitle
                  title={groupName}
                  hint={`${groupItems.length} adresse${groupItems.length > 1 ? 's' : ''}`}
                />
                <div className="divide-y divide-[--k-border]">
                  {groupItems.map((address) => (
                    <AddressRow
                      key={address.id}
                      address={address}
                      onEdit={() => openEdit(address)}
                      onArchive={() => archive.mutate({ id: address.id, hard: false })}
                      onDelete={() => archive.mutate({ id: address.id, hard: true })}
                      onRestore={() => restore.mutate(address.id)}
                      onToggleDefault={() => setDefault.mutate(address)}
                      onToggleDefaultShipper={() => setDefaultShipper.mutate(address)}
                    />
                  ))}
                </div>
              </Card>
            ))
          )}

          {(archive.isError || restore.isError || setDefault.isError) && (
            <Alert type="error">
              {
                ((archive.error || restore.error || setDefault.error) as Error).message
              }
            </Alert>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card>
            <CardTitle
              title="Groupes"
              hint="Classez vos adresses par usage"
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowGroupForm((v) => !v)}
                >
                  <FolderPlus className="h-4 w-4" />
                  Nouveau
                </Button>
              }
            />

            {showGroupForm && (
              <form
                className="mb-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newGroup.trim()) createGroup.mutate(newGroup.trim());
                }}
              >
                <input
                  autoFocus
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  placeholder="Antennes, Partenaires…"
                  className="input-field"
                />
                <Button type="submit" size="sm" isLoading={createGroup.isPending}>
                  Créer
                </Button>
              </form>
            )}

            {createGroup.isError && (
              <Alert type="error" className="mb-3">
                {(createGroup.error as Error).message}
              </Alert>
            )}

            {(groups.data ?? []).length === 0 ? (
              <p className="text-[13px] text-[--k-muted]">
                Aucun groupe. Les adresses restent utilisables sans groupe.
              </p>
            ) : (
              <ul className="divide-y divide-[--k-border]">
                {(groups.data ?? []).map((group) => (
                  <li key={group.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-[--k-text]">
                        {group.name}
                      </span>
                      <span className="text-[12px] text-[--k-muted]">
                        {group.addressCount ?? 0} adresse
                        {(group.addressCount ?? 0) > 1 ? 's' : ''}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Supprimer le groupe (les adresses sont conservées)"
                      onClick={() => deleteGroup.mutate(group.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {deleteGroup.isError && (
              <Alert type="error" className="mt-3">
                {(deleteGroup.error as Error).message}
              </Alert>
            )}

            <p className="mt-3 text-[12px] text-[--k-muted]">
              Supprimer un groupe conserve ses adresses : elles passent « sans groupe ».
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={draft !== null}
        onClose={closeForm}
        title={editing ? 'Modifier l’adresse' : 'Nouvelle adresse'}
        hint={editing ? editing.label : 'Réutilisable en un clic sur les pages d’expédition.'}
        footer={
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="address-form"
              isLoading={saveAddress.isPending}
              disabled={missing.length > 0}
            >
              {editing ? 'Enregistrer' : 'Ajouter au carnet'}
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
          // `form` sur le bouton d'envoi du pied : le formulaire défile, la
          // barre d'actions reste fixe, et la touche Entrée continue de
          // valider comme dans un formulaire ordinaire.
          <form id="address-form" onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Nom dans le carnet"
                required
                placeholder="Antenne Lyon Part-Dieu"
                value={draft.label}
                onChange={(e) => set({ label: e.target.value })}
              />
              <SelectField
                label="Groupe"
                value={draft.groupId ?? ''}
                onChange={(e) => set({ groupId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Sans groupe</option>
                {(groups.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="border-t border-[--k-border] pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[--k-muted]">
                Adresse
              </p>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Destinataire"
                    required
                    placeholder="Antenne Lyon"
                    value={draft.name}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                  <Field
                    label="Contact"
                    placeholder="Service réception"
                    value={draft.attentionName ?? ''}
                    onChange={(e) => set({ attentionName: e.target.value })}
                  />
                </div>
                <AddressAutocomplete
                  label="Adresse"
                  required
                  placeholder="Commencez à taper l’adresse…"
                  value={draft.addressLine1}
                  onChange={(v) => set({ addressLine1: v })}
                  onSelect={(p) =>
                    set({
                      addressLine1: p.addressLine1,
                      city: p.city,
                      state: p.state,
                      postalCode: p.postalCode,
                      country: p.country,
                    })
                  }
                />
                <Field
                  label="Complément"
                  placeholder="Bâtiment, étage…"
                  value={draft.addressLine2 ?? ''}
                  onChange={(e) => set({ addressLine2: e.target.value })}
                />
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field
                    label="Ville"
                    required
                    className="sm:col-span-2"
                    value={draft.city}
                    onChange={(e) => set({ city: e.target.value })}
                  />
                  <Field
                    label="Code postal"
                    required
                    value={draft.postalCode}
                    onChange={(e) => set({ postalCode: e.target.value })}
                  />
                  <Field
                    label="Pays (ISO 2)"
                    required
                    maxLength={2}
                    value={draft.country}
                    onChange={(e) => set({ country: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="État (si applicable)"
                    maxLength={2}
                    value={draft.state ?? ''}
                    onChange={(e) => set({ state: e.target.value.toUpperCase() })}
                  />
                  <Field
                    label="Téléphone"
                    placeholder="0102030405"
                    value={draft.phone ?? ''}
                    onChange={(e) => set({ phone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {saveAddress.isError && (
              <Alert type="error">{(saveAddress.error as Error).message}</Alert>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

interface AddressRowProps {
  address: SavedAddress;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onToggleDefault: () => void;
  onToggleDefaultShipper: () => void;
}

function AddressRow({
  address,
  onEdit,
  onArchive,
  onDelete,
  onRestore,
  onToggleDefault,
  onToggleDefaultShipper,
}: AddressRowProps) {
  const archived = Boolean(address.archivedAt);

  return (
    <div className={cn('flex items-start justify-between gap-3 py-2.5', archived && 'opacity-60')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-[--k-text]">{address.label}</span>
          {address.isDefault && (
            <Badge tone="warning">
              <Star className="h-3 w-3 fill-current" />
              Destinataire par défaut
            </Badge>
          )}
          {address.isDefaultShipper && (
            <Badge tone="primary">
              <Warehouse className="h-3 w-3" />
              Départ par défaut
            </Badge>
          )}
          {archived && <Badge tone="neutral">Archivée</Badge>}
          {address.usageCount > 0 && (
            <Badge tone="neutral">
              {address.usageCount} utilisation{address.usageCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[--k-muted]">
          {address.name}
          {address.name && ' — '}
          {[address.addressLine1, address.postalCode, address.city, address.country]
            .filter(Boolean)
            .join(', ')}
        </p>
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
              title={
                address.isDefault
                  ? 'Retirer le défaut destinataire'
                  : 'Destinataire par défaut'
              }
              onClick={onToggleDefault}
            >
              <Star className={cn('h-4 w-4', address.isDefault && 'fill-amber-400 text-amber-400')} />
            </Button>
            {/* Bouton distinct de l'étoile : une adresse peut être le point de
                départ habituel sans être le destinataire habituel. */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={
                address.isDefaultShipper
                  ? 'Retirer le départ par défaut'
                  : 'Point de départ par défaut'
              }
              onClick={onToggleDefaultShipper}
            >
              <Warehouse
                className={cn('h-4 w-4', address.isDefaultShipper && 'text-[--k-primary]')}
              />
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
