/**
 * Revisión del dibujo de las imágenes generadas.
 *
 * El contenido de un screenshot está congelado, así que sus PNG se cachean una
 * hora en el navegador (`Cache-Control: private, max-age=3600`). Lo que sí
 * cambia es el layout cuando tocamos `lib/og/*`: si la URL no cambia, quien ya
 * abrió la imagen sigue viendo la vieja hasta que caduque. **Sube este número
 * al cambiar cómo se pintan las imágenes** y todas las URLs se renuevan.
 *
 * 2 · las fases del stream pasan a ordenarse de mejor a peor puesto.
 */
export const IMAGE_REVISION = "2";
