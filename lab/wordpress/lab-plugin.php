<?php
/** Plugin Name: WebAbility install failure lab (local only) */
// A real WordPress site with deliberately controllable installation mistakes.
function wa_lab_snippet() {
    return '<script src="https://widget.webability.io/widget.min.js" defer></script>';
}
add_action('send_headers', function () {
    if (get_option('wa_lab_case') === 'csp') header("Content-Security-Policy: script-src 'self'");
});
add_action('wp_head', function () {
    if (get_option('wa_lab_installed', 'yes') === 'yes' && get_option('wa_lab_case') !== 'wrong-slot') echo wa_lab_snippet();
});
add_action('wp_footer', function () {
    if (get_option('wa_lab_case') === 'wrong-slot') echo '<pre>' . esc_html(wa_lab_snippet()) . '</pre>';
    echo '<p>Local install lab; deliberately broken examples. Not a production site.</p>';
});
// Minimal real full-page cache: prime before installing, then leave stale until purged.
// This models stale HTML on WordPress, not a specific third-party caching product.
add_action('template_redirect', function () {
    if (is_admin() || get_option('wa_lab_cache') !== 'yes') return;
    $file = WP_CONTENT_DIR . '/install-lab-page.html';
    if (file_exists($file)) { header('X-Install-Lab-Cache: HIT'); readfile($file); exit; }
    header('X-Install-Lab-Cache: MISS');
    ob_start(function ($html) use ($file) { file_put_contents($file, $html); return $html; });
}, 0);
