import { cleanup, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../api/mock/create-mock-api';
import { AppRoutes } from './app-routes';
import { createMemorySessionStore, renderApp } from '../test/render-app';

function findAdapterBoundaryBypasses(sources: Record<string, string>) {
  return Object.entries(sources)
    .filter(([path]) => !/\.test\.[cm]?[jt]sx?$/.test(path) && !path.includes('/test-support/'))
    .flatMap(([path, source]) => {
      const violations: string[] = [];
      if (/from ['"][^'"]*api\/http/.test(source) || /\bfetch\s*\(/.test(source)) {
        violations.push(path + ': transport bypass');
      }
      if (
        !/\/use-[^/]+\.[cm]?[jt]sx?$/.test(path) &&
        !path.endsWith('/session-context.tsx') &&
        !path.endsWith('/providers.tsx')
      ) {
        const directPropertyCall =
          /\b[A-Za-z_$][\w$]*\s*(?:\?\.|\.)\s*(auth|tools|activity|admin|custody|warehouse|reconciliation|settings)\s*(?:\?\.|\.)/.test(
            source,
          );
        const destructuredAdapter =
          /\b(?:const|let|var)\s*\{[^}]*\b(?:auth|tools|activity|admin|custody|warehouse|reconciliation|settings)\b[^}]*\}\s*=\s*[A-Za-z_$][\w$]*/.test(
            source,
          );
        const computedAdapter =
          /\b[A-Za-z_$][\w$]*\s*(?:\?\.\s*)?\[\s*['"](?:auth|tools|activity|admin|custody|warehouse|reconciliation|settings)['"]\s*\]/.test(
            source,
          );
        const memberAlias =
          /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$][\w$]*\s*(?:\?\.|\.)\s*(auth|tools|activity|admin|custody|warehouse|reconciliation|settings)\b/.test(
            source,
          );
        if (directPropertyCall || destructuredAdapter || computedAdapter || memberAlias) {
          violations.push(path + ': direct adapter call');
        }
      }
      if (
        !/\/use-[^/]+\.[cm]?[jt]sx?$/.test(path) &&
        !path.endsWith('/session-context.tsx') &&
        !path.endsWith('/providers.tsx')
      ) {
        if (/from\s+['"][^'"]*api-context['"]/.test(source)) {
          violations.push(path + ': direct useApi boundary');
        }
      }
      return violations;
    });
}

