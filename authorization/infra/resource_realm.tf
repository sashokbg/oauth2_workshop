resource "keycloak_realm" "resource_realm" {
  realm             = "resource_realm"
  display_name      = "My Drive"
  display_name_html = <<-HTML
    <span style="font-family:arial,sans-serif;font-size:26px;font-weight:300">
      &#9650;&nbsp;My Drive
    </span>
  HTML
  login_theme = "gdrive"
}

resource "keycloak_openid_client" "agenda_client" {
  access_type = "CONFIDENTIAL"
  client_id   = "agenda-app"
  realm_id    = keycloak_realm.resource_realm.id

  valid_post_logout_redirect_uris = ["http://client-app:3000"]
  valid_redirect_uris             = ["http://client-app:3000/callback-agenda"]

  standard_flow_enabled     = true
  client_secret             = "s0me_secret_cl1ent"
}

resource "keycloak_user" "resource_user" {
  realm_id       = keycloak_realm.resource_realm.id
  username       = "resource_user"
  email_verified = true
  first_name = "AAa"
  last_name = "Bbb"
  email          = "resource_user@test.test"
  initial_password {
    value = "resource_user"
  }
}
