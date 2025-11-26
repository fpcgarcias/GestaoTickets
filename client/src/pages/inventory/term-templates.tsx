import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import TermTemplatesSettings from "@/components/inventory/term-templates-settings";

export default function InventoryTermTemplatesPage() {
  const { formatMessage } = useI18n();

  return (
    <InventoryLayout
      title={formatMessage("inventory.term_templates_title")}
      description={formatMessage("inventory.term_templates_description")}
      breadcrumb={[{ label: formatMessage("inventory.term_templates_breadcrumb") }]}
    >
      <TermTemplatesSettings />
    </InventoryLayout>
  );
}


