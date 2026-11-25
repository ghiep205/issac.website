'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import type { UserRole, DepartmentCode } from '@/types/database'
import {
  canUserManageAccounts,
  canUserScoreMember,
  getAllowedScoringMembers,
  isUserCoreTeam,
  canUserAddOrProposeScore,
} from './permissions'
import type { RosterMember } from '@/lib/clubData'
import { findIssuedAccountForLogin, normalizeAccountIdentity } from './accountSync'

export interface AuthUser {
  id: string
  name: string
  role: UserRole
  roleTitle: string
  departmentCode?: DepartmentCode
  departmentName?: string
  memberCode?: string
  isCore: boolean
  avatarBg: string
  avatarUrl?: string
}

export const PRESET_USERS: AuthUser[] = [
  {
    id: 'user-hiep',
    name: 'Giang Lê Hiệp',
    role: 'bcn',
    roleTitle: 'Phó chủ nhiệm CLB (BCN)',
    departmentCode: 'B04',
    departmentName: 'Ban Chủ nhiệm',
    memberCode: '23070691',
    isCore: true,
    avatarBg: 'bg-blue-600',
    avatarUrl: '/giang-le-hiep-avatar.png',
  },
  {
    id: 'user-bcn',
    name: 'Nguyễn Thị Hồng Hân',
    role: 'bcn',
    roleTitle: 'Chủ nhiệm CLB (BCN)',
    departmentCode: 'B04',
    departmentName: 'Ban Chủ nhiệm',
    memberCode: 'STAFF-001',
    isCore: true,
    avatarBg: 'bg-amber-500',
  },
  {
    id: 'user-hr',
    name: 'Vũ Thị Minh Ngọc',
    role: 'hr',
    roleTitle: 'Trưởng Ban Nhân sự (HR)',
    departmentCode: 'B03',
    departmentName: 'Ban Nhân sự',
    memberCode: '23070764',
    isCore: true,
    avatarBg: 'bg-purple-500',
  },
  {
    id: 'user-dept-head',
    name: 'Lê Trần Thuỷ Nguyên',
    role: 'dept_head',
    roleTitle: 'Trưởng Ban Tư vấn',
    departmentCode: 'B02',
    departmentName: 'Ban Tư vấn',
    memberCode: '24310069',
    isCore: true,
    avatarBg: 'bg-emerald-500',
    avatarUrl: '/thuy-nguyen-avatar.png',
  },
  {
    id: 'user-member',
    name: 'Lục Xuân Huy',
    role: 'member',
    roleTitle: 'Thành viên Ban Truyền thông',
    departmentCode: 'B01',
    departmentName: 'Ban Truyền thông',
    memberCode: '25071203',
    isCore: false,
    avatarBg: 'bg-emerald-500',
  },
]

import { INITIAL_MEMBERS } from '@/lib/clubData'
import type { DepartmentSlug } from '@/types/database'

/**
 * Hàm phân định quyền và vai trò chuẩn hóa cho từng thành viên CLB iSSAC
 * Đảm bảo đồng bộ tuyệt đối trên mọi thiết bị (Mobile, Tablet, Desktop)
 */
export function getRoleForMember(m: RosterMember): { role: UserRole; isCore: boolean; roleTitle: string } {
  // 1. Ban Chủ nhiệm
  if (m.department_slug === 'bcn' || m.position.includes('Chủ nhiệm')) {
    return {
      role: 'bcn',
      isCore: true,
      roleTitle: `${m.position} - ${m.department_name}`,
    }
  }

  // 2. Ban Nhân sự: Cán bộ (Trưởng ban & Phó ban) -> 'hr'
  if (m.department_slug === 'nhan-su') {
    if (m.position.includes('Trưởng') || m.position.includes('Phó')) {
      return {
        role: 'hr',
        isCore: true,
        roleTitle: `${m.position} - ${m.department_name} (HR)`,
      }
    }
    // Thành viên Ban Nhân sự: role 'member' nhưng thuộc Ban Nhân sự (có quyền đề xuất điểm theo quy chế)
    return {
      role: 'member',
      isCore: Boolean(m.is_core),
      roleTitle: `${m.position} - ${m.department_name}`,
    }
  }

  // 3. Trưởng ban, Phó ban, Cố vấn của các ban chuyên môn (Truyền thông B01, Tư vấn B02) -> 'dept_head'
  if (m.position.includes('Trưởng') || m.position.includes('Phó') || m.position.includes('Cố vấn')) {
    return {
      role: 'dept_head',
      isCore: true,
      roleTitle: `${m.position} - ${m.department_name}`,
    }
  }

  // 4. Thành viên thường
  return {
    role: 'member',
    isCore: Boolean(m.is_core),
    roleTitle: `${m.position} - ${m.department_name}`,
  }
}

export type { IssuedAccount } from './accountData'
export { INITIAL_ISSUED_ACCOUNTS } from './accountData'
import { INITIAL_ISSUED_ACCOUNTS, type IssuedAccount } from './accountData'

export interface AccountMutationResult {
  success: boolean
  message: string
  account?: IssuedAccount
  cloudSynced?: boolean
  syncPromise?: Promise<boolean>
}

