import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_email(*, to: str, subject: str, body: str) -> None:
    """Send email via configured backend.

    With EMAIL_BACKEND=console, messages are logged only.
    SMTP delivery requires SMTP_HOST (and credentials when needed).
    We never claim delivery succeeded without a configured provider.
    """
    settings = get_settings()
    if settings.email_backend == "console":
        logger.info(
            "EMAIL_CONSOLE to=%s subject=%s body=%s",
            to,
            subject,
            body.replace("\n", " | "),
        )
        return

    if not settings.smtp_host:
        raise RuntimeError(
            "EMAIL_BACKEND is not console but SMTP_HOST is unset. "
            "Configure SMTP or set EMAIL_BACKEND=console."
        )

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        if settings.smtp_user and settings.smtp_password:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
