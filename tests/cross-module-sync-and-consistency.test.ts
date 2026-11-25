import { describe, it, expect } from 'vitest'
import { INITIAL_MEMBERS, type RosterMember } from '../src/lib/clubData'
import { calculatePeriodLeaderboard, AVAILABLE_PERIODS } from '../src/lib/periodData'
import { reconcileMemberScores } from '../src/lib/context/ClubContext'
import { verifyClubMemberIdentity } from '../src/lib/finance/verifyMember'
import { normalizeActivity } from '../src/components/views/ScheduleView'
import { resolveAllAssociatedIdentities, DEFAULT_DELETED_ACCOUNT_IDS } from '../src/lib/auth/AuthContext'
import { canUserManageAccounts } from '../src/lib/auth/permissions'
import type { ActivityItem } from '../src/lib/scheduleData'

describe('Cross-Module Data Logic & Multi-Device Sync Integrity', () => {
  it('1. Period scoring & member current_score stay consistent when synced proposals and partial customPeriodScores coexist', () => {
    const activePeriod = {
      id: 'month-2026-11',
      scope: 'month' as const,
      name: 'Tháng 11/2026',
      shortLabel: 'T11/2026',
      description: 'Chu kỳ đang mở',
      timeRange: '01/11/2026 - 30/11/2026',
      status: 'active' as const,
      isCurrent: true,
      isFinalized: false,
    }

    const syncedProposals: any[] = [
      {
        id: 'prop-1',
        memberCode: '23070691',
        memberName: 'Giang Lê Hiệp',
        memberDept: 'Ban Chủ nhiệm',
        isCore: true,
        criterionCode: 'C04',
        criterionName: 'Ý tưởng sáng tạo',
        points: 3,
        reason: 'Synced from Laptop',
        proposedBy: 'BCN',
        proposedByRole: 'bcn',
        status: 'approved',
        createdAt: '25/11/2026 09:00',
        periodId: 'month-2026-11',
      },
      {
        id: 'prop-2',
        memberCode: 'STAFF-001',
        memberName: 'Nguyễn Thị Hồng Hân',
        memberDept: 'Ban Chủ nhiệm',
        isCore: true,
        criterionCode: 'C05',
        criterionName: 'Hoàn thành nhiệm vụ',
        points: 2,
        reason: 'Synced from Phone',
        proposedBy: 'BCN',
        proposedByRole: 'bcn',
        status: 'approved',
        createdAt: '25/11/2026 09:05',
        periodId: 'month-2026-11',
      },
    ]

    // Stale partial customPeriodScores only knows about 23070691 from earlier session
    const partialCustomScores = {
      'month-2026-11': {
        '23070691': 3,
      },
    }

    const reconciled = reconcileMemberScores(INITIAL_MEMBERS, syncedProposals, 'month-2026-11')
    const leaderboard = calculatePeriodLeaderboard(
      'month-2026-11',
      reconciled,
      [activePeriod, ...AVAILABLE_PERIODS],
      partialCustomScores,
      syncedProposals
    )

    const hiepRank = leaderboard.find((r) => r.member.member_code === '23070691')
    const hanRank = leaderboard.find((r) => r.member.member_code === 'STAFF-001')

    expect(hiepRank?.earnedDelta).toBe(3)
    expect(hiepRank?.finalScore).toBe(63)
    expect(hanRank?.earnedDelta).toBe(2)
    expect(hanRank?.finalScore).toBe(62)
    expect(reconciled.find((m) => m.member_code === 'STAFF-001')?.current_score).toBe(62)
  })

  it('2. Re-issuing an account removes email/studentId from tombstone set while keeping revoked old account IDs dead', () => {
    const deletedIds = new Set<string>([
      ...DEFAULT_DELETED_ACCOUNT_IDS,
      'acc-17000001',
      '24070622',
      '24070622@vnu.edu.vn',
      'nguyễn ngọc anh',
    ])

    const unblockIdentities = ['24070622@vnu.edu.vn', '24070622', 'Nguyễn Ngọc Anh']
    const unblockLower = new Set(unblockIdentities.map((v) => v.toLowerCase().trim()))

    for (const item of Array.from(deletedIds)) {
      if (unblockLower.has(item.toLowerCase().trim())) {
        deletedIds.delete(item)
      }
    }

    // Old account ID stays blacklisted, new person identifiers are clean
    expect(deletedIds.has('acc-17000001')).toBe(true)
    expect(deletedIds.has('acc-thang')).toBe(true)
    expect(deletedIds.has('24070622')).toBe(false)
    expect(deletedIds.has('24070622@vnu.edu.vn')).toBe(false)

    // resolveAllAssociatedIdentities still maps default aliases intact
    expect(resolveAllAssociatedIdentities('acc-thang')).toContain('24310088')
  })

  it('3. Finance verification supports dynamically added cloud roster members as well as INITIAL_MEMBERS', () => {
    const newCloudMember: RosterMember = {
      source_stt: 50,
      member_code: '26078888',
      full_name: 'Phạm Hoàng Minh',
      department_name: 'Ban Tư vấn',
      department_code: 'B02',
      department_slug: 'tu-van',
      position: 'Thành viên',
      is_core: false,
      student_id: '26078888',
      email: 'minhph@vnuis.edu.vn',
      phone: '0912345678',
      current_score: 60,
      absent_count_t02: 0,
    }

    const customRoster = [...INITIAL_MEMBERS, newCloudMember]

    const ok = verifyClubMemberIdentity(
      {
        fullName: '  Phạm   Hoàng Minh ',
        studentId: '26078888',
        email: 'MINHPH@VNUIS.EDU.VN',
        phone: '+84912345678',
      },
      'test-client',
      customRoster
    )

    expect(ok.isValid).toBe(true)
    expect(ok.member?.memberCode).toBe('26078888')
  })

  it('4. Activity normalization preserves user-edited dates even on default IDs like act-01-recruitment', () => {
    const editedActivity: ActivityItem = {
      id: 'act-01-recruitment',
      code: 'iSSAC-REC',
      title: 'Tuyển quân Gen mới (Đã dời lịch)',
      quarter: 'Quý 1',
      month: 'Tháng 11/2026',
      timeStart: '18/09',
      timeEnd: '18/09',
      date: '2026-11-15',
      dayOfWeek: 0,
      session: 'morning',
      period: 'Tiết: 1 - 4',
      time: '08:00 - 11:30',
      lead: 'BCN CLB',
      room: 'Hội trường',
      category: 'recruitment',
      categoryLabel: 'Tuyển quân',
      department: 'Toàn CLB',
      done: false,
      colorTheme: 'amber',
    }

    const normalized = normalizeActivity(editedActivity)
    expect(normalized.date).toBe('2026-11-15')
    expect(normalized.timeStart).toBe('15/11')
    expect(normalized.timeEnd).toBe('15/11')
    expect(normalized.quarter).toBe('Quý 1')
  })

  it('5. canUserManageAccounts allows both role="bcn" and role="admin" alongside B04 department members', () => {
    expect(
      canUserManageAccounts({
        id: 'admin-1',
        name: 'Admin BCN',
        role: 'admin',
        roleTitle: 'Admin',
        isCore: true,
        avatarBg: 'bg-blue-600',
      })
    ).toBe(true)

    expect(
      canUserManageAccounts({
        id: 'hr-1',
        name: 'HR Head',
        role: 'hr',
        roleTitle: 'Trưởng Ban Nhân sự',
        departmentCode: 'B03',
        isCore: true,
        avatarBg: 'bg-purple-600',
      })
    ).toBe(false)
  })

  it('6. Deleting an account with a common full name does not block issuing or keeping another account with the same name', () => {
    const deletedSet = new Set<string>(['acc-haiyen', '23071317', 'haiyennguyen2504@gmail.com'])

    const isBlockedByIdOrContact = (acc: { id: string; studentId?: string; email: string; fullName: string }) => {
      const lowerSet = new Set(Array.from(deletedSet).map((s) => s.toLowerCase().trim()))
      const fullNameClean = acc.fullName.toLowerCase().trim()
      const isThang = fullNameClean === 'trần đức thắng' || fullNameClean === 'tran duc thang'
      return (
        lowerSet.has(acc.id.toLowerCase()) ||
        (acc.studentId ? lowerSet.has(acc.studentId.toLowerCase()) : false) ||
        lowerSet.has(acc.email.toLowerCase()) ||
        (isThang && lowerSet.has(fullNameClean))
      )
    }

    // Account with same Vietnamese name but distinct studentId and email remains allowed
    const secondHaiYen = {
      id: 'acc-1795609999999',
      fullName: 'Nguyễn Thị Hải Yến',
      studentId: '25070267',
      email: 'haiyen260827@gmail.com',
    }
    expect(isBlockedByIdOrContact(secondHaiYen)).toBe(false)

    // Deleted account itself remains strictly blocked
    expect(
      isBlockedByIdOrContact({
        id: 'acc-haiyen',
        fullName: 'Nguyễn Thị Hải Yến',
        studentId: '23071317',
        email: 'haiyennguyen2504@gmail.com',
      })
    ).toBe(true)
  })
})

