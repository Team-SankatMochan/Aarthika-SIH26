from fastapi import FastAPI, Query, Header, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
import uuid

app = FastAPI(
    title="AARTHIKA Mock Government Data API",
    description="Demo-only mock API for the AARTHIKA hackathon prototype. NOT an official government API.",
    version="1.0.0"
)

# -------------------------------------------------------------------
# MOCK DATA
# Modeled on the kinds of data exposed by Agmarknet, e-Way Bill APIs,
# API Setu / government-service directories, and MSME scheme information.
# Values below are synthetic demo values unless explicitly described
# as scheme facts in the README.
# -------------------------------------------------------------------

MARKET_PRICES = [
    {
        "commodity": "Tomato",
        "commodity_group": "Vegetables",
        "state": "Karnataka",
        "district": "Kolar",
        "market": "Kolar",
        "arrival_date": "2026-09-02",
        "unit": "Rs/quintal",
        "min_price": 1800,
        "max_price": 2600,
        "modal_price": 2200,
        "arrivals_qtl": 1840
    },
    {
        "commodity": "Onion",
        "commodity_group": "Vegetables",
        "state": "Maharashtra",
        "district": "Nashik",
        "market": "Lasalgaon",
        "arrival_date": "2026-09-02",
        "unit": "Rs/quintal",
        "min_price": 2100,
        "max_price": 3200,
        "modal_price": 2750,
        "arrivals_qtl": 3210
    },
    {
        "commodity": "Wheat",
        "commodity_group": "Cereals",
        "state": "Madhya Pradesh",
        "district": "Indore",
        "market": "Indore",
        "arrival_date": "2026-09-02",
        "unit": "Rs/quintal",
        "min_price": 2350,
        "max_price": 2850,
        "modal_price": 2600,
        "arrivals_qtl": 2480
    },
    {
        "commodity": "Mustard",
        "commodity_group": "Oil Seeds",
        "state": "Rajasthan",
        "district": "Alwar",
        "market": "Alwar",
        "arrival_date": "2026-09-02",
        "unit": "Rs/quintal",
        "min_price": 5200,
        "max_price": 6100,
        "modal_price": 5650,
        "arrivals_qtl": 1260
    },
    {
        "commodity": "Dairy",
        "commodity_group": "Livestock Products",
        "state": "Maharashtra",
        "district": "Latur",
        "market": "Ausa",
        "arrival_date": "2026-09-02",
        "unit": "Rs/litre",
        "min_price": 48,
        "max_price": 60,
        "modal_price": 55,
        "arrivals_qtl": 620
    }
]

SCHEMES = [
    {
        "scheme_id": "PMEGP",
        "name": "Prime Minister's Employment Generation Programme",
        "category": "finance",
        "target": "New micro-enterprises in rural and urban non-farm sectors",
        "max_project_cost": {
            "manufacturing": 5000000,
            "business_service": 2000000
        },
        "margin_money_subsidy": {
            "general_rural": 0.25,
            "general_urban": 0.15,
            "special_rural": 0.35,
            "special_urban": 0.25
        },
        "eligibility_checks": [
            "New micro-enterprise",
            "Udyam registration required before physical verification/margin-money adjustment"
        ]
    },
    {
        "scheme_id": "PM_VISHWAKARMA",
        "name": "PM Vishwakarma",
        "category": "finance",
        "target": "Traditional artisans and craftspeople in 18 identified trades",
        "credit_limit": 300000,
        "interest_rate_percent": 5,
        "credit_tranches": [100000, 200000],
        "toolkit_incentive": 15000,
        "training_stipend_per_day": 500,
        "benefits": [
            "Recognition",
            "Skill training",
            "Toolkit incentive",
            "Collateral-free credit",
            "Digital transaction incentives",
            "Market linkage"
        ]
    },
    {
        "scheme_id": "ESDP",
        "name": "Entrepreneurship and Skill Development Programme",
        "category": "skill",
        "target": "Entrepreneurship and skill development for MSME ecosystem participants",
        "benefits": [
            "Entrepreneurship development",
            "Skill development"
        ]
    },
    {
        "scheme_id": "NSSH",
        "name": "National SC-ST Hub",
        "category": "market",
        "target": "SC/ST entrepreneurs",
        "procurement_target_percent": 4,
        "benefits": [
            "Market access",
            "Procurement support",
            "Capacity building"
        ]
    },
    {
        "scheme_id": "COIR_VIKAS",
        "name": "Coir Vikas Yojana",
        "category": "industry",
        "target": "Coir sector development",
        "benefits": [
            "Skill development",
            "Industry support",
            "Market development"
        ]
    }
]

