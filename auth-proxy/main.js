const express = require("express");
const cors = require("cors");
const session = require("express-session");
const proxy = require("express-http-proxy");
const oauthclient = require("oauth-v2-client").default;

const app = express();
const port = 3000;

const api = new oauthclient({
    oauthOptions: {
        clientId: "auth-proxy",
        clientSecret: "sWi4CdDKXiEnVQvXkJamyYU8vH0rtZr4",
        callbackUrl: "http://localhost:3000/callback",
        accessTokenUrl: "http://localhost:8080/realms/demo/protocol/openid-connect/token",
        authUrl: "http://localhost:8080/realms/demo/protocol/openid-connect/auth"
    },
    requestOptions: {
        bodyType: "x-www-form-urlencoded"
    }
});

app.use(cors({
    origin: "http://localhost:3002",
    credentials: true
}));

app.use(session({
    secret: "my-highly-insecure-session-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxage: 60000,
        samesite: true
    },
}));

app.use("/api", proxy("http://localhost:3001", {
    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        console.log(srcReq.session.token);
        if (typeof srcReq.session.token !== "undefined") {
            proxyReqOpts.headers["Authorization"] = "Bearer " + srcReq.session.token.access_token;
        }
        return proxyReqOpts;
    }
}));

// redirect to provider authentication page
app.get("/login", function (req, res) {
    res.redirect(api.authorizationCode.getAuthUri());
});

// extract token in the callback
app.get("/callback", async function (req, res) {
    console.log(`Callback called with code=${req.query.code}`);
    await api.authorizationCode.getToken({
        callbackUrl: req.procotol + "://" + req.get("host") + req.originalUrl,
        onSuccess: (data) => {
            console.log("Successfully retrieved tokens, storing in session...");

            // store returned token info
            // contains among others both access_token and refresh_token
            req.session.token = data;
            req.session.save(function(err) {
                if (err) return next(err);
                res.redirect("http://localhost:3002/");
            });
        },
        onError: (error) => {
            console.log(error);
          	res.status(500).end();
        },
    });
});



app.listen(port, () => {
    console.log(`Auth Proxy listening on port ${port}`);
});