export interface AuthContextType {
  currentUser: AuthUser | null
  isAuthChecked: boolean
  isAuthenticated: boolean
  switchUser: (userId: string) => void
  login: (account: string, password?: string) => { success: boolean; user?: AuthUser; message?: string }
  loginWithSync: (account: string, password?: string) => Promise<{ success: boolean; user?: AuthUser; message?: string }>
  logout: () => void
  issuedAccounts: IssuedAccount[]
  createIssuedAccount: (accountData: Omit<IssuedAccount, 'id' | 'createdAt'>) => AccountMutationResult
  updateIssuedAccount: (id: string, updates: Partial<IssuedAccount>) => AccountMutationResult
  deleteIssuedAccount: (id: string) => AccountMutationResult
  refreshCloudAccounts: () => Promise<void>
  cloudSyncError: string | null
  isBCN: boolean
  isHR: boolean
  isDeptHead: boolean
  isMember: boolean
  isCoreTeam: boolean
  canManageAccounts: boolean
  canAddOrProposeScore: boolean
  canScoreMember: (targetMember: { department_code?: string; department_slug?: string; full_name?: string } | null) => { allowed: boolean; reason?: string }
  getAllowedMembers: (members: RosterMember[]) => RosterMember[]
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Danh sách các định danh tài khoản đã bị Ban Chủ nhiệm xóa trên Cloud / Hệ thống
export const DEFAULT_DELETED_ACCOUNT_IDS: string[] = [
  'acc-thang',
  '24310088',
  'tdthang@vnuis.edu.vn',
  'user-dept-head',
  'Trần Đức Thắng',
]

/**
 * Thu thập tất cả các định danh liên quan (ID, MSSV, Email, Họ tên, Mã thành viên)
 * của một người dùng dựa trên bất kỳ định danh nào truyền vào.
 */
export function resolveAllAssociatedIdentities(
  rawId: string,
  extraAccounts?: IssuedAccount[]
): string[] {
  if (!rawId) return []
  const clean = rawId.trim().toLowerCase()
  const results = new Set<string>()
  results.add(rawId.trim())
  results.add(clean)

  // Đặc tả nhận diện cán bộ Trần Đức Thắng (khóa triệt để mọi alias)
  if (
    clean === 'acc-thang' ||
    clean === '24310088' ||
    clean === 'tdthang@vnuis.edu.vn' ||
    clean === 'trần đức thắng' ||
    clean === 'tran duc thang' ||
    clean === 'user-dept-head'
  ) {
    results.add('acc-thang')
    results.add('24310088')
    results.add('tdthang@vnuis.edu.vn')
    results.add('trần đức thắng')
    results.add('user-dept-head')
  }

  // 1. Quét trong INITIAL_ISSUED_ACCOUNTS và extraAccounts
  const allAccs = [...INITIAL_ISSUED_ACCOUNTS, ...(extraAccounts || [])]
  for (const acc of allAccs) {
    const match =
      acc.id.toLowerCase() === clean ||
      (acc.studentId && acc.studentId.toLowerCase() === clean) ||
      acc.email.toLowerCase() === clean ||
      acc.fullName.toLowerCase() === clean
    if (match) {
      results.add(acc.id)
      if (acc.studentId) results.add(acc.studentId)
      if (acc.email) results.add(acc.email.toLowerCase())
      if (acc.fullName) results.add(acc.fullName.toLowerCase())
    }
  }

  // 2. Quét trong INITIAL_MEMBERS
  for (const m of INITIAL_MEMBERS) {
    const match =
      m.member_code.toLowerCase() === clean ||
      (m.student_id && m.student_id.toLowerCase() === clean) ||
      m.email.toLowerCase() === clean ||
      m.full_name.toLowerCase() === clean
    if (match) {
      results.add(m.member_code)
      if (m.student_id) results.add(m.student_id)
      if (m.email) results.add(m.email.toLowerCase())
      if (m.full_name) results.add(m.full_name.toLowerCase())
    }
  }

  // 3. Quét trong PRESET_USERS
  for (const p of PRESET_USERS) {
    const match =
      p.id.toLowerCase() === clean ||
      (p.memberCode && p.memberCode.toLowerCase() === clean) ||
      p.name.toLowerCase() === clean
    if (match) {
      results.add(p.id)
      if (p.memberCode) results.add(p.memberCode)
      if (p.name) results.add(p.name.toLowerCase())
    }
  }

  return Array.from(results)
}

const DEPT_SLUG_BY_CODE: Record<string, DepartmentSlug> = {
  B01: 'truyen-thong',
  B02: 'tu-van',
  B03: 'nhan-su',
  B04: 'bcn',
}

const UNSYNCED_ACCOUNTS_KEY = 'issac_unsynced_accounts_v1'

interface UnsyncedAccountRecord {
  account: IssuedAccount
  savedAt: number
}

function loadUnsyncedAccountRecords(): Map<string, UnsyncedAccountRecord> {
  const map = new Map<string, UnsyncedAccountRecord>()
  if (typeof window === 'undefined') return map
  try {
    const raw = localStorage.getItem(UNSYNCED_ACCOUNTS_KEY)
    if (!raw) return map
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry?.account?.id) {
          map.set(entry.account.id, entry)
        }
      }
    }
  } catch {}
  return map
}

function persistUnsyncedAccountRecords(map: Map<string, UnsyncedAccountRecord>) {
  if (typeof window === 'undefined') return
  try {
    const entries = Array.from(map.values())
    if (entries.length === 0) {
      localStorage.removeItem(UNSYNCED_ACCOUNTS_KEY)
    } else {
      localStorage.setItem(UNSYNCED_ACCOUNTS_KEY, JSON.stringify(entries))
    }
  } catch {}
}

