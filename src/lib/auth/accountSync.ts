import type { IssuedAccount } from './accountData'

export function normalizeAccountIdentity(value?: string | null): string {
  return String(value || '').toLowerCase().trim()
}

export function isAccountDeletedBySet(acc: any, delSet: Set<string>): boolean {
  if (!acc || delSet.size === 0) return false
  const lowerDel = new Set<string>()
  delSet.forEach((v) => {
    if (v) lowerDel.add(String(v).toLowerCase().trim())
  })
  const candidates = [acc.id, acc.studentId, acc.memberCode, acc.email]
  if (candidates.some((val) => val && lowerDel.has(String(val).toLowerCase().trim()))) {
    return true
  }
  const fullNameClean = String(acc.fullName || acc.name || '').toLowerCase().trim()
  if ((fullNameClean === 'trần đức thắng' || fullNameClean === 'tran duc thang') && lowerDel.has(fullNameClean)) {
    return true
  }
  return false
}

export function dedupeAccounts<T extends Partial<IssuedAccount> & Record<string, any>>(list: T[]): T[] {
  const seenIds = new Set<string>()
  const seenEmails = new Set<string>()
  const seenStudentIds = new Set<string>()
  const result: T[] = []

  for (const acc of list) {
    if (!acc || typeof acc !== 'object') continue
    const id = String(acc.id || '').trim()
    if (!id || seenIds.has(id)) continue

    const emailKey = normalizeAccountIdentity(acc.email)
    if (emailKey && seenEmails.has(emailKey)) continue

    const studentKey = normalizeAccountIdentity(acc.studentId)
    if (studentKey && studentKey !== 'staff-001' && seenStudentIds.has(studentKey)) continue

    seenIds.add(id)
    if (emailKey) seenEmails.add(emailKey)
    if (studentKey && studentKey !== 'staff-001') seenStudentIds.add(studentKey)
    result.push(acc)
  }

  return result
}

export function mergeIssuedAccountsList<T extends Partial<IssuedAccount> & Record<string, any>>(params: {
  existingAccounts: T[]
  incomingAccounts: T[]
  deletedSet: Set<string>
  explicitTargetId?: string
}): T[] {
  const { existingAccounts, incomingAccounts, deletedSet, explicitTargetId } = params
  const existingById = new Map<string, T>()
  for (const a of existingAccounts) {
    if (a?.id && !isAccountDeletedBySet(a, deletedSet)) {
      existingById.set(a.id, a)
    }
  }

  const accMap = new Map<string, T>()
  for (const a of incomingAccounts) {
    if (!a?.id || isAccountDeletedBySet(a, deletedSet)) continue
    const prev = existingById.get(a.id)
    const already = accMap.get(a.id)
    const base = already || prev
    if (!base) {
      accMap.set(a.id, { ...a, updatedAt: Number(a.updatedAt || 0) || Date.now() })
    } else {
      const baseTime = Number(base.updatedAt || 0)
      const inTime = Number(a.updatedAt || 0)
      const isExplicitTarget = Boolean(explicitTargetId && explicitTargetId === a.id)
      if (isExplicitTarget || inTime >= baseTime) {
        accMap.set(a.id, {
          ...base,
          ...a,
          updatedAt: Math.max(baseTime, inTime) || a.updatedAt || base.updatedAt,
        })
      } else if (!already) {
        accMap.set(a.id, base)
      }
    }
  }

  for (const [id, existingAcc] of existingById.entries()) {
    if (!accMap.has(id)) {
      accMap.set(id, existingAcc)
    }
  }

  return dedupeAccounts(Array.from(accMap.values()))
}

export function findIssuedAccountForLogin(params: {
  activeIssued: IssuedAccount[]
  cleanInput: string
  member?: {
    member_code?: string
    student_id?: string
    email?: string
  }
}): IssuedAccount | undefined {
  const { activeIssued, cleanInput, member } = params
  const memberStudentClean = normalizeAccountIdentity(member?.student_id)
  const memberCodeClean = normalizeAccountIdentity(member?.member_code)
  const memberEmailClean = normalizeAccountIdentity(member?.email)

  return (
    activeIssued.find(
      (a) =>
        normalizeAccountIdentity(a.email) === cleanInput ||
        normalizeAccountIdentity(a.id) === cleanInput
    ) ||
    activeIssued.find((a) => {
      if (a.isFixed) return false
      const aStudent = normalizeAccountIdentity(a.studentId)
      const aEmail = normalizeAccountIdentity(a.email)
      const aName = normalizeAccountIdentity(a.fullName)
      return (
        (aStudent && aStudent === cleanInput) ||
        (Boolean(member) &&
          Boolean(aStudent) &&
          aStudent !== 'staff-001' &&
          (aStudent === memberStudentClean || aStudent === memberCodeClean)) ||
        (Boolean(memberEmailClean) && Boolean(aEmail) && aEmail === memberEmailClean) ||
        aName === cleanInput
      )
    }) ||
    activeIssued.find((a) => {
      const aStudent = normalizeAccountIdentity(a.studentId)
      const aEmail = normalizeAccountIdentity(a.email)
      const aName = normalizeAccountIdentity(a.fullName)
      return (
        (aStudent && aStudent !== 'staff-001' && aStudent === cleanInput) ||
        (Boolean(member) &&
          Boolean(aStudent) &&
          aStudent !== 'staff-001' &&
          (aStudent === memberStudentClean || aStudent === memberCodeClean)) ||
        (Boolean(memberEmailClean) && Boolean(aEmail) && aEmail === memberEmailClean) ||
        aName === cleanInput
      )
    })
  )
}

