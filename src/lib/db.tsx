import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { seedDatabase } from '../data/seed';
import { STORE_PRODUCT_PHOTOS } from '../data/storeProductImages';
import { useToast } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { isSupabaseConfigured, rpc } from './supabase';
import type {
  Accessory,
  CostElement,
  Database,
  FactoryImage,
  ImageOwnerTable,
  Inspection,
  InspectionStatus,
  Machinery,
  Mold,
  PackagingRow,
  Product,
  RawMaterial,
  Settings,
  SparePart,
  StageOverride,
  TableKey,
  TableMap,
} from '../types';

const STORAGE_KEY = 'elzonki.db.v1';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function loadDatabase(): Database {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return clone(seedDatabase);
    const parsed = JSON.parse(stored) as Partial<Database>;
    const base = clone(seedDatabase);
    const merged: Database = {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      molds: Array.isArray(parsed.molds) ? parsed.molds : base.molds,
      machinery: Array.isArray(parsed.machinery) ? parsed.machinery : base.machinery,
      spareParts: normalizeSpareParts(parsed.spareParts),
      images: Array.isArray(parsed.images) ? normalizeImages(parsed.images) : base.images,
      inspections: normalizeInspections(parsed.inspections),
    };
    return {
      ...merged,
      products: merged.products.map((product) => ({
        ...product,
        stageMachines: product.stageMachines ?? {},
        stageOverrides: product.stageOverrides ?? {},
      })),
      accessories: merged.accessories.map((accessory) => ({
        ...accessory,
        productCodes: Array.isArray(accessory.productCodes)
          ? accessory.productCodes
          : (base.accessories.find((item) => item.code === accessory.code)?.productCodes ?? []),
      })),
    };
  } catch {
    return clone(seedDatabase);
  }
}

const normalizeProducts = (rows: Product[] | null | undefined): Product[] =>
  (Array.isArray(rows) ? rows : []).map((product) => ({
    ...product,
    stageMachines: product.stageMachines ?? {},
    stageOverrides: product.stageOverrides ?? {},
  }));

const normalizeAccessories = (rows: Accessory[] | null | undefined): Accessory[] =>
  (Array.isArray(rows) ? rows : []).map((accessory) => ({
    ...accessory,
    productCodes: Array.isArray(accessory.productCodes) ? accessory.productCodes : [],
  }));

const normalizeRaw = (rows: RawMaterial[] | null | undefined): RawMaterial[] =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    productCodes: Array.isArray(row.productCodes) ? row.productCodes : [],
  }));

const normalizePackaging = (rows: PackagingRow[] | null | undefined): PackagingRow[] =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    productCodes: Array.isArray(row.productCodes) ? row.productCodes : [],
  }));

const normalizeMolds = (rows: Mold[] | null | undefined): Mold[] =>
  Array.isArray(rows) ? rows : [];

const normalizeMachinery = (rows: Machinery[] | null | undefined): Machinery[] =>
  Array.isArray(rows) ? rows : [];

const normalizeSpareParts = (rows: SparePart[] | null | undefined): SparePart[] =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    unitCost: Number(row.unitCost) || 0,
    stockQty: Number(row.stockQty) || 0,
    replacementIntervalHours: Number(row.replacementIntervalHours) || 0,
    notes: row.notes ?? '',
  }));

const attemptedPhotoUpgrades = new Set<string>();

