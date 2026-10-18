<?php
declare(strict_types=1);

// Mismos perfiles que servidor/constantes.py.
function configuracionMysqlEquipo(): array
{
    $equipo = strtoupper(trim(gethostname() ?: php_uname('n')));
    $usuario = 'rafa';
    $password = 'rafa';
    $puerto = 3306;
    if ($equipo === 'DESKTOP-RAFAEL') {
        $usuario = 'root';
        $password = '';
        $puerto = puertoMysqlXampp();
    } elseif ($equipo !== 'SERVITEK-ASUS') {
        $puerto = 3307;
    }
    return [
        'dsn' => "mysql:host=localhost;port={$puerto};dbname=antoniopaezlobato;charset=utf8mb4",
        'usuario' => $usuario,
        'password' => $password,
    ];
}

// Lee port de [mysqld], igual que configuracion_mysql.py; por defecto, 3306.
function puertoMysqlXampp(): int
{
    $archivo = @fopen('C:/xampp/mysql/bin/my.ini', 'r');
    if ($archivo === false) return 3306;
    try {
        $seccion = '';
        while (($linea = fgets($archivo)) !== false) {
            $linea = trim($linea);
            if ($linea === '' || $linea[0] === '#' || $linea[0] === ';') continue;
            if (preg_match('/^\[(.+)\]$/', $linea, $partes)) {
                $seccion = strtolower(trim($partes[1]));
                continue;
            }
            if ($seccion === 'mysqld' && preg_match('/^port\s*=\s*(\d+)\s*$/i', $linea, $partes)) {
                $puerto = (int)$partes[1];
                return $puerto > 0 && $puerto <= 65535 ? $puerto : 3306;
            }
        }
        return 3306;
    } finally {
        fclose($archivo);
    }
}
