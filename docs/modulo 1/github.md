repo: harambeiskappa/Compras
branch: main

## Last sync

date: 2026-08-27T15:05:00Z

### Updated in this project

- Prototipo del módulo 1 (información de la compra): lista, alta, ver/editar.
- Roles, catálogos y campos tomados del esquema real de Prisma.
- Datos de pantalla con nombres reales de WinCompras (~120 compras/año).

## Screen map

| Pantalla del prototipo | Archivos del repo |
|---|---|
| Lista `/compras` (con datos, vacía) | prisma/migrations/20260825191736_modulos_1_y_2/migration.sql, CLAUDE.md |
| Alta `/compras/nueva` | migration.sql (tabla `compra`), CLAUDE.md (reglas de dominio) |
| Ver y editar `/compras/[id]` | migration.sql (`compra`, catálogos), CLAUDE.md |
| Aviso que no bloquea | CLAUDE.md (regla 6: titular vs. empresa de las tropas) |
| Catálogos y creación al vuelo | migration.sql (`vendedor`, `hotelero`, `consignatario`, `persona_compradora`, `empresa`) |
