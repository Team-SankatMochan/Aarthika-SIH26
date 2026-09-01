from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationResponse

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(location_in: LocationCreate, db: Session = Depends(get_db)):
    """Create a new geographic location."""
    db_obj = Location(**location_in.model_dump(exclude_unset=True))
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


@router.get("", response_model=List[LocationResponse])
def list_locations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List registered locations."""
    return db.scalars(select(Location).offset(skip).limit(limit)).all()


@router.get("/{location_id}", response_model=LocationResponse)
def get_location(location_id: str, db: Session = Depends(get_db)):
    """Retrieve location details by ID."""
    loc = db.get(Location, location_id)
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return loc
