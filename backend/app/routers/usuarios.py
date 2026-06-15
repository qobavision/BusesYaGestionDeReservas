from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crud import empleado as crud_empleado
from app.crud import rol as crud_rol
from app.crud import usuario as crud_usuario
from app.database import obtener_sesion
from app.dependencies.auth import requiere_rol
from app.models.usuario import Usuario
from app.schemas.usuario import (
    UsuarioAdministradorActualizar,
    UsuarioAdministradorCrear,
    UsuarioAdministradorLista,
    UsuarioActualizar,
    UsuarioCrear,
)

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

admin_o_administrador = requiere_rol("admin", "administrador")


def _usuario_panel_item(db: Session, us: Usuario) -> UsuarioAdministradorLista:
    rl = crud_rol.obtener_por_id(db, us.id_rol)
    nombre_emp = "—"
    if us.id_empleado is not None:
        emp = crud_empleado.obtener_por_id(db, us.id_empleado)
        if emp is not None:
            nombre_emp = f"{emp.nombre} {emp.apellido}".strip()
    return UsuarioAdministradorLista(
        id_usuario=us.id_usuario,
        nombre_usuario=us.nombre_usuario,
        correo=us.correo,
        id_rol=us.id_rol,
        nombre_rol=(rl.nombre_rol if rl else ""),
        id_empleado=us.id_empleado,
        nombre_empleado=nombre_emp or "—",
        estado=us.estado,
    )


@router.get("", response_model=list[UsuarioAdministradorLista])
def listar_para_panel(
    _: Usuario = Depends(admin_o_administrador),
    db: Session = Depends(obtener_sesion),
):
    ordenados = db.query(Usuario).order_by(Usuario.nombre_usuario).all()
    return [_usuario_panel_item(db, u) for u in ordenados]


@router.get("/{id_usuario}", response_model=UsuarioAdministradorLista)
def obtener_uno(
    id_usuario: int,
    _: Usuario = Depends(admin_o_administrador),
    db: Session = Depends(obtener_sesion),
):
    u = crud_usuario.obtener_por_id(db, id_usuario)
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    return _usuario_panel_item(db, u)


@router.patch("/{id_usuario}", response_model=UsuarioAdministradorLista)
def actualizar_desde_panel(
    id_usuario: int,
    datos: UsuarioAdministradorActualizar,
    usuario_actual: Usuario = Depends(admin_o_administrador),
    db: Session = Depends(obtener_sesion),
):
    valores = datos.model_dump(exclude_unset=True, exclude_none=True)
    if not valores:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No hay cambios por aplicar.")

    existente = crud_usuario.obtener_por_id(db, id_usuario)
    if not existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    if "nombre_usuario" in valores:
        otro_nom = crud_usuario.obtener_por_nombre_usuario(db, valores["nombre_usuario"])
        if otro_nom and otro_nom.id_usuario != id_usuario:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe otro usuario con ese nombre de usuario.",
            )

    if "correo" in valores:
        otro_corr = crud_usuario.obtener_por_correo(db, str(valores["correo"]))
        if otro_corr and otro_corr.id_usuario != id_usuario:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe otro usuario registrado con ese correo.",
            )

    if "id_rol" in valores and valores["id_rol"] is not None:
        if not crud_rol.obtener_por_id(db, valores["id_rol"]):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El rol seleccionado no existe.")

    if (
        "estado" in valores
        and valores["estado"] is False
        and usuario_actual.id_usuario == id_usuario
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta.",
        )

    try:
        parche = UsuarioActualizar(**valores)
    except ValidationError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Correo o datos incorrectos. Ejemplo de correo: diego@busesya o diego@busesya.com",
        ) from None

    actualizado = crud_usuario.actualizar(db, id_usuario, parche)

    if not actualizado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    return _usuario_panel_item(db, actualizado)


@router.delete("/{id_usuario}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_usuario_panel(
    id_usuario: int,
    usuario_actual: Usuario = Depends(admin_o_administrador),
    db: Session = Depends(obtener_sesion),
):
    if usuario_actual.id_usuario == id_usuario:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes eliminar tu propia cuenta.")

    u = crud_usuario.obtener_por_id(db, id_usuario)
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    try:
        if not crud_usuario.eliminar_por_id(db, id_usuario):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo eliminar el usuario (hay datos relacionados).",
        ) from None


@router.post("", response_model=UsuarioAdministradorLista, status_code=status.HTTP_201_CREATED)
def crear_desde_panel(
    datos: UsuarioAdministradorCrear,
    _: Usuario = Depends(admin_o_administrador),
    db: Session = Depends(obtener_sesion),
):
    if not crud_rol.obtener_por_id(db, datos.id_rol):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El rol seleccionado no existe.")

    empleado_ficha = crud_empleado.obtener_por_id(db, datos.id_empleado)
    if not empleado_ficha:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El empleado seleccionado no existe.")

    if crud_usuario.obtener_por_id_empleado(db, datos.id_empleado):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ese empleado ya tiene un usuario del sistema vinculado.",
        )

    if crud_usuario.obtener_por_correo(db, str(datos.correo)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un usuario registrado con ese correo.",
        )

    if crud_usuario.obtener_por_nombre_usuario(db, datos.nombre_usuario):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un usuario con ese nombre de usuario.",
        )

    try:
        creado = crud_usuario.crear(
            db,
            UsuarioCrear(
                nombre_usuario=datos.nombre_usuario,
                correo=datos.correo,
                password=datos.password,
                id_rol=datos.id_rol,
                id_empleado=datos.id_empleado,
            ),
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo crear el usuario (datos duplicados u otro error de datos).",
        ) from None

    return _usuario_panel_item(db, creado)
