export type AnalyticsEventName =
  | 'auth_signup_success'
  | 'auth_login_success'
  | 'session_started'
  | 'question_answered'
  | 'session_completed'
  | 'import_used'
  | 'day7_retained'

export interface Attribution {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

export interface AnalyticsEvent {
  event_name: AnalyticsEventName
  session_id?: string
  user_id?: number
  timestamp: string
  properties?: Record<string, unknown>
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}
