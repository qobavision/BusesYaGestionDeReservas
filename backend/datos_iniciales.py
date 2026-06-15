"""
Crea roles y un usuario de prueba para cada panel.
Ejecutar una vez: python datos_iniciales.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import app.database as base_datos
from app.crud import rol as crud_rol
from app.crud import usuario as crud_usuario
from app.database import inicializar_base_datos
from app.schemas.rol import RolCrear
from app.schemas.usuario import UsuarioCrear

ROLES = [
    ("admin", "Administrador del sistema"),
    ("asesor", "Asesor de ventas"),
    ("conductor", "Conductor de vehículos"),
]

USUARIOS_PRUEBA = [
    {
        "nombre_usuario": "yostonadmin",
        "correo": "yostonadmin@busesya.com",
        "password": "123456789",
        "rol": "admin",
    },
    {
        "nombre_usuario": "diegoadmin",
        "correo": "diegoadmin@busesya.com",
        "password": "123456789",
        "rol": "admin",
    },
    {
        "nombre_usuario": "yostonasesor",
        "correo": "yostonasesor@busesya.com",
        "password": "123456789",
        "rol": "asesor",
    },
    {
        "nombre_usuario": "yostonconductor",
        "correo": "yostonconductor@busesya.com",
        "password": "123456789",
        "rol": "conductor",
    },
]


def main():
    if not inicializar_base_datos():
        print("ERROR: Configura URL_BASE_DATOS en .env")
        sys.exit(1)

    db = base_datos.SesionLocal()
    try:
        print("Creando roles...")
        mapa_roles = {}
        for nombre, descripcion in ROLES:
            existente = crud_rol.obtener_por_nombre(db, nombre)
            if existente:
                mapa_roles[nombre] = existente.id_rol
                print(f"  - {nombre} (ya existe)")
            else:
                rol = crud_rol.crear(db, RolCrear(nombre_rol=nombre, descripcion=descripcion))
                mapa_roles[nombre] = rol.id_rol
                print(f"  - {nombre} creado")

        print("\nCreando usuarios de prueba...")
        for u in USUARIOS_PRUEBA:
            if crud_usuario.obtener_por_correo(db, u["correo"]):
                print(f"  - {u['correo']} (ya existe)")
                continue
            crud_usuario.crear(
                db,
                UsuarioCrear(
                    nombre_usuario=u["nombre_usuario"],
                    correo=u["correo"],
                    password=u["password"],
                    id_rol=mapa_roles[u["rol"]],
                ),
            )
            print(f"  - {u['correo']} / {u['password']} ({u['rol']})")

        print("\nListo. Puedes iniciar sesión con:")
        for u in USUARIOS_PRUEBA:
            print(f"  {u['correo']}  ->  {u['password']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
