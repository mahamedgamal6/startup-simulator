import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEMO_ACCOUNTS, hasPermission } from './permissions';
import { isSupabaseConfigured, rpc } from '../lib/supabase';
import type { AppRole, AppUser, AuditEntry } from '../types';

const SESSION_KEY = 'elzonki.session.v2';

interface SessionPayload {
  token?: string;
  user: AppUser;
  role: AppRole;
}

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'انتهت الجلسة أو أنها غير صالحة. سجّل الدخول من جديد.',
  FORBIDDEN: 'لا تملك صلاحية تنفيذ هذه العملية.',
  INVALID_CREDENTIALS: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  ACCOUNT_DISABLED: 'هذا الحساب موقوف. تواصل مع مدير النظام.',
  TOO_MANY_ATTEMPTS: 'عدد محاولات الدخول كبير. حاول مرة أخرى بعد 15 دقيقة.',
  INVALID_NAME: 'الاسم الكامل مطلوب (حرفان على الأقل).',
  INVALID_USERNAME: 'اسم الدخول يجب أن يكون 3–32 حرفًا إنجليزيًا (a-z, 0-9, . _ -).',
  WEAK_PASSWORD: 'كلمة المرور يجب ألا تقل عن 6 أحرف.',
  USERNAME_TAKEN: 'اسم الدخول مستخدم بالفعل.',
  ROLE_NOT_FOUND: 'الدور المحدد غير موجود.',
  USER_NOT_FOUND: 'المستخدم غير موجود.',
  CANNOT_DISABLE_SELF: 'لا يمكنك إيقاف حسابك الحالي.',
  CANNOT_DELETE_SELF: 'لا يمكنك حذف حسابك الحالي.',
  LAST_ADMIN: 'يجب أن يبقى حساب مدير نظام واحد نشط على الأقل.',
  SYSTEM_ROLE: 'دور مدير النظام محمي ولا يمكن تعديله أو حذفه.',
  ROLE_IN_USE: 'لا يمكن حذف الدور لأنه مرتبط بحسابات مستخدمين.',
  ROLE_NAME_TAKEN: 'يوجد دور بهذا الاسم بالفعل.',
  INVALID_PERMISSIONS: 'الصلاحيات المحددة غير صالحة.',
};

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const code = raw.trim().split('\n')[0]?.trim() ?? '';
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (/failed to fetch|network|fetch failed/i.test(raw)) {
    return 'تعذر الاتصال بخادم المصادقة. تحقق من اتصال الشبكة وحاول مجددًا.';
  }
  return 'تعذر إكمال العملية. حاول مرة أخرى.';
}

export interface NewUserInput {
  name: string;
  username: string;
  password: string;
  roleId: string;
  active: boolean;
}

export interface UserPatch {
  name: string;
  username: string;
  roleId: string;
  active: boolean;
  password?: string;
}

export interface NewRoleInput {
  name: string;
  description: string;
  permissions: string[];
}

interface AuthContextValue {
  users: AppUser[];
  roles: AppRole[];
  audit: AuditEntry[];
  currentUser: AppUser | null;
  currentRole: AppRole | null;
  sessionToken: string | null;
  permissions: string[];
  can: (permission: string) => boolean;
  loading: boolean;
  backendError: string;
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  createUser: (input: NewUserInput) => Promise<void>;
  updateUser: (id: string, patch: UserPatch) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  resetPassword: (id: string, password: string) => Promise<void>;
  createRole: (input: NewRoleInput) => Promise<void>;
  updateRole: (id: string, input: NewRoleInput) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
  log: (action: string, detail: string) => void;
  demoAccounts: typeof DEMO_ACCOUNTS;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  const permissions = currentRole?.permissions ?? [];
  const can = useCallback(
    (permission: string) => hasPermission(permissions, permission),
    [permissions],
  );

