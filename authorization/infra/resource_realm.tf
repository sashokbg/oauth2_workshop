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
  consent_required          = true
  access_token_lifespan     = "10"
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

resource "keycloak_openid_client_scope" "agenda_scope" {
  name                   = "agenda.read"
  realm_id               = keycloak_realm.resource_realm.id
  consent_screen_text    = "Do you allow the app to read your agenda ? (agenda.read)"
  include_in_token_scope = true
}

resource "keycloak_openid_audience_protocol_mapper" "agenda_audience" {
  realm_id                 = keycloak_realm.resource_realm.id
  client_id                = keycloak_openid_client.agenda_client.id
  name                     = "agenda-audience"
  included_custom_audience = "agenda-app-audience"
}

resource "keycloak_openid_client_optional_scopes" "app_scope" {
  client_id      = keycloak_openid_client.agenda_client.id
  realm_id       = keycloak_realm.resource_realm.id
  optional_scopes = [keycloak_openid_client_scope.agenda_scope.name]
}

resource "keycloak_openid_client_default_scopes" "app_default_scope" {
  client_id      = keycloak_openid_client.agenda_client.id
  realm_id       = keycloak_realm.resource_realm.id
  default_scopes = []
}

resource "keycloak_openid_client" "another_server" {
  access_type = "CONFIDENTIAL"
  client_id   = "client-server"
  realm_id    = keycloak_realm.resource_realm.id

  standard_flow_enabled     = false
  client_secret             = "anotherserversecret"
  service_accounts_enabled  = true
}

resource "keycloak_openid_client_optional_scopes" "server_scopes" {
  client_id = keycloak_openid_client.another_server.id
  realm_id  = keycloak_realm.resource_realm.id
  optional_scopes = [keycloak_openid_client_scope.agenda_scope.name]
}

# # # # # # # # # # # # #
# CONTACTS CONFIG
# # # # # # # # # # # # #

resource "keycloak_openid_client" "contacts_client" {
  access_type = "CONFIDENTIAL"
  client_id   = "contacts-app"
  realm_id    = keycloak_realm.resource_realm.id

  valid_post_logout_redirect_uris = ["http://client-app:3000"]
  valid_redirect_uris             = ["http://client-app:3000/callback-contacts"]

  standard_flow_enabled = true
  client_secret         = "s0me_secret_cl1ent"
  consent_required      = true
}

resource "keycloak_openid_client_optional_scopes" "app_scope_contacts" {
  client_id      = keycloak_openid_client.contacts_client.id
  realm_id       = keycloak_realm.resource_realm.id
  optional_scopes = [keycloak_openid_client_scope.agenda_scope.name]
}

resource "keycloak_openid_client_default_scopes" "app_default_scope_contacts" {
  client_id      = keycloak_openid_client.contacts_client.id
  realm_id       = keycloak_realm.resource_realm.id
  default_scopes = []
}

resource "keycloak_openid_audience_protocol_mapper" "contacts_audience" {
  realm_id                 = keycloak_realm.resource_realm.id
  client_id                = keycloak_openid_client.contacts_client.id
  name                     = "contacts-audience"
  included_custom_audience = "contacts-app-audience"
}
