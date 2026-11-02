import enum


class MemberRole(str, enum.Enum):
    candidate = "candidate"
    recruiter = "recruiter"
    agency_manager = "agency_manager"
    org_admin = "org_admin"
    platform_admin = "platform_admin"


class InvitationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    revoked = "revoked"
    expired = "expired"


class SubscriptionStatus(str, enum.Enum):
    trial = "trial"
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    none = "none"


class ResumeStatus(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    ready = "ready"
    failed = "failed"
