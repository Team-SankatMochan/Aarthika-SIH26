from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.models.scheme import Scheme, SchemeRule
from app.schemas.scheme import SchemeCreate, SchemeResponse, SchemeRuleCreate, SchemeRuleResponse

router = APIRouter(prefix="/schemes", tags=["Schemes & Financial Rules"])


@router.post("", response_model=SchemeResponse, status_code=status.HTTP_201_CREATED)
def create_scheme(scheme_in: SchemeCreate, db: Session = Depends(get_db)):
    """Create a new government financing scheme."""
    db_obj = Scheme(
        id=scheme_in.id or None,
        scheme_name=scheme_in.scheme_name,
        scheme_type=scheme_in.scheme_type,
        description=scheme_in.description,
        active=scheme_in.active,
    )
    db.add(db_obj)
    db.flush()

    if scheme_in.rules:
        for r in scheme_in.rules:
            r_data = r.model_dump(exclude_unset=True)
            r_data["scheme_id"] = db_obj.id
            rule_obj = SchemeRule(**r_data)
            db.add(rule_obj)

    db.commit()
    db.refresh(db_obj)
    return db_obj


@router.get("", response_model=List[SchemeResponse])
def list_schemes(active_only: bool = True, db: Session = Depends(get_db)):
    """List available financing schemes with their associated active rules."""
    query = select(Scheme)
    if active_only:
        query = query.where(Scheme.active == True)
    return db.scalars(query).all()


@router.get("/{scheme_id}", response_model=SchemeResponse)
def get_scheme(scheme_id: str, db: Session = Depends(get_db)):
    """Retrieve details and rules of a specific scheme."""
    scheme = db.get(Scheme, scheme_id)
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found")
    return scheme


@router.post("/{scheme_id}/rules", response_model=SchemeRuleResponse, status_code=status.HTTP_201_CREATED)
def add_scheme_rule(scheme_id: str, rule_in: SchemeRuleCreate, db: Session = Depends(get_db)):
    """Add a new configurable rule to a government scheme."""
    scheme = db.get(Scheme, scheme_id)
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found")

    data = rule_in.model_dump(exclude_unset=True)
    data["scheme_id"] = scheme_id
    rule_obj = SchemeRule(**data)
    db.add(rule_obj)
    db.commit()
    db.refresh(rule_obj)
    return rule_obj
