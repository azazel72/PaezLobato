
from sqlmodel import SQLModel, Field
from typing import Optional


class ProductoDB(SQLModel, table=True):
    __tablename__ = "productos"

    id: Optional[int] = Field(default=None, primary_key=True)
    tipo: str
    codigo: str
    tipo_producto_id: Optional[int] = None
    material_id: Optional[int] = None
    tostado_id: Optional[int] = None
    ubicacion_id: Optional[int] = None
    contenedor_id: Optional[int] = None
    produccion_id: Optional[int] = None
    pedido_id: int = 0
    pedido_fabricacion_id: int = 0
    estado: Optional[int] = 1
