import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Grid2X2, List, Wrench } from 'lucide-react';
import type { Model } from './client';
import { errorMessage } from './client';
import { useCheckout, useFieldTools, useInventoryView, useSheetNavigation } from './field-state';
import { RecordSheet } from './experience/RecordSheet';
import { ToolDetail } from './tools';
import { Badge, date, Empty, Field, human, Loading, Notice } from './ui';

type Asset = Model<'AssetView'>;
export function AssetPhoto({ asset, companyId, large = false }: { asset: Asset; companyId: string; large?: boolean }) {
  return asset.registration_photo_id ? (
    <span className={large ? 'catalog-photo-frame' : 'tool-photo'}>
      <img
        className={large ? 'catalog-photo' : ''}
        src={`/api/companies/${companyId}/files/${asset.registration_photo_id}`}
        alt=""
        loading="lazy"
      />
    </span>
  ) : (
    <span className={large ? 'catalog-placeholder' : 'tool-photo'}>
      <Wrench size={large ? 42 : 22} aria-hidden="true" />
    </span>
  );
}
export function assetStatus(tool: Asset) {
  return tool.lifecycle !== 'active'
    ? human(tool.lifecycle)
    : tool.missing
      ? 'Lost'
      : tool.serviceability !== 'serviceable'
        ? human(tool.serviceability)
        : tool.holder_membership_id
          ? 'In use'
          : 'In stock';
}

export function MyToolsPage() {
  const { c, refs, tools, handoffs, pendingAsset } = useFieldTools();
  return (
    <div className="worker-screen">
      <header className="worker-screen-heading">
        <div>
          <span className="worker-eyebrow">{c.preferred_name}</span>
          <h1>My tools</h1>
        </div>
      </header>
      <section className="worker-pending-section" aria-label="Pending tool movements">
        {handoffs.isPending && <Loading />}
        {handoffs.error && <Notice error>{errorMessage(handoffs.error)}</Notice>}
        {handoffs.data?.map((handoff) => (
          <article className="pending-movement" key={handoff.id}>
            <span className="worker-eyebrow">
              {handoff.destination_membership_id === c.membership_id
                ? 'Awaiting acceptance'
                : 'Waiting on someone else'}
            </span>
            <p>
              Transfer to{' '}
              {handoff.destination_membership_id
                ? refs.person(handoff.destination_membership_id)
                : refs.warehouse(handoff.destination_warehouse_id)}
            </p>
            <p className="muted">{pendingAsset(handoff.asset_id)?.name ?? 'Loading tool…'}</p>
            <Link className="button" to={`/app/operations?review=handoff:${handoff.id}`}>
              Review
            </Link>
          </article>
        ))}
      </section>
      <section className="worker-possession-section">
        <div className="worker-section-heading">
          <span className="worker-eyebrow">In my possession</span>
          <span className="worker-section-count">{tools.data?.length ?? 0}</span>
        </div>
        {tools.isPending && <Loading />}
        {tools.error && <Notice error>{errorMessage(tools.error)}</Notice>}
        <div className="worker-tool-list">
          {tools.data?.map((tool) => (
            <article className="worker-tool-row" key={tool.id}>
              <Link
                className="worker-tool-main"
                to={`/app/mine/${tool.id}`}
                aria-label={`${tool.asset_tag} ${tool.name}`}
              >
                <AssetPhoto asset={tool} companyId={c.company_id} />
                <div className="worker-tool-copy">
                  <strong>{tool.name}</strong>
                  <span className="muted">
                    {tool.manufacturer} · {tool.model_number}
                  </span>
                  <small>
                    {assetStatus(tool)} · {date(tool.custody_started_at)} · {tool.asset_tag}
                  </small>
                </div>
              </Link>
              <Link className="button worker-transfer-button" to={`/app/mine/${tool.id}?action=transfer`}>
                Transfer
              </Link>
            </article>
          ))}
        </div>
        {tools.data?.length === 0 && <p className="worker-empty-copy">You don’t have any tools in your custody yet.</p>}
      </section>
      <Link className="worker-checkout-pill" to="/app/checkout">
        Need something else? Browse checkout
      </Link>
    </div>
  );
}