// يستبدل صور المنتجات الافتراضية القديمة (SVG) بصور المتجر الحقيقية دون المساس بصور المستخدم.
async function upgradeLegacyProductPhotos(
  images: FactoryImage[],
  products: Product[],
  token: string,
): Promise<FactoryImage[]> {
  const byId = new Map(products.map((product) => [product.id, product]));
  const next = [...images];
  let changed = false;

  for (let index = 0; index < next.length; index += 1) {
    const image = next[index];
    if (image.ownerTable !== 'products' || !image.dataUrl.startsWith('data:image/svg+xml')) {
      continue;
    }
    const product = byId.get(image.ownerId);
    const photo = product ? STORE_PRODUCT_PHOTOS[product.code] : undefined;
    if (!photo || photo === image.dataUrl) continue;

    const attemptKey = `${image.ownerId}:${image.updatedAt}`;
    if (attemptedPhotoUpgrades.has(attemptKey)) continue;
    attemptedPhotoUpgrades.add(attemptKey);

    try {
      const saved = await rpc<FactoryImage>('app_set_factory_image', {
        p_token: token,
        p_owner_table: 'products',
        p_owner_id: image.ownerId,
        p_data_url: photo,
      });
      next[index] = { ...image, ...saved, dataUrl: photo };
      changed = true;
    } catch {
      /* بدون صلاحية تعديل أو عند تعذر الاتصال: تبقى الصورة الحالية كما هي. */
    }
  }

  return changed ? next : images;
}

const normalizeImages = (rows: FactoryImage[] | null | undefined): FactoryImage[] =>
  (Array.isArray(rows) ? rows : []).filter(
    (row) =>
      Boolean(row?.ownerId) &&
      (row.ownerTable === 'products' ||
        row.ownerTable === 'machinery' ||
        row.ownerTable === 'molds' ||
        row.ownerTable === 'accessories') &&
      typeof row.dataUrl === 'string' &&
      row.dataUrl.startsWith('data:image/'),
  );

const normalizeInspections = (rows: Inspection[] | null | undefined): Inspection[] =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    status:
      row.status === 'fail' || row.status === 'rework' ? row.status : 'pass',
    note: row.note ?? '',
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  }));

interface RemoteFactoryPayload {
  products?: Product[] | null;
  rawMaterials?: RawMaterial[] | null;
  accessories?: Accessory[] | null;
  molds?: Mold[] | null;
  machinery?: Machinery[] | null;
  spareParts?: SparePart[] | null;
  images?: FactoryImage[] | null;
  packaging?: PackagingRow[] | null;
  costElements?: CostElement[] | null;
  inspections?: Inspection[] | null;
  settings?: Settings | null;
}

export interface FactorySyncState {
  ready: boolean;
  syncing: boolean;
  error: string;
  lastSyncedAt: string | null;
}

function syncErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const code = raw.trim().split('\n')[0]?.trim() ?? '';
  const messages: Record<string, string> = {
    UNAUTHORIZED: 'انتهت جلسة المزامنة. سجّل الدخول من جديد.',
    FORBIDDEN: 'لا تملك صلاحية تعديل هذه البيانات.',
    CODE_TAKEN: 'هذا الكود مستخدم بالفعل في جهاز آخر.',
    MACHINE_NOT_FOUND: 'الماكينة المرتبطة بقطعة الغيار غير موجودة على الخادم.',
    OWNER_NOT_FOUND: 'العنصر المطلوب إضافة الصورة إليه غير موجود على الخادم.',
    INVALID_IMAGE: 'صيغة الصورة غير مدعومة أو حجمها أكبر من الحد المسموح.',
    INVALID_TABLE: 'نوع العنصر غير صالح لإضافة صورة.',
    PRODUCT_NOT_FOUND: 'المنتج المرتبط بعنصر التكلفة غير موجود على الخادم.',
    COST_EXISTS: 'يوجد عنصر تكلفة آخر مرتبط بهذا المنتج.',
    INVALID_ROW: 'بعض بيانات السجل غير صالحة.',
    INVALID_ROWS: 'صيغة بيانات المزامنة غير صالحة.',
    INVALID_STATUS: 'حالة الفحص غير صالحة.',
    INVALID_SETTINGS: 'قيم إعدادات التكلفة خارج النطاق المسموح.',
    TOO_MANY_ROWS: 'عدد السجلات أكبر من الحد المسموح في عملية واحدة.',
  };
  if (messages[code]) return messages[code];
  if (/failed to fetch|network|fetch failed/i.test(raw)) {
    return 'تعذر الاتصال بـ Supabase. تحقق من الشبكة ثم أعد المحاولة.';
  }
  return 'تعذرت مزامنة بيانات المصنع مع الخادم.';
}

