import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AVAILABLE_PERIODS } from '@/lib/periodData'
import { INITIAL_MEMBERS } from '@/lib/clubData'
import { INITIAL_ISSUED_ACCOUNTS } from '@/lib/auth/accountData'
import { INITIAL_ACTIVITIES } from '@/lib/scheduleData'

// Bộ nhớ đệm tạm thời phía server để phản hồi tức thì
let cachedEvents: any[] | null = null
let cachedActiveEventId: string | null = null
let cachedProposals: any[] | null = null
let cachedMembers: any[] | null = null
let cachedDisputes: any[] | null = null
let cachedPeriods: any[] | null = null
let cachedActivePeriodId: string | null = null
let cachedPeriodScores: Record<string, any> | null = null
let cachedDeletedProposalIds: string[] | null = null
let cachedDeletedEventIds: string[] | null = null
let cachedDeletedPeriodIds: string[] | null = null
let cachedCustomRules: any[] | null = null
let cachedAccounts: any[] | null = null
let cachedDeletedAccountIds: string[] | null = null
let cachedDeletedMemberCodes: string[] | null = null
let cachedActivities: any[] | null = null
let cachedDeletedActivityIds: string[] | null = null
let cachedSchedulePendingRequests: any[] | null = null
let cachedSurveyEvents: any[] | null = null
let cachedSurveyFeedbacks: any[] | null = null
let cachedDeletedSurveyEventIds: string[] | null = null
let cachedSurveyCustomQuestions: Record<string, any> | null = null
let cachedBcnSurveyNotes: Record<string, string> | null = null

function isAccountDeletedBySet(acc: any, delSet: Set<string>): boolean {
  if (!acc || delSet.size === 0) return false
  const lowerDel = new Set<string>()
  delSet.forEach((v) => {
    if (v) lowerDel.add(String(v).toLowerCase().trim())
  })
  const candidates = [acc.id, acc.studentId, acc.memberCode, acc.email, acc.fullName]
  return candidates.some((val) => val && lowerDel.has(String(val).toLowerCase().trim()))
}

async function loadSettingJson<T>(supabase: ReturnType<typeof createAdminClient>, key: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (!error && data?.value) {
      return JSON.parse(data.value) as T
    }
  } catch (e) {
    console.warn(`Supabase loadSettingJson(${key}) notice:`, e)
  }
  return null
}