EWAY_BILLS = {}

class EWayBillRequest(BaseModel):
    gstin: str = Field(..., min_length=15, max_length=15)
    document_number: str
    document_date: str
    from_pincode: str = Field(..., min_length=6, max_length=6)
    to_pincode: str = Field(..., min_length=6, max_length=6)
    taxable_value: float
    total_invoice_value: float
    transporter_id: Optional[str] = None
    vehicle_number: Optional[str] = None
    transport_mode: str = "ROAD"

class AuthRequest(BaseModel):
    username: str
    password: str

class BusinessContextResponse(BaseModel):
    commodity: str
    state: str
    market_snapshot: list
    risk_indicators: dict
    recommended_checks: list

@app.get("/")
def root():
    return {
        "app": "AARTHIKA Mock Government Data API",
        "status": "running",
        "mock": True,
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "ok", "mock": True}

# -------------------------------------------------------------------
# Agmarknet-style market data
# -------------------------------------------------------------------

@app.get("/api/v1/market-prices")
def market_prices(
    commodity: Optional[str] = None,
    state: Optional[str] = None,
    market: Optional[str] = None
):
    data = MARKET_PRICES

    if commodity:
        data = [x for x in data if x["commodity"].lower() == commodity.lower()]
    if state:
        data = [x for x in data if x["state"].lower() == state.lower()]
    if market:
        data = [x for x in data if x["market"].lower() == market.lower()]

    return {
        "status": "SUCCESS",
        "source": "AGMARKNET_MOCK",
        "count": len(data),
        "data": data
    }

# -------------------------------------------------------------------
# Government scheme / API Setu-style directory data
# -------------------------------------------------------------------

@app.get("/api/v1/schemes")
def schemes(category: Optional[str] = None):
    data = SCHEMES
    if category:
        data = [x for x in data if x["category"].lower() == category.lower()]

    return {
        "status": "SUCCESS",
        "source": "GOVERNMENT_SCHEME_DIRECTORY_MOCK",
        "count": len(data),
        "data": data
    }

@app.get("/api/v1/schemes/{scheme_id}")
def scheme_detail(scheme_id: str):
    for scheme in SCHEMES:
        if scheme["scheme_id"].lower() == scheme_id.lower():
            return {
                "status": "SUCCESS",
                "source": "GOVERNMENT_SCHEME_DIRECTORY_MOCK",
                "data": scheme
            }

    raise HTTPException(status_code=404, detail="Scheme not found")

# -------------------------------------------------------------------
# Simplified e-Way Bill-style API
# -------------------------------------------------------------------

@app.post("/api/v1/ewaybill/auth")
def ewaybill_auth(request: AuthRequest):
    # Demo token only. Never use real credentials here.
    return {
        "status": 1,
        "authtoken": "MOCK-" + uuid.uuid4().hex[:24],
        "expires_in_minutes": 360,
        "mock": True
    }

