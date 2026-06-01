// NOTE: The original "view bitplanes" component referenced from app.js
// (COMMAND.VIEWPLANES) was never committed to this repository, which left the
// production build with an unresolvable dynamic import. This minimal placeholder
// restores a resolvable module so `vite build` succeeds. It no-ops the overlay
// and logs a warning instead of rendering the (missing) bitplanes view.
const BitPlanes = (function () {
    let me = {};
    let visible = false;

    me.toggle = function (andOpen) {
        visible = typeof andOpen === "boolean" ? andOpen : !visible;
        console.warn("BitPlanes view is not bundled in this build.");
        return visible;
    };

    me.isVisible = function () {
        return visible;
    };

    return me;
})();

export default BitPlanes;