// GET /api/db/sync — Lấy dữ liệu sự kiện & điểm danh mới nhất từ Supabase
export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()

    // 1. Đọc từ bảng settings trong Supabase
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'issac_events_cloud',
        'issac_active_event_id',
        'issac_proposals_cloud',
        'issac_members_cloud',
        'issac_disputes_cloud',
        'issac_periods_cloud',
        'issac_active_period_id',
        'issac_custom_period_scores',
        'issac_deleted_proposal_ids',
        'issac_deleted_event_ids',
        'issac_deleted_period_ids',
        'issac_custom_rules_cloud',
        'issac_issued_accounts_cloud',
        'issac_deleted_account_ids',
        'issac_deleted_member_codes_v2',
        'issac_activities_cloud',
        'issac_deleted_activity_ids',
        'issac_schedule_pending_requests',
        'issac_survey_events_cloud',
        'issac_survey_feedbacks_cloud',
        'issac_deleted_survey_event_ids',
        'issac_survey_custom_questions_cloud',
        'issac_bcn_survey_notes_cloud',
      ])

    if (!error && data && data.length > 0) {
      const eventsRow = data.find((r) => r.key === 'issac_events_cloud')
      const proposalsRow = data.find((r) => r.key === 'issac_proposals_cloud')
      const membersRow = data.find((r) => r.key === 'issac_members_cloud')
      const disputesRow = data.find((r) => r.key === 'issac_disputes_cloud')
      const periodsRow = data.find((r) => r.key === 'issac_periods_cloud')
      const activePeriodRow = data.find((r) => r.key === 'issac_active_period_id')
      const scoresRow = data.find((r) => r.key === 'issac_custom_period_scores')
      const deletedIdsRow = data.find((r) => r.key === 'issac_deleted_proposal_ids')
      const deletedEventIdsRow = data.find((r) => r.key === 'issac_deleted_event_ids')
      const deletedPeriodIdsRow = data.find((r) => r.key === 'issac_deleted_period_ids')
      const activeEventRow = data.find((r) => r.key === 'issac_active_event_id')
      const customRulesRow = data.find((r) => r.key === 'issac_custom_rules_cloud')
      const accountsRow = data.find((r) => r.key === 'issac_issued_accounts_cloud')
      const deletedAccountsRow = data.find((r) => r.key === 'issac_deleted_account_ids')
      const deletedMemberCodesRow = data.find((r) => r.key === 'issac_deleted_member_codes_v2')
      const activitiesRow = data.find((r) => r.key === 'issac_activities_cloud')
      const deletedActivityIdsRow = data.find((r) => r.key === 'issac_deleted_activity_ids')
      const schedulePendingRequestsRow = data.find((r) => r.key === 'issac_schedule_pending_requests')
      const surveyEventsRow = data.find((r) => r.key === 'issac_survey_events_cloud')
      const surveyFeedbacksRow = data.find((r) => r.key === 'issac_survey_feedbacks_cloud')
      const deletedSurveyEventIdsRow = data.find((r) => r.key === 'issac_deleted_survey_event_ids')
      const surveyCustomQuestionsRow = data.find((r) => r.key === 'issac_survey_custom_questions_cloud')
      const bcnSurveyNotesRow = data.find((r) => r.key === 'issac_bcn_survey_notes_cloud')

      let eventsFromDb = null
      let proposalsFromDb = null
      let membersFromDb = null
      let disputesFromDb = null
      let periodsFromDb = null
      let activePeriodFromDb = null
      let scoresFromDb = null
      let deletedIdsFromDb = null
      let deletedEventIdsFromDb = null
      let deletedPeriodIdsFromDb = null
      let activeEventIdFromDb = null
      let customRulesFromDb = null
      let accountsFromDb = null
      let deletedAccountIdsFromDb = null
      let deletedMemberCodesFromDb = null
      let activitiesFromDb = null
      let deletedActivityIdsFromDb = null
      let schedulePendingRequestsFromDb = null
      let surveyEventsFromDb = null
      let surveyFeedbacksFromDb = null
      let deletedSurveyEventIdsFromDb = null
      let surveyCustomQuestionsFromDb = null
      let bcnSurveyNotesFromDb = null

      if (eventsRow?.value) {
        try {
          eventsFromDb = JSON.parse(eventsRow.value)
          cachedEvents = eventsFromDb
        } catch (e) {
          console.error('Error parsing events JSON:', e)
        }
      }

      if (activeEventRow) {
        activeEventIdFromDb = activeEventRow.value !== undefined ? (activeEventRow.value || '') : null
        if (activeEventIdFromDb !== null) {
          cachedActiveEventId = activeEventIdFromDb
        }
      }

      if (customRulesRow?.value) {
        try {
          customRulesFromDb = JSON.parse(customRulesRow.value)
          cachedCustomRules = customRulesFromDb
        } catch (e) {
          console.error('Error parsing custom rules JSON:', e)
        }
      }

      if (proposalsRow?.value) {
        try {
          proposalsFromDb = JSON.parse(proposalsRow.value)
          cachedProposals = proposalsFromDb
        } catch (e) {
          console.error('Error parsing proposals JSON:', e)
        }
      }

      if (membersRow?.value) {
        try {
          membersFromDb = JSON.parse(membersRow.value)
          cachedMembers = membersFromDb
        } catch (e) {
          console.error('Error parsing members JSON:', e)
        }
      }

      if (disputesRow?.value) {
        try {
          disputesFromDb = JSON.parse(disputesRow.value)
          cachedDisputes = disputesFromDb
        } catch (e) {
          console.error('Error parsing disputes JSON:', e)
        }
      }

      if (periodsRow?.value) {
        try {
          periodsFromDb = JSON.parse(periodsRow.value)
          cachedPeriods = periodsFromDb
        } catch (e) {
          console.error('Error parsing periods JSON:', e)
        }
      }

      if (activePeriodRow?.value) {
        activePeriodFromDb = activePeriodRow.value
        cachedActivePeriodId = activePeriodFromDb
      }

      if (scoresRow?.value) {
        try {
          scoresFromDb = JSON.parse(scoresRow.value)
          cachedPeriodScores = scoresFromDb
        } catch (e) {
          console.error('Error parsing period scores JSON:', e)
        }
      }

      if (deletedIdsRow?.value) {
        try {
          deletedIdsFromDb = JSON.parse(deletedIdsRow.value)
          cachedDeletedProposalIds = deletedIdsFromDb
        } catch (e) {
          console.error('Error parsing deleted IDs JSON:', e)
        }
      }

      if (deletedEventIdsRow?.value) {
        try {
          deletedEventIdsFromDb = JSON.parse(deletedEventIdsRow.value)
          cachedDeletedEventIds = deletedEventIdsFromDb
        } catch (e) {
          console.error('Error parsing deleted event IDs JSON:', e)
        }
      }

      if (deletedPeriodIdsRow?.value) {
        try {
          deletedPeriodIdsFromDb = JSON.parse(deletedPeriodIdsRow.value)
          cachedDeletedPeriodIds = deletedPeriodIdsFromDb
        } catch (e) {
          console.error('Error parsing deleted period IDs JSON:', e)
        }
      }

      if (deletedAccountsRow?.value) {
        try {
          deletedAccountIdsFromDb = JSON.parse(deletedAccountsRow.value)
          cachedDeletedAccountIds = deletedAccountIdsFromDb
        } catch (e) {
          console.error('Error parsing deleted accounts JSON:', e)
        }
      }

      if (deletedMemberCodesRow?.value) {
        try {
          deletedMemberCodesFromDb = JSON.parse(deletedMemberCodesRow.value)
          cachedDeletedMemberCodes = deletedMemberCodesFromDb
        } catch (e) {
          console.error('Error parsing deleted member codes JSON:', e)
        }
      }

      if (accountsRow?.value) {
        try {
          accountsFromDb = JSON.parse(accountsRow.value)
          cachedAccounts = accountsFromDb
        } catch (e) {
          console.error('Error parsing accounts JSON:', e)
        }
      }

      if (activitiesRow?.value) {
        try {
          activitiesFromDb = JSON.parse(activitiesRow.value)
          cachedActivities = activitiesFromDb
        } catch (e) {
          console.error('Error parsing activities JSON:', e)
        }
      }

      if (deletedActivityIdsRow?.value) {
        try {
          deletedActivityIdsFromDb = JSON.parse(deletedActivityIdsRow.value)
          cachedDeletedActivityIds = deletedActivityIdsFromDb
        } catch (e) {
          console.error('Error parsing deleted activity IDs JSON:', e)
        }
      }

      if (bcnSurveyNotesRow?.value) {
        try {
          bcnSurveyNotesFromDb = JSON.parse(bcnSurveyNotesRow.value)
          cachedBcnSurveyNotes = bcnSurveyNotesFromDb
        } catch (e) {
          console.error('Error parsing BCN survey notes JSON:', e)
        }
      }

      if (schedulePendingRequestsRow?.value) {
        try {
          schedulePendingRequestsFromDb = JSON.parse(schedulePendingRequestsRow.value)
          cachedSchedulePendingRequests = schedulePendingRequestsFromDb
        } catch (e) {
          console.error('Error parsing schedule pending requests JSON:', e)
        }
      }

      if (surveyEventsRow?.value) {
        try {
          surveyEventsFromDb = JSON.parse(surveyEventsRow.value)
          cachedSurveyEvents = surveyEventsFromDb
        } catch (e) {
          console.error('Error parsing survey events JSON:', e)
        }
      }

      if (surveyFeedbacksRow?.value) {
        try {
          surveyFeedbacksFromDb = JSON.parse(surveyFeedbacksRow.value)
          cachedSurveyFeedbacks = surveyFeedbacksFromDb
        } catch (e) {
          console.error('Error parsing survey feedbacks JSON:', e)
        }
      }

      if (deletedSurveyEventIdsRow?.value) {
        try {
          deletedSurveyEventIdsFromDb = JSON.parse(deletedSurveyEventIdsRow.value)
          cachedDeletedSurveyEventIds = deletedSurveyEventIdsFromDb
        } catch (e) {
          console.error('Error parsing deleted survey event IDs JSON:', e)
        }
      }

      if (surveyCustomQuestionsRow?.value) {
        try {
          surveyCustomQuestionsFromDb = JSON.parse(surveyCustomQuestionsRow.value)
          cachedSurveyCustomQuestions = surveyCustomQuestionsFromDb
        } catch (e) {
          console.error('Error parsing survey custom questions JSON:', e)
        }
      }

      const activeDeletedSurveyEventIds = new Set(deletedSurveyEventIdsFromDb || cachedDeletedSurveyEventIds || [])
      let finalSurveyEvents = surveyEventsFromDb || cachedSurveyEvents
      if (Array.isArray(finalSurveyEvents)) {
        if (activeDeletedSurveyEventIds.size > 0) {
          finalSurveyEvents = finalSurveyEvents.filter((e: any) => e?.id && !activeDeletedSurveyEventIds.has(e.id))
        }
      }

      const activeDeletedEventIds = new Set(deletedEventIdsFromDb || cachedDeletedEventIds || [])
      let finalEvents = eventsFromDb || cachedEvents || []
      if (activeDeletedEventIds.size > 0 && Array.isArray(finalEvents)) {
        finalEvents = finalEvents.filter((e: any) => !activeDeletedEventIds.has(e.id))
      }

      const activeDeletedPeriodIds = new Set(deletedPeriodIdsFromDb || cachedDeletedPeriodIds || [])
      const periodMap = new Map<string, any>()
      
      const savedPeriodsList = periodsFromDb !== null ? periodsFromDb : cachedPeriods
      if (Array.isArray(savedPeriodsList)) {
        for (const p of savedPeriodsList) {
          if (p?.id && !activeDeletedPeriodIds.has(p.id)) {
            periodMap.set(p.id, p)
          }
        }
      } else {
        // Chỉ dùng AVAILABLE_PERIODS mặc định nếu hệ thống chưa từng lưu chu kỳ nào
        for (const p of AVAILABLE_PERIODS) {
          if (!activeDeletedPeriodIds.has(p.id)) {
            periodMap.set(p.id, p)
          }
        }
      }
      const safePeriods = Array.from(periodMap.values())

      const activeDeletedAccountIds = new Set<string>((deletedAccountIdsFromDb || cachedDeletedAccountIds || []) as string[])
      const activeDeletedMemberCodes = new Set<string>((deletedMemberCodesFromDb || cachedDeletedMemberCodes || []) as string[])
      const activeDeletedActivityIds = new Set<string>((deletedActivityIdsFromDb || cachedDeletedActivityIds || []) as string[])

      let finalAccounts = accountsFromDb || cachedAccounts || INITIAL_ISSUED_ACCOUNTS
      if (Array.isArray(finalAccounts) && activeDeletedAccountIds.size > 0) {
        finalAccounts = finalAccounts.filter((a: any) => !isAccountDeletedBySet(a, activeDeletedAccountIds))
      }
      cachedAccounts = finalAccounts

      let finalActivities = activitiesFromDb !== null ? activitiesFromDb : cachedActivities
      if (Array.isArray(finalActivities) && activeDeletedActivityIds.size > 0) {
        finalActivities = finalActivities.filter((a: any) => a?.id && !activeDeletedActivityIds.has(a.id))
      }

      let finalSurveyFeedbacks = surveyFeedbacksFromDb || cachedSurveyFeedbacks || []
      if (Array.isArray(finalSurveyFeedbacks) && activeDeletedSurveyEventIds.size > 0) {
        const deletedEventNames = new Set(
          ((surveyEventsFromDb || cachedSurveyEvents || []) as any[])
            .filter((e: any) => e?.id && activeDeletedSurveyEventIds.has(e.id))
            .map((e: any) => e.name)
        )
        if (deletedEventNames.size > 0) {
          finalSurveyFeedbacks = finalSurveyFeedbacks.filter((f: any) => !deletedEventNames.has(f.event))
        }
      }

      // Giữ toàn bộ thành viên hiện có (bao gồm thành viên thêm mới) và loại bỏ thành viên đã xóa
      let finalMembers = membersFromDb || cachedMembers || INITIAL_MEMBERS
      if (Array.isArray(finalMembers)) {
        finalMembers = finalMembers.filter(
          (m: any) => m?.member_code && !activeDeletedMemberCodes.has(m.member_code)
        )
        // Chỉ bổ sung thành viên mặc định nếu chưa bị xóa trong issac_deleted_member_codes_v2 và chưa có trong danh sách
        const existingCodes = new Set(finalMembers.map((m: any) => m.member_code))
        const missingInitial = INITIAL_MEMBERS.filter(
          (m) => !existingCodes.has(m.member_code) && !activeDeletedMemberCodes.has(m.member_code)
        )
        if (missingInitial.length > 0) {
          finalMembers = [...finalMembers, ...missingInitial]
        }
        finalMembers = finalMembers.map((m: any) => ({
          ...m,
          avatar_url: m.avatar_url && m.avatar_url.length > 40000 ? undefined : m.avatar_url,
        }))
        cachedMembers = finalMembers
      }

      return NextResponse.json(
        {
          success: true,
          events: finalEvents,
          activeEventId: activeEventIdFromDb !== null ? activeEventIdFromDb : (cachedActiveEventId || ''),
          proposals: proposalsFromDb || cachedProposals,
          members: finalMembers,
          disputes: disputesFromDb || cachedDisputes,
          periods: safePeriods,
          activePeriodId: activePeriodFromDb || cachedActivePeriodId || (safePeriods[0]?.id || 'month-2026-11'),
          customPeriodScores: scoresFromDb || cachedPeriodScores,
          customRules: customRulesFromDb || cachedCustomRules || [],
          deletedProposalIds: deletedIdsFromDb || cachedDeletedProposalIds || [],
          deletedEventIds: deletedEventIdsFromDb || cachedDeletedEventIds || [],
          deletedPeriodIds: deletedPeriodIdsFromDb || cachedDeletedPeriodIds || [],
          accounts: finalAccounts,
          deletedAccountIds: Array.from(activeDeletedAccountIds),
          deletedMemberCodes: Array.from(activeDeletedMemberCodes),
          activities: finalActivities,
          deletedActivityIds: Array.from(activeDeletedActivityIds),
          schedulePendingRequests: schedulePendingRequestsFromDb !== null ? schedulePendingRequestsFromDb : (cachedSchedulePendingRequests || []),
          surveyEvents: finalSurveyEvents,
          surveyFeedbacks: finalSurveyFeedbacks,
          deletedSurveyEventIds: Array.from(activeDeletedSurveyEventIds),
          surveyCustomQuestions: surveyCustomQuestionsFromDb || cachedSurveyCustomQuestions || {},
          bcnSurveyNotes: bcnSurveyNotesFromDb || cachedBcnSurveyNotes || {},
          source: 'supabase_cloud',
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      )
    }

    const fallbackDeletedSurveyEventIds = new Set(cachedDeletedSurveyEventIds || [])
    let fallbackSurveyEvents = cachedSurveyEvents
    if (fallbackDeletedSurveyEventIds.size > 0 && Array.isArray(fallbackSurveyEvents)) {
      fallbackSurveyEvents = fallbackSurveyEvents.filter((e: any) => !fallbackDeletedSurveyEventIds.has(e.id))
    }

    const fallbackDeletedEventIds = new Set(cachedDeletedEventIds || [])
    let fallbackEvents = cachedEvents || []
    if (fallbackDeletedEventIds.size > 0 && Array.isArray(fallbackEvents)) {
      fallbackEvents = fallbackEvents.filter((e: any) => !fallbackDeletedEventIds.has(e.id))
    }

    const fallbackDeletedPeriodIds = new Set(cachedDeletedPeriodIds || [])
    const fallbackPeriodMap = new Map<string, any>()
    if (Array.isArray(cachedPeriods)) {
      for (const p of cachedPeriods) {
        if (p?.id && !fallbackDeletedPeriodIds.has(p.id)) {
          fallbackPeriodMap.set(p.id, p)
        }
      }
    } else {
      for (const p of AVAILABLE_PERIODS) {
        if (!fallbackDeletedPeriodIds.has(p.id)) {
          fallbackPeriodMap.set(p.id, p)
        }
      }
    }
    const safeFallbackPeriods = Array.from(fallbackPeriodMap.values())

    const fallbackDeletedAccountIds = new Set(cachedDeletedAccountIds || [])
    let fallbackAccounts = (cachedAccounts && cachedAccounts.length > 0) ? cachedAccounts : INITIAL_ISSUED_ACCOUNTS
    if (fallbackDeletedAccountIds.size > 0 && Array.isArray(fallbackAccounts)) {
      fallbackAccounts = fallbackAccounts.filter((a: any) => !isAccountDeletedBySet(a, fallbackDeletedAccountIds))
    }

    const fallbackDelMemberSet = new Set(cachedDeletedMemberCodes || [])
    let fallbackMembers = cachedMembers || INITIAL_MEMBERS
    if (Array.isArray(fallbackMembers)) {
      fallbackMembers = fallbackMembers.filter(
        (m: any) => m?.member_code && !fallbackDelMemberSet.has(m.member_code)
      )
      const existingCodes = new Set(fallbackMembers.map((m: any) => m.member_code))
      const missingInitial = INITIAL_MEMBERS.filter(
        (m) => !existingCodes.has(m.member_code) && !fallbackDelMemberSet.has(m.member_code)
      )
      if (missingInitial.length > 0) {
        fallbackMembers = [...fallbackMembers, ...missingInitial]
      }
    }

    const fallbackDelActivitySet = new Set(cachedDeletedActivityIds || [])
    let fallbackActivities = cachedActivities !== null ? cachedActivities : INITIAL_ACTIVITIES
    if (Array.isArray(fallbackActivities) && fallbackDelActivitySet.size > 0) {
      fallbackActivities = fallbackActivities.filter((a: any) => a?.id && !fallbackDelActivitySet.has(a.id))
    }

    return NextResponse.json(
      {
        success: true,
        events: fallbackEvents,
        activeEventId: cachedActiveEventId || '',
        proposals: cachedProposals,
        members: fallbackMembers,
        disputes: cachedDisputes,
        periods: safeFallbackPeriods,
        activePeriodId: cachedActivePeriodId || (safeFallbackPeriods[0]?.id || 'month-2026-11'),
        customPeriodScores: cachedPeriodScores,
        customRules: cachedCustomRules || [],
        deletedProposalIds: cachedDeletedProposalIds || [],
        deletedEventIds: cachedDeletedEventIds || [],
        deletedPeriodIds: cachedDeletedPeriodIds || [],
        accounts: fallbackAccounts,
        deletedAccountIds: Array.from(fallbackDeletedAccountIds),
        deletedMemberCodes: Array.from(fallbackDelMemberSet),
        activities: fallbackActivities,
        deletedActivityIds: Array.from(fallbackDelActivitySet),
        schedulePendingRequests: cachedSchedulePendingRequests || [],
        surveyEvents: fallbackSurveyEvents,
        surveyFeedbacks: cachedSurveyFeedbacks || [],
        deletedSurveyEventIds: Array.from(fallbackDeletedSurveyEventIds),
        surveyCustomQuestions: cachedSurveyCustomQuestions || {},
        bcnSurveyNotes: cachedBcnSurveyNotes || {},
        source: 'cache_memory',
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sync error'
    const errorFallbackDeletedEventIds = new Set(cachedDeletedEventIds || [])
    let errorFallbackEvents = cachedEvents || []
    if (errorFallbackDeletedEventIds.size > 0 && Array.isArray(errorFallbackEvents)) {
      errorFallbackEvents = errorFallbackEvents.filter((e: any) => !errorFallbackDeletedEventIds.has(e.id))
    }

    const errorDelMemberSet = new Set(cachedDeletedMemberCodes || [])
    let errorFallbackMembers = cachedMembers || INITIAL_MEMBERS
    if (Array.isArray(errorFallbackMembers)) {
      errorFallbackMembers = errorFallbackMembers.filter(
        (m: any) => m?.member_code && !errorDelMemberSet.has(m.member_code)
      )
      const existingCodes = new Set(errorFallbackMembers.map((m: any) => m.member_code))
      const missingInitial = INITIAL_MEMBERS.filter(
        (m) => !existingCodes.has(m.member_code) && !errorDelMemberSet.has(m.member_code)
      )
      if (missingInitial.length > 0) {
        errorFallbackMembers = [...errorFallbackMembers, ...missingInitial]
      }
    }

    let errorFallbackAccounts = (cachedAccounts && cachedAccounts.length > 0) ? cachedAccounts : INITIAL_ISSUED_ACCOUNTS
    const errorDelAccSet = new Set(cachedDeletedAccountIds || [])
    if (errorDelAccSet.size > 0 && Array.isArray(errorFallbackAccounts)) {
      errorFallbackAccounts = errorFallbackAccounts.filter((a: any) => !isAccountDeletedBySet(a, errorDelAccSet))
    }

    return NextResponse.json({
      success: true,
      events: errorFallbackEvents,
      proposals: cachedProposals,
      members: errorFallbackMembers,
      disputes: cachedDisputes,
      periods: cachedPeriods || AVAILABLE_PERIODS,
      activePeriodId: cachedActivePeriodId || 'month-2026-11',
      customPeriodScores: cachedPeriodScores,
      deletedProposalIds: cachedDeletedProposalIds || [],
      deletedEventIds: cachedDeletedEventIds || [],
      deletedPeriodIds: cachedDeletedPeriodIds || [],
      deletedMemberCodes: Array.from(errorDelMemberSet),
      accounts: errorFallbackAccounts,
      deletedAccountIds: Array.from(errorDelAccSet),
      activities: cachedActivities !== null ? cachedActivities : INITIAL_ACTIVITIES,
      deletedActivityIds: cachedDeletedActivityIds || [],
      surveyEvents: cachedSurveyEvents,
      surveyFeedbacks: cachedSurveyFeedbacks || [],
      deletedSurveyEventIds: cachedDeletedSurveyEventIds || [],
      surveyCustomQuestions: cachedSurveyCustomQuestions || {},
      bcnSurveyNotes: cachedBcnSurveyNotes || {},
      error: msg,
      source: 'fallback',
    })
  }
}

// POST /api/db/sync — Ghi nhận sự kiện hoặc điểm danh mới lên Supabase để PC và ĐT cùng thấy
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      action,
      event,
      events,
      eventId,
      memberCode,
      status,
      note,
      proposals,
      proposalId,
      deletedProposalIds,
      deletedEventIds,
      deletedPeriodIds,
      periodId,
      activeEventId,
      members,
      disputes,
      periods,
      activePeriodId,
      customPeriodScores,
      customRules,
      accounts,
      deletedAccountIds,
      accountId,
      unblockAccountIdentities,
      deletedMemberCodes,
      member,
      activities,
      deletedActivityIds,
      activityId,
      schedulePendingRequests,
      surveyEvents,
      surveyFeedbacks,
      deletedSurveyEventIds,
      surveyEventId,
      surveyEventName,
      surveyCustomQuestions,
      bcnSurveyNotes,
    } = body
    const supabase = createAdminClient()

    let dbSuccess = false
    let dbErrorMsg: string | null = null

    const saveSetting = async (key: string, rawValue: string, description: string) => {
      try {
        const { error: upsertErr } = await supabase
          .from('settings')
          .upsert(
            {
              key,
              value: rawValue,
              description,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
          )
        if (upsertErr) {
          dbErrorMsg = upsertErr.message
          console.warn(`Supabase ${key} upsert notice:`, upsertErr.message)
        } else {
          dbSuccess = true
        }
      } catch (err: any) {
        dbErrorMsg = err?.message || 'Database error'
        console.warn(`Supabase ${key} catch notice:`, err)
      }
    }

    // 0. Quản lý danh sách ID bản ghi đã xóa (Tombstones để chống hồi sinh khi sync từ máy khác)
    if (deletedProposalIds !== undefined || (action === 'delete_proposal' && proposalId)) {
      if (cachedDeletedProposalIds === null) {
        cachedDeletedProposalIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_proposal_ids')
      }
      const incomingDel = Array.isArray(deletedProposalIds) ? deletedProposalIds : []
      if (action === 'delete_proposal' && proposalId && !incomingDel.includes(proposalId)) {
        incomingDel.push(proposalId)
      }
      const combinedDelSet = new Set([
        ...(cachedDeletedProposalIds || []),
        ...incomingDel,
      ])
      cachedDeletedProposalIds = Array.from(combinedDelSet)

      await saveSetting(
        'issac_deleted_proposal_ids',
        JSON.stringify(cachedDeletedProposalIds),
        'Cloud synchronized deleted proposal IDs for iSSAC Web'
      )
    }

    // 0.1 Quản lý danh sách ID sự kiện đã xóa (Tombstones để chống hồi sinh khi sync từ máy khác)
    if (deletedEventIds !== undefined || (action === 'delete_event' && eventId)) {
      if (cachedDeletedEventIds === null) {
        cachedDeletedEventIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_event_ids')
      }
      const incomingDelEvt = Array.isArray(deletedEventIds) ? deletedEventIds : []
      if (action === 'delete_event' && eventId && !incomingDelEvt.includes(eventId)) {
        incomingDelEvt.push(eventId)
      }
      const combinedDelEvtSet = new Set([
        ...(cachedDeletedEventIds || []),
        ...incomingDelEvt,
      ])
      cachedDeletedEventIds = Array.from(combinedDelEvtSet)

      await saveSetting(
        'issac_deleted_event_ids',
        JSON.stringify(cachedDeletedEventIds),
        'Cloud synchronized deleted event IDs for iSSAC Web'
      )
    }

    // 0.2 Quản lý danh sách ID chu kỳ thi đua đã xóa (Tombstones để chống hồi sinh chu kỳ đã xóa)
    if (deletedPeriodIds !== undefined || (action === 'delete_period' && periodId)) {
      if (cachedDeletedPeriodIds === null) {
        cachedDeletedPeriodIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_period_ids')
      }
      if (action === 'delete_period' && periodId) {
        const set = new Set([...(cachedDeletedPeriodIds || []), periodId])
        cachedDeletedPeriodIds = Array.from(set)
      } else if (Array.isArray(deletedPeriodIds)) {
        cachedDeletedPeriodIds = Array.from(new Set(deletedPeriodIds))
      }
    }

    // Nếu có danh sách periods được gửi lên (kể cả tạo mới hay cập nhật):
    // Mọi chu kỳ có trong periods đều PHẢI ĐƯỢC GỠ KHỎI cachedDeletedPeriodIds!
    if (periods !== undefined && Array.isArray(periods)) {
      if (cachedDeletedPeriodIds === null) {
        cachedDeletedPeriodIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_period_ids')
      }
      const activePeriodIds = new Set(periods.map((p: any) => p?.id).filter(Boolean))
      if (cachedDeletedPeriodIds && cachedDeletedPeriodIds.length > 0) {
        cachedDeletedPeriodIds = cachedDeletedPeriodIds.filter((id) => !activePeriodIds.has(id))
      }
    }

    if (deletedPeriodIds !== undefined || (action === 'delete_period' && periodId) || (periods !== undefined && Array.isArray(periods))) {
      await saveSetting(
        'issac_deleted_period_ids',
        JSON.stringify(cachedDeletedPeriodIds || []),
        'Cloud synchronized deleted period IDs for iSSAC Web'
      )
    }

    // 0.3 Quản lý danh sách ID tài khoản đã xóa (Tombstones để đồng bộ nhất quán giữa Điện thoại và Máy tính)
    const hasUnblockIdentities = Array.isArray(unblockAccountIdentities) && unblockAccountIdentities.length > 0
    if (deletedAccountIds !== undefined || (action === 'delete_account' && accountId) || hasUnblockIdentities) {
      if (cachedDeletedAccountIds === null) {
        cachedDeletedAccountIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_account_ids')
      }
      if (cachedAccounts === null) {
        cachedAccounts = await loadSettingJson<any[]>(supabase, 'issac_issued_accounts_cloud')
      }
      const incomingDelAcc = Array.isArray(deletedAccountIds) ? [...deletedAccountIds] : []
      if (action === 'delete_account' && accountId && !incomingDelAcc.includes(accountId)) {
        incomingDelAcc.push(accountId)
      }
      if (body.studentId && !incomingDelAcc.includes(body.studentId)) {
        incomingDelAcc.push(body.studentId)
      }
      if (body.memberCode && !incomingDelAcc.includes(body.memberCode)) {
        incomingDelAcc.push(body.memberCode)
      }
      if (body.email && !incomingDelAcc.includes(body.email)) {
        incomingDelAcc.push(body.email)
      }

      // Tự động mở rộng bí danh cho Trần Đức Thắng nếu có thao tác xóa
      if (action === 'delete_account' || deletedAccountIds !== undefined) {
        for (const item of [...incomingDelAcc]) {
          const clean = String(item).toLowerCase().trim()
          if (clean === 'acc-thang' || clean === '24310088' || clean === 'tdthang@vnuis.edu.vn') {
            if (!incomingDelAcc.includes('acc-thang')) incomingDelAcc.push('acc-thang')
            if (!incomingDelAcc.includes('24310088')) incomingDelAcc.push('24310088')
            if (!incomingDelAcc.includes('tdthang@vnuis.edu.vn')) incomingDelAcc.push('tdthang@vnuis.edu.vn')
            if (!incomingDelAcc.includes('user-dept-head')) incomingDelAcc.push('user-dept-head')
          }
        }
      }

      const combinedDelAccSet = new Set([
        ...(cachedDeletedAccountIds || []),
        ...incomingDelAcc,
      ])

      // Khi BCN cấp lại tài khoản mới cho một người từng có tài khoản bị xóa:
      // gỡ studentId/email/fullName khỏi tombstone (giữ nguyên acc-... cũ đã xóa)
      if (hasUnblockIdentities) {
        const unblockLower = new Set(
          unblockAccountIdentities
            .map((v: any) => String(v || '').toLowerCase().trim())
            .filter(Boolean)
        )
        for (const existingDel of Array.from(combinedDelAccSet)) {
          if (unblockLower.has(String(existingDel).toLowerCase().trim())) {
            combinedDelAccSet.delete(existingDel)
          }
        }
      }

      cachedDeletedAccountIds = Array.from(combinedDelAccSet)

      if (Array.isArray(cachedAccounts)) {
        cachedAccounts = cachedAccounts.filter((a: any) => !isAccountDeletedBySet(a, combinedDelAccSet))
      }

      await saveSetting(
        'issac_deleted_account_ids',
        JSON.stringify(cachedDeletedAccountIds),
        'Cloud synchronized deleted account IDs for iSSAC Web'
      )
    }

    // 0.4 Quản lý danh sách Member Code đã xóa (Tombstones tách biệt hoàn toàn với tài khoản)
    if (deletedMemberCodes !== undefined || (action === 'delete_member' && memberCode) || (action === 'add_member' && member?.member_code)) {
      if (cachedDeletedMemberCodes === null) {
        cachedDeletedMemberCodes = await loadSettingJson<string[]>(supabase, 'issac_deleted_member_codes_v2')
      }
      const incomingDel = Array.isArray(deletedMemberCodes) ? [...deletedMemberCodes] : []
      if (action === 'delete_member' && memberCode && !incomingDel.includes(memberCode)) {
        incomingDel.push(memberCode)
      }
      const combinedDelSet = new Set([
        ...(cachedDeletedMemberCodes || []),
        ...incomingDel,
      ])
      if (action === 'add_member' && member?.member_code) {
        combinedDelSet.delete(member.member_code)
      }
      cachedDeletedMemberCodes = Array.from(combinedDelSet)

      await saveSetting(
        'issac_deleted_member_codes_v2',
        JSON.stringify(cachedDeletedMemberCodes),
        'Cloud synchronized deleted member codes (v2) for iSSAC Web'
      )
    }

    const shouldUpdateEvents = events !== undefined || action !== undefined

    if (shouldUpdateEvents) {
      // Nếu chưa có cachedEvents trong bộ nhớ server, tải từ Supabase trước
      if (!cachedEvents) {
        try {
          const { data: currentDbRow } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'issac_events_cloud')
            .maybeSingle()
          if (currentDbRow?.value) {
            cachedEvents = JSON.parse(currentDbRow.value)
          }
        } catch (e) {
          console.warn('Error reading current events before update:', e)
        }
      }

      let updatedEvents = Array.isArray(cachedEvents) ? cachedEvents : []

      if (action === 'delete_event' && eventId) {
        // Xóa sự kiện cụ thể (không ghi đè thô bằng events snapshot cũ từ client)
        updatedEvents = updatedEvents.filter((e: any) => e.id !== eventId)
      } else if (action === 'create_event' && event) {
        // Đẩy sự kiện mới lên đầu danh sách và giữ nguyên toàn bộ sự kiện & check-in hiện có
        updatedEvents = [event, ...updatedEvents.filter((e: any) => e.id !== event.id)]
      } else if (action === 'update_event' && eventId && (event || body.event)) {
        const evUpdates = event || body.event
        const hasEvt = updatedEvents.some((evt: any) => evt.id === eventId)
        if (!hasEvt && Array.isArray(events)) {
          const fallbackEvt = events.find((e: any) => e.id === eventId)
          if (fallbackEvt) updatedEvents = [fallbackEvt, ...updatedEvents]
        }
        updatedEvents = updatedEvents.map((evt: any) => {
          if (evt.id === eventId) {
            return {
              ...evt,
              ...evUpdates,
              // Bảo toàn danh sách check-in và đăng ký hiện có trên server
              records: evt.records || evUpdates.records || {},
              registeredMemberCodes: evUpdates.registeredMemberCodes || evt.registeredMemberCodes || [],
            }
          }
          return evt
        })
      } else if (action === 'update_event_attendees' && eventId && Array.isArray(body.registeredMemberCodes)) {
        const hasEvt = updatedEvents.some((evt: any) => evt.id === eventId)
        if (!hasEvt && Array.isArray(events)) {
          const fallbackEvt = events.find((e: any) => e.id === eventId)
          if (fallbackEvt) updatedEvents = [fallbackEvt, ...updatedEvents]
        }
        updatedEvents = updatedEvents.map((evt: any) => {
          if (evt.id === eventId) {
            return {
              ...evt,
              registeredMemberCodes: body.registeredMemberCodes,
            }
          }
          return evt
        })
      } else if (action === 'register' && eventId && memberCode) {
        updatedEvents = updatedEvents.map((evt: any) => {
          if (evt.id === eventId) {
            const cur = evt.registeredMemberCodes || []
            return {
              ...evt,
              registeredMemberCodes: cur.includes(memberCode) ? cur : [...cur, memberCode],
            }
          }
          return evt
        })
      } else if (action === 'unregister' && eventId && memberCode) {
        // Hủy đăng ký 1 thành viên trên server state
        updatedEvents = updatedEvents.map((evt: any) => {
          if (evt.id === eventId) {
            return {
              ...evt,
              registeredMemberCodes: (evt.registeredMemberCodes || []).filter((c: string) => c !== memberCode),
            }
          }
          return evt
        })
      } else if (action === 'checkin' && eventId && memberCode) {
        const existingEvt = updatedEvents.find((evt: any) => evt.id === eventId)
        if (!existingEvt && Array.isArray(events)) {
          const fallbackEvt = events.find((e: any) => e.id === eventId)
          if (fallbackEvt) updatedEvents = [fallbackEvt, ...updatedEvents]
        }
        // Cập nhật điểm danh 1 thành viên
        updatedEvents = updatedEvents.map((evt: any) => {
          if (evt.id === eventId) {
            const prevRec = evt.records?.[memberCode]
            const resolvedStatus = status || 'present_on_time'
            const isPresentStatus = resolvedStatus === 'present_on_time' || resolvedStatus === 'late'
            return {
              ...evt,
              records: {
                ...(evt.records || {}),
                [memberCode]: {
                  ...(prevRec || {}),
                  memberCode,
                  status: resolvedStatus,
                  note: note !== undefined ? note : (prevRec?.note || ''),
                  checkinTime: isPresentStatus
                    ? (prevRec?.checkinTime || new Date().toLocaleTimeString('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        hour: '2-digit',
                        minute: '2-digit',
                      }))
                    : undefined,
                },
              },
            }
          }
          return evt
        })
      } else if (action === 'finalize' && eventId) {
        // Chốt sổ buổi họp
        updatedEvents = updatedEvents.map((evt: any) => {
          if (evt.id === eventId) {
            return {
              ...evt,
              isFinalized: true,
              finalizedAt: new Date().toLocaleTimeString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              }),
              finalizedBy: body.finalizedBy || 'BCN',
            }
          }
          return evt
        })
      } else if (events && Array.isArray(events)) {
        // Hợp nhất events 2 chiều thông minh theo ID (tránh ghi đè mất sự kiện hoặc mất record điểm danh)
        const delSet = new Set(cachedDeletedEventIds || [])
        const evtMap = new Map<string, any>()
        for (const e of updatedEvents) {
          if (e?.id && !delSet.has(e.id)) evtMap.set(e.id, e)
        }
        for (const e of events) {
          if (e?.id && !delSet.has(e.id)) {
            const existing = evtMap.get(e.id)
            if (!existing) {
              evtMap.set(e.id, e)
            } else {
              evtMap.set(e.id, {
                ...existing,
                ...e,
                isFinalized: existing.isFinalized || e.isFinalized,
                registeredMemberCodes: Array.from(
                  new Set([...(existing.registeredMemberCodes || []), ...(e.registeredMemberCodes || [])])
                ),
                records: {
                  ...(existing.records || {}),
                  ...(e.records || {}),
                },
              })
            }
          }
        }
        updatedEvents = Array.from(evtMap.values())
      }

      if (cachedDeletedEventIds && cachedDeletedEventIds.length > 0) {
        const delSet = new Set(cachedDeletedEventIds)
        updatedEvents = updatedEvents.filter((e: any) => !delSet.has(e.id))
      }

      cachedEvents = updatedEvents

      // Ghi vào bảng settings của Supabase để lưu trữ vĩnh viễn trên Cloud
      try {
        const { error: upsertErr } = await supabase
          .from('settings')
          .upsert(
            {
              key: 'issac_events_cloud',
              value: JSON.stringify(updatedEvents),
              description: 'Cloud synchronized events for iSSAC Web across mobile and desktop',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
          )

        if (upsertErr) {
          dbErrorMsg = upsertErr.message
          console.warn('Supabase settings upsert notice:', upsertErr.message)
        } else {
          dbSuccess = true
        }
      } catch (dbErr: any) {
        dbErrorMsg = dbErr?.message || 'Database error'
        console.warn('Supabase events catch notice:', dbErr)
      }
    }

    // 2. Đồng bộ & Hợp nhất Proposals 2 chiều (Chống mất dữ liệu lịch sử điểm số)
    if (proposals !== undefined || (action === 'delete_proposal' && proposalId)) {
      if (!cachedProposals) {
        try {
          const { data: curRow } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'issac_proposals_cloud')
            .maybeSingle()
          if (curRow?.value) {
            cachedProposals = JSON.parse(curRow.value)
          }
        } catch (e) {
          console.warn('Error reading current proposals before update:', e)
        }
      }

      const existingProps = cachedProposals || []
      const incomingProps = Array.isArray(proposals) ? proposals : []
      const deletedSet = new Set(cachedDeletedProposalIds || [])

      const propMap = new Map<string, any>()
      // Thêm các proposal hiện có nếu chưa bị xóa
      for (const p of existingProps) {
        if (p?.id && !deletedSet.has(p.id) && p.status !== 'deleted') {
          propMap.set(p.id, p)
        }
      }
      // Hợp nhất các proposal từ client (cập nhật hoặc thêm mới)
      for (const p of incomingProps) {
        if (p?.id && !deletedSet.has(p.id) && p.status !== 'deleted') {
          propMap.set(p.id, p)
        }
      }

      if (action === 'delete_proposal' && proposalId) {
        propMap.delete(proposalId)
      }

      const mergedProposals = Array.from(propMap.values())
      cachedProposals = mergedProposals

      await saveSetting(
        'issac_proposals_cloud',
        JSON.stringify(mergedProposals),
        'Cloud synchronized proposals for iSSAC Web'
      )
    }

    if (members !== undefined || action === 'add_member' || action === 'delete_member') {
      if (cachedMembers === null) {
        cachedMembers = await loadSettingJson<any[]>(supabase, 'issac_members_cloud')
      }
      if (cachedDeletedMemberCodes === null) {
        cachedDeletedMemberCodes = await loadSettingJson<string[]>(supabase, 'issac_deleted_member_codes_v2')
      }
      const activeDelMemSet = new Set(cachedDeletedMemberCodes || [])
      if (action === 'add_member' && member?.member_code) {
        activeDelMemSet.delete(member.member_code)
      }

      const memberMap = new Map<string, any>()
      const serverMembers = Array.isArray(cachedMembers) && cachedMembers.length > 0 ? cachedMembers : INITIAL_MEMBERS
      for (const sm of serverMembers) {
        if (sm?.member_code && !activeDelMemSet.has(sm.member_code)) {
          memberMap.set(sm.member_code, sm)
        }
      }

      if (Array.isArray(members)) {
        for (const incomingM of members) {
          if (!incomingM?.member_code || activeDelMemSet.has(incomingM.member_code)) continue
          const existing = memberMap.get(incomingM.member_code)
          if (!existing) {
            memberMap.set(incomingM.member_code, incomingM)
          } else {
            const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0
            const incomingTime = incomingM.updated_at ? new Date(incomingM.updated_at).getTime() : 0
            if (incomingTime >= existingTime) {
              memberMap.set(incomingM.member_code, {
                ...existing,
                ...incomingM,
                avatar_url: incomingM.avatar_url || existing.avatar_url,
              })
            }
          }
        }
      }

      if (action === 'add_member' && member?.member_code && !activeDelMemSet.has(member.member_code)) {
        memberMap.set(member.member_code, member)
      }

      if (action === 'delete_member' && memberCode) {
        memberMap.delete(memberCode)
      }

      // Giữ cả thành viên mới thêm, chỉ loại bỏ các thành viên đã xóa và cắt avatar quá lớn
      let cleanMembers = Array.from(memberMap.values())
        .filter((m: any) => m?.member_code && !activeDelMemSet.has(m.member_code))
        .map((m: any) => ({
          ...m,
          avatar_url: m.avatar_url && m.avatar_url.length > 40000 ? undefined : m.avatar_url,
        }))

      // Khôi phục các thành viên mặc định nếu chưa bị xóa trong issac_deleted_member_codes_v2
      const existingCleanCodes = new Set(cleanMembers.map((m: any) => m.member_code))
      const missingInitial = INITIAL_MEMBERS.filter(
        (m) => !existingCleanCodes.has(m.member_code) && !activeDelMemSet.has(m.member_code)
      )
      if (missingInitial.length > 0) {
        cleanMembers = [...cleanMembers, ...missingInitial]
      }

      cachedMembers = cleanMembers
      await saveSetting(
        'issac_members_cloud',
        JSON.stringify(cleanMembers),
        'Cloud synchronized members for iSSAC Web'
      )
    }

    if (disputes !== undefined || action === 'create_dispute' || action === 'review_dispute' || action === 'resolve_dispute') {
      if (cachedDisputes === null) {
        cachedDisputes = await loadSettingJson<any[]>(supabase, 'issac_disputes_cloud')
      }
      const dispMap = new Map<string, any>()
      const currentServerDisputes = cachedDisputes || []
      if (Array.isArray(currentServerDisputes)) {
        for (const d of currentServerDisputes) {
          if (d?.id) dispMap.set(d.id, d)
        }
      }

      const incomingList = Array.isArray(disputes) ? disputes : (body.dispute ? [body.dispute] : [])
      for (const d of incomingList) {
        if (d?.id) {
          const existing = dispMap.get(d.id)
          if (!existing) {
            dispMap.set(d.id, d)
          } else {
            dispMap.set(d.id, {
              ...existing,
              ...d,
              hrNote: d.hrNote !== undefined ? d.hrNote : existing.hrNote,
              hrReviewedAt: d.hrReviewedAt !== undefined ? d.hrReviewedAt : existing.hrReviewedAt,
              bcnVerdict: d.bcnVerdict !== undefined ? d.bcnVerdict : existing.bcnVerdict,
              resolvedAt: d.resolvedAt !== undefined ? d.resolvedAt : existing.resolvedAt,
              status: d.status || existing.status,
            })
          }
        }
      }

      const mergedDisputes = Array.from(dispMap.values())
      cachedDisputes = mergedDisputes
      await saveSetting(
        'issac_disputes_cloud',
        JSON.stringify(mergedDisputes),
        'Cloud synchronized disputes for iSSAC Web'
      )
    }

    if (periods !== undefined || (action === 'delete_period' && periodId)) {
      if (cachedPeriods === null) {
        cachedPeriods = await loadSettingJson<any[]>(supabase, 'issac_periods_cloud')
      }
      if (cachedDeletedPeriodIds === null) {
        cachedDeletedPeriodIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_period_ids')
      }
      const activeDelPerSet = new Set(cachedDeletedPeriodIds || [])
      if (action === 'delete_period' && periodId) {
        activeDelPerSet.add(periodId)
      }

      const periodMap = new Map<string, any>()
      const existingPeriods = Array.isArray(cachedPeriods) ? cachedPeriods : AVAILABLE_PERIODS
      for (const p of existingPeriods) {
        if (p?.id && !activeDelPerSet.has(p.id)) periodMap.set(p.id, p)
      }
      if (Array.isArray(periods)) {
        for (const p of periods) {
          if (p?.id && !activeDelPerSet.has(p.id)) {
            periodMap.set(p.id, { ...(periodMap.get(p.id) || {}), ...p })
          }
        }
      }
      const cleanPeriods = Array.from(periodMap.values())
      cachedPeriods = cleanPeriods
      await saveSetting(
        'issac_periods_cloud',
        JSON.stringify(cleanPeriods),
        'Cloud synchronized periods for iSSAC Web'
      )
    }

    if (activePeriodId !== undefined) {
      cachedActivePeriodId = String(activePeriodId)
      await saveSetting(
        'issac_active_period_id',
        String(activePeriodId),
        'Cloud synchronized active period ID for iSSAC Web'
      )
    }

    if (activeEventId !== undefined) {
      cachedActiveEventId = String(activeEventId || '')
      await saveSetting(
        'issac_active_event_id',
        String(activeEventId || ''),
        'Cloud synchronized active event ID for iSSAC Web'
      )
    }

    if (customRules !== undefined) {
      if (cachedCustomRules === null) {
        cachedCustomRules = await loadSettingJson<any[]>(supabase, 'issac_custom_rules_cloud')
      }
      cachedCustomRules = customRules
      await saveSetting(
        'issac_custom_rules_cloud',
        JSON.stringify(customRules),
        'Cloud synchronized custom rules for iSSAC Web'
      )
    }

    if (customPeriodScores !== undefined || (action === 'delete_period' && periodId)) {
      if (cachedPeriodScores === null) {
        cachedPeriodScores = await loadSettingJson<Record<string, any>>(supabase, 'issac_custom_period_scores')
      }
      const mergedScores: Record<string, any> = { ...(cachedPeriodScores || {}) }
      if (customPeriodScores && typeof customPeriodScores === 'object') {
        for (const [pid, deltaMap] of Object.entries(customPeriodScores)) {
          if (action === 'reset_period_scores' && pid === periodId) {
            mergedScores[pid] = {}
          } else if (deltaMap && typeof deltaMap === 'object') {
            mergedScores[pid] = {
              ...(mergedScores[pid] || {}),
              ...(deltaMap as Record<string, number>),
            }
          }
        }
      }
      if (action === 'delete_period' && periodId) {
        delete mergedScores[periodId]
      }
      cachedPeriodScores = mergedScores
      await saveSetting(
        'issac_custom_period_scores',
        JSON.stringify(mergedScores),
        'Cloud synchronized period scores for iSSAC Web'
      )
    }

    if (accounts !== undefined || action === 'create_account' || action === 'update_account') {
      if (cachedDeletedAccountIds === null) {
        cachedDeletedAccountIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_account_ids')
      }
      if (cachedAccounts === null) {
        cachedAccounts = await loadSettingJson<any[]>(supabase, 'issac_issued_accounts_cloud')
      }
      const activeDelAccSet = new Set(cachedDeletedAccountIds || [])
      const accMap = new Map<string, any>()
      const existingAccs = Array.isArray(cachedAccounts) && cachedAccounts.length > 0 ? cachedAccounts : INITIAL_ISSUED_ACCOUNTS
      for (const a of existingAccs) {
        if (a?.id && !isAccountDeletedBySet(a, activeDelAccSet)) {
          accMap.set(a.id, a)
        }
      }
      if (Array.isArray(accounts)) {
        for (const a of accounts) {
          if (a?.id && !isAccountDeletedBySet(a, activeDelAccSet)) {
            accMap.set(a.id, { ...(accMap.get(a.id) || {}), ...a })
          }
        }
      }
      const cleanAccounts = Array.from(accMap.values())
      cachedAccounts = cleanAccounts
      await saveSetting(
        'issac_issued_accounts_cloud',
        JSON.stringify(cleanAccounts),
        'Cloud synchronized issued accounts for iSSAC Web'
      )
    }

    if (deletedActivityIds !== undefined || (action === 'delete_activity' && activityId)) {
      if (cachedDeletedActivityIds === null) {
        cachedDeletedActivityIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_activity_ids')
      }
      const incomingDelAct = Array.isArray(deletedActivityIds) ? [...deletedActivityIds] : []
      if (action === 'delete_activity' && activityId && !incomingDelAct.includes(activityId)) {
        incomingDelAct.push(activityId)
      }
      cachedDeletedActivityIds = Array.from(new Set([...(cachedDeletedActivityIds || []), ...incomingDelAct]))
      await saveSetting(
        'issac_deleted_activity_ids',
        JSON.stringify(cachedDeletedActivityIds),
        'Cloud synchronized deleted activity IDs for iSSAC Web'
      )
    }

    if (activities !== undefined || (action === 'delete_activity' && activityId)) {
      if (cachedActivities === null) {
        cachedActivities = await loadSettingJson<any[]>(supabase, 'issac_activities_cloud')
      }
      if (cachedDeletedActivityIds === null) {
        cachedDeletedActivityIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_activity_ids')
      }
      const activeDelActSet = new Set(cachedDeletedActivityIds || [])
      let nextActivities = Array.isArray(activities)
        ? activities.filter((a: any) => a?.id && !activeDelActSet.has(a.id))
        : (cachedActivities || [])
      if (action === 'delete_activity' && activityId) {
        nextActivities = nextActivities.filter((a: any) => a.id !== activityId)
      }
      cachedActivities = nextActivities
      await saveSetting(
        'issac_activities_cloud',
        JSON.stringify(nextActivities),
        'Cloud synchronized activities schedule for iSSAC Web'
      )
    }

    if (schedulePendingRequests !== undefined) {
      cachedSchedulePendingRequests = schedulePendingRequests
      await saveSetting(
        'issac_schedule_pending_requests',
        JSON.stringify(schedulePendingRequests),
        'Cloud synchronized schedule pending requests for iSSAC Web'
      )
    }

    // Xử lý danh sách ID sự kiện khảo sát đã xóa (Tombstones để chống hồi sinh khi sync từ thiết bị khác)
    if (deletedSurveyEventIds !== undefined || (action === 'delete_survey_event' && surveyEventId)) {
      if (cachedDeletedSurveyEventIds === null) {
        cachedDeletedSurveyEventIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_survey_event_ids')
      }
      if (cachedSurveyEvents === null) {
        cachedSurveyEvents = await loadSettingJson<any[]>(supabase, 'issac_survey_events_cloud')
      }
      if (cachedSurveyFeedbacks === null) {
        cachedSurveyFeedbacks = await loadSettingJson<any[]>(supabase, 'issac_survey_feedbacks_cloud')
      }

      const deletedTargetName =
        surveyEventName ||
        (Array.isArray(cachedSurveyEvents)
          ? cachedSurveyEvents.find((e: any) => e.id === surveyEventId)?.name
          : undefined)

      const incomingDelSurvey = Array.isArray(deletedSurveyEventIds) ? deletedSurveyEventIds : []
      if (action === 'delete_survey_event' && surveyEventId && !incomingDelSurvey.includes(surveyEventId)) {
        incomingDelSurvey.push(surveyEventId)
      }
      const combinedDelSurveySet = new Set([
        ...(cachedDeletedSurveyEventIds || []),
        ...incomingDelSurvey,
      ])
      if (action === 'restore_survey_events') {
        combinedDelSurveySet.clear()
      }
      cachedDeletedSurveyEventIds = Array.from(combinedDelSurveySet)

      if (cachedSurveyEvents && Array.isArray(cachedSurveyEvents)) {
        cachedSurveyEvents = cachedSurveyEvents.filter((e: any) => !combinedDelSurveySet.has(e.id))
      }

      // Dọn sạch feedbacks thuộc sự kiện khảo sát vừa bị xóa khỏi Cloud
      if (action === 'delete_survey_event' && deletedTargetName && Array.isArray(cachedSurveyFeedbacks)) {
        cachedSurveyFeedbacks = cachedSurveyFeedbacks.filter((f: any) => f.event !== deletedTargetName)
        await saveSetting(
          'issac_survey_feedbacks_cloud',
          JSON.stringify(cachedSurveyFeedbacks),
          'Cloud synchronized survey feedbacks for iSSAC Web'
        )
      }

      await saveSetting(
        'issac_deleted_survey_event_ids',
        JSON.stringify(cachedDeletedSurveyEventIds),
        'Cloud synchronized deleted survey event IDs for iSSAC Web'
      )
    }

    if (surveyEvents !== undefined) {
      if (cachedDeletedSurveyEventIds === null) {
        cachedDeletedSurveyEventIds = await loadSettingJson<string[]>(supabase, 'issac_deleted_survey_event_ids')
      }
      if (cachedSurveyEvents === null) {
        cachedSurveyEvents = await loadSettingJson<any[]>(supabase, 'issac_survey_events_cloud')
      }
      const activeDelSurveySet = new Set(cachedDeletedSurveyEventIds || [])
      const cleanSurveyEvents = Array.isArray(surveyEvents)
        ? surveyEvents.filter((e: any) => e?.id && !activeDelSurveySet.has(e.id))
        : surveyEvents
      cachedSurveyEvents = cleanSurveyEvents

      await saveSetting(
        'issac_survey_events_cloud',
        JSON.stringify(cleanSurveyEvents),
        'Cloud synchronized survey events for iSSAC Web'
      )
    }

    if (surveyFeedbacks !== undefined) {
      if (cachedSurveyFeedbacks === null) {
        cachedSurveyFeedbacks = await loadSettingJson<any[]>(supabase, 'issac_survey_feedbacks_cloud')
      }
      const fbMap = new Map<string, any>()
      const getFbKey = (f: any) =>
        f?.event && f?.targetMemberCode && f?.evaluatorMemberCode
          ? `${f.event}::${f.targetMemberCode}::${f.evaluatorMemberCode}`
          : String(f?.id || Math.random())

      const existingFb = Array.isArray(cachedSurveyFeedbacks) ? cachedSurveyFeedbacks : []
      for (const f of existingFb) {
        if (f) fbMap.set(getFbKey(f), f)
      }
      if (Array.isArray(surveyFeedbacks)) {
        for (const f of surveyFeedbacks) {
          if (!f) continue
          const k = getFbKey(f)
          const prev = fbMap.get(k)
          if (!prev) {
            fbMap.set(k, f)
          } else {
            const prevTime = prev.submittedAt ? new Date(prev.submittedAt).getTime() : 0
            const newTime = f.submittedAt ? new Date(f.submittedAt).getTime() : 0
            if (newTime >= prevTime) {
              fbMap.set(k, f)
            }
          }
        }
      }
      const mergedFeedbacks = Array.from(fbMap.values())
      cachedSurveyFeedbacks = mergedFeedbacks
      await saveSetting(
        'issac_survey_feedbacks_cloud',
        JSON.stringify(mergedFeedbacks),
        'Cloud synchronized survey feedbacks for iSSAC Web'
      )
    }

    if (surveyCustomQuestions !== undefined) {
      if (cachedSurveyCustomQuestions === null) {
        cachedSurveyCustomQuestions = await loadSettingJson<Record<string, any>>(supabase, 'issac_survey_custom_questions_cloud')
      }
      cachedSurveyCustomQuestions = {
        ...(cachedSurveyCustomQuestions || {}),
        ...surveyCustomQuestions,
      }
      await saveSetting(
        'issac_survey_custom_questions_cloud',
        JSON.stringify(cachedSurveyCustomQuestions),
        'Cloud synchronized survey custom questions for iSSAC Web'
      )
    }

    if (bcnSurveyNotes !== undefined && typeof bcnSurveyNotes === 'object') {
      if (cachedBcnSurveyNotes === null) {
        cachedBcnSurveyNotes = await loadSettingJson<Record<string, string>>(supabase, 'issac_bcn_survey_notes_cloud')
      }
      cachedBcnSurveyNotes = {
        ...(cachedBcnSurveyNotes || {}),
        ...bcnSurveyNotes,
      }
      await saveSetting(
        'issac_bcn_survey_notes_cloud',
        JSON.stringify(cachedBcnSurveyNotes),
        'Cloud synchronized BCN survey notes for iSSAC Web'
      )
    }

    return NextResponse.json({
      success: true,
      events: cachedEvents,
      activeEventId: cachedActiveEventId || '',
      proposals: cachedProposals,
      members: cachedMembers,
      disputes: cachedDisputes,
      periods: cachedPeriods,
      activePeriodId: cachedActivePeriodId || 'month-2026-11',
      customPeriodScores: cachedPeriodScores,
      customRules: cachedCustomRules || [],
      deletedProposalIds: cachedDeletedProposalIds || [],
      deletedEventIds: cachedDeletedEventIds || [],
      deletedPeriodIds: cachedDeletedPeriodIds || [],
      accounts: cachedAccounts,
      deletedAccountIds: cachedDeletedAccountIds || [],
      deletedMemberCodes: cachedDeletedMemberCodes || [],
      activities: cachedActivities,
      deletedActivityIds: cachedDeletedActivityIds || [],
      schedulePendingRequests: cachedSchedulePendingRequests || [],
      surveyEvents: cachedSurveyEvents,
      surveyFeedbacks: cachedSurveyFeedbacks || [],
      deletedSurveyEventIds: cachedDeletedSurveyEventIds || [],
      surveyCustomQuestions: cachedSurveyCustomQuestions || {},
      bcnSurveyNotes: cachedBcnSurveyNotes || {},
      cloudSynced: dbSuccess,
      cloudNote: dbSuccess
        ? 'Đã đồng bộ trực tiếp lên cơ sở dữ liệu Supabase Cloud'
        : `Dữ liệu đang đồng bộ qua server memory cache (${dbErrorMsg || 'Cần cấp quyền SQL hoặc service_role'}). Hãy chạy script SQL mở RLS hoặc cấp SUPABASE_SERVICE_ROLE_KEY để lưu vĩnh viễn.`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
