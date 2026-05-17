/**
 * Frase de confirmación que el user debe teclear literalmente para
 * disparar el borrado. En mayúsculas y en español — coherente con el
 * idioma por defecto del producto y suficiente para evitar deletions
 * accidentales por click. La frase NO se localiza: queremos un único
 * gate exacto (un user árabo-parlante que tenga la app en árabe
 * sigue viendo este string para confirmar, junto con la traducción
 * informativa al lado).
 *
 * Aislado en un fichero separado (no en `delete-account.ts`) porque
 * un módulo `"use server"` solo puede exportar funciones async. La
 * constante se importa tanto desde el server action como desde el
 * cliente que renderiza el formulario.
 */
export const DELETE_CONFIRMATION_PHRASE = "ELIMINAR MI CUENTA";
