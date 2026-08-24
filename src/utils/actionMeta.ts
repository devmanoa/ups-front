import {
  History,
  Tag,
  XCircle,
  Layers,
  BookUser,
  FolderPlus,
  Truck,
  RadioTower,
  Boxes,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ActionMeta {
  icon: LucideIcon;
  label: string;
  tone: string;
}

/**
 * Présentation par type d'action, partagée par la Timeline et le détail d'un
 * envoi : deux écrans qui nommeraient différemment la même action sèmeraient
 * le doute sur ce qui s'est passé.
 */
export const ACTION_META: Record<string, ActionMeta> = {
  'shipment.create': { icon: Tag, label: 'Étiquette créée', tone: 'text-indigo-600 bg-indigo-50' },
  'shipment.void': { icon: XCircle, label: 'Expédition annulée', tone: 'text-red-600 bg-red-50' },
  'shipment.sync': {
    icon: RadioTower,
    label: 'Statuts synchronisés',
    tone: 'text-slate-600 bg-slate-100',
  },
  'bulk.create': { icon: Layers, label: 'Envoi groupé', tone: 'text-violet-600 bg-violet-50' },
  'address.create': { icon: BookUser, label: 'Adresse ajoutée', tone: 'text-green-600 bg-green-50' },
  'address.update': {
    icon: BookUser,
    label: 'Adresse modifiée',
    tone: 'text-amber-600 bg-amber-50',
  },
  'address.archive': {
    icon: BookUser,
    label: 'Adresse archivée',
    tone: 'text-slate-600 bg-slate-100',
  },
  'address.restore': {
    icon: BookUser,
    label: 'Adresse restaurée',
    tone: 'text-green-600 bg-green-50',
  },
  'address.delete': { icon: BookUser, label: 'Adresse supprimée', tone: 'text-red-600 bg-red-50' },
  'group.create': { icon: FolderPlus, label: 'Groupe créé', tone: 'text-green-600 bg-green-50' },
  'group.update': { icon: FolderPlus, label: 'Groupe modifié', tone: 'text-amber-600 bg-amber-50' },
  'group.delete': { icon: FolderPlus, label: 'Groupe supprimé', tone: 'text-red-600 bg-red-50' },
  'pickup.create': { icon: Truck, label: 'Enlèvement planifié', tone: 'text-indigo-600 bg-indigo-50' },
  'pickup.cancel': { icon: Truck, label: 'Enlèvement annulé', tone: 'text-red-600 bg-red-50' },
  // Absents jusqu'ici : le catalogue s'affichait sous le libellé générique
  // « Action », qui ne disait pas ce qui avait été fait.
  'package_type.create': { icon: Boxes, label: 'Type de colis ajouté', tone: 'text-green-600 bg-green-50' },
  'package_type.update': { icon: Boxes, label: 'Type de colis modifié', tone: 'text-amber-600 bg-amber-50' },
  'package_type.archive': { icon: Boxes, label: 'Type de colis archivé', tone: 'text-slate-600 bg-slate-100' },
  'package_type.restore': { icon: Boxes, label: 'Type de colis restauré', tone: 'text-green-600 bg-green-50' },
  'package_type.delete': { icon: Boxes, label: 'Type de colis supprimé', tone: 'text-red-600 bg-red-50' },
};

export const FALLBACK_META: ActionMeta = {
  icon: History,
  label: 'Action',
  tone: 'text-slate-600 bg-slate-100',
};

export function actionMeta(action: string): ActionMeta {
  return ACTION_META[action] ?? FALLBACK_META;
}
