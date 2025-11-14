import { useState } from "react";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
import { EntityDrawer } from "@/components/inventory/entity-drawer";
import {
  useCreateInventoryWebhook,
  useDeleteInventoryWebhook,
  useInventoryWebhooks,
} from "@/hooks/useInventoryApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface WebhookFormState {
  name: string;
  url: string;
  events: string;
  secret: string;
}

const DEFAULT_WEBHOOK_FORM: WebhookFormState = {
  name: "",
  url: "",
  events: "inventory.created",
  secret: "",
};

export default function InventoryWebhooksPage() {
  const { formatMessage } = useI18n();
  const { toast } = useToast();
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<WebhookFormState>(DEFAULT_WEBHOOK_FORM);
  const [editingWebhook, setEditingWebhook] = useState<any | null>(null);

  const webhooksQuery = useInventoryWebhooks();
  const createWebhook = useCreateInventoryWebhook();
  const deleteWebhook = useDeleteInventoryWebhook();

  const webhooks = webhooksQuery.data?.data ?? [];

  const openDrawer = (webhook?: any) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormState({
        name: webhook.name,
        url: webhook.url,
        events: webhook.events?.join(", ") ?? "",
        secret: webhook.secret ?? "",
      });
    } else {
      setEditingWebhook(null);
      setFormState(DEFAULT_WEBHOOK_FORM);
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingWebhook(null);
    setFormState(DEFAULT_WEBHOOK_FORM);
  };

  const handleSubmit = () => {
    if (!formState.name.trim() || !formState.url.trim()) {
      toast({
        title: formatMessage("inventory.webhooks.form.validation"),
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: formState.name,
      url: formState.url,
      events: formState.events
        .split(",")
        .map((event) => event.trim())
        .filter(Boolean),
      secret: formState.secret || undefined,
    };

    createWebhook.mutate(payload, {
      onSuccess: () => {
        toast({ title: formatMessage("inventory.webhooks.toast.saved") });
        closeDrawer();
        webhooksQuery.refetch();
      },
    });
  };

  const handleDelete = (webhook: any) => {
    const confirmed = window.confirm(
      formatMessage("inventory.webhooks.table.confirm_delete", { name: webhook.name })
    );
    if (!confirmed) return;
    deleteWebhook.mutate({ id: webhook.id }, { onSuccess: () => webhooksQuery.refetch() });
  };

  const columns: EntityColumn<any>[] = [
    {
      key: "name",
      header: formatMessage("inventory.webhooks.table.name"),
      render: (webhook) => webhook.name,
    },
    {
      key: "url",
      header: formatMessage("inventory.webhooks.table.url"),
      render: (webhook) => (
        <span className="text-xs text-muted-foreground break-all">{webhook.url}</span>
      ),
    },
    {
      key: "events",
      header: formatMessage("inventory.webhooks.table.events"),
      render: (webhook) => (
        <div className="flex flex-wrap gap-1">
          {(webhook.events ?? []).map((event: string) => (
            <Badge key={event} variant="secondary">
              {event}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      header: formatMessage("inventory.webhooks.table.status"),
      render: (webhook) => (
        <Badge variant={webhook.is_active === false ? "outline" : "secondary"}>
          {webhook.is_active === false
            ? formatMessage("inventory.webhooks.table.inactive")
            : formatMessage("inventory.webhooks.table.active")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: formatMessage("inventory.webhooks.table.actions"),
      render: (webhook) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openDrawer(webhook)}>
            {formatMessage("inventory.webhooks.table.edit")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(webhook)}>
            {formatMessage("inventory.webhooks.table.delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <InventoryLayout
      title={formatMessage("inventory.webhooks_title")}
      description={formatMessage("inventory.webhooks_description")}
      breadcrumb={[{ label: formatMessage("inventory.webhooks_breadcrumb") }]}
      actions={
        <Button onClick={() => openDrawer()}>
          {formatMessage("inventory.webhooks.actions.new_webhook")}
        </Button>
      }
    >
      <EntityTable
        data={webhooks}
        columns={columns}
        isLoading={webhooksQuery.isLoading}
        emptyTitle={formatMessage("inventory.webhooks.table.empty_title")}
        emptyDescription={formatMessage("inventory.webhooks.table.empty_description")}
      />

      <EntityDrawer
        title={
          editingWebhook
            ? formatMessage("inventory.webhooks.drawer.edit_title")
            : formatMessage("inventory.webhooks.drawer.create_title")
        }
        description={formatMessage("inventory.webhooks.drawer.description")}
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
          else setDrawerOpen(true);
        }}
        primaryAction={{
          label: formatMessage("inventory.webhooks.drawer.save"),
          onClick: handleSubmit,
          loading: createWebhook.isPending,
        }}
        secondaryAction={{
          label: formatMessage("inventory.webhooks.drawer.cancel"),
          onClick: closeDrawer,
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{formatMessage("inventory.webhooks.form.name")}</Label>
            <Input value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.webhooks.form.url")}</Label>
            <Input value={formState.url} onChange={(event) => setFormState((prev) => ({ ...prev, url: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.webhooks.form.events")}</Label>
            <Input
              value={formState.events}
              onChange={(event) => setFormState((prev) => ({ ...prev, events: event.target.value }))}
              placeholder={formatMessage("inventory.webhooks.form.events_placeholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.webhooks.form.secret")}</Label>
            <Textarea
              rows={2}
              value={formState.secret}
              onChange={(event) => setFormState((prev) => ({ ...prev, secret: event.target.value }))}
            />
          </div>
        </div>
      </EntityDrawer>
    </InventoryLayout>
  );
}

