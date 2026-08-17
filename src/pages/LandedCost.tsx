import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Globe, Calculator, Plus, Trash2, Receipt } from 'lucide-react';
import { api, type LandedCostPayload } from '../services/api';
import type { LandedCostResult, LandedCostItemInput } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { SubmitBar } from '../components/ui/SubmitBar';
import { Field, SelectField } from '../components/ui/Field';
import Button from '../components/ui/Button';
import { money } from '../utils/format';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'];

const emptyItem = (): LandedCostItemInput => ({ priceEach: '', quantity: '1' });

export default function LandedCost() {
  const [exportCountry, setExportCountry] = useState('FR');
  const [importCountry, setImportCountry] = useState('US');
  const [currency, setCurrency] = useState('EUR');
  const [items, setItems] = useState<LandedCostItemInput[]>([emptyItem()]);

  const mutation = useMutation<LandedCostResult, Error, LandedCostPayload>({
    mutationFn: (payload) => api.getLandedCost(payload),
  });

  const update = (index: number, patch: Partial<LandedCostItemInput>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const remove = (index: number) => {
    // On conserve toujours au moins une ligne.
    if (items.length > 1) setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const invalidItem = items.some(
    (it) => !it.priceEach || Number(it.priceEach) <= 0 || !it.quantity || Number(it.quantity) <= 0,
  );

  const blockedReason = !exportCountry
    ? "Le pays d'expédition est obligatoire"
    : !importCountry
      ? "Le pays de destination est obligatoire"
      : invalidItem
        ? 'Chaque article doit avoir un prix et une quantité supérieurs à 0'
        : exportCountry === importCountry
          ? "Les coûts à l'import ne s'appliquent qu'entre deux pays différents"
          : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blockedReason) return;
    mutation.mutate({
      exportCountryCode: exportCountry,
      importCountryCode: importCountry,
      items,
      currency,
    });
  };

  return (
    <div>
      <PageHeader
        title="Coûts à l'import"
        subtitle="Estimez droits de douane, taxes et frais pour une expédition internationale."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardTitle title="Trajet" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Pays d'expédition"
                required
                maxLength={2}
                value={exportCountry}
                onChange={(e) => setExportCountry(e.target.value.toUpperCase())}
              />
              <Field
                label="Pays de destination"
                required
                maxLength={2}
                value={importCountry}
                onChange={(e) => setImportCountry(e.target.value.toUpperCase())}
              />
              <SelectField
                label="Devise"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
            </div>
          </Card>

          <Card>
            <CardTitle title="Marchandises" hint={`${items.length} article(s)`} />
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="rounded-xl border border-[--k-border] bg-[--k-bg]/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[--k-muted]">
                      Article {i + 1}
                    </span>
                    {items.length > 1 && (
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field
                        label="Description"
                        placeholder="T-shirts coton"
                        value={item.description ?? ''}
                        onChange={(e) => update(i, { description: e.target.value })}
                      />
                    </div>
                    <Field
                      label="Prix unitaire"
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.priceEach}
                      onChange={(e) => update(i, { priceEach: e.target.value })}
                    />
                    <Field
                      label="Quantité"
                      required
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => update(i, { quantity: e.target.value })}
                    />
                    <Field
                      label="Code SH (douane)"
                      placeholder="610910"
                      value={item.hsCode ?? ''}
                      onChange={(e) => update(i, { hsCode: e.target.value })}
                    />
                    <Field
                      label="Pays d'origine"
                      maxLength={2}
                      placeholder={exportCountry}
                      value={item.originCountryCode ?? ''}
                      onChange={(e) => update(i, { originCountryCode: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                <Plus className="h-4 w-4" />
                Ajouter un article
              </Button>
            </div>

            <SubmitBar
              isLoading={mutation.isPending}
              blockedReason={blockedReason}
              icon={<Calculator className="h-4 w-4" />}
            >
              Estimer les coûts
            </SubmitBar>
          </Card>
        </form>

        <div className="lg:sticky lg:top-4">
          {mutation.isError ? (
            <Alert type="error">{mutation.error.message}</Alert>
          ) : mutation.isSuccess ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[--k-primary]/40 bg-[--k-primary-2]/40 px-4 py-3">
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-indigo-900">
                  <Receipt className="h-4 w-4" />
                  Coût total estimé
                </span>
                <span className="text-[20px] font-bold text-[--k-text]">
                  {money(mutation.data.grandTotal, mutation.data.currency)}
                </span>
              </div>

              <Card>
                <CardTitle title="Détail" />
                <dl className="space-y-1.5">
                  {[
                    ['Droits de douane', mutation.data.totalDuties],
                    ['Taxes / TVA', mutation.data.totalTaxes],
                    ['Frais annexes', mutation.data.totalFees],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between text-[13px]">
                      <dt className="text-[--k-muted]">{label}</dt>
                      <dd className="font-medium text-[--k-text]">
                        {money(value as number, mutation.data.currency)}
                      </dd>
                    </div>
                  ))}
                </dl>

                {mutation.data.items.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-[--k-border] pt-3">
                    {mutation.data.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-[12px]">
                        <span className="text-[--k-muted]">
                          {item.description || `Article ${item.commodityId || i + 1}`}
                          {item.quantity ? ` × ${item.quantity}` : ''}
                        </span>
                        <span className="text-[--k-text]">
                          {money(item.totalCharges, mutation.data.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <p className="text-[11px] text-[--k-muted]">
                Estimation indicative fournie par UPS. Les montants réellement perçus par les
                douanes peuvent différer.
              </p>
            </div>
          ) : (
            <EmptyState
              icon={Globe}
              title="Aucune estimation"
              description="Indiquez les pays d'expédition et de destination, puis les marchandises, pour estimer les droits et taxes à l'import."
            />
          )}
        </div>
      </div>
    </div>
  );
}
