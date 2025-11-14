import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { InventoryFilterBar, InventoryFilterConfig, InventoryFilterValue } from "@/components/inventory/inventory-filter-bar";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
import { EntityDrawer } from "@/components/inventory/entity-drawer";
import {
  InventoryLocation,
  useCreateInventoryLocation,
  useDeleteInventoryLocation,
  useInventoryLocations,
  useUpdateInventoryLocation,
} from "@/hooks/useInventoryApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { config } from "@/lib/config";

interface DepartmentOption {
  id: number;
  name: string;
}

interface LocationFormState {
  name: string;
  type: string;
  departmentId: string;
  parentLocationId: string;
}

const DEFAULT_LOCATION_FORM: LocationFormState = {
  name: "",
  type: "storage",
  departmentId: "",
  parentLocationId: "",
};

const LOCATION_TYPES = ["storage", "office", "shelf", "room", "other"];
const ALL_VALUE = "__all__";

export default function InventoryLocationsPage() {
  const { formatMessage } = useI18n();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<LocationFormState>(DEFAULT_LOCATION_FORM);
  const [editingLocation, setEditingLocation] = useState<InventoryLocation | null>(null);

  const locationsQuery = useInventoryLocations();
  const createLocation = useCreateInventoryLocation();
  const updateLocation = useUpdateInventoryLocation();
  const deleteLocation = useDeleteInventoryLocation();

  const departmentsQuery = useQuery({
    queryKey: ["inventory-departments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/departments?active_only=true&limit=200");
      const data = await response.json();
      return (data.departments ?? data.data ?? []) as DepartmentOption[];
    },
  });

  const locations = locationsQuery.data?.data ?? [];
  const departments = departmentsQuery.data ?? [];

  const filteredLocations = useMemo(() => {
    return locations.filter((location) => {
      const matchesSearch =
        !search ||
        location.name?.toLowerCase().includes(search.trim().toLowerCase());
      const matchesType = !typeFilter || location.type === typeFilter;
      const matchesDepartment = !departmentFilter || String(location.department_id) === departmentFilter;
      return matchesSearch && matchesType && matchesDepartment;
    });
  }, [locations, search, typeFilter, departmentFilter]);

  const filterConfigs: InventoryFilterConfig[] = [
    {
      type: "search",
      key: "search",
      value: search,
      placeholder: formatMessage("inventory.locations.filters.search"),
      width: 260,
    },
    {
      type: "select",
      key: "type",
      value: typeFilter || ALL_VALUE,
      placeholder: formatMessage("inventory.locations.filters.type"),
      options: [
        { label: formatMessage("inventory.locations.filters.all_types"), value: ALL_VALUE },
        ...LOCATION_TYPES.map((type) => ({
          value: type,
          label: formatMessage(`inventory.locations.types.${type}` as any),
        })),
      ],
      width: 200,
    },
    {
      type: "select",
      key: "department",
      value: departmentFilter || ALL_VALUE,
      placeholder: formatMessage("inventory.locations.filters.department"),
      options: [
        { label: formatMessage("inventory.locations.filters.all_departments"), value: ALL_VALUE },
        ...departments.map((dept) => ({ label: dept.name, value: String(dept.id) })),
      ],
      width: 220,
    },
  ];

  const handleFilterChange = (key: string, value: InventoryFilterValue) => {
    const normalized = value === ALL_VALUE ? "" : value;
    if (key === "search") setSearch(String(normalized ?? ""));
    if (key === "type") setTypeFilter(String(normalized ?? ""));
    if (key === "department") setDepartmentFilter(String(normalized ?? ""));
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("");
    setDepartmentFilter("");
  };

  const openCreateDrawer = () => {
    setEditingLocation(null);
    setFormState(DEFAULT_LOCATION_FORM);
    setDrawerOpen(true);
  };

  const openEditDrawer = (location: InventoryLocation) => {
    setEditingLocation(location);
    setFormState({
      name: location.name ?? "",
      type: location.type ?? "storage",
      departmentId: location.department_id ? String(location.department_id) : "",
      parentLocationId: location.parent_location_id ? String(location.parent_location_id) : "",
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingLocation(null);
    setFormState(DEFAULT_LOCATION_FORM);
  };

  const handleFormChange = (field: keyof LocationFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formState.name.trim()) {
      toast({
        title: formatMessage("inventory.locations.form.validation.name"),
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: formState.name,
      type: formState.type,
      department_id: formState.departmentId ? Number(formState.departmentId) : undefined,
      parent_location_id: formState.parentLocationId ? Number(formState.parentLocationId) : undefined,
    };

    if (editingLocation) {
      updateLocation.mutate(
        { id: editingLocation.id, payload },
        { onSuccess: closeDrawer }
      );
    } else {
      createLocation.mutate(payload, { onSuccess: closeDrawer });
    }
  };

  const handleDeactivate = (location: InventoryLocation) => {
    const confirmed = window.confirm(
      formatMessage("inventory.locations.table.confirm_deactivate", { name: location.name })
    );
    if (!confirmed) return;
    deleteLocation.mutate({ id: location.id });
  };

  const openQrCode = (location: InventoryLocation) => {
    const url = `${config.apiBaseUrl}/api/inventory/locations/${location.id}/qrcode`;
    window.open(url, "_blank");
  };

  const columns: EntityColumn<InventoryLocation>[] = [
    {
      key: "name",
      header: formatMessage("inventory.locations.table.name"),
      render: (location) => location.name,
    },
    {
      key: "type",
      header: formatMessage("inventory.locations.table.type"),
      render: (location) => formatMessage(`inventory.locations.types.${location.type}` as any),
    },
    {
      key: "department",
      header: formatMessage("inventory.locations.table.department"),
      render: (location) => departments.find((dept) => dept.id === location.department_id)?.name ?? "--",
    },
    {
      key: "status",
      header: formatMessage("inventory.locations.table.status"),
      render: (location) => (
        <Badge variant={location.is_active === false ? "outline" : "secondary"}>
          {location.is_active === false
            ? formatMessage("inventory.locations.table.inactive")
            : formatMessage("inventory.locations.table.active")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: formatMessage("inventory.locations.table.actions"),
      render: (location) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditDrawer(location)}>
            {formatMessage("inventory.locations.table.edit")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openQrCode(location)}>
            {formatMessage("inventory.locations.table.qrcode")}
          </Button>
          {location.is_active !== false && (
            <Button variant="ghost" size="sm" onClick={() => handleDeactivate(location)}>
              {formatMessage("inventory.locations.table.deactivate")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <InventoryLayout
      title={formatMessage("inventory.locations_title")}
      description={formatMessage("inventory.locations_description")}
      breadcrumb={[{ label: formatMessage("inventory.locations_breadcrumb") }]}
      actions={
        <Button onClick={openCreateDrawer}>
          {formatMessage("inventory.locations.actions.new_location")}
        </Button>
      }
    >
      <div className="space-y-4">
        <InventoryFilterBar
          filters={filterConfigs}
          onChange={handleFilterChange}
          onReset={resetFilters}
          isDirty={Boolean(search || typeFilter || departmentFilter)}
        />
        <EntityTable
          data={filteredLocations}
          columns={columns}
          isLoading={locationsQuery.isLoading || departmentsQuery.isLoading}
          emptyTitle={formatMessage("inventory.locations.table.empty_title")}
          emptyDescription={formatMessage("inventory.locations.table.empty_description")}
        />
      </div>

      <EntityDrawer
        title={
          editingLocation
            ? formatMessage("inventory.locations.drawer.edit_title")
            : formatMessage("inventory.locations.drawer.create_title")
        }
        description={formatMessage("inventory.locations.drawer.description")}
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDrawer();
          } else {
            setDrawerOpen(true);
          }
        }}
        primaryAction={{
          label: formatMessage("inventory.locations.drawer.save"),
          onClick: handleSubmit,
          loading: createLocation.isPending || updateLocation.isPending,
        }}
        secondaryAction={{
          label: formatMessage("inventory.locations.drawer.cancel"),
          onClick: closeDrawer,
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{formatMessage("inventory.locations.form.name")}</Label>
            <Input value={formState.name} onChange={(event) => handleFormChange("name", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.locations.form.type")}</Label>
            <Select value={formState.type} onValueChange={(value) => handleFormChange("type", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatMessage(`inventory.locations.types.${type}` as any)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.locations.form.department")}</Label>
            <Select
              value={formState.departmentId}
              onValueChange={(value) => handleFormChange("departmentId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={formatMessage("inventory.locations.form.department_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={String(dept.id)}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.locations.form.parent_location")}</Label>
            <Select
              value={formState.parentLocationId}
              onValueChange={(value) => handleFormChange("parentLocationId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={formatMessage("inventory.locations.form.parent_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{formatMessage("inventory.locations.form.parent_none")}</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={String(location.id)}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </EntityDrawer>
    </InventoryLayout>
  );
}

