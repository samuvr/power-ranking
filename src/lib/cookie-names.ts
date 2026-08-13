// Nombres de cookie en un módulo sin dependencias: el middleware corre en el
// runtime Edge y no debe arrastrar el cliente de base de datos.
export const ADMIN_COOKIE_NAME = "admin_session";
export const USER_COOKIE_NAME = "user_session";
