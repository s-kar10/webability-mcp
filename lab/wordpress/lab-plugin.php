<?php
/** Plugin Name: WebAbility install failure lab (local only) */
// A real WordPress site with deliberately controllable installation mistakes.
function wa_lab_snippet() {
    return '<script src="https://widget.webability.io/widget.min.js" defer></script>';
}
// Lab-only owner workflow; intentionally separate from detector implementation.
add_action('admin_menu', function () {
    add_options_page('Install lab', 'Install lab', 'manage_options', 'wa-install-lab', 'wa_lab_settings');
});
function wa_lab_settings() {
    if (!current_user_can('manage_options')) return;
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        check_admin_referer('wa_lab_settings');
        $action = sanitize_key($_POST['lab_action'] ?? '');
        if ($action === 'save') {
            $placement = sanitize_key($_POST['placement'] ?? 'head');
            update_option('wa_lab_installed', 'yes');
            update_option('wa_lab_case', $placement === 'text' ? 'wrong-slot' : 'healthy');
        } elseif ($action === 'allow-script') {
            // Keep the policy restrictive: allow only the actual widget origin.
            update_option('wa_lab_case', 'csp-allowed');
        } elseif ($action === 'clear-cache') {
            $file = WP_CONTENT_DIR . '/install-lab-page.html';
            if (file_exists($file)) unlink($file);
        }
        echo '<div class="notice notice-success"><p>Lab settings saved. Check the website again.</p></div>';
    }
    echo '<div class="wrap"><h1>Install lab</h1><p>Controls for this local test site only. These are not standard WordPress settings.</p>';
    echo '<h2>Install code</h2><form method="post">';
    wp_nonce_field('wa_lab_settings');
    echo '<label for="placement">Code location</label> <select id="placement" name="placement">';
    echo '<option value="head" ' . selected(get_option('wa_lab_case') !== 'wrong-slot', true, false) . '>Site-wide header</option>';
    echo '<option value="text" ' . selected(get_option('wa_lab_case'), 'wrong-slot', false) . '>Visible page text</option></select>';
    echo '<p><button class="button button-primary" name="lab_action" value="save">Save installation</button></p></form>';
    echo '<h2>Script security policy</h2><p>Allow https://widget.webability.io while keeping other external script origins blocked.</p><form method="post">';
    wp_nonce_field('wa_lab_settings');
    echo '<button class="button" name="lab_action" value="allow-script">Allow WebAbility script</button></form>';
    echo '<h2>Page cache</h2><p>Remove the saved copy of this lab page so the next visitor receives the latest version.</p><form method="post">';
    wp_nonce_field('wa_lab_settings');
    echo '<button class="button" name="lab_action" value="clear-cache">Clear page cache</button></form></div>';
}
add_action('send_headers', function () {
    if (get_option('wa_lab_case') === 'csp') header("Content-Security-Policy: script-src 'self'");
    if (get_option('wa_lab_case') === 'csp-allowed') header("Content-Security-Policy: script-src 'self' https://widget.webability.io");
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