export const makeId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

interface DataContextValue {
  db: Database;
  syncState: FactorySyncState;
  upsert: <K extends TableKey>(table: K, row: TableMap[K]) => Promise<boolean>;
  upsertMany: <K extends TableKey>(table: K, rows: TableMap[K][]) => Promise<boolean>;
  remove: (table: TableKey, id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  resetDemo: () => Promise<boolean>;
  updateSettings: (patch: Partial<Settings>) => void;
  setInspection: (
    productCode: string,
    checkId: string,
    patch: { status?: InspectionStatus; note?: string },
  ) => void;
  clearInspections: (productCode: string) => Promise<boolean>;
  updateProductStages: (
    productId: string,
    stageMachines: Record<string, string>,
    stageOverrides: Record<string, StageOverride>,
  ) => Promise<boolean>;
  setImage: (
    ownerTable: ImageOwnerTable,
    ownerId: string,
    dataUrl: string,
  ) => Promise<boolean>;
  removeImage: (ownerTable: ImageOwnerTable, ownerId: string) => Promise<boolean>;
  upsertSparePart: (part: SparePart) => Promise<boolean>;
  removeSparePart: (id: string) => Promise<boolean>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { sessionToken } = useAuth();
  const toast = useToast();
  const [db, setDb] = useState<Database>(() => loadDatabase());
  const [syncState, setSyncState] = useState<FactorySyncState>({
    ready: false,
    syncing: false,
    error: '',
    lastSyncedAt: null,
  });
  const dbRef = useRef(db);
  const syncInFlight = useRef(false);
  const writeInFlight = useRef(0);
  const settingsTimer = useRef<number | null>(null);
  const inspectionTimers = useRef<Map<string, number>>(new Map());
  const inspectionVersions = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* التخزين ممتلئ أو غير متاح */
    }
  }, [db]);

  const loadRemote = useCallback(
    async (silent = false) => {
      if (!sessionToken) return;
      if (!isSupabaseConfigured) {
        setSyncState((prev) => ({
          ...prev,
          ready: true,
          syncing: false,
          error: 'لم تُضبط مفاتيح Supabase. تُعرض النسخة المحلية فقط.',
        }));
        return;
      }
      if (
        syncInFlight.current ||
        writeInFlight.current > 0 ||
        settingsTimer.current ||
        inspectionTimers.current.size > 0
      )
        return;
      syncInFlight.current = true;
      if (!silent) {
        setSyncState((prev) => ({ ...prev, syncing: true, error: '' }));
      }
      try {
        const remote = await rpc<RemoteFactoryPayload>('app_factory_bootstrap', {
          p_token: sessionToken,
        });
        const remoteImages = await upgradeLegacyProductPhotos(
          normalizeImages(remote.images),
          normalizeProducts(remote.products),
          sessionToken,
        );
        setDb((prev) => ({
          ...prev,
          products: normalizeProducts(remote.products),
          rawMaterials: normalizeRaw(remote.rawMaterials),
          accessories: normalizeAccessories(remote.accessories),
          molds: normalizeMolds(remote.molds),
          machinery: normalizeMachinery(remote.machinery),
          spareParts: normalizeSpareParts(remote.spareParts),
          images: remoteImages,
          packaging: normalizePackaging(remote.packaging),
          costElements: Array.isArray(remote.costElements) ? remote.costElements : [],
          inspections: normalizeInspections(remote.inspections),
          settings: remote.settings
            ? { ...prev.settings, ...remote.settings }
            : prev.settings,
        }));
        setSyncState({
          ready: true,
          syncing: false,
          error: '',
          lastSyncedAt: new Date().toISOString(),
        });
      } catch (error) {
        setSyncState((prev) => ({
          ...prev,
          ready: true,
          syncing: false,
          error: syncErrorMessage(error),
          lastSyncedAt: prev.lastSyncedAt,
        }));
      } finally {
        syncInFlight.current = false;
      }
    },
    [sessionToken],
  );

  useEffect(() => {
    if (settingsTimer.current) {
      window.clearTimeout(settingsTimer.current);
      settingsTimer.current = null;
    }
    if (!sessionToken) {
      setSyncState({
        ready: false,
        syncing: false,
        error: '',
        lastSyncedAt: null,
      });
      return;
    }
    setSyncState((prev) => ({ ...prev, ready: false, syncing: true, error: '' }));
    void loadRemote();
    const interval = window.setInterval(() => void loadRemote(true), 15000);
    const onFocus = () => void loadRemote(true);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void loadRemote(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (settingsTimer.current) {
        window.clearTimeout(settingsTimer.current);
        settingsTimer.current = null;
      }
      for (const timer of inspectionTimers.current.values()) {
        window.clearTimeout(timer);
      }
      inspectionTimers.current.clear();
      inspectionVersions.current.clear();
    };
  }, [sessionToken, loadRemote]);

  const upsertMany = useCallback(
    async <K extends TableKey>(table: K, rows: TableMap[K][]): Promise<boolean> => {
      if (!rows.length) return true;
      if (!sessionToken) {
        toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error');
        return false;
      }
      const previous = dbRef.current;
      const movedCodes = new Map<string, string>();
      if (table === 'products') {
        for (const row of rows as TableMap['products'][]) {
          const before = previous.products.find((item) => item.id === row.id);
          if (before && before.code !== row.code) {
            movedCodes.set(before.code, row.code);
          }
        }
      }
      setDb((prev) => {
        const list = [...(prev[table] as TableMap[K][])];
        for (const row of rows) {
          const index = list.findIndex((item) => item.id === row.id);
          if (index >= 0) list[index] = row;
          else list.unshift(row);
        }
        const next = { ...prev, [table]: list } as Database;
        if (movedCodes.size) {
          next.inspections = prev.inspections.map((item) => {
            const code = movedCodes.get(item.productCode);
            return code ? { ...item, productCode: code } : item;
          });
        }
        return next;
      });

      writeInFlight.current += 1;
      let failed = false;
      try {
        const saved = await rpc<TableMap[K][]>('app_upsert_factory_rows', {
          p_token: sessionToken,
          p_table: table,
          p_rows: rows,
        });
        if (Array.isArray(saved) && saved.length) {
          setDb((prev) => {
            const list = [...(prev[table] as TableMap[K][])];
            for (const row of saved) {
              const index = list.findIndex((item) => item.id === row.id);
              if (index >= 0) list[index] = row;
              else list.unshift(row);
            }
            return { ...prev, [table]: list } as Database;
          });
        }
        setSyncState((prev) => ({
          ...prev,
          error: '',
          lastSyncedAt: new Date().toISOString(),
        }));
        return true;
      } catch (error) {
        failed = true;
        setDb(previous);
        const message = syncErrorMessage(error);
        setSyncState((prev) => ({ ...prev, error: message }));
        toast(message, 'error');
        return false;
      } finally {
        writeInFlight.current -= 1;
        if (failed) void loadRemote(true);
      }
    },
    [sessionToken, loadRemote, toast],
  );

  const upsert = useCallback(
    <K extends TableKey>(table: K, row: TableMap[K]) => upsertMany(table, [row]),
    [upsertMany],
  );

  const remove = useCallback(
    async (table: TableKey, id: string): Promise<boolean> => {
      if (!sessionToken) {
        toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error');
        return false;
      }
      const previous = dbRef.current;
      const removedProduct =
        table === 'products' ? previous.products.find((item) => item.id === id) : undefined;
      const imageOwner: ImageOwnerTable | null =
        table === 'products' ||
        table === 'machinery' ||
        table === 'molds' ||
        table === 'accessories'
          ? table
          : null;
      setDb((prev) => {
        const next = {
          ...prev,
          [table]: (prev[table] as { id: string }[]).filter((item) => item.id !== id),
        } as Database;
        if (removedProduct) {
          next.inspections = prev.inspections.filter(
            (item) => item.productCode !== removedProduct.code,
          );
        }
        if (imageOwner) {
          next.images = prev.images.filter(
            (image) => !(image.ownerTable === imageOwner && image.ownerId === id),
          );
        }
        if (table === 'machinery') {
          next.spareParts = prev.spareParts.filter((part) => part.machineId !== id);
        }
        return next;
      });

      writeInFlight.current += 1;
      let failed = false;
      try {
        await rpc('app_delete_factory_row', {
          p_token: sessionToken,
          p_table: table,
          p_id: id,
        });
        setSyncState((prev) => ({
          ...prev,
          error: '',
          lastSyncedAt: new Date().toISOString(),
        }));
        return true;
      } catch (error) {
        failed = true;
        setDb(previous);
        const message = syncErrorMessage(error);
        setSyncState((prev) => ({ ...prev, error: message }));
        toast(message, 'error');
        return false;
      } finally {
        writeInFlight.current -= 1;
        if (failed) void loadRemote(true);
      }
    },
    [sessionToken, loadRemote, toast],
  );

  const updateProductStages = useCallback(
    async (
      productId: string,
      stageMachines: Record<string, string>,
      stageOverrides: Record<string, StageOverride>,
    ): Promise<boolean> => {
      if (!sessionToken) {
        toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error');
        return false;
      }
      const previous = dbRef.current;
      setDb((prev) => ({
        ...prev,
        products: prev.products.map((product) =>
          product.id === productId
            ? { ...product, stageMachines, stageOverrides }
            : product,
        ),
      }));

      writeInFlight.current += 1;
      let failed = false;
      try {
        const saved = await rpc<Product>('app_update_product_stages', {
          p_token: sessionToken,
          p_product_id: productId,
          p_stage_machines: stageMachines,
          p_stage_overrides: stageOverrides,
        });
        setDb((prev) => ({
          ...prev,
          products: prev.products.map((product) =>
            product.id === productId ? { ...product, ...saved } : product,
          ),
        }));
        setSyncState((prev) => ({
          ...prev,
          error: '',
          lastSyncedAt: new Date().toISOString(),
        }));
        return true;
      } catch (error) {
        failed = true;
        setDb(previous);
        const message = syncErrorMessage(error);
        setSyncState((prev) => ({ ...prev, error: message }));
        toast(message, 'error');
        return false;
      } finally {
        writeInFlight.current -= 1;
        if (failed) void loadRemote(true);
      }
    },
    [sessionToken, loadRemote, toast],
  );

  const setImage = useCallback(
    async (ownerTable: ImageOwnerTable, ownerId: string, dataUrl: string): Promise<boolean> => {
      if (!sessionToken) {
        toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error');
        return false;
      }
      const previous = dbRef.current;
      const optimistic: FactoryImage = {
        ownerTable,
        ownerId,
        dataUrl,
        updatedAt: new Date().toISOString(),
      };
      setDb((prev) => ({
        ...prev,
        images: [
          ...prev.images.filter(
            (image) => !(image.ownerTable === ownerTable && image.ownerId === ownerId),
          ),
          optimistic,
        ],
      }));

      writeInFlight.current += 1;
      let failed = false;
      try {
        const saved = await rpc<FactoryImage>('app_set_factory_image', {
          p_token: sessionToken,
          p_owner_table: ownerTable,
          p_owner_id: ownerId,
          p_data_url: dataUrl,
        });
        setDb((prev) => ({
          ...prev,
          images: [
            ...prev.images.filter(
              (image) => !(image.ownerTable === ownerTable && image.ownerId === ownerId),
            ),
            { ...optimistic, ...saved },
          ],
        }));
        setSyncState((prev) => ({
          ...prev,
          error: '',
          lastSyncedAt: new Date().toISOString(),
        }));
        return true;
      } catch (error) {
        failed = true;
        setDb(previous);
        const message = syncErrorMessage(error);
        setSyncState((prev) => ({ ...prev, error: message }));
        toast(message, 'error');
        return false;
      } finally {
        writeInFlight.current -= 1;
        if (failed) void loadRemote(true);
      }
    },
    [sessionToken, loadRemote, toast],
  );

  const removeImage = useCallback(
    async (ownerTable: ImageOwnerTable, ownerId: string): Promise<boolean> => {
      if (!sessionToken) {
        toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error');
        return false;
      }
      const previous = dbRef.current;
      setDb((prev) => ({
        ...prev,
        images: prev.images.filter(
          (image) => !(image.ownerTable === ownerTable && image.ownerId === ownerId),
        ),
      }));

      writeInFlight.current += 1;
      let failed = false;
      try {
        await rpc('app_delete_factory_image', {
          p_token: sessionToken,
          p_owner_table: ownerTable,
          p_owner_id: ownerId,
        });
        setSyncState((prev) => ({
          ...prev,
          error: '',
          lastSyncedAt: new Date().toISOString(),
        }));
        return true;
      } catch (error) {
        failed = true;
        setDb(previous);
        const message = syncErrorMessage(error);
        setSyncState((prev) => ({ ...prev, error: message }));
        toast(message, 'error');
        return false;
      } finally {
        writeInFlight.current -= 1;
        if (failed) void loadRemote(true);
      }
    },
    [sessionToken, loadRemote, toast],
  );

  const upsertSparePart = useCallback(
    async (part: SparePart): Promise<boolean> => {
      if (!sessionToken) {
        toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error');
        return false;
      }
      const previous = dbRef.current;
      setDb((prev) => {
        const index = prev.spareParts.findIndex((item) => item.id === part.id);
        const list = [...prev.spareParts];
        if (index >= 0) list[index] = part;
        else list.unshift(part);
        return { ...prev, spareParts: list };
      });

      writeInFlight.current += 1;
      let failed = false;
      try {
        const saved = await rpc<SparePart>('app_upsert_spare_part', {
          p_token: sessionToken,
          p_row: part,
        });
        setDb((prev) => {
          const index = prev.spareParts.findIndex((item) => item.id === saved.id);
          const list = [...prev.spareParts];
          if (index >= 0) list[index] = saved;
          else list.unshift(saved);
          return { ...prev, spareParts: list };
        });
        setSyncState((prev) => ({
          ...prev,
          error: '',
          lastSyncedAt: new Date().toISOString(),
        }));
        return true;
      } catch (error) {
        failed = true;
        setDb(previous);
        const message = syncErrorMessage(error);
        setSyncState((prev) => ({ ...prev, error: message }));
        toast(message, 'error');
        return false;
      } finally {
        writeInFlight.current -= 1;
        if (failed) void loadRemote(true);
      }
    },
    [sessionToken, loadRemote, toast],
  );

  const removeSparePart = useCallback(
    async (id: string): Promise<boolean> => {
      if (!sessionToken) {
        toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error');
        return false;
      }
      const previous = dbRef.current;
      setDb((prev) => ({
        ...prev,
        spareParts: prev.spareParts.filter((part) => part.id !== id),
      }));

      writeInFlight.current += 1;
      let failed = false;
      try {
        await rpc('app_delete_spare_part', {
          p_token: sessionToken,
          p_id: id,
        });
        setSyncState((prev) => ({
          ...prev,
          error: '',
          lastSyncedAt: new Date().toISOString(),
        }));
        return true;
      } catch (error) {
        failed = true;
        setDb(previous);
        const message = syncErrorMessage(error);
        setSyncState((prev) => ({ ...prev, error: message }));
        toast(message, 'error');
        return false;
      } finally {
        writeInFlight.current -= 1;
        if (failed) void loadRemote(true);
      }
    },
    [sessionToken, loadRemote, toast],
  );

  const refresh = useCallback(() => loadRemote(false), [loadRemote]);

  const resetDemo = useCallback(async (): Promise<boolean> => {
    if (settingsTimer.current) {
      window.clearTimeout(settingsTimer.current);
      settingsTimer.current = null;
    }
    for (const timer of inspectionTimers.current.values()) {
      window.clearTimeout(timer);
    }
    inspectionTimers.current.clear();
    inspectionVersions.current.clear();
    const seeded = clone(seedDatabase);
    setDb(seeded);
    if (!sessionToken) return true;
    writeInFlight.current += 1;
    try {
      await rpc('app_replace_factory_data', {
        p_token: sessionToken,
        p_payload: {
          products: seeded.products,
          rawMaterials: seeded.rawMaterials,
          accessories: seeded.accessories,
          molds: seeded.molds,
          machinery: seeded.machinery,
          packaging: seeded.packaging,
          costElements: seeded.costElements,
          inspections: seeded.inspections,
          settings: seeded.settings,
        },
      });
      // استعادة الصور الافتراضية بعد مسح البيانات التجريبية.
      for (const image of seeded.images) {
        await rpc('app_set_factory_image', {
          p_token: sessionToken,
          p_owner_table: image.ownerTable,
          p_owner_id: image.ownerId,
          p_data_url: image.dataUrl,
        });
      }
      setSyncState((prev) => ({
        ...prev,
        error: '',
        lastSyncedAt: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      const message = syncErrorMessage(error);
      setSyncState((prev) => ({ ...prev, error: message }));
      toast(message, 'error');
      return false;
    } finally {
      writeInFlight.current -= 1;
      void loadRemote(true);
    }
  }, [sessionToken, loadRemote, toast]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setDb((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
      if (!sessionToken) return;
      if (settingsTimer.current) window.clearTimeout(settingsTimer.current);
      settingsTimer.current = window.setTimeout(() => {
        settingsTimer.current = null;
        const settings = dbRef.current.settings;
        writeInFlight.current += 1;
        let failed = false;
        void (async () => {
          try {
            const saved = await rpc<Settings>('app_update_factory_settings', {
              p_token: sessionToken,
              p_margin_pct: settings.marginPct,
              p_aluminum_factor: settings.aluminumFactor,
            });
            setDb((prev) => ({ ...prev, settings: { ...prev.settings, ...saved } }));
            setSyncState((prev) => ({
              ...prev,
              error: '',
              lastSyncedAt: new Date().toISOString(),
            }));
          } catch (error) {
            failed = true;
            const message = syncErrorMessage(error);
            setSyncState((prev) => ({ ...prev, error: message }));
            toast(message, 'error');
          } finally {
            writeInFlight.current -= 1;
            if (failed) void loadRemote(true);
          }
        })();
      }, 600);
    },
    [sessionToken, loadRemote, toast],
  );

  const setInspection = useCallback(
    (
      productCode: string,
      checkId: string,
      patch: { status?: InspectionStatus; note?: string },
    ) => {
      if (!sessionToken) {
        toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error');
        return;
      }

      setDb((prev) => {
        const updatedAt = new Date().toISOString();
        const index = prev.inspections.findIndex(
          (item) => item.productCode === productCode && item.checkId === checkId,
        );
        const list = [...prev.inspections];
        if (index >= 0) {
          list[index] = { ...list[index], ...patch, updatedAt };
        } else {
          const row: Inspection = {
            id: `insp-${productCode}-${checkId}`,
            productCode,
            checkId,
            status: patch.status ?? 'pass',
            note: patch.note ?? '',
            updatedAt,
          };
          list.push(row);
        }
        return { ...prev, inspections: list };
      });

      const key = `${productCode}::${checkId}`;
      const version = (inspectionVersions.current.get(key) ?? 0) + 1;
      inspectionVersions.current.set(key, version);
      const pending = inspectionTimers.current.get(key);
      if (pending) window.clearTimeout(pending);
      inspectionTimers.current.set(
        key,
        window.setTimeout(() => {
          inspectionTimers.current.delete(key);
          const current = dbRef.current.inspections.find(
            (item) => item.productCode === productCode && item.checkId === checkId,
          );
          if (!current) return;
          writeInFlight.current += 1;
          let failed = false;
          void (async () => {
            try {
              const saved = await rpc<Inspection>('app_set_inspection', {
                p_token: sessionToken,
                p_product_code: productCode,
                p_check_id: checkId,
                p_status: current.status,
                p_note: current.note,
              });
              if (
                inspectionVersions.current.get(key) === version &&
                !inspectionTimers.current.has(key)
              ) {
                setDb((prev) => {
                  const list = prev.inspections.filter(
                    (item) =>
                      !(item.productCode === productCode && item.checkId === checkId) &&
                      item.id !== saved.id,
                  );
                  return { ...prev, inspections: [...list, saved] };
                });
              }
              setSyncState((prev) => ({
                ...prev,
                error: '',
                lastSyncedAt: new Date().toISOString(),
              }));
            } catch (error) {
              failed = true;
              const message = syncErrorMessage(error);
              setSyncState((prev) => ({ ...prev, error: message }));
              toast(message, 'error');
            } finally {
              writeInFlight.current -= 1;
              if (failed) void loadRemote(true);
            }
          })();
        }, 500),
      );
    },
    [sessionToken, loadRemote, toast],
  );

  const clearInspections = useCallback(
    async (productCode: string): Promise<boolean> => {
      if (!sessionToken) {
        toast('انتهت الجلسة. سجّل الدخول من جديد.', 'error');
        return false;
      }

      const prefix = `${productCode}::`;
      for (const [key, timer] of inspectionTimers.current) {
        if (key.startsWith(prefix)) {
          window.clearTimeout(timer);
          inspectionTimers.current.delete(key);
        }
      }
      for (const key of [...inspectionVersions.current.keys()]) {
        if (key.startsWith(prefix)) inspectionVersions.current.delete(key);
      }

      const previous = dbRef.current;
      setDb((prev) => ({
        ...prev,
        inspections: prev.inspections.filter((item) => item.productCode !== productCode),
      }));

      // انتظر أي كتابة سابقة قبل الحذف حتى لا يعيد طلب قديم إضافة نتيجة بعد المسح.
      while (writeInFlight.current > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }

      writeInFlight.current += 1;
      let failed = false;
      try {
        await rpc('app_clear_inspections', {
          p_token: sessionToken,
          p_product_code: productCode,
        });
        setSyncState((prev) => ({
          ...prev,
          error: '',
          lastSyncedAt: new Date().toISOString(),
        }));
        return true;
      } catch (error) {
        failed = true;
        setDb(previous);
        const message = syncErrorMessage(error);
        setSyncState((prev) => ({ ...prev, error: message }));
        toast(message, 'error');
        return false;
      } finally {
        writeInFlight.current -= 1;
        if (failed) void loadRemote(true);
      }
    },
    [sessionToken, loadRemote, toast],
  );

  const value = useMemo(
    () => ({
      db,
      syncState,
      upsert,
      upsertMany,
      remove,
      refresh,
      resetDemo,
      updateSettings,
      setInspection,
      clearInspections,
      updateProductStages,
      setImage,
      removeImage,
      upsertSparePart,
      removeSparePart,
    }),
    [
      db,
      syncState,
      upsert,
      upsertMany,
      remove,
      refresh,
      resetDemo,
      updateSettings,
      setInspection,
      clearInspections,
      updateProductStages,
      setImage,
      removeImage,
      upsertSparePart,
      removeSparePart,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
