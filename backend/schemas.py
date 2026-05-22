from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
import ipaddress


class IPAddressCreate(BaseModel):
    ip: str
    label: Optional[str] = None
    pool_name: str = "default"
    is_active: bool = True

    @field_validator("ip")
    @classmethod
    def validate_ip(cls, v):
        try:
            ipaddress.ip_address(v)
        except ValueError:
            raise ValueError(f"Invalid IP address: {v}")
        return v


class IPAddressUpdate(BaseModel):
    label: Optional[str] = None
    pool_name: Optional[str] = None
    is_active: Optional[bool] = None


class IPAddressOut(BaseModel):
    id: int
    ip: str
    label: Optional[str]
    pool_name: str
    is_active: bool
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class DomainRuleCreate(BaseModel):
    domain: str
    max_per_minute: int = 10
    max_per_hour: int = 200
    max_per_day: int = 2000
    max_connections: int = 10
    notes: Optional[str] = None
    is_active: bool = True

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v):
        v = v.lower().strip()
        if not v or "." not in v:
            raise ValueError("Domain must be a valid domain name")
        return v


class DomainRuleUpdate(BaseModel):
    max_per_minute: Optional[int] = None
    max_per_hour: Optional[int] = None
    max_per_day: Optional[int] = None
    max_connections: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class DomainRuleOut(BaseModel):
    id: int
    domain: str
    max_per_minute: int
    max_per_hour: int
    max_per_day: int
    max_connections: int
    notes: Optional[str]
    is_active: bool
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class IPDomainRuleCreate(BaseModel):
    ip_id: int
    domain_rule_id: int
    max_per_minute: Optional[int] = None
    max_per_hour: Optional[int] = None
    max_per_day: Optional[int] = None
    max_connections: Optional[int] = None
    is_active: bool = True


class IPDomainRuleOut(BaseModel):
    id: int
    ip_id: int
    domain_rule_id: int
    max_per_minute: Optional[int]
    max_per_hour: Optional[int]
    max_per_day: Optional[int]
    max_connections: Optional[int]
    is_active: bool

    model_config = {"from_attributes": True}


class DKIMKeyCreate(BaseModel):
    domain: str
    selector: str = "kumomta"


class DKIMKeyOut(BaseModel):
    id: int
    domain: str
    selector: str
    public_key: str
    dns_record: Optional[str]
    is_active: bool
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    kumomta_host: Optional[str] = None
    kumomta_port: Optional[int] = None
    kumomta_api_port: Optional[int] = None
    config_dir: Optional[str] = None
    relay_hosts: Optional[str] = None


class SettingsOut(BaseModel):
    kumomta_host: str
    kumomta_port: int
    kumomta_api_port: int
    config_dir: str
    relay_hosts: str
