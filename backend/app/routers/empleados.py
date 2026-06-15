from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crud import empleado as crud_empleado
from app.database import obtener_sesion
from app.crud import rol as crud_rol
from app.dependencies.auth import obtener_usuario_actual, requiere_rol
from app.models.usuario import Usuario
from app.schemas.empleado import EmpleadoActualizar, EmpleadoCrear, EmpleadoRespuesta

router = APIRouter(prefix="/empleados", tags=["Empleados"])

admin_o_administrador = requiere_rol("admin", "administrador")


def _nombre_rol_usuario(db: Session, usuario: Usuario) -> str:
    rol = crud_rol.obtener_por_id(db, usuario.id_rol)
    return (rol.nombre_rol if rol else "").lower()


@router.get("", response_model=list[EmpleadoRespuesta])
def listar_panel(
    solo_sin_cuenta_sistema: bool = Query(
        False,
        description="Si es true: solo empleados sin usuario vinculado (para crear cuenta).",
    ),
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(obtener_sesion),
):
    nombre_rol = _nombre_rol_usuario(db, usuario)
    if solo_sin_cuenta_sistema:
        if nombre_rol not in ("admin", "administrador"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para esta acción",
            )
        return crud_empleado.listar_sin_cuenta_sistema(db)
    if nombre_rol not in ("admin", "administrador", "asesor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para esta acción",
        )
    return crud_empleado.listar_todos_ordenados(db)


@router.get("/{id_empleado}", response_model=EmpleadoRespuesta)
def obtener(
    id_empleado: int,
    _: Usuario = Depends(admin_o_administrador),
    db: Session = Depends(obtener_sesion),
):
    emp = crud_empleado.obtener_por_id(db, id_empleado)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empleado no encontrado.")
    return emp


@router.post("", response_model=EmpleadoRespuesta, status_code=status.HTTP_201_CREATED)
def crear(
    datos: EmpleadoCrear,
    _: Usuario = Depends(admin_o_administrador),
    db: Session = Depends(obtener_sesion),
):
    if crud_empleado.obtener_por_dni(db, datos.dni):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un empleado con el DNI {datos.dni}.",
        )
    try:
        return crud_empleado.crear(db, datos)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo guardar el empleado (DNI duplicado u otro error).",
        ) from None


@router.patch("/{id_empleado}", response_model=EmpleadoRespuesta)
def actualizar(
    id_empleado: int,
    datos: EmpleadoActualizar,
    _: Usuario = Depends(admin_o_administrador),
    db: Session = Depends(obtener_sesion),
):
    emp = crud_empleado.obtener_por_id(db, id_empleado)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empleado no encontrado.")

    if datos.dni is not None:
        otro = crud_empleado.obtener_por_dni(db, datos.dni)
        if otro and otro.id_empleado != id_empleado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe otro empleado con el DNI {datos.dni}.",
            )

    try:
        actualizado = crud_empleado.actualizar(db, id_empleado, datos)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo actualizar el empleado.",
        ) from None

    if not actualizado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empleado no encontrado.")
    return actualizado


@router.delete("/{id_empleado}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    id_empleado: int,
    usuario_actual: Usuario = Depends(admin_o_administrador),
    db: Session = Depends(obtener_sesion),
):
    if not crud_empleado.obtener_por_id(db, id_empleado):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empleado no encontrado.")

    try:
        crud_empleado.eliminar_con_cascada_admin(
            db,
            id_empleado,
            id_usuario_operador=usuario_actual.id_usuario,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        ) from err
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo eliminar el empleado (hay datos relacionados que impiden el borrado).",
        ) from None
