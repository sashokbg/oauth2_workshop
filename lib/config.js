module.exports = {
  client: {
    KEYCLOAK_BASE_URL: "http://idp:8080",
    KEYCLOAK_REALM: "app_realm",
    KEYCLOAK_CLIENT_ID: "client-app",
    KEYCLOAK_CLIENT_SECRET: "s0me_secret_cl1ent",
    KEYCLOAK_REDIRECT_URI: "http://client-app:3000/callback",
    POST_LOGOUT_REDIRECT_URI: "http://client-app:3000",
  },

  server_client: {
    KEYCLOAK_BASE_URL: "http://idp-resource:8080",
    KEYCLOAK_REALM: "resource_realm",
    KEYCLOAK_CLIENT_ID: "client-server",
    KEYCLOAK_CLIENT_SECRET: "anotherserversecret",
  },

  agenda: {
    KEYCLOAK_BASE_URL: "http://idp-resource:8080",
    KEYCLOAK_REALM: "resource_realm",
    KEYCLOAK_CLIENT_ID: "agenda-app",
    KEYCLOAK_CLIENT_SECRET: "s0me_secret_cl1ent",
    KEYCLOAK_REDIRECT_URI: "http://client-app:3000/callback-agenda",
    APP_URL: "http://agenda-app:3001",
    POST_AUTH_REDIRECT: "/agenda",
    POST_LOGOUT_REDIRECT_URI: "http://client-app:3000",
  },

  contacts: {
    KEYCLOAK_BASE_URL: "http://idp-resource:8080",
    KEYCLOAK_REALM: "resource_realm",
    KEYCLOAK_CLIENT_ID: "contacts-app",
    KEYCLOAK_CLIENT_SECRET: "s0me_secret_cl1ent",
    KEYCLOAK_REDIRECT_URI: "http://client-app:3000/callback-contacts",
    APP_URL: "http://contacts-app:3002",
    POST_AUTH_REDIRECT: "/contacts",
    POST_LOGOUT_REDIRECT_URI: "http://client-app:3000",
  }
}
