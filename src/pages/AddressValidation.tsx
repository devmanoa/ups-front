import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MapPinned, Search } from 'lucide-react';
import { api, type AddressPayload } from '../services/api';
import type { AddressValidationResult, Address } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Field, SelectField } from '../components/ui/Field';
import Button from '../components/ui/Button';

export default function AddressValidation() {
  const [address, setAddress] = useState<Address>({ country: 'US' });
  const [requestOption, setRequestOption] = useState('3');

  const mutation = useMutation<AddressValidationResult, Error, AddressPayload>({
    mutationFn: (payload) => api.validateAddress(payload),
  });

  const set = (patch: Partial<Address>) => setAddress((prev) => ({ ...prev, ...patch }));

  const canSubmit = Boolean(address.postalCode || address.city);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate({ address, requestOption: Number(requestOption) });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Validation d'adresse"
        subtitle="Vérifie et normalise une adresse, et indique si elle est résidentielle ou professionnelle."
      />

      <Alert type="info" className="mb-4">
        Cette API UPS ne couvre que les États-Unis et Porto Rico.
      </Alert>

      <form onSubmit={submit}>
        <Card>
          <CardTitle title="Adresse à vérifier" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Adresse ligne 1"
              placeholder="2311 York Rd"
              value={address.addressLine1 ?? ''}
              onChange={(e) => set({ addressLine1: e.target.value })}
            />
            <Field
              label="Adresse ligne 2"
              value={address.addressLine2 ?? ''}
              onChange={(e) => set({ addressLine2: e.target.value })}
            />
            <Field
              label="Ville"
              placeholder="Timonium"
              value={address.city ?? ''}
              onChange={(e) => set({ city: e.target.value })}
            />
            <Field
              label="État (code)"
              placeholder="MD"
              value={address.state ?? ''}
              onChange={(e) => set({ state: e.target.value.toUpperCase() })}
            />
            <Field
              label="Code postal"
              placeholder="21093"
              value={address.postalCode ?? ''}
              onChange={(e) => set({ postalCode: e.target.value })}
            />
            <Field
              label="Pays (ISO 2)"
              required
              value={address.country ?? ''}
              onChange={(e) => set({ country: e.target.value.toUpperCase() })}
            />
            <SelectField
              label="Traitement"
              value={requestOption}
              onChange={(e) => setRequestOption(e.target.value)}
            >
              <option value="3">Validation + classification</option>
              <option value="1">Validation seule</option>
              <option value="2">Classification seule</option>
            </SelectField>
          </div>
          <div className="mt-4">
            <Button type="submit" isLoading={mutation.isPending} disabled={!canSubmit}>
              {!mutation.isPending && <Search className="h-4 w-4" />}
              Valider l'adresse
            </Button>
          </div>
        </Card>
      </form>

      {mutation.isError && (
        <Alert type="error" className="mt-4">
          {mutation.error.message}
        </Alert>
      )}

      {mutation.isSuccess && <Result data={mutation.data} />}
    </div>
  );
}

function Result({ data }: { data: AddressValidationResult }) {
  let verdict: { type: 'success' | 'info' | 'error'; text: string };
  if (data.valid) verdict = { type: 'success', text: 'Adresse valide.' };
  else if (data.ambiguous)
    verdict = { type: 'info', text: 'Adresse ambiguë — plusieurs correspondances possibles.' };
  else verdict = { type: 'error', text: 'Adresse introuvable dans la base UPS.' };

  return (
    <div className="mt-4 space-y-4">
      <Alert type={verdict.type}>{verdict.text}</Alert>

      <Card>
        <CardTitle
          title="Adresses proposées"
          action={
            data.classification ? (
              <Badge tone={data.classification.code === '2' ? 'warning' : 'primary'}>
                {data.classification.description}
              </Badge>
            ) : undefined
          }
        />
        {data.candidates.length === 0 ? (
          <p className="text-[12px] text-[--k-muted]">Aucune suggestion retournée.</p>
        ) : (
          <div className="space-y-2">
            {data.candidates.map((c, i) => (
              <div key={i} className="rounded-xl border border-[--k-border] p-3">
                <div className="flex items-start gap-2">
                  <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-[--k-primary]" />
                  <div>
                    <p className="text-[13px] font-medium text-[--k-text]">
                      {c.addressLines.join(', ')}
                    </p>
                    <p className="text-[12px] text-[--k-muted]">
                      {[c.city, c.state, c.postalCode, c.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
