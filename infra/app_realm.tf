resource "keycloak_realm" "app_realm" {
  realm = "app_realm"
}

resource "keycloak_openid_client" "app" {
  access_type = "CONFIDENTIAL"
  client_id   = "exercise-app"
  realm_id    = keycloak_realm.app_realm.id

  valid_post_logout_redirect_uris = ["http://exercise-app:3000"]
  valid_redirect_uris             = ["http://exercise-app:3000/callback"]

  standard_flow_enabled     = true
  client_secret             = "s0me_secret_cl1ent"
}

resource "keycloak_user" "app_user" {
  realm_id       = keycloak_realm.app_realm.id
  username       = "app_user"
  email_verified = true
  first_name = "AAa"
  last_name = "Bbb"
  email          = "app_user@test.test"
  initial_password {
    value = "app_user"
  }
}
