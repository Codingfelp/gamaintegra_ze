<?php
function MyAutoLoad($Class)
{
  $cDir = ['_conn', '_validator', '_format', '_ferraments'];
  $iDir = null;

  foreach ($cDir as $dirName) :
    if (!$iDir && file_exists(__DIR__ . '/' . $dirName . '/' . $Class . '.class.php') && !is_dir(__DIR__ . '/' . $dirName . '/' . $Class . '.class.php')) :
      include_once(__DIR__ . '/' . $dirName . '/' . $Class . '.class.php');
      $iDir = true;
    endif;
  endforeach;
}
define('VSESSION', 'PROJETO_CDL');

spl_autoload_register("MyAutoLoad");
