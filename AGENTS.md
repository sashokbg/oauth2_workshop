This repository's purpose is to confire OAUTH2 and OpenID Connect client / resource etc in order to show how they work as an exercise.

The Identity Provider is a Keycloak instance running in a docker container and configured using `tofu`. Keycloak config files are found under `infra` directory.


## Resource Server
The resource server is an Expressjs API that returns a hard-coded list of agenda items and also performs token validation and introspection with Keycloak.

The resource server is found under `resource_server`

## App Server

The app server serves a very simple web application, using Express js and Handlebar templates.
It exposes all the required pages and callback endpoints and manages the required redirects to the IdP (Keycloak).

The /agenda endpoint will call the `resource_server` with an access_token to show the user's agenda.

The app server is found under `server`

### Session Management

The authentication flow used is "code flow", so the JWT tokens are stored in the backend and an HTTPOnly session cookie is sent to the client (browser).
The session store on the backend is a very simple JSON file containing the sessionid and a JSON document with the various tokens.

## OAuth2

```mermaid
sequenceDiagram
    participant Resource_Owner
    participant Client_App
    participant Resource_Server
    participant Auth_Server


    Resource_Owner->> Client_App: Request resource
    Client_App ->> Resource_Server: Get resource
    Resource_Server ->> Client_App: Not authorized 401
    Client_App ->> Resource_Owner: Redirect to Auth
    Resource_Owner ->> Auth_Server: Authorize and Consent
    Auth_Server ->> Resource_Owner: One time use Code
    Resource_Owner ->> Client_App: Callback URL + <code>
    Client_App ->> Auth_Server: Exchange code for tokens
    Auth_Server -->> Client_App: Access Tokens JWT
    Client_App ->> Client_App: Create session & Store Tokens
    Client_App ->> Resource_Owner: Session Cookie
    Resource_Owner ->> Client_App: /resource + <session>
    Client_App ->> Resource_Server: /resource + <token>
    Resource_Server ->> Auth_Server: Introspect token
    Auth_Server -->> Resource_Server: OK
    Resource_Server -->> Client_App: <resource payload>
    Client_App -->> Resource_Owner: <resource payload>
```

## OIDC

```mermaid
sequenceDiagram
    participant Resource_Owner
    participant Client/Resource App
    participant Auth_Server


    Resource_Owner->> Client/Resource App: Request resource
    Client/Resource App -->> Client/Resource App: Verify session
    Client/Resource App ->> Resource_Owner: Redirect to Auth
    Resource_Owner ->> Auth_Server: Authorize and Consent
    Auth_Server -->> Resource_Owner: One time use Code
    Resource_Owner ->> Client/Resource App: Callback URL + <code>
    Client/Resource App ->> Auth_Server: Exchange code for tokens
    Auth_Server -->> Client/Resource App: ID Tokens JWT
    Client/Resource App ->> Client/Resource App: Create session & Store Tokens
    Client/Resource App -->> Resource_Owner: Session Cookie
    Resource_Owner ->> Client/Resource App: /resource + <session>
    Client/Resource App ->> Client/Resource App: Verify Sesssion & Token
    Client/Resource App ->> Auth_Server: Introspect token
    Auth_Server -->> Client/Resource App: OK
    Client/Resource App -->> Resource_Owner: <resource payload>
```
