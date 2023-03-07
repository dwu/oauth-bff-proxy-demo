const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const proxy = require("express-http-proxy");
const oauthclient = require("oauth-v2-client").default;
const zlib = require("zlib");

const app = express();
const port = 3000;

const password = "my-highly-insecure-key";
const salt = "f2b6d40b1239b743f62b2ad10bb2d75590469d48daf39115f0b08e0b61f933b5";
const iv = Buffer.from("0e7faa381c10876cb3ac6324d40fc6e1", "hex");
const key = crypto.scryptSync(password, salt, 32);

const USE_COMPRESSION = false;

function encrypt(data) {
    const cipher = crypto.createCipheriv("aes256", key, iv);
    return Buffer.concat([cipher.update(data), cipher.final()]);
}

function decrypt(data) {
    const decipher = crypto.createDecipheriv("aes256", key, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}

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
    credentials: true,
    headers: true
}));

app.use(cookieParser());

app.use("/api", proxy("http://localhost:3001", {
    proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
        console.log("api: called");
        const tokenInfo = srcReq.cookies.authinfo;
        if (typeof tokenInfo !== "undefined") {
            console.log("api: Found encrypted authinfo cookie with tokenInfo");
            console.log(`api: tokenInfo (len=${tokenInfo.length}): ${tokenInfo}`);
            const decryptedTokenInfo = decrypt(Buffer.from(tokenInfo, "base64"));
            console.log(`api: decrypted tokenInfo (len=${decryptedTokenInfo.length}): ${decryptedTokenInfo}`);

            if (USE_COMPRESSION) {
                const decompressedTokenInfo = zlib.brotliDecompressSync(decryptedTokenInfo);
                console.log(`api: decompressed tokenInfo (len=${decompressedTokenInfo.length}): ${decompressedTokenInfo}`);
                proxyReqOpts.headers["Authorization"] = "Bearer " + JSON.parse(decompressedTokenInfo).access_token;
            } else {
                proxyReqOpts.headers["Authorization"] = "Bearer " + JSON.parse(decryptedTokenInfo).access_token;
            }
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
            console.log("callback: Successfully retrieved tokens, storing in encrypted cookie...");
            // store returned token info
            // contains among others both access_token and refresh_token
            var tokenInfo = JSON.stringify(data);
            console.log(`callback: tokenInfo (len=${tokenInfo.length}): ${tokenInfo}`);
            if (USE_COMPRESSION) {
                const compressedTokenInfo = zlib.brotliCompressSync(Buffer.from(tokenInfo));
                console.log(`callback: compressed TokenInfo (len=${compressedTokenInfo.length}): ${compressedTokenInfo}`);
                const encryptedTokenInfo = encrypt(compressedTokenInfo).toString("base64");
                console.log(`callback: encrypted tokenInfo (len=${encryptedTokenInfo.length}): ${encryptedTokenInfo}`);
                res.cookie("authinfo", encryptedTokenInfo, { maxAge: 60000, httpOnly: true, sameSite: "strict" });
            } else {
                const encryptedTokenInfo = encrypt(tokenInfo).toString("base64");
                console.log(`callback: encrypted tokenInfo (len=${encryptedTokenInfo.length}): ${encryptedTokenInfo}`);
                res.cookie("authinfo", encryptedTokenInfo, { maxAge: 60000, httpOnly: true, sameSite: "strict" });
            }

            res.redirect("http://localhost:3002/");
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
