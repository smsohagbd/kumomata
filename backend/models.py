from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class IPAddress(Base):
    __tablename__ = "ip_addresses"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, unique=True, nullable=False, index=True)
    label = Column(String, nullable=True)
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


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
