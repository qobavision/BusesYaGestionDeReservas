from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session



from app.crud import viaje as crud_viaje

from app.database import obtener_sesion

from app.dependencies.auth import requiere_rol

from app.models.usuario import Usuario

from app.schemas.viaje import ViajeAsignarPanel, ViajeEstadoConductorPatch, ViajePanelLista



router = APIRouter(prefix="/viajes", tags=["Viajes"])



_staff_viajes_listar = requiere_rol("admin", "administrador", "asesor")

_solo_conductor_viajes = requiere_rol("conductor")

_solo_asesor_asignar = requiere_rol("admin", "administrador", "asesor")





@router.get(

    "",

    response_model=list[ViajePanelLista],

    summary="Panel — listar viajes (reserva confirmada, código VI-NNNN)",

)

def viajes_panel_listar(

    _: Usuario = Depends(_staff_viajes_listar),

    db: Session = Depends(obtener_sesion),

):

    return crud_viaje.listar_para_panel(db)






@router.get(

    "/mis-asignados",

    response_model=list[ViajePanelLista],

    summary="Conductor — listar viajes asignados a mi empleado vinculado",

)

def viajes_mis_asignados(

    usuario: Usuario = Depends(_solo_conductor_viajes),

    db: Session = Depends(obtener_sesion),

):

    if usuario.id_empleado is None:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,

            detail="Tu cuenta no está vinculada a un empleado conductor. El administrador debe vincular tu usuario a tu ficha en Empleados.",

        )

    return crud_viaje.listar_para_panel(db, id_empleado_conductor=usuario.id_empleado)


@router.patch(
    "/{id_viaje}/estado-conductor",
    response_model=ViajePanelLista,
    summary="Conductor — marcar pendiente, en camino o finalizado",
)
def viajes_estado_conductor(
    id_viaje: int,
    datos: ViajeEstadoConductorPatch,
    usuario: Usuario = Depends(_solo_conductor_viajes),
    db: Session = Depends(obtener_sesion),
):
    if usuario.id_empleado is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu cuenta no está vinculada a un empleado conductor. El administrador debe vincular tu usuario a tu ficha en Empleados.",
        )
    try:
        viaje = crud_viaje.actualizar_estado_por_conductor(
            db, id_viaje, usuario.id_empleado, datos.estado
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)
        ) from err
    if not viaje:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Viaje no encontrado o no está asignado a tu cuenta.",
        )
    lista = crud_viaje.listar_para_panel(
        db, id_empleado_conductor=usuario.id_empleado
    )
    item = next((x for x in lista if x.id_viaje == id_viaje), None)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo leer el viaje después de actualizar el estado.",
        )
    return item


@router.patch(

    "/{id_viaje}/asignar",

    response_model=ViajePanelLista,

    summary="Asesor — asignar vehículo y conductor",

)

def viajes_asignar_flota(

    id_viaje: int,

    datos: ViajeAsignarPanel,

    _: Usuario = Depends(_solo_asesor_asignar),

    db: Session = Depends(obtener_sesion),

):

    try:

        viaje = crud_viaje.asignar_vehiculo_conductor(

            db,

            id_viaje,

            datos.id_vehiculo,

            datos.id_empleado,

        )

    except ValueError as err:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)

        ) from err



    if not viaje:

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,

            detail="Viaje no encontrado o la reserva aún no está confirmada.",

        )



    lista = crud_viaje.listar_para_panel(db)

    item = next((x for x in lista if x.id_viaje == id_viaje), None)

    if not item:

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail="No se pudo leer el viaje después de asignar.",

        )

    return item

