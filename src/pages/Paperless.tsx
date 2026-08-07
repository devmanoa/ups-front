import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileText, Upload, CheckCircle2, Copy, Check } from 'lucide-react';
import { api, type UploadPayload } from '../services/api';
import type { UploadResult } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { SubmitBar } from '../components/ui/SubmitBar';
import { SelectField } from '../components/ui/Field';

/** Limite UPS pour un document dématérialisé. */
const MAX_BYTES = 10 * 1024 * 1024;

/** Lit un fichier et renvoie son contenu en base64, sans le préfixe data:. */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      // FileReader renvoie "data:<mime>;base64,XXXX" : UPS n'attend que XXXX.
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function Paperless() {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('001');
  const [fileError, setFileError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const types = useQuery({
    queryKey: ['document-types'],
    queryFn: () => api.getDocumentTypes(),
    staleTime: Infinity,
  });

  const mutation = useMutation<UploadResult, Error, UploadPayload>({
    mutationFn: (payload) => api.uploadDocument(payload),
  });

  const acceptedFormats = types.data?.fileFormats ?? ['pdf', 'jpg', 'png', 'doc', 'docx', 'txt'];

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFileError(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (selected.size > MAX_BYTES) {
      setFileError(`Le fichier dépasse 10 Mo (${formatSize(selected.size)}).`);
      setFile(null);
      return;
    }

    const ext = selected.name.split('.').pop()?.toLowerCase() ?? '';
    if (!acceptedFormats.includes(ext)) {
      setFileError(`Format .${ext} non accepté. Formats : ${acceptedFormats.join(', ')}`);
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const blockedReason = fileError
    ? fileError
    : !file
      ? 'Sélectionnez un document à téléverser'
      : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || blockedReason) return;

    const fileBase64 = await readAsBase64(file);
    mutation.mutate({
      fileName: file.name,
      fileFormat: file.name.split('.').pop()?.toLowerCase() ?? '',
      documentType,
      fileBase64,
    });
  };

  const copyId = async () => {
    if (!mutation.data) return;
    try {
      await navigator.clipboard.writeText(mutation.data.documentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  };

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        title="Documents douaniers"
        subtitle="Téléversez vos factures commerciales et documents douaniers dématérialisés."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={submit}>
          <Card>
            <CardTitle
              title="Document"
              hint="10 Mo maximum. Le document reste disponible pour vos expéditions internationales."
            />

            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[--k-border] bg-[--k-bg]/40 px-4 py-8 text-center transition hover:border-[--k-primary]/40 hover:bg-[--k-primary-2]/20">
                <Upload className="mb-2 h-6 w-6 text-[--k-primary]" />
                {file ? (
                  <>
                    <span className="text-[13px] font-medium text-[--k-text]">{file.name}</span>
                    <span className="mt-0.5 text-[12px] text-[--k-muted]">
                      {formatSize(file.size)} — cliquez pour changer
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] font-medium text-[--k-text]">
                      Choisir un fichier
                    </span>
                    <span className="mt-0.5 text-[12px] text-[--k-muted]">
                      {acceptedFormats.join(', ')}
                    </span>
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept={acceptedFormats.map((f) => `.${f}`).join(',')}
                  onChange={onFileChange}
                />
              </label>

              {fileError && <Alert type="error">{fileError}</Alert>}

              <SelectField
                label="Type de document"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                {(types.data?.documentTypes ?? [{ code: '001', name: 'Facture commerciale' }]).map(
                  (t) => (
                    <option key={t.code} value={t.code}>
                      {t.name}
                    </option>
                  ),
                )}
              </SelectField>
            </div>

            <SubmitBar
              isLoading={mutation.isPending}
              blockedReason={blockedReason}
              icon={<Upload className="h-4 w-4" />}
            >
              Téléverser
            </SubmitBar>
          </Card>
        </form>

        <div className="lg:sticky lg:top-4">
          {mutation.isError ? (
            <Alert type="error">{mutation.error.message}</Alert>
          ) : mutation.isSuccess ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-700" />
                <div>
                  <p className="text-[14px] font-semibold text-green-800">Document téléversé</p>
                  <p className="text-[12px] text-green-700">{mutation.data.status}</p>
                </div>
              </div>

              <Card>
                <CardTitle
                  title="Identifiant du document"
                  hint="À rattacher à une expédition internationale."
                />
                <button
                  type="button"
                  onClick={copyId}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-[--k-border] px-3 py-2.5 text-left transition hover:border-[--k-primary]/40"
                >
                  <code className="truncate font-mono text-[13px] text-[--k-text]">
                    {mutation.data.documentId || '—'}
                  </code>
                  {copied ? (
                    <Check className="h-4 w-4 shrink-0 text-[--k-success]" />
                  ) : (
                    <Copy className="h-4 w-4 shrink-0 text-[--k-muted]" />
                  )}
                </button>
              </Card>
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="Aucun document téléversé"
              description="Sélectionnez une facture commerciale ou un document douanier. UPS renvoie un identifiant réutilisable lors de vos expéditions."
            />
          )}
        </div>
      </div>
    </div>
  );
}
