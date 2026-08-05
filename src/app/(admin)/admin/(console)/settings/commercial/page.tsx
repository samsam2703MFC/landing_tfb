import { getCommercialSettings } from '@/lib/commercial/settings';
import { CommercialSettingsScreen } from '@/components/admin/CommercialSettingsScreen';

/** §16 — sales stages, services, and the entities that issue the invoice. */
export default async function CommercialSettingsPage() {
  const settings = await getCommercialSettings();
  return <CommercialSettingsScreen settings={settings} />;
}
