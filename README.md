# Overview

This project demonstrates the *BFF Proxy Pattern* from the IETF draft document [OAuth 2.0 for Browser-Based Apps](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps).

![Overwiew as UML sequence diagram](https://raw.githubusercontent.com/dwu/oauth-bff-proxy-demo/main/docs/overview.png)

**Notes:**
- Demo does not use HTTPS to make it easier to follow along what's going on via packet sniffers. Hence cookies are not "Secure".
- The auth-proxy implementation stores the user's tokens in a server-side session. An alternative stateless implementation would be to store the tokens in an encrypted, secure cookie with properties `SameSite=strict`, `Secure`, `HttpOnly`
  - Note that browsers typically have a size limit for cookies. In section 5.3 "Implementation Limits" in [RFC 2965](https://www.rfc-editor.org/rfc/rfc2965) it is recommended that browser implementations SHOULD allow cookies with at least 4096 bytes in size.

# Services

- Make sure that KeyCloak is running on `http://localhost/8080` and the config files from `./keycloak-config` (realm `demo` and clients `auth-proxy`and `backend`) have been imported
- Start all services via `npm start`

## Frontend

- Running on `http://localhost:3002/`
- Vue app that calls the `/api` route of the proxy
- If status 401 is returned, the application redirects to the proxy's `/login` endpoint
- If status 200 is returned, the API result is displayed

## Proxy

- Running on `http://localhost:3000/`
- Performs auth code flow via client `auth-proxy` when `/login` is called
- Retrieves access and refresh tokens when `/callback` is called by KeyCloak after the user has been authenticated
- Stores the tokens in the user's server-side session
- Proxies requests to `/api` to backend `/`
  - If the request to `/api` contains a session id and the session contains a token the access token is injected in the `Authorization` header of the backend API call; otherwise the request is proxied unmodified

## Backend

- Running on `http://localhost:3001/`
- Requires requests to contain a JWT that can be validated via KeyCloak's `.../openid-connect/token/introspect` endpoint
- Token validation is performed via client `./keycloak-config/backend.json`
- Returns a JSON document of the form `{"message":"Hello, I'm the backend!","date":1677854324798}`

# References

- [The Token Handler Pattern for Single Page Applications](https://curity.io/resources/learn/the-token-handler-pattern/)
- [A Node.js OAuth Agent for SPAs](https://github.com/curityio/oauth-agent-node-express)
- [OAuth Proxy Plugin for NGINX LUA Systems](https://github.com/curityio/nginx-lua-oauth-proxy-plugin)
- [Improve Single Page Application Token Security with Lightweight OAuth Proxy](https://cloudentity.com/developers/blog/adding-oauth-proxy-bff-component-to-spa/)
- [The Solution: Easier and More Secure With Authentication Gateways](https://www.angulararchitects.io/aktuelles/the-solution-easier-and-more-secure-with-authentication-gateways/)
- [How to combine session-based authentication and stateless REST API](https://softwareengineering.stackexchange.com/questions/400551/how-to-combine-session-based-authentication-and-stateless-rest-api)
