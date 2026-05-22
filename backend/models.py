from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class IPAddress(Base):
    __tablename__ = "ip_addresses"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, unique=True, nullable=False, index=True)
    label = Column(String, nullable=True)
    hostname = Column(String, nullable=True)
    pool_name = Column(String, default="default", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    domain_rules = relationship("IPDomainRule", back_populates="ip_address", cascade="all, delete-orphan")


class DomainRule(Base):
    __tablename__ = "domain_rules"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, unique=True, nullable=False, index=True)
    max_per_minute = Column(Integer, default=10)
    max_per_hour = Column(Integer, default=200)
    max_per_day = Column(Integer, default=2000)
    max_connections = Column(Integer, default=10)
    max_message_rate = Column(String, default="10/min")
    egress_pool = Column(String, nullable=True)   # None = use default pool
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    ip_rules = relationship("IPDomainRule", back_populates="domain_rule", cascade="all, delete-orphan")


class IPDomainRule(Base):
    """Per-IP override for a specific domain."""
    __tablename__ = "ip_domain_rules"

    id = Column(Integer, primary_key=True, index=True)
    ip_id = Column(Integer, ForeignKey("ip_addresses.id"), nullable=False)
    domain_rule_id = Column(Integer, ForeignKey("domain_rules.id"), nullable=False)
    max_per_minute = Column(Integer, nullable=True)
    max_per_hour = Column(Integer, nullable=True)
    max_per_day = Column(Integer, nullable=True)
    max_connections = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ip_address = relationship("IPAddress", back_populates="domain_rules")
    domain_rule = relationship("DomainRule", back_populates="ip_rules")


class DKIMKey(Base):
    __tablename__ = "dkim_keys"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, nullable=False, index=True)
    selector = Column(String, nullable=False, default="kumomta")
    private_key = Column(Text, nullable=False)
    public_key = Column(Text, nullable=False)
    dns_record = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SuppressedEmail(Base):
    """Emails that permanently bounced — never send to these again."""
    __tablename__ = "suppressed_emails"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    reason = Column(String, nullable=True)        # e.g. "550 5.1.1 user not found"
    bounce_code = Column(Integer, nullable=True)  # e.g. 550
    source = Column(String, default="bounce")     # "bounce" or "manual"
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EmailLog(Base):
    """Realtime delivery log events pushed by KumoMTA via webhook."""
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False, index=True)   # Reception, Delivery, Bounce, etc.
    message_id = Column(String, nullable=True, index=True)
    sender = Column(String, nullable=True)
    recipient = Column(String, nullable=True)
    queue = Column(String, nullable=True)
    site = Column(String, nullable=True)
    response_code = Column(Integer, nullable=True)
    response_message = Column(String, nullable=True)
    peer_ip = Column(String, nullable=True)
    egress_pool = Column(String, nullable=True)
    egress_source = Column(String, nullable=True)
    size = Column(Integer, nullable=True)
    num_attempts = Column(Integer, nullable=True)
    bounce_class = Column(String, nullable=True)
    event_time = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
