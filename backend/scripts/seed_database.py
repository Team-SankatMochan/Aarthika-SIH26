import sys
from pathlib import Path
from decimal import Decimal
from datetime import date

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import SessionLocal
from app.db.database import init_db
from app.models.location import Location
from app.models.user import User
from app.models.business import Business
from app.models.scheme import Scheme, SchemeRule
from app.models.business_assumption import BusinessAssumption
from app.models.market_data import MarketData
from app.models.evidence import Evidence


def seed():
    # Ensure tables exist
    init_db()
    
    db = SessionLocal()
    print("[*] Starting database seeding...")

    try:
        # 1. Micro Finance Scheme
        micro_scheme = db.query(Scheme).filter_by(scheme_name="Micro Finance Scheme").first()
        if not micro_scheme:
            micro_scheme = Scheme(
                scheme_name="Micro Finance Scheme",
                scheme_type="MICRO_FINANCE",
                description="Government micro-enterprise credit facility for rural and semi-urban micro-entrepreneurs.",
                active=True,
            )
            db.add(micro_scheme)
            db.flush()

            micro_rule = SchemeRule(
                scheme_id=micro_scheme.id,
                min_project_cost=Decimal("0.00"),
                max_project_cost=Decimal("140000.00"),
                financing_percentage=Decimal("90.00"),
                max_loan_amount=Decimal("125000.00"),
                annual_interest_rate=Decimal("6.50"),
                tenure_months=36,
                moratorium_months=3,
                effective_from=date(2024, 1, 1),
                effective_to=date(2028, 12, 31),
                active=True,
            )
            db.add(micro_rule)
            print("  [+] Created Micro Finance Scheme & Rule (Max Rs 1,25,000 @ 6.5%, 36m, 3m Moratorium)")

        # 2. Term Loan Scheme
        term_scheme = db.query(Scheme).filter_by(scheme_name="Term Loan Scheme").first()
        if not term_scheme:
            term_scheme = Scheme(
                scheme_name="Term Loan Scheme",
                scheme_type="TERM_LOAN",
                description="Government term loan assistance for small and medium rural commercial enterprises.",
                active=True,
            )
            db.add(term_scheme)
            db.flush()

            term_rule = SchemeRule(
                scheme_id=term_scheme.id,
                min_project_cost=Decimal("140000.01"),
                max_project_cost=Decimal("5000000.00"),
                financing_percentage=Decimal("90.00"),
                max_loan_amount=Decimal("4500000.00"),
                annual_interest_rate=Decimal("8.00"),
                tenure_months=84,
                moratorium_months=6,
                effective_from=date(2024, 1, 1),
                effective_to=date(2028, 12, 31),
                active=True,
            )
            db.add(term_rule)
            print("  [+] Created Term Loan Scheme & Rule (Max Rs 45,00,000 @ 8.0%, 84m, 6m Moratorium)")

        # 3. Demo Location (Latur, Maharashtra)
        demo_location = db.query(Location).filter_by(district="Latur", village_or_city="Ausa").first()
        if not demo_location:
            demo_location = Location(
                state="Maharashtra",
                district="Latur",
                block="Ausa",
                village_or_city="Ausa",
                latitude=Decimal("18.2467000"),
                longitude=Decimal("76.5025000"),
            )
            db.add(demo_location)
            db.flush()
            print("  [+] Created Demo Location: Ausa, Latur, Maharashtra")

        # 4. Demo Entrepreneur
        demo_user = db.query(User).filter_by(phone="+919876543210").first()
        if not demo_user:
            demo_user = User(
                name="Ramesh Patil (Demo Entrepreneur)",
                phone="+919876543210",
                location_id=demo_location.id,
                available_capital=Decimal("25000.00"),
                skills=["dairy_farming", "cattle_care", "milk_testing"],
                experience="4 years managing small family cattle unit",
                assets=["0.5 acre ancestral land", "borewell connection", "thatched cattle shed"],
                family_workforce=2,
                preferences={"target_business": "dairy", "preferred_tenure_years": 3},
                risk_tolerance="MODERATE",
            )
            db.add(demo_user)
            db.flush()
            print("  [+] Created Demo User: Ramesh Patil")

        # 5. Demo Dairy Business
        demo_business = db.query(Business).filter_by(business_name="Samruddhi Dairy Enterprise (Demo)").first()
        if not demo_business:
            demo_business = Business(
                user_id=demo_user.id,
                location_id=demo_location.id,
                business_name="Samruddhi Dairy Enterprise (Demo)",
                business_category="Dairy & Livestock",
                description="[DEMO DATA - NOT OFFICIAL STATS] Small dairy venture procuring and distributing fresh milk directly to village and semi-urban households in Ausa.",
                status="TESTING",
            )
            db.add(demo_business)
            db.flush()
            print("  [+] Created Demo Business: Samruddhi Dairy Enterprise")

            # 6. Demo Business Assumptions
            demo_assumptions = BusinessAssumption(
                business_id=demo_business.id,
                expected_customers=35,
                selling_price=Decimal("55.00"),
                production_volume=Decimal("80.00"),  # 80 Litres/day
                raw_material_cost=Decimal("34.00"),  # Feed & fodder per litre
                labour_cost=Decimal("4000.00"),      # Monthly helper
                rent=Decimal("1500.00"),             # Monthly shed maintenance/rent
                transport_cost=Decimal("1800.00"),   # Monthly motorcycle delivery fuel
                working_capital=Decimal("15000.00"), # Feed inventory buffer
                proposed_loan_amount=Decimal("120000.00"), # 2 quality HF crossbreed milch cows
                other_operating_cost=Decimal("1200.00"),
                assumption_source="ENTREPRENEUR",
                confidence=Decimal("0.75"),
            )
            db.add(demo_assumptions)

            # 7. Demo Market Data
            demo_market_data = MarketData(
                location_id=demo_location.id,
                business_id=demo_business.id,
                data_type="PRICING_SIGNAL",
                source="[MOCK/DEMO] Local Mandi Dairy Collection Rate",
                value=Decimal("52.00"),
                unit="INR/Litre",
                observation_date=date(2026, 8, 15),
                confidence=Decimal("0.85"),
                is_observed=True,
                is_estimated=False,
                metadata_json={"collector": "Demo Agricultural Field Officer", "sample_size": 12},
            )
            db.add(demo_market_data)

            # 8. Demo Traceable Evidence
            demo_evidence = Evidence(
                business_id=demo_business.id,
                evidence_type="DEMAND",
                source="[MOCK/DEMO] Direct Household Survey in Ausa Ward 3",
                description="32 out of 40 surveyed households confirmed willingness to buy morning delivered unadulterated milk at Rs 55/L.",
                value=Decimal("32.00"),
                confidence=Decimal("0.80"),
                is_observed=True,
                is_estimated=False,
            )
            db.add(demo_evidence)
            print("  [+] Created Demo Assumptions, Market Data & Evidence")

        db.commit()
        print("[OK] Database seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding error: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed()
