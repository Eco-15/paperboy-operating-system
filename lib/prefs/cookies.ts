// Appearance prefs are mirrored into cookies so the ROOT layout (app/layout.tsx)
// can stamp data-theme / data-density on <html> during SSR — before paint, with
// no DB round-trip and no flash of the wrong theme.
//
// The database (user_preference) remains the source of truth and syncs across
// devices; these cookies are just a fast local mirror. On load the shell
// reconciles them against the DB values it was handed (see ConsoleShell).

export const THEME_COOKIE = "pb.theme";
export const DENSITY_COOKIE = "pb.density";
export const MOTION_COOKIE = "pb.motion";

// A year, in seconds. Appearance is a sticky preference.
export const PREF_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The blocking script that runs in <head> before first paint. It resolves the
 * "system" theme via matchMedia (which the server can't know) and stamps the
 * result on <html>, so the correct palette is in place on the very first frame.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE.replace(".", "\\.")}=([^;]*)/);
var t=m?decodeURIComponent(m[1]):"system";
if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
document.documentElement.dataset.theme=t;
}catch(e){}})();`;
