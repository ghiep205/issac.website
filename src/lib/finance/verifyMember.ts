import { INITIAL_MEMBERS, type RosterMember } from '@/lib/clubData'
import { createAdminClient } from '@/lib/supabase/admin'

export interface VerificationInput {
  fullName: string
  studentId: string
  email: string
  phone: string
}

export interface VerificationResult {
  isValid: boolean
  member?: {
    memberCode: string
    fullName: string
    studentId: string
    email: string
    phone: string
    departmentName: string
  }
  errorMessage?: string
}

// Memory rate limit tracker for anti-enumeration
const failedAttemptsMap = new Map<string, { count: number; lockedUntil: number }>()

export function normalizeVietnameseString(str: string): string {
  return str
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '')
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3)
  } else if (cleaned.startsWith('84') && cleaned.length > 9) {
    cleaned = '0' + cleaned.slice(2)
  }
  return cleaned
}

export function normalizeStudentId(studentId: string): string {
  return studentId.trim().toUpperCase()
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Validates 4 required identity fields against official club members.
 * Implements strict server-side normalization, rate-limiting and generic errors.
 */
export function verifyClubMemberIdentity(
  input: VerificationInput,
  clientIp: string = 'global',
  roster: RosterMember[] = INITIAL_MEMBERS
): VerificationResult {
  const genericError =
    'Thông tin xác minh không khớp với danh sách thành viên chính thức của CLB. Vui lòng kiểm tra lại chính xác 4 trường: Họ tên, MSSV, Email và Số điện thoại.'

  // 1. Rate limiting check
  const now = Date.now()
  const tracker = failedAttemptsMap.get(clientIp)
  if (tracker && tracker.lockedUntil > now) {
    const remainingSeconds = Math.ceil((tracker.lockedUntil - now) / 1000)
    return {
      isValid: false,
      errorMessage: `Bạn đã thử sai quá số lần quy định. Vui lòng chờ ${remainingSeconds} giây trước khi thử lại.`,
    }
  }

  // 2. Validate presence of all 4 fields
  if (
    !input.fullName?.trim() ||
    !input.studentId?.trim() ||
    !input.email?.trim() ||
    !input.phone?.trim()
  ) {
    return {
      isValid: false,
      errorMessage: 'Vui lòng điền đầy đủ 4 thông tin bắt buộc để xác minh danh tính.',
    }
  }

  // 3. Normalization
  const normName = normalizeVietnameseString(input.fullName)
  const normMssv = normalizeStudentId(input.studentId)
  const normEmail = normalizeEmail(input.email)
  const normPhone = normalizePhoneNumber(input.phone)

  // 4. Exact 4-field match against members
  const matchedMember = roster.find((m: RosterMember) => {
    // Check MSSV (or member_code if student_id not explicitly set)
    const memberMssv = normalizeStudentId(m.student_id || m.member_code)
    if (memberMssv !== normMssv) return false

    // Check Full Name
    const memberName = normalizeVietnameseString(m.full_name)
    if (memberName !== normName) return false

    // Check Email
    const memberEmail = normalizeEmail(m.email)
    if (memberEmail !== normEmail) return false

    // Check Phone
    const memberPhone = normalizePhoneNumber(m.phone || '')
    if (memberPhone && memberPhone !== normPhone) return false

    return true
  })

  if (!matchedMember) {
    // Track failed attempt
    const currentCount = (tracker?.count || 0) + 1
    const lockDuration = currentCount >= 5 ? 5 * 60 * 1000 : 0 // Lock 5 mins if 5 consecutive fails
    failedAttemptsMap.set(clientIp, {
      count: currentCount,
      lockedUntil: lockDuration > 0 ? now + lockDuration : 0,
    })

    return {
      isValid: false,
      errorMessage: genericError,
    }
  }

  // Reset fail tracker on success
  failedAttemptsMap.delete(clientIp)

  return {
    isValid: true,
    member: {
      memberCode: matchedMember.member_code,
      fullName: matchedMember.full_name,
      studentId: matchedMember.student_id || matchedMember.member_code,
      email: matchedMember.email,
      phone: matchedMember.phone || '',
      departmentName: matchedMember.department_name,
    },
  }
}

/**
 * Loads live member list from Supabase cloud settings (`issac_members_cloud` / `issac_deleted_member_codes_v2`)
 * merged with INITIAL_MEMBERS so newly added/edited members can also verify on the fund payment portal.
 */
export async function verifyClubMemberIdentityWithCloud(
  input: VerificationInput,
  clientIp: string = 'global'
): Promise<VerificationResult> {
  let activeRoster: RosterMember[] = INITIAL_MEMBERS

  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['issac_members_cloud', 'issac_deleted_member_codes_v2'])

      if (data && data.length > 0) {
        const memRow = data.find((r) => r.key === 'issac_members_cloud')
        const delRow = data.find((r) => r.key === 'issac_deleted_member_codes_v2')
        const delSet = new Set<string>(delRow?.value ? JSON.parse(delRow.value) : [])
        if (memRow?.value) {
          const parsed = JSON.parse(memRow.value)
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleanedCloud = parsed.filter((m: any) => m?.member_code && !delSet.has(m.member_code))
            const cloudCodes = new Set(cleanedCloud.map((m: any) => m.member_code))
            const missingInit = INITIAL_MEMBERS.filter(
              (m) => !cloudCodes.has(m.member_code) && !delSet.has(m.member_code)
            )
            activeRoster = [...cleanedCloud, ...missingInit]
          }
        }
      }
    }
  } catch (err) {
    console.warn('Cloud member verification fallback to INITIAL_MEMBERS:', err)
  }

  return verifyClubMemberIdentity(input, clientIp, activeRoster)
}

