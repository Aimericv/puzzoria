import type { Locale } from "./types";
const en = {
  recoveryTitle: "Account recovery",
  recoveryCode: "Recovery code",
  recoveryCodeHelp:
    "Save this code somewhere private. It is shown only once and lets you reset your password without email. Never share it.",
  recoveryIntro:
    "Enter your username and saved recovery code, then choose a new password. You will need to log in again.",
  recoveryEnabled:
    "A recovery code is active. If you lost it, create a replacement below.",
  recoveryMissing:
    "You do not have a recovery code yet. Create one to keep access if you forget your password.",
  recoveryRotateHelp:
    "Enter your current password. Creating a new code invalidates the previous one.",
  generateRecovery: "Create a new recovery code",
  recoverySuccess:
    "Password reset. Save your new recovery code, then log in with your new password.",
  recoveryInvalid:
    "Username or recovery code is incorrect, or the code is no longer valid.",
  passwordMismatch: "The two passwords do not match.",
  forgotPassword: "Forgot your password?",
  newPassword: "New password",
  currentPassword: "Current password",
  confirmPassword: "Confirm new password",
  downloadRecovery: "Download code",
  savedRecovery: "I have saved my code",
  resetPassword: "Reset password",
};
const fr: typeof en = {
  recoveryTitle: "Récupération du compte",
  recoveryCode: "Code de secours",
  recoveryCodeHelp:
    "Conservez ce code dans un endroit privé. Il n'est affiché qu'une fois et permet de réinitialiser votre mot de passe sans email. Ne le partagez jamais.",
  recoveryIntro:
    "Saisissez votre pseudo et le code de secours conservé, puis choisissez un nouveau mot de passe. Vous devrez ensuite vous reconnecter.",
  recoveryEnabled:
    "Un code de secours est actif. Si vous l'avez perdu, créez-en un nouveau ci-dessous.",
  recoveryMissing:
    "Vous n'avez pas encore de code de secours. Créez-en un pour retrouver votre compte en cas d'oubli du mot de passe.",
  recoveryRotateHelp:
    "Saisissez votre mot de passe actuel. Le nouveau code remplacera l'ancien, qui deviendra inutilisable.",
  generateRecovery: "Créer un nouveau code de secours",
  recoverySuccess:
    "Mot de passe réinitialisé. Conservez votre nouveau code de secours, puis connectez-vous avec votre nouveau mot de passe.",
  recoveryInvalid:
    "Pseudo ou code de secours incorrect, ou code devenu inutilisable.",
  passwordMismatch: "Les deux mots de passe ne correspondent pas.",
  forgotPassword: "Mot de passe oublié ?",
  newPassword: "Nouveau mot de passe",
  currentPassword: "Mot de passe actuel",
  confirmPassword: "Confirmer le nouveau mot de passe",
  downloadRecovery: "Télécharger le code",
  savedRecovery: "J'ai conservé mon code",
  resetPassword: "Réinitialiser le mot de passe",
};
const es: typeof en = {
  recoveryTitle: "Recuperación de la cuenta",
  recoveryCode: "Código de recuperación",
  recoveryCodeHelp:
    "Guarda este código en un lugar privado. Solo se muestra una vez y permite restablecer la contraseña sin correo electrónico. No lo compartas.",
  recoveryIntro:
    "Introduce tu usuario y el código guardado, y elige una nueva contraseña. Después deberás iniciar sesión de nuevo.",
  recoveryEnabled:
    "Hay un código de recuperación activo. Si lo has perdido, crea otro abajo.",
  recoveryMissing:
    "Aún no tienes un código de recuperación. Crea uno para recuperar tu cuenta si olvidas la contraseña.",
  recoveryRotateHelp:
    "Introduce tu contraseña actual. El nuevo código invalidará el anterior.",
  generateRecovery: "Crear un nuevo código de recuperación",
  recoverySuccess:
    "Contraseña restablecida. Guarda tu nuevo código e inicia sesión con la nueva contraseña.",
  recoveryInvalid: "Usuario o código incorrecto, o código ya no válido.",
  passwordMismatch: "Las dos contraseñas no coinciden.",
  forgotPassword: "¿Has olvidado tu contraseña?",
  newPassword: "Nueva contraseña",
  currentPassword: "Contraseña actual",
  confirmPassword: "Confirmar nueva contraseña",
  downloadRecovery: "Descargar código",
  savedRecovery: "He guardado mi código",
  resetPassword: "Restablecer contraseña",
};
const de: typeof en = {
  recoveryTitle: "Kontowiederherstellung",
  recoveryCode: "Wiederherstellungscode",
  recoveryCodeHelp:
    "Bewahre diesen Code privat auf. Er wird nur einmal angezeigt und ermöglicht das Zurücksetzen des Passworts ohne E-Mail. Teile ihn niemals.",
  recoveryIntro:
    "Gib deinen Benutzernamen und gespeicherten Code ein und wähle ein neues Passwort. Melde dich anschließend erneut an.",
  recoveryEnabled:
    "Ein Wiederherstellungscode ist aktiv. Erstelle unten einen neuen, falls du ihn verloren hast.",
  recoveryMissing:
    "Du hast noch keinen Wiederherstellungscode. Erstelle einen für den Fall, dass du dein Passwort vergisst.",
  recoveryRotateHelp:
    "Gib dein aktuelles Passwort ein. Der neue Code macht den bisherigen ungültig.",
  generateRecovery: "Neuen Wiederherstellungscode erstellen",
  recoverySuccess:
    "Passwort zurückgesetzt. Speichere deinen neuen Code und melde dich mit dem neuen Passwort an.",
  recoveryInvalid:
    "Benutzername oder Code falsch, oder der Code ist nicht mehr gültig.",
  passwordMismatch: "Die beiden Passwörter stimmen nicht überein.",
  forgotPassword: "Passwort vergessen?",
  newPassword: "Neues Passwort",
  currentPassword: "Aktuelles Passwort",
  confirmPassword: "Neues Passwort bestätigen",
  downloadRecovery: "Code herunterladen",
  savedRecovery: "Ich habe meinen Code gespeichert",
  resetPassword: "Passwort zurücksetzen",
};
export const recoveryMessages = (locale: Locale) =>
  ({ en, fr, es, de })[locale];