@app.post("/api/v1/ewaybill/generate")
def generate_ewaybill(
    request: EWayBillRequest,
    authtoken: Optional[str] = Header(default=None)
):
    if not authtoken:
        raise HTTPException(status_code=401, detail="Mock authtoken required")

    if request.transport_mode.upper() not in ["ROAD", "RAIL", "AIR", "SHIP"]:
        raise HTTPException(status_code=400, detail="Invalid transport mode")

    ewb_no = int("9" + str(abs(hash(request.document_number)))[:11])

    bill = {
        "ewayBillNo": ewb_no,
        "ewayBillDate": datetime.now().strftime("%d/%m/%Y %I:%M:%S %p"),
        "validUpto": "03/09/2026 11:59:59 PM",
        "status": "ACTIVE",
        "gstin": request.gstin,
        "documentNumber": request.document_number,
        "documentDate": request.document_date,
        "fromPincode": request.from_pincode,
        "toPincode": request.to_pincode,
        "taxableValue": request.taxable_value,
        "totalInvoiceValue": request.total_invoice_value,
        "transporterId": request.transporter_id,
        "vehicleNumber": request.vehicle_number,
        "transportMode": request.transport_mode.upper(),
        "mock": True
    }

    EWAY_BILLS[str(ewb_no)] = bill

    return {
        "status": 1,
        "data": bill,
        "message": "Mock e-way bill generated successfully"
    }

@app.get("/api/v1/ewaybill/{ewb_no}")
def get_ewaybill(
    ewb_no: str,
    authtoken: Optional[str] = Header(default=None)
):
    if not authtoken:
        raise HTTPException(status_code=401, detail="Mock authtoken required")

    bill = EWAY_BILLS.get(ewb_no)
    if not bill:
        # Return a deterministic demo record for frontend testing.
        bill = {
            "ewayBillNo": int(ewb_no),
            "ewayBillDate": "02/09/2026 10:30:00 AM",
            "validUpto": "03/09/2026 11:59:59 PM",
            "status": "ACTIVE",
            "documentNumber": "INV-DEMO-1001",
            "fromPincode": "563101",
            "toPincode": "560001",
            "taxableValue": 180000,
            "totalInvoiceValue": 212400,
            "transportMode": "ROAD",
            "mock": True
        }

    return {
        "status": 1,
        "data": bill
    }

@app.post("/api/v1/ewaybill/validate")
def validate_ewaybill(request: EWayBillRequest):
    warnings = []

    if request.taxable_value <= 0:
        warnings.append("Taxable value must be greater than zero")
    if request.total_invoice_value < request.taxable_value:
        warnings.append("Invoice value is lower than taxable value")
    if request.from_pincode == request.to_pincode:
        warnings.append("Source and destination PIN codes are identical")

    return {
        "status": "VALID" if not warnings else "REVIEW",
        "mock": True,
        "warnings": warnings,
        "risk_score": 12 if not warnings else 48
    }

# -------------------------------------------------------------------
# AARTHIKA business-risk context endpoint
# -------------------------------------------------------------------

@app.get("/api/v1/business-context")
def business_context(
    commodity: str,
    state: str
):
    def _matches(record_state: str, query: str) -> bool:
        # Accept full or partial state names, e.g. "Maharashtra" matches
        # a query of "Ausa, Latur, Maharashtra".
        return record_state.lower() in query.lower() or query.lower() in record_state.lower()

    market = [
        x for x in MARKET_PRICES
        if x["commodity"].lower() == commodity.lower()
        and _matches(x["state"], state)
    ]

    if not market:
        return {
            "commodity": commodity,
            "state": state,
            "market_snapshot": [],
            "risk_indicators": {
                "data_availability": "LOW",
                "price_volatility": "UNKNOWN"
            },
            "recommended_checks": [
                "Collect local mandi price history",
                "Validate supplier and buyer information",
                "Estimate working-capital requirement"
            ]
        }

    m = market[0]
    spread = round((m["max_price"] - m["min_price"]) / m["modal_price"] * 100, 2)

    return {
        "commodity": commodity,
        "state": state,
        "market_snapshot": market,
        "risk_indicators": {
            "price_spread_percent": spread,
            "arrival_pressure": "HIGH" if m["arrivals_qtl"] > 2500 else "MEDIUM",
            "data_availability": "HIGH"
        },
        "recommended_checks": [
            "Compare purchase price with modal market price",
            "Check recent price trend before stocking",
            "Estimate inventory holding period",
            "Validate GST/e-way bill information where applicable",
            "Check eligibility for relevant MSME schemes"
        ]
    }
