terraform {
  required_providers {
    keycloak = {
      source  = "keycloak/keycloak"
      version = "5.7.0"
    }
  }
}

provider "keycloak" {
  client_id = "admin-cli"
  username  = "admin"
  password  = "admin"
  url       = "http://localhost:8080"
}

resource "keycloak_realm" "app_realm" {
  realm = "app_realm"
}

resource "keycloak_openid_client_scope" "agenda_scope" {
  name                   = "agenda.read"
  realm_id               = keycloak_realm.app_realm.id
  consent_screen_text    = "Do you allow the app to read your agenda ? (agenda.read)"
  include_in_token_scope = true
}

resource "keycloak_openid_client" "exercise-app" {
  access_type = "CONFIDENTIAL"
  client_id   = "exercise-app"
  realm_id    = keycloak_realm.app_realm.id

  valid_post_logout_redirect_uris = ["http://exercise-app:3000"]
  valid_redirect_uris             = ["http://exercise-app:3000/callback"]

  standard_flow_enabled     = true
  client_secret             = "s0me_secret_cl1ent"
}

resource "keycloak_openid_client" "resource-client" {
  access_type = "CONFIDENTIAL"
  client_id   = "resource-app"
  realm_id    = keycloak_realm.app_realm.id

  valid_post_logout_redirect_uris = ["http://exercise-app:3000"]
  valid_redirect_uris             = ["http://exercise-app:3000/callback-resource"]

  standard_flow_enabled     = true
  client_secret             = "s0me_secret_cl1ent"
  consent_required          = true
}

resource "keycloak_user" "user" {
  realm_id       = keycloak_realm.app_realm.id
  username       = "user"
  email_verified = true
  first_name = "AAa"
  last_name = "Bbb"
  email          = "user@test.test"
  initial_password {
    value = "user"
  }
}

resource "keycloak_openid_client_default_scopes" "app_scope" {
  client_id      = keycloak_openid_client.resource-client.id
  default_scopes = [keycloak_openid_client_scope.agenda_scope.name]
  realm_id       = keycloak_realm.app_realm.id
}
