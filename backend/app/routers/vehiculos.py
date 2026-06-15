from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.exc import IntegrityError

from sqlalchemy.orm import Session



from app.crud import vehiculo as crud_vehiculo

from app.database import obtener_sesion

from app.dependencies.auth import requiere_rol

from app.models.usuario import Usuario

from app.schemas.vehiculo import VehiculoActualizar, VehiculoCrear, VehiculoRespuesta



router = APIRouter(prefix="/vehiculos", tags=["Vehículos"])



admin_o_administrador = requiere_rol("admin", "administrador")
_staff_listar_flota = requiere_rol("admin", "administrador", "asesor")





@router.get("", response_model=list[VehiculoRespuesta])
def listar(
    _: Usuario = Depends(_staff_listar_flota),
    db: Session = Depends(obtener_sesion),
):
    return crud_vehiculo.listar(db)





@router.get("/{id_vehiculo}", response_model=VehiculoRespuesta)

def obtener(

    id_vehiculo: int,

    _: Usuario = Depends(admin_o_administrador),

    db: Session = Depends(obtener_sesion),

):

    veh = crud_vehiculo.obtener_por_id(db, id_vehiculo)

    if not veh:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehículo no encontrado.")

    return veh





@router.post("", response_model=VehiculoRespuesta, status_code=status.HTTP_201_CREATED)

def crear(

    datos: VehiculoCrear,

    _: Usuario = Depends(admin_o_administrador),

    db: Session = Depends(obtener_sesion),

):

    if crud_vehiculo.obtener_por_placa(db, datos.placa):

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=f"Ya existe un vehículo con la placa {datos.placa}.",

        )



    try:

        return crud_vehiculo.crear(db, datos)

    except IntegrityError:

        db.rollback()

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="No se pudo guardar el vehículo (placa duplicada).",

        ) from None





@router.patch("/{id_vehiculo}", response_model=VehiculoRespuesta)

def actualizar(

    id_vehiculo: int,

    datos: VehiculoActualizar,

    _: Usuario = Depends(admin_o_administrador),

    db: Session = Depends(obtener_sesion),

):

    veh = crud_vehiculo.obtener_por_id(db, id_vehiculo)

    if not veh:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehículo no encontrado.")



    if datos.placa is not None:

        otro = crud_vehiculo.obtener_por_placa(db, datos.placa)

        if otro and otro.id_vehiculo != id_vehiculo:

            raise HTTPException(

                status_code=status.HTTP_400_BAD_REQUEST,

                detail=f"Ya existe otro vehículo con la placa {datos.placa}.",

            )



    try:

        actualizado = crud_vehiculo.actualizar(db, id_vehiculo, datos)

    except IntegrityError:

        db.rollback()

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="No se pudo actualizar el vehículo (placa duplicada).",

        ) from None



    if not actualizado:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehículo no encontrado.")

    return actualizado





@router.delete("/{id_vehiculo}", status_code=status.HTTP_204_NO_CONTENT)

def eliminar(

    id_vehiculo: int,

    _: Usuario = Depends(admin_o_administrador),

    db: Session = Depends(obtener_sesion),

):

    if not crud_vehiculo.obtener_por_id(db, id_vehiculo):

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehículo no encontrado.")



    if crud_vehiculo.cuenta_viajes_con_vehiculo(db, id_vehiculo) > 0:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="No se puede eliminar: hay viajes asociados a este vehículo.",

        )



    try:

        crud_vehiculo.eliminar(db, id_vehiculo)

    except IntegrityError:

        db.rollback()

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="No se puede eliminar el vehículo (hay datos relacionados).",

        ) from None