function resolveAuthUserSession(params: {
  issued?: IssuedAccount
  member?: RosterMember
  preset?: AuthUser
}): AuthUser {
  const { issued, member, preset } = params
  let finalRole: UserRole = 'member'
  let finalRoleTitle = ''
  let isCore = false

  if (issued && (!member || !issued.isFixed)) {
    finalRole = issued.role
    finalRoleTitle = issued.roleTitle
    isCore = issued.role === 'bcn' || issued.role === 'admin' || issued.role === 'hr' || issued.role === 'dept_head'
    if (
      issued.departmentSlug === 'nhan-su' &&
      issued.role !== 'bcn' &&
      issued.role !== 'admin' &&
      (issued.roleTitle.includes('Trưởng') || issued.roleTitle.includes('Phó'))
    ) {
      finalRole = 'hr'
      isCore = true
    } else if (issued.role === 'member' && member?.is_core) {
      isCore = true
    }
  } else if (member) {
    const derived = getRoleForMember(member)
    finalRole = derived.role
    isCore = derived.isCore
    finalRoleTitle = derived.roleTitle
  } else if (preset) {
    finalRole = preset.role
    finalRoleTitle = preset.roleTitle
    isCore = preset.isCore
  }

  const cleanIssuedStudentId =
    issued?.studentId && issued.studentId.toUpperCase() !== 'STAFF-001' ? issued.studentId : undefined

  return {
    id: issued?.id || member?.member_code || preset?.id || `user-${Date.now()}`,
    name: issued?.fullName || member?.full_name || preset?.name || 'Thành viên iSSAC',
    role: finalRole,
    roleTitle:
      finalRoleTitle ||
      issued?.roleTitle ||
      `${member?.position || 'Thành viên'} - ${member?.department_name || 'CLB iSSAC'}`,
    departmentCode: issued?.departmentCode || member?.department_code || preset?.departmentCode,
    departmentName: issued?.departmentName || member?.department_name || preset?.departmentName,
    memberCode: member?.member_code || cleanIssuedStudentId || preset?.memberCode || issued?.id || member?.student_id,
    isCore,
    avatarBg: 'bg-blue-600',
    avatarUrl: issued?.avatarUrl || member?.avatar_url || preset?.avatarUrl,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isAuthChecked, setIsAuthChecked] = useState(false)
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null)
  const [issuedAccounts, setIssuedAccounts] = useState<IssuedAccount[]>(() => {
    return INITIAL_ISSUED_ACCOUNTS.filter((a) => !DEFAULT_DELETED_ACCOUNT_IDS.includes(a.id))
  })
  const issuedAccountsRef = useRef<IssuedAccount[]>(issuedAccounts)
  useEffect(() => {
    issuedAccountsRef.current = issuedAccounts
  }, [issuedAccounts])
  const cloudMembersRef = useRef<RosterMember[]>(INITIAL_MEMBERS)
  const deletedAccountIdsRef = useRef<Set<string>>(new Set(DEFAULT_DELETED_ACCOUNT_IDS))
  const unsyncedLocalAccountsRef = useRef<Map<string, UnsyncedAccountRecord>>(new Map())
  const pendingAccountSyncRef = useRef<Promise<boolean> | null>(null)
  const lastLocalAccountMutationAtRef = useRef<number>(0)
  const lastUnsyncedRetryAtRef = useRef<number>(0)

  const commitIssuedAccounts = useCallback((nextList: IssuedAccount[]) => {
    issuedAccountsRef.current = nextList
    setIssuedAccounts(nextList)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('issac_issued_accounts', JSON.stringify(nextList))
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  // Kiểm tra một chuỗi bất kỳ có nằm trong danh sách đã bị xóa không
  const isIdentityDeleted = useCallback((val?: string | null): boolean => {
    if (!val) return false
    const clean = val.trim().toLowerCase()
    const delSet = deletedAccountIdsRef.current
    for (const d of delSet) {
      if (!d) continue
      const cleanD = d.trim().toLowerCase()
      if (clean === cleanD) return true
    }
    return false
  }, [])

  // Kiểm tra một thực thể (User / Member / Account / Preset) có bị xóa không
  const isEntityDeleted = useCallback(
    (entity: any): boolean => {
      if (!entity) return false
      if (typeof entity === 'string') return isIdentityDeleted(entity)
      const fullNameVal = String(entity.fullName || entity.full_name || entity.name || '').trim().toLowerCase()
      const isDefaultThangName = fullNameVal === 'trần đức thắng' || fullNameVal === 'tran duc thang'
      return (
        isIdentityDeleted(entity.id) ||
        isIdentityDeleted(entity.memberCode) ||
        isIdentityDeleted(entity.studentId) ||
        isIdentityDeleted(entity.member_code) ||
        isIdentityDeleted(entity.student_id) ||
        isIdentityDeleted(entity.email) ||
        (isDefaultThangName && isIdentityDeleted(fullNameVal))
      )
    },
    [isIdentityDeleted]
  )

  // Helper gửi danh sách tài khoản lên Supabase Cloud API để Máy tính và Điện thoại cùng đồng bộ
  const syncAccountsToCloud = useCallback(
    (payload: {
      account?: IssuedAccount
      accounts?: IssuedAccount[]
      deletedAccountIds?: string[]
      deletedMemberCodes?: string[]
      unblockAccountIdentities?: string[]
      action?: string
      accountId?: string
      studentId?: string
      email?: string
      fullName?: string
    }): Promise<boolean> => {
      if (typeof window === 'undefined') return Promise.resolve(false)

      const p = fetch('/api/db/sync', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null)
          if (!res.ok || !data || data.cloudSynced === false) {
            const errText =
              data?.cloudError ||
              data?.cloudNote ||
              data?.error ||
              `Đồng bộ Cloud thất bại (HTTP ${res.status})`
            setCloudSyncError(errText)
            return false
          }

          setCloudSyncError(null)
          if (Array.isArray(data.accounts)) {
            const cloudIds = new Set(data.accounts.map((a: any) => a?.id).filter(Boolean))
            let changedUnsynced = false
            for (const [unsyncedId] of Array.from(unsyncedLocalAccountsRef.current.entries())) {
              if (cloudIds.has(unsyncedId)) {
                unsyncedLocalAccountsRef.current.delete(unsyncedId)
                changedUnsynced = true
              }
            }
            if (changedUnsynced) {
              persistUnsyncedAccountRecords(unsyncedLocalAccountsRef.current)
            }
          }

          if (typeof BroadcastChannel !== 'undefined') {
            try {
              const bc = new BroadcastChannel('issac_realtime_bus')
              bc.postMessage({ type: 'SYNC_TRIGGER' })
              bc.close()
            } catch {}
          }
          return true
        })
        .catch((e) => {
          console.error('Cloud account sync notice:', e)
          setCloudSyncError('Không thể kết nối Cloud để lưu tài khoản. Hệ thống sẽ tự đồng bộ lại khi có mạng.')
          return false
        })
        .finally(() => {
          if (pendingAccountSyncRef.current === p) {
            pendingAccountSyncRef.current = null
          }
        })
      pendingAccountSyncRef.current = p
      return p
    },
    []
  )

  // Tải và hợp nhất tài khoản đám mây (Chống mất tài khoản mới tạo và chống hồi sinh tài khoản đã xóa)
  const fetchCloudAccounts = useCallback(async (): Promise<{
    accounts: IssuedAccount[]
    members: RosterMember[]
  } | null> => {
    try {
      if (pendingAccountSyncRef.current) {
        await pendingAccountSyncRef.current
      } else if (unsyncedLocalAccountsRef.current.size > 0) {
        const pendingEntries = Array.from(unsyncedLocalAccountsRef.current.values()).map((e) => e.account)
        if (pendingEntries.length > 0) {
          const primary = pendingEntries[0]
          await syncAccountsToCloud({
            action: 'create_account',
            account: primary,
            accounts: pendingEntries,
            unblockAccountIdentities: [
              primary.id,
              primary.email,
              primary.studentId || '',
              primary.fullName,
            ].filter(Boolean),
          })
        }
      }

      const fetchStartedAt = Date.now()
      const res = await fetch('/api/db/sync', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      })
      if (!res.ok) {
        return null
      }
      if (lastLocalAccountMutationAtRef.current > fetchStartedAt) {
        // Có thao tác tạo/sửa/xóa tài khoản mới hơn xảy ra trong lúc đang GET -> bỏ qua response cũ này
        return null
      }
      const data = await res.json()

      if (data.members && Array.isArray(data.members) && data.members.length > 0) {
        cloudMembersRef.current = data.members
      }

      // Thu thập identity của các tài khoản ĐANG HOẠT ĐỘNG trên Cloud
      const activeCloudKeys = new Set<string>()
      const cloudAccountsArr: IssuedAccount[] = Array.isArray(data.accounts) ? data.accounts : []
      for (const ca of cloudAccountsArr) {
        if (ca?.id) activeCloudKeys.add(String(ca.id).toLowerCase().trim())
        if (ca?.email) activeCloudKeys.add(String(ca.email).toLowerCase().trim())
        if (ca?.studentId && String(ca.studentId).toUpperCase() !== 'STAFF-001') {
          activeCloudKeys.add(String(ca.studentId).toLowerCase().trim())
        }
      }

      const unsyncedKeys = new Set<string>()
      for (const { account } of unsyncedLocalAccountsRef.current.values()) {
        if (account.id) unsyncedKeys.add(account.id.toLowerCase().trim())
        if (account.email) unsyncedKeys.add(account.email.toLowerCase().trim())
        if (account.studentId && account.studentId.toUpperCase() !== 'STAFF-001') {
          unsyncedKeys.add(account.studentId.toLowerCase().trim())
        }
      }

      // 1. Đồng bộ tombstones hai chiều từ Cloud:
      //    - Gỡ các định danh đã được Cloud cấp lại tài khoản mới
      //    - Nạp thêm các tài khoản bị xóa trên thiết bị khác
      const skipTombstoneOverwrite = Date.now() - lastLocalAccountMutationAtRef.current < 4000
      const defaultThangSet = new Set(DEFAULT_DELETED_ACCOUNT_IDS.map((s) => s.toLowerCase().trim()))
      const cloudDeletedArr: string[] = Array.isArray(data.deletedAccountIds) ? data.deletedAccountIds : []
      const cloudDeletedLower = new Set(cloudDeletedArr.map((s) => String(s || '').toLowerCase().trim()).filter(Boolean))

      // Nếu thiết bị khác vừa gỡ chặn (re-issue) một người -> gỡ khỏi deletedAccountIdsRef local
      if (!skipTombstoneOverwrite) {
        for (const existingDel of Array.from(deletedAccountIdsRef.current)) {
          const cleanDel = existingDel.toLowerCase().trim()
          if (activeCloudKeys.has(cleanDel) && !cloudDeletedLower.has(cleanDel)) {
            deletedAccountIdsRef.current.delete(existingDel)
          }
        }
      }

      if (!skipTombstoneOverwrite && cloudDeletedArr.length > 0) {
        for (const rawId of cloudDeletedArr) {
          if (!rawId) continue
          const cleanRaw = rawId.toLowerCase().trim()
          if ((activeCloudKeys.has(cleanRaw) || unsyncedKeys.has(cleanRaw)) && !defaultThangSet.has(cleanRaw)) {
            continue
          }
          deletedAccountIdsRef.current.add(rawId)
          deletedAccountIdsRef.current.add(cleanRaw)
          if (defaultThangSet.has(cleanRaw)) {
            const aliases = resolveAllAssociatedIdentities(rawId, issuedAccountsRef.current)
            for (const a of aliases) {
              deletedAccountIdsRef.current.add(a)
              deletedAccountIdsRef.current.add(a.toLowerCase())
            }
          }
        }
      }

      try {
        localStorage.setItem('issac_deleted_account_ids', JSON.stringify(Array.from(deletedAccountIdsRef.current)))
      } catch {}

      // 2. Hợp nhất danh sách tài khoản (bảo toàn unsynced local accounts đến khi Cloud xác nhận)
      let nextCleanAccounts = issuedAccountsRef.current
      if (Array.isArray(data.accounts)) {
        const mergedMap = new Map<string, IssuedAccount>()
        const cloudIds = new Set<string>()
        const cloudById = new Map<string, IssuedAccount>()
        for (const ca of cloudAccountsArr) {
          if (ca?.id && !isEntityDeleted(ca)) {
            cloudIds.add(ca.id)
            cloudById.set(ca.id, ca)
          }
        }

        // Đặt các thay đổi local chưa xác nhận (hoặc mới hơn Cloud) lên đầu
        const remainingUnsynced: IssuedAccount[] = []
        let unsyncedChanged = false
        for (const [id, entry] of Array.from(unsyncedLocalAccountsRef.current.entries())) {
          if (isEntityDeleted(entry.account)) {
            unsyncedLocalAccountsRef.current.delete(id)
            unsyncedChanged = true
            continue
          }
          const cloudMatch = cloudById.get(id)
          const cloudUpdated = Number(cloudMatch?.updatedAt || 0)
          const localUpdated = Number(entry.account.updatedAt || entry.savedAt || 0)
          if (cloudMatch && cloudUpdated >= localUpdated) {
            // Cloud đã nhận phiên bản mới nhất
            unsyncedLocalAccountsRef.current.delete(id)
            unsyncedChanged = true
          } else {
            mergedMap.set(id, entry.account)
            remainingUnsynced.push(entry.account)
          }
        }
        if (unsyncedChanged) {
          persistUnsyncedAccountRecords(unsyncedLocalAccountsRef.current)
        }

        // Nạp danh sách từ Cloud
        for (const cloudAcc of cloudAccountsArr) {
          if (cloudAcc?.id && !isEntityDeleted(cloudAcc) && !mergedMap.has(cloudAcc.id)) {
            mergedMap.set(cloudAcc.id, cloudAcc)
          }
        }

        nextCleanAccounts = Array.from(mergedMap.values()).filter((a) => !isEntityDeleted(a))
        // Cập nhật Ref & localStorage đồng bộ NGAY LẬP TỨC (không đặt bên trong setState updater của React 19)
        const accountsChanged = JSON.stringify(nextCleanAccounts) !== JSON.stringify(issuedAccountsRef.current)
        issuedAccountsRef.current = nextCleanAccounts
        if (accountsChanged) {
          try {
            localStorage.setItem('issac_issued_accounts', JSON.stringify(nextCleanAccounts))
          } catch {}
          setIssuedAccounts(nextCleanAccounts)
        }

        // Nếu còn tài khoản local chưa lên được Cloud (do lỗi mạng / cold-start), tự đẩy lại mỗi 10s
        if (
          remainingUnsynced.length > 0 &&
          !pendingAccountSyncRef.current &&
          Date.now() - lastUnsyncedRetryAtRef.current > 10000
        ) {
          lastUnsyncedRetryAtRef.current = Date.now()
          const target = remainingUnsynced[0]
          syncAccountsToCloud({
            action: 'create_account',
            account: target,
            accounts: remainingUnsynced,
            unblockAccountIdentities: [
              target.id,
              target.email,
              target.studentId || '',
              target.fullName,
            ].filter(Boolean),
          })
        }
      } else {
        const clean = issuedAccountsRef.current.filter((a) => !isEntityDeleted(a))
        const changed = clean.length !== issuedAccountsRef.current.length
        issuedAccountsRef.current = clean
        nextCleanAccounts = clean
        if (changed) {
          try {
            localStorage.setItem('issac_issued_accounts', JSON.stringify(clean))
          } catch {}
          setIssuedAccounts(clean)
        }
      }

      // 3. FORCE LOGOUT & LIVE ROLE SYNC REAL-TIME TRÊN TẤT CẢ THIẾT BỊ:
      const latestMembers: RosterMember[] = Array.isArray(data.members) && data.members.length > 0
        ? data.members
        : cloudMembersRef.current

      setCurrentUser((current) => {
        if (current) {
          if (isEntityDeleted(current)) {
            try {
              localStorage.removeItem('issac_active_user')
            } catch {}
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('issac_account_deleted', { detail: { user: current } }))
              if (window.location.pathname !== '/login') {
                window.location.href = '/login?reason=deleted'
              }
            }
            return null
          }

          const matchedIssued = nextCleanAccounts.find(
            (a) =>
              a.id === current.id ||
              (!a.isFixed &&
                a.studentId &&
                a.studentId.toUpperCase() !== 'STAFF-001' &&
                current.memberCode &&
                a.studentId.toLowerCase() === current.memberCode.toLowerCase())
          )
          if (matchedIssued?.status === 'suspended') {
            try {
              localStorage.removeItem('issac_active_user')
            } catch {}
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('issac_account_suspended', { detail: { user: current } }))
              if (window.location.pathname !== '/login') {
                window.location.href = '/login?reason=suspended'
              }
            }
            return null
          }

          const matchedMember = latestMembers.find(
            (m) =>
              (current.memberCode && m.member_code === current.memberCode) ||
              (matchedIssued?.studentId &&
                matchedIssued.studentId.toUpperCase() !== 'STAFF-001' &&
                (m.student_id === matchedIssued.studentId || m.member_code === matchedIssued.studentId))
          )

          if (matchedIssued && (!matchedMember || !matchedIssued.isFixed)) {
            const refreshed = resolveAuthUserSession({ issued: matchedIssued, member: matchedMember })
            if (
              refreshed.role !== current.role ||
              refreshed.roleTitle !== current.roleTitle ||
              refreshed.departmentCode !== current.departmentCode ||
              refreshed.name !== current.name
            ) {
              return refreshed
            }
          }
        }

        if (!current && typeof window !== 'undefined') {
          const saved = localStorage.getItem('issac_active_user')
          if (saved && !isIdentityDeleted(saved)) {
            const foundCloudIssued = nextCleanAccounts.find(
              (a) =>
                (a.id === saved ||
                  (a.studentId && a.studentId.toUpperCase() !== 'STAFF-001' && a.studentId === saved) ||
                  a.email.toLowerCase() === saved.toLowerCase()) &&
                a.status !== 'suspended' &&
                !isEntityDeleted(a)
            )
            const foundCloudMem = latestMembers.find(
              (m) =>
                ((m.member_code === saved || m.student_id === saved) && !isEntityDeleted(m)) ||
                (foundCloudIssued?.studentId &&
                  foundCloudIssued.studentId.toUpperCase() !== 'STAFF-001' &&
                  (m.student_id === foundCloudIssued.studentId || m.member_code === foundCloudIssued.studentId))
            )
            if (foundCloudIssued || foundCloudMem) {
              return resolveAuthUserSession({ issued: foundCloudIssued, member: foundCloudMem })
            }
          }
        }
        return current
      })
      return { accounts: nextCleanAccounts, members: latestMembers }
    } catch {
      // Offline fallback
      return null
    }
  }, [isEntityDeleted, isIdentityDeleted, syncAccountsToCloud])

  // Load saved accounts & active user from localStorage
  useEffect(() => {
    unsyncedLocalAccountsRef.current = loadUnsyncedAccountRecords()

    // Chỉ nạp tombstones tài khoản (tách biệt hoàn toàn với danh sách xóa thành viên)
    try {
      const savedDelAccs = localStorage.getItem('issac_deleted_account_ids')
      if (savedDelAccs) {
        const parsed = JSON.parse(savedDelAccs)
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => {
            deletedAccountIdsRef.current.add(id)
            deletedAccountIdsRef.current.add(id.toLowerCase())
          })
        }
      }
    } catch {}

    let initialAccList: IssuedAccount[] = []
    try {
      const savedAccs = localStorage.getItem('issac_issued_accounts')
      const baseAccounts: IssuedAccount[] = savedAccs ? JSON.parse(savedAccs) : INITIAL_ISSUED_ACCOUNTS
      const accById = new Map<string, IssuedAccount>()
      for (const { account } of unsyncedLocalAccountsRef.current.values()) {
        if (account?.id) accById.set(account.id, account)
      }
      for (const a of baseAccounts) {
        if (a?.id && !accById.has(a.id)) accById.set(a.id, a)
      }
      const mergedLocal = Array.from(accById.values())

      const activeEmailOrStudentSet = new Set<string>()
      mergedLocal.forEach((a) => {
        if (a?.email) activeEmailOrStudentSet.add(a.email.toLowerCase().trim())
        if (a?.studentId && a.studentId.toUpperCase() !== 'STAFF-001') {
          activeEmailOrStudentSet.add(a.studentId.toLowerCase().trim())
        }
      })

      const defaultThangSet = new Set(DEFAULT_DELETED_ACCOUNT_IDS.map((s) => s.toLowerCase().trim()))
      const initialDelList = Array.from(deletedAccountIdsRef.current)
      for (const d of initialDelList) {
        if (defaultThangSet.has(d.toLowerCase().trim())) {
          const aliases = resolveAllAssociatedIdentities(d)
          aliases.forEach((a) => {
            deletedAccountIdsRef.current.add(a)
            deletedAccountIdsRef.current.add(a.toLowerCase())
          })
        }
      }
      activeEmailOrStudentSet.forEach((val) => {
        if (!defaultThangSet.has(val)) {
          deletedAccountIdsRef.current.delete(val)
        }
      })

      initialAccList = mergedLocal.filter((a) => !isEntityDeleted(a))
      commitIssuedAccounts(initialAccList)
    } catch (err) {
      console.error(err)
    }

    let resolvedLocally = false
    let savedIdentifier: string | null = null
    try {
      const urlParams =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      const paramUser = urlParams?.get('user')
      savedIdentifier = paramUser || localStorage.getItem('issac_active_user')

      if (savedIdentifier && !isIdentityDeleted(savedIdentifier)) {
        const cleanSaved = savedIdentifier.trim().toLowerCase()

        // 1. Nạp danh sách thành viên local (để gắn thông tin thành viên nếu có)
        let localRoster: RosterMember[] = cloudMembersRef.current
        try {
          const savedMembersStr = localStorage.getItem('issac_members_clean_v1')
          if (savedMembersStr) {
            const parsedMembers = JSON.parse(savedMembersStr)
            if (Array.isArray(parsedMembers) && parsedMembers.length > 0) {
              const memberMap = new Map<string, RosterMember>()
              INITIAL_MEMBERS.forEach((m) => memberMap.set(m.member_code, m))
              parsedMembers.forEach((m: RosterMember) => {
                if (m?.member_code) memberMap.set(m.member_code, m)
              })
              localRoster = Array.from(memberMap.values())
              cloudMembersRef.current = localRoster
            }
          }
        } catch {}

        // 2. Check preset users (như user-bcn, user-hr...)
        const foundPreset = PRESET_USERS.find((u) => u.id === savedIdentifier && !isEntityDeleted(u))
        if (foundPreset) {
          setCurrentUser(foundPreset)
          setIsAuthChecked(true)
          resolvedLocally = true
        } else {
          const accSource = initialAccList.length > 0 ? initialAccList : INITIAL_ISSUED_ACCOUNTS
          const foundIssued = accSource.find(
            (a) =>
              !isEntityDeleted(a) &&
              a.status !== 'suspended' &&
              (a.id === savedIdentifier ||
                a.email.toLowerCase() === cleanSaved ||
                (!a.isFixed && a.studentId && a.studentId.toLowerCase() === cleanSaved))
          )
          const foundMember = localRoster.find(
            (m) =>
              !isEntityDeleted(m) &&
              (m.member_code === savedIdentifier ||
                m.student_id === savedIdentifier ||
                (foundIssued?.studentId &&
                  foundIssued.studentId.toUpperCase() !== 'STAFF-001' &&
                  (m.student_id === foundIssued.studentId || m.member_code === foundIssued.studentId)))
          )

          if (foundIssued || foundMember) {
            setCurrentUser(resolveAuthUserSession({ issued: foundIssued, member: foundMember }))
            setIsAuthChecked(true)
            resolvedLocally = true
          }
        }
      } else if (savedIdentifier && isIdentityDeleted(savedIdentifier)) {
        try {
          localStorage.removeItem('issac_active_user')
        } catch {}
      }
    } catch (e) {
      console.error(e)
    }

    if (!resolvedLocally) {
      if (savedIdentifier && !isIdentityDeleted(savedIdentifier)) {
        // Đợi tải Cloud trước khi chuyển hướng /login phòng trường hợp cache local trống nhưng Cloud vẫn có user
        fetchCloudAccounts().finally(() => {
          setIsAuthChecked(true)
        })
      } else {
        setCurrentUser(null)
        setIsAuthChecked(true)
        fetchCloudAccounts()
      }
    } else {
      fetchCloudAccounts()
    }
  }, [commitIssuedAccounts, fetchCloudAccounts, isEntityDeleted, isIdentityDeleted])

  // Lắng nghe visibilitychange, storage và chu kỳ polling 3 giây để cập nhật tài khoản trên mọi thiết bị
  useEffect(() => {
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchCloudAccounts()
      }
    }
    const handleFocus = () => {
      fetchCloudAccounts()
    }
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'issac_issued_accounts' ||
        e.key === 'issac_active_user' ||
        e.key === 'issac_deleted_account_ids'
      ) {
        try {
          if (e.key === 'issac_deleted_account_ids') {
            if (e.newValue) {
              const parsed = JSON.parse(e.newValue)
              if (Array.isArray(parsed)) {
                parsed.forEach((id: string) => {
                  deletedAccountIdsRef.current.add(id)
                  deletedAccountIdsRef.current.add(id.toLowerCase())
                })
              }
            }
          }
        } catch {}
        fetchCloudAccounts()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility)
    }
    let broadcastChannel: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        broadcastChannel = new BroadcastChannel('issac_realtime_bus')
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'SYNC_TRIGGER') {
            fetchCloudAccounts()
          }
        }
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus)
      window.addEventListener('storage', handleStorage)
    }
    // Poll mỗi 15 giây để đồng bộ tài khoản giữa các thiết bị nhẹ nhàng, không gây nghẽn mạng
    let backoffUntil = 0
    const pollAccounts = async () => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (Date.now() < backoffUntil) return
      try {
        await fetchCloudAccounts()
      } catch {
        backoffUntil = Date.now() + 30000
      }
    }
    const timer = setInterval(pollAccounts, 10000)

    return () => {
      if (broadcastChannel) {
        try {
          broadcastChannel.close()
        } catch {}
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus)
        window.removeEventListener('storage', handleStorage)
      }
      clearInterval(timer)
    }
  }, [fetchCloudAccounts])

  const switchUser = (userId: string) => {
    if (isIdentityDeleted(userId)) return

    const foundPreset = PRESET_USERS.find((u) => u.id === userId && !isEntityDeleted(u))
    if (foundPreset) {
      setCurrentUser(foundPreset)
      localStorage.setItem('issac_active_user', foundPreset.id)
      return
    }

    const activeRoster = cloudMembersRef.current.length > 0 ? cloudMembersRef.current : INITIAL_MEMBERS
    const foundMember = activeRoster.find(
      (m) => (m.member_code === userId || m.student_id === userId) && !isEntityDeleted(m)
    )
    if (foundMember) {
      const roleInfo = getRoleForMember(foundMember)
      const mappedUser: AuthUser = {
        id: foundMember.member_code,
        name: foundMember.full_name,
        role: roleInfo.role,
        roleTitle: roleInfo.roleTitle,
        departmentCode: foundMember.department_code,
        departmentName: foundMember.department_name,
        memberCode: foundMember.member_code,
        isCore: roleInfo.isCore,
        avatarBg: 'bg-blue-600',
        avatarUrl: foundMember.avatar_url,
      }
      setCurrentUser(mappedUser)
      localStorage.setItem('issac_active_user', mappedUser.id)
    }
  }

  const createIssuedAccount = (data: Omit<IssuedAccount, 'id' | 'createdAt'>): AccountMutationResult => {
    // Chỉ Ban Chủ nhiệm mới có thể cấp tài khoản
    if (!canUserManageAccounts(currentUser)) {
      return { success: false, message: 'Chỉ Ban Chủ nhiệm mới có quyền cấp tài khoản cán bộ!' }
    }

    const cleanName = (data.fullName || '').trim()
    const cleanEmail = (data.email || '').trim().toLowerCase()
    const cleanStudentId = (data.studentId || '').trim()
    const cleanPassword = (data.passwordPlain || '').trim()

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return { success: false, message: 'Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu!' }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, message: 'Định dạng Email đăng nhập chưa hợp lệ (VD: 24070622@vnu.edu.vn).' }
    }

    const currentList = issuedAccountsRef.current.length > 0 ? issuedAccountsRef.current : issuedAccounts
    const dupEmailAcc = currentList.find((a) => a.email.trim().toLowerCase() === cleanEmail)
    if (dupEmailAcc) {
      return {
        success: false,
        message: `Email "${cleanEmail}" đã được cấp cho tài khoản "${dupEmailAcc.fullName}"! Vui lòng dùng nút Sửa thông tin hoặc nhập email khác.`,
      }
    }

    if (cleanStudentId && cleanStudentId.toUpperCase() !== 'STAFF-001') {
      const dupMssvAcc = currentList.find(
        (a) => a.studentId && a.studentId.trim().toLowerCase() === cleanStudentId.toLowerCase() && !a.isFixed
      )
      if (dupMssvAcc) {
        return {
          success: false,
          message: `Mã sinh viên "${cleanStudentId}" đã có tài khoản của "${dupMssvAcc.fullName}" (${dupMssvAcc.email}). Vui lòng sửa tài khoản hiện có thay vì tạo trùng!`,
        }
      }
    }

    const nowTs = Date.now()
    const newAcc: IssuedAccount = {
      ...data,
      departmentSlug: data.departmentSlug || DEPT_SLUG_BY_CODE[data.departmentCode] || 'truyen-thong',
      fullName: cleanName,
      email: cleanEmail,
      studentId: cleanStudentId || undefined,
      passwordPlain: cleanPassword,
      roleTitle: (data.roleTitle || 'Thành viên CLB iSSAC').trim(),
      status: data.status || 'active',
      id: `acc-${nowTs}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      updatedAt: nowTs,
    }

    // Gỡ ID/email/MSSV/họ tên của tài khoản mới tạo khỏi blacklist nếu người này từng bị xóa tài khoản trước đó
    const unblockIdentities: string[] = [newAcc.id, cleanEmail]
    if (cleanStudentId && cleanStudentId.toUpperCase() !== 'STAFF-001') unblockIdentities.push(cleanStudentId)
    if (cleanName) unblockIdentities.push(cleanName)
    const unblockLower = new Set(unblockIdentities.map((v) => v.toLowerCase().trim()))

    for (const delItem of Array.from(deletedAccountIdsRef.current)) {
      if (unblockLower.has(delItem.toLowerCase().trim())) {
        deletedAccountIdsRef.current.delete(delItem)
      }
    }
    const updatedDelArr = Array.from(deletedAccountIdsRef.current)
    lastLocalAccountMutationAtRef.current = nowTs
    try {
      localStorage.setItem('issac_deleted_account_ids', JSON.stringify(updatedDelArr))
    } catch {}

    // Ghi nhận vào hàng đợi local chưa đồng bộ để chống mất sau 2.5s hoặc khi F5
    unsyncedLocalAccountsRef.current.set(newAcc.id, { account: newAcc, savedAt: nowTs })
    persistUnsyncedAccountRecords(unsyncedLocalAccountsRef.current)

    const updated = [newAcc, ...currentList.filter((a) => a.id !== newAcc.id)]
    commitIssuedAccounts(updated)

    const syncPromise = syncAccountsToCloud({
      action: 'create_account',
      account: newAcc,
      accounts: updated,
      unblockAccountIdentities: unblockIdentities,
    })

    return {
      success: true,
      message: `Cấp tài khoản thành công cho "${cleanName}"!`,
      account: newAcc,
      syncPromise,
    }
  }

  const updateIssuedAccount = (id: string, updates: Partial<IssuedAccount>): AccountMutationResult => {
    // Chỉ Ban Chủ nhiệm mới có thể sửa tài khoản
    if (!canUserManageAccounts(currentUser)) {
      return { success: false, message: 'Chỉ Ban Chủ nhiệm mới có quyền chỉnh sửa tài khoản cán bộ!' }
    }

    const currentList = issuedAccountsRef.current.length > 0 ? issuedAccountsRef.current : issuedAccounts
    const existing = currentList.find((a) => a.id === id)
    if (!existing) {
      return { success: false, message: 'Không tìm thấy tài khoản cần cập nhật.' }
    }

    const nextName = updates.fullName !== undefined ? updates.fullName.trim() : existing.fullName
    const nextEmail = updates.email !== undefined ? updates.email.trim().toLowerCase() : existing.email.trim().toLowerCase()
    const nextStudentId =
      updates.studentId !== undefined ? updates.studentId.trim() || undefined : existing.studentId
    const nextPassword =
      updates.passwordPlain !== undefined ? updates.passwordPlain.trim() : existing.passwordPlain

    if (!nextName || !nextEmail || !nextPassword) {
      return { success: false, message: 'Họ tên, Email và Mật khẩu không được để trống!' }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return { success: false, message: 'Định dạng Email đăng nhập chưa hợp lệ.' }
    }

    const dupEmail = currentList.find((a) => a.id !== id && a.email.trim().toLowerCase() === nextEmail)
    if (dupEmail) {
      return {
        success: false,
        message: `Email "${nextEmail}" đã được sử dụng bởi tài khoản "${dupEmail.fullName}".`,
      }
    }

    if (nextStudentId && nextStudentId.toUpperCase() !== 'STAFF-001' && !existing.isFixed) {
      const dupStudent = currentList.find(
        (a) =>
          a.id !== id &&
          !a.isFixed &&
          a.studentId &&
          a.studentId.trim().toLowerCase() === nextStudentId.toLowerCase()
      )
      if (dupStudent) {
        return {
          success: false,
          message: `Mã sinh viên "${nextStudentId}" đã gắn với tài khoản "${dupStudent.fullName}".`,
        }
      }
    }

    const nowTs = Date.now()
    const nextDeptCode = updates.departmentCode || existing.departmentCode
    const updatedTarget: IssuedAccount = {
      ...existing,
      ...updates,
      departmentCode: nextDeptCode,
      departmentSlug: updates.departmentSlug || DEPT_SLUG_BY_CODE[nextDeptCode] || existing.departmentSlug,
      fullName: nextName,
      email: nextEmail,
      studentId: nextStudentId,
      passwordPlain: nextPassword,
      roleTitle: (updates.roleTitle !== undefined ? updates.roleTitle : existing.roleTitle).trim(),
      updatedAt: nowTs,
    }

    const unblockIdentities = [updatedTarget.id, nextEmail, nextStudentId || '', nextName].filter(Boolean)
    const unblockLower = new Set(unblockIdentities.map((v) => v.toLowerCase().trim()))
    for (const delItem of Array.from(deletedAccountIdsRef.current)) {
      if (unblockLower.has(delItem.toLowerCase().trim())) {
        deletedAccountIdsRef.current.delete(delItem)
      }
    }
    try {
      localStorage.setItem('issac_deleted_account_ids', JSON.stringify(Array.from(deletedAccountIdsRef.current)))
    } catch {}

    lastLocalAccountMutationAtRef.current = nowTs
    unsyncedLocalAccountsRef.current.set(id, { account: updatedTarget, savedAt: nowTs })
    persistUnsyncedAccountRecords(unsyncedLocalAccountsRef.current)

    const updated = currentList.map((a) => (a.id === id ? updatedTarget : a))
    commitIssuedAccounts(updated)

    // Cập nhật ngay phiên hiện tại nếu đang sửa tài khoản đang đăng nhập
    if (currentUser && (currentUser.id === id || (!existing.isFixed && nextStudentId && currentUser.memberCode === nextStudentId))) {
      if (updatedTarget.status === 'suspended') {
        logout()
      } else {
        setCurrentUser(resolveAuthUserSession({ issued: updatedTarget }))
      }
    }

    const syncPromise = syncAccountsToCloud({
      action: 'update_account',
      account: updatedTarget,
      accounts: updated,
      unblockAccountIdentities: unblockIdentities,
    })

    return {
      success: true,
      message: 'Cập nhật tài khoản thành công!',
      account: updatedTarget,
      syncPromise,
    }
  }

  const deleteIssuedAccount = (id: string): AccountMutationResult => {
    // Chỉ Ban Chủ nhiệm mới có thể xóa tài khoản
    if (!canUserManageAccounts(currentUser)) {
      return { success: false, message: 'Chỉ Ban Chủ nhiệm mới có quyền xóa tài khoản cán bộ!' }
    }

    const currentList = issuedAccountsRef.current.length > 0 ? issuedAccountsRef.current : issuedAccounts
    const target =
      currentList.find((a) => a.id === id) || INITIAL_ISSUED_ACCOUNTS.find((a) => a.id === id)
    if (target?.isFixed) {
      return { success: false, message: 'Không thể xóa tài khoản cố định của Ban Chủ nhiệm!' }
    }

    if (unsyncedLocalAccountsRef.current.has(id)) {
      unsyncedLocalAccountsRef.current.delete(id)
      persistUnsyncedAccountRecords(unsyncedLocalAccountsRef.current)
    }

    // 1. Lưu tombstone cho ID, MSSV và Email của tài khoản bị xóa (không khóa theo Họ tên chung để tránh ảnh hưởng người trùng tên)
    deletedAccountIdsRef.current.add(id)
    deletedAccountIdsRef.current.add(id.toLowerCase())
    if (target?.studentId && target.studentId.toUpperCase() !== 'STAFF-001') {
      deletedAccountIdsRef.current.add(target.studentId)
      deletedAccountIdsRef.current.add(target.studentId.toLowerCase())
    }
    if (target?.email) {
      deletedAccountIdsRef.current.add(target.email)
      deletedAccountIdsRef.current.add(target.email.toLowerCase())
    }

    const deletedArr = Array.from(deletedAccountIdsRef.current)
    lastLocalAccountMutationAtRef.current = Date.now()
    try {
      localStorage.setItem('issac_deleted_account_ids', JSON.stringify(deletedArr))
    } catch {}

    // 2. Lọc bỏ tài khoản khỏi danh sách
    const updated = currentList.filter((a) => a.id !== id && !isEntityDeleted(a))
    commitIssuedAccounts(updated)

    // 3. Nếu người dùng hiện tại bị xóa -> Đăng xuất ngay lập tức
    if (currentUser && isEntityDeleted(currentUser)) {
      setCurrentUser(null)
      try {
        localStorage.removeItem('issac_active_user')
      } catch {}
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login?reason=deleted'
      }
    }

    // 4. Đồng bộ lập tức lên Cloud Supabase để Điện thoại và Laptop nhận ngay xóa bỏ trong thời gian thực
    const syncPromise = syncAccountsToCloud({
      accounts: updated,
      deletedAccountIds: deletedArr,
      action: 'delete_account',
      accountId: id,
      studentId: target?.studentId,
      email: target?.email,
    })

    return { success: true, message: 'Đã xóa tài khoản thành công!', syncPromise }
  }

  const login = (
    accountInput: string,
    passwordInput?: string,
    snapshot?: { accounts?: IssuedAccount[]; members?: RosterMember[] } | null
  ) => {
    const clean = accountInput.trim().toLowerCase()
    if (!clean) {
      return { success: false, message: 'Vui lòng nhập Email sinh viên hoặc Mã số sinh viên (MSSV).' }
    }

    if (!passwordInput || !passwordInput.trim()) {
      return { success: false, message: 'Vui lòng nhập mật khẩu tài khoản.' }
    }
    const cleanPass = passwordInput.trim()

    // BƯỚC 1: KIỂM TRA BLACKLIST / TOMBSTONE TRƯỚC TIÊN
    if (isIdentityDeleted(clean)) {
      return {
        success: false,
        message: 'Tài khoản hoặc thông tin thành viên này đã bị xóa khỏi hệ thống bởi Ban Chủ nhiệm.',
      }
    }

    // 1. Tìm kiếm trong danh sách thành viên CLB (cả mặc định lẫn thành viên mới thêm/cập nhật từ Cloud)
    const activeMemberList =
      snapshot?.members && snapshot.members.length > 0
        ? snapshot.members
        : cloudMembersRef.current.length > 0
          ? cloudMembersRef.current
          : INITIAL_MEMBERS
    const member = activeMemberList.find(
      (m) =>
        normalizeAccountIdentity(m.member_code) === clean ||
        normalizeAccountIdentity(m.student_id) === clean ||
        normalizeAccountIdentity(m.email) === clean ||
        normalizeAccountIdentity(m.full_name) === clean
    )

    // 2. Tìm kiếm trong danh sách tài khoản được cấp (issuedAccounts):
    const currentIssuedList =
      snapshot?.accounts && snapshot.accounts.length > 0
        ? snapshot.accounts
        : issuedAccountsRef.current.length > 0
          ? issuedAccountsRef.current
          : issuedAccounts
    const activeIssued = currentIssuedList.filter((a) => !isEntityDeleted(a))
    const issued = findIssuedAccountForLogin({
      activeIssued,
      cleanInput: clean,
      member,
    })

    // Nếu người dùng đăng nhập bằng Email mới của tài khoản được cấp và tài khoản có gắn MSSV -> liên kết hồ sơ thành viên tương ứng
    const resolvedMember =
      member ||
      (issued?.studentId && issued.studentId.toUpperCase() !== 'STAFF-001'
        ? activeMemberList.find(
            (m) =>
              normalizeAccountIdentity(m.student_id) === normalizeAccountIdentity(issued.studentId) ||
              normalizeAccountIdentity(m.member_code) === normalizeAccountIdentity(issued.studentId)
          )
        : undefined)

    // 3. Tìm kiếm trong tài khoản cài sẵn (preset)
    const preset = PRESET_USERS.find(
      (u) =>
        !isEntityDeleted(u) &&
        (u.id.toLowerCase() === clean ||
          u.memberCode?.toLowerCase() === clean ||
          (resolvedMember && u.memberCode?.toLowerCase() === resolvedMember.member_code.toLowerCase()) ||
          u.name.toLowerCase() === clean)
    )

    // BƯỚC 2: KIỂM TRA THỰC THỂ TÌM THẤY CÓ BỊ XÓA HOẶC KHÓA KHÔNG
    if (
      (issued && isEntityDeleted(issued)) ||
      (resolvedMember && isEntityDeleted(resolvedMember)) ||
      (preset && isEntityDeleted(preset))
    ) {
      return {
        success: false,
        message: 'Tài khoản hoặc thông tin thành viên này đã bị xóa khỏi hệ thống bởi Ban Chủ nhiệm.',
      }
    }

    if (issued && issued.status === 'suspended') {
      return {
        success: false,
        message: 'Tài khoản của bạn hiện đang bị tạm khóa bởi Ban Chủ nhiệm. Vui lòng liên hệ BCN.',
      }
    }

    if (!issued && !preset && !resolvedMember) {
      return {
        success: false,
        message: 'Không tìm thấy tài khoản trong hệ thống. Vui lòng kiểm tra lại Email sinh viên hoặc MSSV của bạn.',
      }
    }

    // Kiểm tra mật khẩu hợp lệ trên mọi thiết bị
    const validPasswords = new Set<string>()
    validPasswords.add('issac2026')
    validPasswords.add('issac2025')
    validPasswords.add('123456')
    validPasswords.add('ISSAC2026@clb')

    if (issued?.passwordPlain) {
      const pStr = String(issued.passwordPlain)
      validPasswords.add(pStr)
      validPasswords.add(pStr.trim())
    }
    if (issued?.studentId) {
      validPasswords.add(issued.studentId)
      validPasswords.add(`ISSAC2026@${issued.studentId}`)
    }
    if (resolvedMember?.student_id) {
      validPasswords.add(resolvedMember.student_id)
      validPasswords.add(`ISSAC2026@${resolvedMember.student_id}`)
    }
    if (resolvedMember?.member_code) {
      validPasswords.add(resolvedMember.member_code)
      validPasswords.add(`ISSAC2026@${resolvedMember.member_code}`)
    }
    if (resolvedMember?.phone) {
      validPasswords.add(resolvedMember.phone)
    }

    const isCorrectPassword = validPasswords.has(cleanPass)

    if (!isCorrectPassword) {
      return {
        success: false,
        message: 'Mật khẩu không chính xác. Mật khẩu mặc định là issac2026 hoặc mật khẩu được Ban Chủ nhiệm cấp.',
      }
    }

    const authUser = resolveAuthUserSession({ issued, member: resolvedMember, preset })

    setCurrentUser(authUser)
    try {
      localStorage.setItem('issac_active_user', authUser.id)
    } catch {}

    return {
      success: true,
      user: authUser,
      message: `Đăng nhập thành công! Chào mừng ${authUser.name} (${authUser.roleTitle}).`,
    }
  }

  const loginWithSync = async (accountInput: string, passwordInput?: string) => {
    // Đồng bộ danh sách tài khoản mới nhất từ Cloud trước khi xác thực để tài khoản vừa tạo ở thiết bị khác đăng nhập được ngay
    const snapshot = await fetchCloudAccounts()
    return login(accountInput, passwordInput, snapshot)
  }

  const logout = () => {
    localStorage.removeItem('issac_active_user')
    setCurrentUser(null)
  }

  const isBCN =
    currentUser?.role === 'bcn' ||
    currentUser?.role === 'admin' ||
    (currentUser?.departmentCode === 'B04' && currentUser?.role !== 'member') ||
    false
  const isHR =
    currentUser?.role === 'hr' ||
    (currentUser?.departmentCode === 'B03' &&
      currentUser?.role !== 'member' &&
      !currentUser?.roleTitle?.includes('Thành viên')) ||
    false
  const isDeptHead = currentUser?.role === 'dept_head' || false
  const hasLeadershipRole =
    currentUser?.role === 'bcn' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'hr' ||
    currentUser?.role === 'dept_head'
  const isMember =
    currentUser?.role === 'member' ||
    (!hasLeadershipRole && Boolean(currentUser?.roleTitle?.includes('Thành viên'))) ||
    false
  const isCoreTeam = isUserCoreTeam(currentUser)
  const canManageAccounts = canUserManageAccounts(currentUser)
  const canAddOrProposeScore = Boolean(canUserAddOrProposeScore(currentUser))

  const canScoreMember = useCallback(
    (targetMember: { department_code?: string; department_slug?: string; full_name?: string } | null) => {
      return canUserScoreMember(currentUser, targetMember)
    },
    [currentUser]
  )

  const getAllowedMembers = useCallback(
    (membersList: RosterMember[]) => {
      return getAllowedScoringMembers(currentUser, membersList)
    },
    [currentUser]
  )

  const isAuthenticated = Boolean(currentUser)

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthChecked,
        isAuthenticated,
        switchUser,
        login,
        loginWithSync,
        logout,
        issuedAccounts,
        createIssuedAccount,
        updateIssuedAccount,
        deleteIssuedAccount,
        refreshCloudAccounts: async () => {
          await fetchCloudAccounts()
        },
        cloudSyncError,
        isBCN,
        isHR,
        isDeptHead,
        isMember,
        isCoreTeam,
        canManageAccounts,
        canAddOrProposeScore,
        canScoreMember,
        getAllowedMembers,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
