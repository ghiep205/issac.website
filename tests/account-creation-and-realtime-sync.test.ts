import { describe, it, expect, afterEach } from 'vitest'
import { hasGenuineServiceRoleKey, hasSupabaseConfig } from '@/lib/supabase/admin'
import { isUserCoreTeam, canUserManageAccounts } from '@/lib/auth/permissions'
import { mergeEvents, mergeProposals, type MeetingEvent, type ProposalItem } from '@/lib/context/ClubContext'
import { INITIAL_ISSUED_ACCOUNTS } from '@/lib/auth/accountData'
import { INITIAL_MEMBERS } from '@/lib/clubData'
import type { AuthUser } from '@/lib/auth/AuthContext'

describe('Account Persistence, Role Logic & Multi-Device Sync Fixes', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const originalSecretKey = process.env.SUPABASE_SECRET_KEY
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl

    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey

    if (originalSecretKey === undefined) delete process.env.SUPABASE_SECRET_KEY
    else process.env.SUPABASE_SECRET_KEY = originalSecretKey

    if (originalAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey
  })

  it('1. recognizes both legacy JWT service_role keys and new sb_secret_ Supabase secret keys', () => {
    const jwtAnonHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const jwtAnonPayload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')
    const jwtServicePayload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')

    const anonJwt = `${jwtAnonHeader}.${jwtAnonPayload}.sig`
    const serviceJwt = `${jwtAnonHeader}.${jwtServicePayload}.sig`

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonJwt

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_key_value_123456'
    expect(hasGenuineServiceRoleKey()).toBe(true)
    // hasSupabaseConfig safely stays false in Vitest/test mode to avoid unintended remote writes
    expect(hasSupabaseConfig()).toBe(false)

    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceJwt
    expect(hasGenuineServiceRoleKey()).toBe(true)

    process.env.SUPABASE_SECRET_KEY = 'sb_secret_fallback_key_123456'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(hasGenuineServiceRoleKey()).toBe(true)
    delete process.env.SUPABASE_SECRET_KEY

    process.env.SUPABASE_SERVICE_ROLE_KEY = anonJwt
    expect(hasGenuineServiceRoleKey()).toBe(false)

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key-here'
    expect(hasGenuineServiceRoleKey()).toBe(false)
  })

  it('2. respects explicit leadership roles (hr, dept_head, bcn) even when roleTitle begins with Thành viên', () => {
    const promotedHr: AuthUser = {
      id: 'acc-promoted-hr',
      name: 'Cán bộ Mới',
      role: 'hr',
      roleTitle: 'Thành viên Ban Nhân sự phụ trách điểm danh',
      departmentCode: 'B03',
      departmentName: 'Ban Nhân sự',
      memberCode: '26079901',
      isCore: true,
      avatarBg: 'bg-blue-600',
    }
    const regularMember: AuthUser = {
      id: 'acc-regular',
      name: 'Thành viên Mới',
      role: 'member',
      roleTitle: 'Thành viên - Ban Nhân sự',
      departmentCode: 'B03',
      departmentName: 'Ban Nhân sự',
      memberCode: '26079902',
      isCore: false,
      avatarBg: 'bg-blue-600',
    }
    const promotedBcn: AuthUser = {
      id: 'acc-promoted-bcn',
      name: 'Cán bộ BCN',
      role: 'bcn',
      roleTitle: 'Thành viên Ban Chủ nhiệm',
      departmentCode: 'B04',
      departmentName: 'Ban Chủ nhiệm',
      memberCode: '26079903',
      isCore: true,
      avatarBg: 'bg-blue-600',
    }

    expect(isUserCoreTeam(promotedHr)).toBe(true)
    expect(isUserCoreTeam(promotedBcn)).toBe(true)
    expect(canUserManageAccounts(promotedBcn)).toBe(true)
    expect(isUserCoreTeam(regularMember)).toBe(false)
  })

  it('3. mergeEvents respects updatedAt so removed attendees are not resurrected across devices while preserving check-ins', () => {
    const localOlder: MeetingEvent[] = [
      {
        id: 'evt-sync-1',
        title: 'Họp CLB cũ',
        description: 'Mô tả cũ',
        date: '26/11/2026',
        startTime: '19:00',
        endTime: '21:00',
        location: 'Phòng 101',
        pinCode: '1111',
        isRequired: true,
        isFinalized: false,
        registeredMemberCodes: ['23070691', '24070680'],
        records: {
          '23070691': { memberCode: '23070691', status: 'present_on_time', checkinTime: '19:00' },
        },
        updatedAt: 1000,
      },
    ]

    const cloudNewer: MeetingEvent[] = [
      {
        id: 'evt-sync-1',
        title: 'Họp CLB mới',
        description: 'Mô tả mới',
        date: '26/11/2026',
        startTime: '19:00',
        endTime: '21:00',
        location: 'Phòng 202',
        pinCode: '2222',
        isRequired: true,
        isFinalized: false,
        registeredMemberCodes: ['23070691'], // 24070680 was removed on the other device
        records: {
          '24070622': { memberCode: '24070622', status: 'late', checkinTime: '19:20' },
        },
        updatedAt: 2000,
      },
    ]

    const merged = mergeEvents(localOlder, cloudNewer)
    expect(merged).toHaveLength(1)
    expect(merged[0].title).toBe('Họp CLB mới')
    expect(merged[0].location).toBe('Phòng 202')
    expect(merged[0].registeredMemberCodes).toEqual(['23070691'])
    expect(merged[0].registeredMemberCodes).not.toContain('24070680')
    expect(merged[0].records['23070691']).toBeDefined()
    expect(merged[0].records['24070622']).toBeDefined()
  })

  it('4. mergeProposals applies newer edited or rejected status across devices instead of reverting to stale records', () => {
    const localEdited: ProposalItem[] = [
      {
        id: 'prop-edit-1',
        memberCode: '24070680',
        memberName: 'Phương Gia Huy',
        memberDept: 'Ban Truyền thông',
        isCore: true,
        criterionCode: 'C04',
        criterionName: 'Ý tưởng sáng tạo',
        points: 5,
        reason: 'Điểm đã sửa từ 3 lên 5',
        proposedBy: 'BCN Hiệp sửa',
        proposedByRole: 'bcn',
        status: 'approved',
        createdAt: '25/11/2026 10:00',
        updatedAt: 5000,
      },
    ]

    const staleIncoming: ProposalItem[] = [
      {
        id: 'prop-edit-1',
        memberCode: '24070680',
        memberName: 'Phương Gia Huy',
        memberDept: 'Ban Truyền thông',
        isCore: true,
        criterionCode: 'C04',
        criterionName: 'Ý tưởng sáng tạo',
        points: 3,
        reason: 'Điểm cũ',
        proposedBy: 'HR Ngọc',
        proposedByRole: 'hr',
        status: 'approved',
        createdAt: '25/11/2026 09:00',
        updatedAt: 2000,
      },
    ]

    const merged = mergeProposals(localEdited, staleIncoming)
    expect(merged).toHaveLength(1)
    expect(merged[0].points).toBe(5)
    expect(merged[0].reason).toBe('Điểm đã sửa từ 3 lên 5')
  })

  it('5. distinguishes master STAFF-001 fixed account from member STAFF-001 roster identity', () => {
    const masterAcc = INITIAL_ISSUED_ACCOUNTS.find((a) => a.id === 'acc-master')
    const staffMember = INITIAL_MEMBERS.find((m) => m.member_code === 'STAFF-001')

    expect(masterAcc).toBeDefined()
    expect(masterAcc?.isFixed).toBe(true)
    expect(masterAcc?.email).toBe('ambassadors.club@vnuis.edu.vn')

    expect(staffMember).toBeDefined()
    expect(staffMember?.full_name).toBe('Nguyễn Thị Hồng Hân')
    expect(staffMember?.email).not.toBe(masterAcc?.email)
  })
})
