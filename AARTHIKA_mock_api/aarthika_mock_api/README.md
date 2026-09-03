# AARTHIKA Mock Government Data API

Demo-only FastAPI service for the AARTHIKA prototype.

## What it mocks

1. **Agmarknet-style market data**
   - Commodity
   - Commodity group
   - State / district / market
   - Arrival date
   - Minimum, maximum and modal price
   - Arrivals

2. **Government scheme directory**
   - PMEGP
   - PM Vishwakarma
   - ESDP
   - NSSH
   - Coir Vikas Yojana

3. **e-Way Bill-style integration**
   - Authentication
   - Generate mock e-way bill
   - Get mock e-way bill
   - Validate shipment data

4. **AARTHIKA business-context endpoint**
   - Combines market information with simple risk indicators and recommended checks.

## Important

This is **NOT an official Government of India API**.

Market-price records are synthetic demo values. The endpoint shapes are inspired by the official systems, not a claim that these endpoints are their live production endpoints.

The official e-Way Bill documentation describes REST APIs over HTTPS and includes authentication, generation and retrieval operations. Current documentation is version 1.03.

## Run

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt

uvicorn main:app --reload
```

Open:

http://127.0.0.1:8000/docs

## Main endpoints

### Market prices

```http
GET /api/v1/market-prices
GET /api/v1/market-prices?commodity=Tomato&state=Karnataka
GET /api/v1/market-prices?commodity=Onion&market=Lasalgaon
```

### Schemes

```http
GET /api/v1/schemes
GET /api/v1/schemes?category=finance
GET /api/v1/schemes/PMEGP
GET /api/v1/schemes/PM_VISHWAKARMA
```

### e-Way Bill

First get a mock token:

```http
POST /api/v1/ewaybill/auth
Content-Type: application/json

{
  "username": "demo",
  "password": "demo"
}
```

Then generate:

```http
POST /api/v1/ewaybill/generate
authtoken: MOCK-your-token
Content-Type: application/json
```

```json
{
  "gstin": "29ABCDE1234F1Z5",
  "document_number": "INV-10027",
  "document_date": "2026-09-02",
  "from_pincode": "563101",
  "to_pincode": "560001",
  "taxable_value": 180000,
  "total_invoice_value": 212400,
  "transporter_id": "MOCKTRANS001",
  "vehicle_number": "KA01AB1234",
  "transport_mode": "ROAD"
}
```

### AARTHIKA risk context

```http
GET /api/v1/business-context?commodity=Tomato&state=Karnataka
```

This is the endpoint you can call from the AARTHIKA risk/feasibility engine.

## Official references used for API shape

- Agmarknet: https://agmarknet.gov.in/home
- e-Way Bill API documentation: https://docs.ewaybillgst.gov.in/apidocs/api-overview.html
- API Setu directory: https://directory.apisetu.gov.in/search
