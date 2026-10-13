<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/mysql_config.php';
$configuracionBdEquipo = configuracionMysqlEquipo();
define('DB_DSN', $configuracionBdEquipo['dsn']);
define('DB_USER', $configuracionBdEquipo['usuario']);
define('DB_PASS', $configuracionBdEquipo['password']);
unset($configuracionBdEquipo);

const ALLOW_ALL = true;
$ALLOWED_TABLES = ['usuarios','clientes','polizas'];

const SESSION_INACTIVITY_SECONDS = 150*60;

// ACL por recurso: tabla → operación → [roles permitidos]
// Usa '*' para defaults globales.
$ACL = [
  '*' => [ // defaults (todas las tablas salvo override)
    'list'        => ['admin','editor','viewer'],
    'read'        => ['admin','editor','viewer'],
    'create'      => ['admin','editor'],
    'update'      => ['admin','editor'],
    'delete'      => ['admin','editor'],      // soft delete
    'restore'     => ['admin','editor'],
    'hard_delete' => ['admin'],
    'meta'        => ['admin'],               // /?tables=...
  ],

  // Overrides por tabla
  'usuarios' => [
    'list'        => ['admin'],               // p.ej. solo admin ve usuarios
    'read'        => ['admin'],
    'create'      => ['admin'],
    'update'      => ['admin'],
    'delete'      => ['admin'],
    'restore'     => ['admin'],
    'hard_delete' => ['admin'],
  ],

  // Ejemplo extra:
  // 'polizas' => [
  //   'hard_delete' => [], // nadie
  // ],
];
