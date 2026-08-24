import { Plus, Trash2, Boxes } from 'lucide-react';
import type { PackageInput } from '../types/ups';
import { Field } from './ui/Field';
import Button from './ui/Button';
import { PackageTypePicker } from './ui/PackageTypePicker';

interface PackagesEditorProps {
  packages: PackageInput[];
  onChange: (packages: PackageInput[]) => void;
  withReference?: boolean;
}

export const emptyPackage = (): PackageInput => ({ weight: '1' });

/** Éditeur de colis partagé par les pages Tarifs et Étiquettes. */
export function PackagesEditor({ packages, onChange, withReference = false }: PackagesEditorProps) {
  const update = (index: number, patch: Partial<PackageInput>) => {
    onChange(packages.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const remove = (index: number) => {
    // On conserve toujours au moins un colis.
    if (packages.length > 1) onChange(packages.filter((_, i) => i !== index));
  };

  /**
   * Un type chargé remplace le premier colis s'il est encore vierge, sinon
   * il s'ajoute : ouvrir la page puis charger « DS620 » ne doit pas laisser
   * un colis vide de 1 kg en tête de liste.
   */
  const addFromType = (added: PackageInput[]) => {
    const onlyUntouched =
      packages.length === 1 &&
      packages[0].weight === '1' &&
      !packages[0].length &&
      !packages[0].width &&
      !packages[0].height &&
      !packages[0].reference;

    onChange(onlyUntouched ? added : [...packages, ...added]);
  };

  return (
    <div className="space-y-2">
      <PackageTypePicker className="mb-1" onSelect={addFromType} />

      {packages.map((pkg, i) => (
        <div key={i} className="rounded-xl border border-[--k-border] bg-[--k-bg]/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[--k-muted]">
              Colis {i + 1}
              {pkg.description && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[--k-primary-2] px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                  <Boxes className="h-3 w-3" />
                  {pkg.description}
                </span>
              )}
            </span>
            {packages.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="inline-flex items-center gap-1 text-[12px] text-[--k-danger] hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Poids (kg)"
              required
              type="number"
              step="0.1"
              min="0.1"
              value={pkg.weight}
              onChange={(e) => update(i, { weight: e.target.value })}
            />
            <Field
              label="Longueur (cm)"
              type="number"
              min="1"
              value={pkg.length ?? ''}
              onChange={(e) => update(i, { length: e.target.value })}
            />
            <Field
              label="Largeur (cm)"
              type="number"
              min="1"
              value={pkg.width ?? ''}
              onChange={(e) => update(i, { width: e.target.value })}
            />
            <Field
              label="Hauteur (cm)"
              type="number"
              min="1"
              value={pkg.height ?? ''}
              onChange={(e) => update(i, { height: e.target.value })}
            />
            {withReference && (
              <Field
                label="Référence"
                value={pkg.reference ?? ''}
                onChange={(e) => update(i, { reference: e.target.value })}
              />
            )}
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange([...packages, emptyPackage()])}
      >
        <Plus className="h-4 w-4" />
        Ajouter un colis
      </Button>
    </div>
  );
}