  const loadDirectory = useCallback(async (role: AppRole | null, token: string) => {
    if (!role) {
      setUsers([]);
      setRoles([]);
      setAudit([]);
      return;
    }
    const canUsers = hasPermission(role.permissions, 'users.view');
    const canRoles = hasPermission(role.permissions, 'roles.view');
    const canAudit = hasPermission(role.permissions, 'audit.view');
    const [nextUsers, nextRoles, nextAudit] = await Promise.all([
      canUsers
        ? rpc<AppUser[]>('app_list_users', { p_token: token })
        : Promise.resolve([]),
      canUsers || canRoles
        ? rpc<AppRole[]>('app_list_roles', { p_token: token })
        : Promise.resolve([]),
      canAudit
        ? rpc<AuditEntry[]>('app_list_audit', { p_token: token, p_limit: 300 })
        : Promise.resolve([]),
    ]);
    setUsers(nextUsers);
    setRoles(nextRoles);
    setAudit(nextAudit);
  }, []);

  const applySession = useCallback(
    async (token: string, payload: { user: AppUser; role: AppRole }) => {
      setSessionToken(token);
      setCurrentUser(payload.user);
      setCurrentRole(payload.role);
      try {
        await loadDirectory(payload.role, token);
      } catch {
        /* الجداول المساعدة تُحمّل حسب الصلاحية؛ فشلها لا يمنع الدخول */
      }
    },
    [loadDirectory],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured) {
        setBackendError(
          'لم تُضبط مفاتيح Supabase. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY ثم أعد البناء.',
        );
        setLoading(false);
        return;
      }
      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem(SESSION_KEY);
      } catch {
        stored = null;
      }
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const payload = await rpc<{ user: AppUser; role: AppRole }>('app_session', {
          p_token: stored,
        });
        if (cancelled) return;
        await applySession(stored, payload);
      } catch {
        try {
          sessionStorage.removeItem(SESSION_KEY);
        } catch {
          /* تجاهل */
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  useEffect(() => {
    if (!sessionExpired) return;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* تجاهل */
    }
    setSessionToken(null);
    setCurrentUser(null);
    setCurrentRole(null);
    setUsers([]);
    setRoles([]);
    setAudit([]);
    setSessionExpired(false);
  }, [sessionExpired]);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof Error && error.message.trim() === 'UNAUTHORIZED') {
      setSessionExpired(true);
    }
    throw new Error(errorMessage(error));
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      if (!isSupabaseConfigured) {
        return {
          ok: false,
          error: 'خدمة المصادقة غير مهيأة. تحقق من إعدادات Supabase.',
        };
      }
      try {
        const payload = await rpc<SessionPayload>('app_login', {
          p_username: username,
          p_password: password,
        });
        if (!payload?.token || !payload.user || !payload.role) {
          return { ok: false, error: 'تعذر إنشاء الجلسة. حاول مرة أخرى.' };
        }
        try {
          sessionStorage.setItem(SESSION_KEY, payload.token);
        } catch {
          /* الجلسة تعمل داخل الذاكرة حتى إغلاق التبويب */
        }
        await applySession(payload.token, payload);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }
    },
    [applySession],
  );

  const logout = useCallback(() => {
    const token = sessionToken;
    setSessionToken(null);
    setCurrentUser(null);
    setCurrentRole(null);
    setUsers([]);
    setRoles([]);
    setAudit([]);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* تجاهل */
    }
    if (token) {
      void rpc('app_logout', { p_token: token }).catch(() => undefined);
    }
  }, [sessionToken]);

  const refreshAudit = useCallback(async () => {
    if (!sessionToken || !currentRole) return;
    if (!hasPermission(currentRole.permissions, 'audit.view')) return;
    try {
      const data = await rpc<AuditEntry[]>('app_list_audit', {
        p_token: sessionToken,
        p_limit: 300,
      });
      setAudit(data);
    } catch {
      /* تجاهل تحديث السجل */
    }
  }, [sessionToken, currentRole]);

  const refreshSession = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const payload = await rpc<{ user: AppUser; role: AppRole }>('app_session', {
        p_token: sessionToken,
      });
      setCurrentUser(payload.user);
      setCurrentRole(payload.role);
      await loadDirectory(payload.role, sessionToken);
    } catch (error) {
      if (error instanceof Error && error.message.trim() === 'UNAUTHORIZED') {
        setSessionExpired(true);
      }
    }
  }, [sessionToken, loadDirectory]);

  const createUser = useCallback(
    async (input: NewUserInput) => {
      if (!sessionToken) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      try {
        const user = await rpc<AppUser>('app_create_user', {
          p_token: sessionToken,
          p_name: input.name,
          p_username: input.username,
          p_password: input.password,
          p_role_id: input.roleId,
          p_active: input.active,
        });
        setUsers((prev) => [user, ...prev]);
        void refreshAudit();
      } catch (error) {
        handleError(error);
      }
    },
    [sessionToken, refreshAudit, handleError],
  );

  const updateUser = useCallback(
    async (id: string, patch: UserPatch) => {
      if (!sessionToken) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      try {
        const user = await rpc<AppUser>('app_update_user', {
          p_token: sessionToken,
          p_user_id: id,
          p_name: patch.name,
          p_username: patch.username,
          p_role_id: patch.roleId,
          p_active: patch.active,
          p_password: patch.password && patch.password.length ? patch.password : null,
        });
        setUsers((prev) => prev.map((item) => (item.id === id ? user : item)));
        if (id === currentUser?.id) {
          await refreshSession();
        } else {
          void refreshAudit();
        }
      } catch (error) {
        handleError(error);
      }
    },
    [sessionToken, currentUser, refreshSession, refreshAudit, handleError],
  );

  const deleteUser = useCallback(
    async (id: string) => {
      if (!sessionToken) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      try {
        await rpc('app_delete_user', { p_token: sessionToken, p_user_id: id });
        setUsers((prev) => prev.filter((item) => item.id !== id));
        void refreshAudit();
      } catch (error) {
        handleError(error);
      }
    },
    [sessionToken, refreshAudit, handleError],
  );

  const resetPassword = useCallback(
    async (id: string, password: string) => {
      if (!sessionToken) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      try {
        await rpc('app_reset_password', {
          p_token: sessionToken,
          p_user_id: id,
          p_password: password,
        });
        void refreshAudit();
      } catch (error) {
        handleError(error);
      }
    },
    [sessionToken, refreshAudit, handleError],
  );

  const createRole = useCallback(
    async (input: NewRoleInput) => {
      if (!sessionToken) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      try {
        const role = await rpc<AppRole>('app_create_role', {
          p_token: sessionToken,
          p_name: input.name,
          p_description: input.description,
          p_permissions: input.permissions,
        });
        setRoles((prev) => [...prev, role]);
        void refreshAudit();
      } catch (error) {
        handleError(error);
      }
    },
    [sessionToken, refreshAudit, handleError],
  );

  const updateRole = useCallback(
    async (id: string, input: NewRoleInput) => {
      if (!sessionToken) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      try {
        const role = await rpc<AppRole>('app_update_role', {
          p_token: sessionToken,
          p_role_id: id,
          p_name: input.name,
          p_description: input.description,
          p_permissions: input.permissions,
        });
        setRoles((prev) => prev.map((item) => (item.id === id ? role : item)));
        setCurrentRole((prev) => (prev?.id === id ? role : prev));
        void refreshAudit();
      } catch (error) {
        handleError(error);
      }
    },
    [sessionToken, refreshAudit, handleError],
  );

  const deleteRole = useCallback(
    async (id: string) => {
      if (!sessionToken) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      try {
        await rpc('app_delete_role', { p_token: sessionToken, p_role_id: id });
        setRoles((prev) => prev.filter((item) => item.id !== id));
        void refreshAudit();
      } catch (error) {
        handleError(error);
      }
    },
    [sessionToken, refreshAudit, handleError],
  );

  const log = useCallback(
    (action: string, detail: string) => {
      if (!sessionToken) return;
      void rpc<AuditEntry>('app_log', {
        p_token: sessionToken,
        p_action: action,
        p_detail: detail,
      })
        .then((entry) => setAudit((prev) => [entry, ...prev].slice(0, 500)))
        .catch(() => undefined);
    },
    [sessionToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      users,
      roles,
      audit,
      currentUser,
      currentRole,
      sessionToken,
      permissions,
      can,
      loading,
      backendError,
      login,
      logout,
      createUser,
      updateUser,
      deleteUser,
      resetPassword,
      createRole,
      updateRole,
      deleteRole,
      log,
      demoAccounts: DEMO_ACCOUNTS,
    }),
    [
      users,
      roles,
      audit,
      currentUser,
      currentRole,
      sessionToken,
      permissions,
      can,
      loading,
      backendError,
      login,
      logout,
      createUser,
      updateUser,
      deleteUser,
      resetPassword,
      createRole,
      updateRole,
      deleteRole,
      log,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