export function InventoryPage({ flagged = false }: { flagged?: boolean }) {
  const { c, refs, tools, groups, expanded, toggle, search, setSearch, warehouse, setWarehouse } =
    useInventoryView(flagged);
  const rows = [...groups.values()].flat();
  return (
    <div className="page-content admin-operations-page">
      <header className="page-heading">
        <div>
          <h1>{flagged ? 'Damaged & lost' : 'Inventory'}</h1>
          <p>
            {rows.length} tools · {warehouse ? refs.warehouse(warehouse) : 'All warehouses'}
          </p>
        </div>
        {c.can('tools.register') && (
          <Link className="button primary" to="/app/tools/new">
            Add tool
          </Link>
        )}
      </header>
      <div className="toolbar">
        <Field
          label="Search inventory"
          type="search"
          value={search}
          placeholder="Search tools…"
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="field">
          <label htmlFor="inventory-warehouse">Warehouse</label>
          <select id="inventory-warehouse" value={warehouse} onChange={(event) => setWarehouse(event.target.value)}>
            <option value="">All warehouses</option>
            {refs.warehouses.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {tools.isPending && <Loading />}
      {tools.error && <Notice error>{errorMessage(tools.error)}</Notice>}
      <div className="inventory-card">
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Holder</th>
                <th>Status</th>
                <th>Warehouse</th>
                <th>Last moved</th>
              </tr>
            </thead>
            <tbody>
              {[...groups.entries()].map(([id, units]) =>
                units.length === 1 ? (
                  <InventoryRow
                    key={units[0].id}
                    asset={units[0]}
                    companyId={c.company_id}
                    holder={
                      units[0].holder_membership_id
                        ? refs.person(units[0].holder_membership_id)
                        : refs.warehouse(units[0].warehouse_id)
                    }
                    warehouse={refs.warehouse(units[0].responsible_warehouse_id)}
                  />
                ) : (
                  <InventoryGroup
                    key={id}
                    units={units}
                    companyId={c.company_id}
                    expanded={expanded.has(id)}
                    toggle={() => toggle(id)}
                    holder={refs.person}
                    warehouse={refs.warehouse}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
      {tools.data && !rows.length && <Empty>No tools match this inventory view.</Empty>}
    </div>
  );
}
function InventoryGroup({
  units,
  companyId,
  expanded,
  toggle,
  holder,
  warehouse,
}: {
  units: Asset[];
  companyId: string;
  expanded: boolean;
  toggle: () => void;
  holder: (id: string | null) => string;
  warehouse: (id: string | null) => string;
}) {
  const first = units[0];
  return (
    <>
      <tr
        className="inventory-group-row"
        tabIndex={0}
        role="button"
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${first.name}, ${units.length} tools`}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <td>
          <div className="inventory-tool">
            <ChevronDown size={14} />
            <AssetPhoto asset={first} companyId={companyId} />
            <div>
              <strong>{first.name}</strong>
              <span>
                {first.manufacturer} · {first.model_number}
              </span>
            </div>
          </div>
        </td>
        <td>{units.length} individual tools</td>
        <td>{units.filter((unit) => unit.requestable).length} available</td>
        <td>{new Set(units.map((unit) => unit.responsible_warehouse_id)).size} warehouses</td>
        <td />
      </tr>
      {expanded &&
        units.map((unit) => (
          <InventoryRow
            nested
            key={unit.id}
            asset={unit}
            companyId={companyId}
            holder={unit.holder_membership_id ? holder(unit.holder_membership_id) : warehouse(unit.warehouse_id)}
            warehouse={warehouse(unit.responsible_warehouse_id)}
          />
        ))}
    </>
  );
}
function InventoryRow({
  asset,
  companyId,
  holder,
  warehouse,
  nested = false,
}: {
  asset: Asset;
  companyId: string;
  holder: string;
  warehouse: string;
  nested?: boolean;
}) {
  const location = useLocation();
  return (
    <tr className={nested ? 'inventory-row inventory-row--nested' : 'inventory-row'}>
      <td>
        <Link
          className="inventory-tool"
          to={`/app/tools/${asset.id}`}
          state={{ returnTo: location.pathname + location.search }}
          aria-label={`${asset.asset_tag} ${asset.name}`}
        >
          <AssetPhoto asset={asset} companyId={companyId} />
          <div>
            <strong>{nested ? asset.asset_tag : asset.name}</strong>
            <span>{nested ? asset.name : `${asset.manufacturer} · ${asset.model_number}`}</span>
          </div>
        </Link>
      </td>
      <td>{holder}</td>
      <td>
        <Badge>{assetStatus(asset)}</Badge>
      </td>
      <td>{warehouse}</td>
      <td>{date(asset.custody_started_at)}</td>
    </tr>
  );
}
export function CheckoutPage() {
  const location = useLocation();
  const {
    c,
    refs,
    tools,
    groups,
    search,
    setSearch,
    warehouse,
    setWarehouse,
    mode,
    setMode,
    category,
    categories,
    setCategory,
    availability,
    setAvailability,
  } = useCheckout();
  return (
    <div className="worker-screen">
      <header className="worker-screen-heading">
        <h1>Checkout</h1>
        <div className="view-controls">
          <button aria-label="Grid" aria-pressed={mode === 'grid'} onClick={() => setMode('grid')}>
            <Grid2X2 size={16} />
          </button>
          <button aria-label="List" aria-pressed={mode === 'list'} onClick={() => setMode('list')}>
            <List size={16} />
          </button>
        </div>
      </header>
      <Field
        label="Search tools"
        type="search"
        value={search}
        placeholder="Search tools"
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="field" style={{ margin: '16px 0' }}>
        <label htmlFor="checkout-warehouse">Warehouse</label>
        <select id="checkout-warehouse" value={warehouse} onChange={(event) => setWarehouse(event.target.value)}>
          <option value="">All warehouses</option>
          {refs.warehouses.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="checkout-filters">
        <div className="field">
          <label htmlFor="checkout-category">Category</label>
          <select id="checkout-category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="checkout-availability">Availability</label>
          <select
            id="checkout-availability"
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
          >
            <option value="">All tools</option>
            <option value="available">Available at warehouse</option>
            <option value="held">With a person</option>
          </select>
        </div>
      </div>
      {tools.isPending && <Loading />}
      {tools.error && <Notice error>{errorMessage(tools.error)}</Notice>}
      <div className={`checkout-grid checkout-grid--${mode}`}>
        {[...groups.entries()].map(([id, units]) => (
          <article className="checkout-card" key={id}>
            <AssetPhoto asset={units[0]} companyId={c.company_id} large />
            <div>
              <h2>{units[0].name}</h2>
              <p>
                {units[0].manufacturer} · {units[0].model_number}
              </p>
              <p>
                {units.filter((unit) => unit.requestable).length} of {units.length} available
              </p>
              {units.map((unit) => (
                <Link
                  key={unit.id}
                  className="button"
                  style={{ margin: '4px 4px 0 0', fontSize: 11 }}
                  to={`/app/checkout/${unit.id}`}
                  state={{ returnTo: location.pathname + location.search }}
                >
                  {unit.asset_tag} · {unit.requestable ? 'Request' : assetStatus(unit)}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
      {tools.data && groups.size === 0 && <Empty>No tools match those filters.</Empty>}
    </div>
  );
}
export function ToolSheet({ field = 'inventory' }: { field?: 'mine' | 'checkout' | 'inventory' }) {
  const { close } = useSheetNavigation();
  return (
    <>
      {field === 'mine' ? <MyToolsPage /> : field === 'checkout' ? <CheckoutPage /> : <InventoryPage />}
      <RecordSheet title="Tool details" onClose={close}>
        <ToolDetail />
      </RecordSheet>
    </>
  );
}
