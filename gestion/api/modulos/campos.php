<?php
declare(strict_types=1);

function gNumero(string $label, int $precision = 0, float $min = 0, float $max = 2147483647): array
{
    return gCampo($label, 'number', ['required' => true, 'default' => 0, 'min' => $min, 'maxValue' => $max, 'precision' => $precision, 'step' => $precision ? 10 ** -$precision : 1]);
}
function gReferencia(string $label, string $table, bool $required = false, array $extra = []): array
{
    return gCampo($label, 'select', ['ref' => $table, 'required' => $required] + $extra);
}
function gTexto(string $label, int $max, bool $required = false): array { return gCampo($label, 'text', ['max' => $max, 'required' => $required]); }
function gSiNo(string $label): array { return gCampo($label, 'checkbox', ['default' => 0]); }