describe('adapter-backed route boundaries', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/login';
  });

  it('surfaces adapter query failures on login, worker, and admin views', async () => {
    const baseApi = createMockApi();
    const loginApi = {
      ...baseApi,
      auth: {
        ...baseApi.auth,
        listDemoProfiles: async () => {
          throw new Error('profiles offline');
        },
      },
    };
    renderApp(<AppRoutes />, { api: loginApi });
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');

    const workerApi = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        listTools: async () => {
          throw new Error('tools offline');
        },
      },
    };
    cleanup();
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: workerApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');

    const adminApi = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        getSummary: async () => {
          throw new Error('summary offline');
        },
      },
    };
    cleanup();
    window.location.hash = '#/admin/dashboard';
    renderApp(<AppRoutes />, { api: adminApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  });

  it('keeps worker, login, and admin loading surfaces visible until adapters resolve', async () => {
    const baseApi = createMockApi();
    type ToolList = Awaited<ReturnType<typeof baseApi.tools.listTools>>;
    let resolveTools: (tools: ToolList) => void = () => undefined;
    const toolsPromise = new Promise<ToolList>((resolve) => {
      resolveTools = resolve;
    });
    const pendingApi = { ...baseApi, tools: { ...baseApi.tools, listTools: () => toolsPromise } };
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: pendingApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByText('Loading your tools…')).toBeInTheDocument();
    resolveTools(await baseApi.tools.listTools());
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();

    cleanup();
    type Profiles = Awaited<ReturnType<typeof baseApi.auth.listDemoProfiles>>;
    let resolveProfiles: (profiles: Profiles) => void = () => undefined;
    const profilesPromise = new Promise<Profiles>((resolve) => {
      resolveProfiles = resolve;
    });
    const pendingLoginApi = { ...baseApi, auth: { ...baseApi.auth, listDemoProfiles: () => profilesPromise } };
    window.location.hash = '#/login';
    renderApp(<AppRoutes />, { api: pendingLoginApi });
    expect(await screen.findByText('Loading profiles…')).toBeInTheDocument();
    resolveProfiles(await baseApi.auth.listDemoProfiles());
    expect(await screen.findByRole('button', { name: 'Enter as Ray' })).toBeInTheDocument();

    cleanup();
    type Summary = Awaited<ReturnType<typeof baseApi.admin.getSummary>>;
    let resolveSummary: (summary: Summary) => void = () => undefined;
    const summaryPromise = new Promise<Summary>((resolve) => {
      resolveSummary = resolve;
    });
    const pendingAdminApi = { ...baseApi, admin: { ...baseApi.admin, getSummary: () => summaryPromise } };
    window.location.hash = '#/admin/dashboard';
    renderApp(<AppRoutes />, { api: pendingAdminApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByText('Loading the control room…')).toBeInTheDocument();
    resolveSummary(await baseApi.admin.getSummary({ actorId: 'sam-ochoa' }));
    expect(await screen.findByRole('heading', { name: 'Control room' })).toBeInTheDocument();
  });

  it('keeps production surfaces behind hooks/contracts instead of transport or direct adapter calls', () => {
    const sources = {
      ...import.meta.glob('../app/**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }),
      ...import.meta.glob('../features/**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }),
      ...import.meta.glob('../components/**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }),
    } as Record<string, string>;
    expect(findAdapterBoundaryBypasses(sources)).toEqual([]);
  });

  it('fails closed for synthetic transport, adapter, and useApi boundary violations', () => {
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': "import { createHttpApi } from '../api/http/create-http-api';",
      }),
    ).toEqual(['../components/Fake.tsx: transport bypass']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': 'const result = api.tools.listTools();',
      }),
    ).toEqual(['../components/Fake.tsx: direct adapter call']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': "import { useApi } from '../api/api-context';",
      }),
    ).toEqual(['../components/Fake.tsx: direct useApi boundary']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx':
          "import { useApi as useDataApi } from '../api/api-context'; const client = useDataApi(); client.tools.listTools();",
      }),
    ).toEqual(['../components/Fake.tsx: direct adapter call', '../components/Fake.tsx: direct useApi boundary']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': 'const { tools } = api; tools.listTools();',
      }),
    ).toEqual(['../components/Fake.tsx: direct adapter call']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': 'const { tools: toolPort, auth } = api; toolPort.listTools();',
      }),
    ).toEqual(['../components/Fake.tsx: direct adapter call']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': "api['tools'].listTools();",
      }),
    ).toEqual(['../components/Fake.tsx: direct adapter call']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': "api?.tools?.listTools(); api?.['auth']?.getSession();",
      }),
    ).toEqual(['../components/Fake.tsx: direct adapter call']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': 'const tools = api.tools; tools.listTools();',
      }),
    ).toEqual(['../components/Fake.tsx: direct adapter call']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': 'const tools = api?.tools; tools?.listTools();',
      }),
    ).toEqual(['../components/Fake.tsx: direct adapter call']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': 'api.warehouse.listQueue({ actorId: "sam-ochoa" });',
      }),
    ).toEqual(['../components/Fake.tsx: direct adapter call']);
    expect(
      findAdapterBoundaryBypasses({
        '../components/Fake.tsx': 'const { warehouse } = api; warehouse.listInventory({ actorId: "sam-ochoa" });',
      }),
    ).toEqual(['../components/Fake.tsx: direct adapter call']);
  });
});
