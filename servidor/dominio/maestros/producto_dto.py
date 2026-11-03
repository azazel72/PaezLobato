
from pydantic import BaseModel
from servidor.modelos import ProductoDB


class ProductoDTO(BaseModel):
    id: int | None
    tipo: str
    codigo: str
    tipo_producto_id: int | None = None
    material_id: int | None = None
    tostado_id: int | None = None
    ubicacion_id: int | None = None
    contenedor_id: int | None = None
    produccion_id: int | None
    pedido_id: int = 0
    pedido_fabricacion_id: int = 0
    estado: int | None = 1

    def from_db(producto_db: ProductoDB) -> "ProductoDTO":
        return ProductoDTO(
            id=producto_db.id,
            tipo=producto_db.tipo,
            codigo=producto_db.codigo,
            tipo_producto_id=producto_db.tipo_producto_id,
            material_id=producto_db.material_id,
            tostado_id=producto_db.tostado_id,
            ubicacion_id=producto_db.ubicacion_id,
            contenedor_id=producto_db.contenedor_id,
            produccion_id=producto_db.produccion_id,
            pedido_id=producto_db.pedido_id,
            pedido_fabricacion_id=producto_db.pedido_fabricacion_id,
            estado=producto_db.estado,
        )

    def to_db(self) -> ProductoDB:
        return ProductoDB(
            id=self.id,
            tipo=self.tipo,
            codigo=self.codigo,
            tipo_producto_id=self.tipo_producto_id,
            material_id=self.material_id,
            tostado_id=self.tostado_id,
            ubicacion_id=self.ubicacion_id,
            contenedor_id=self.contenedor_id,
            produccion_id=self.produccion_id,
            pedido_id=self.pedido_id,
            pedido_fabricacion_id=self.pedido_fabricacion_id,
            estado=self.estado,
        )
