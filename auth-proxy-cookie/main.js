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

function encrypt(oauthtokeninfo) {
    const cipher = crypto.createCipheriv("aes256", key, iv);
    return cipher.update(oauthtokeninfo, "utf8", "hex") + cipher.final("hex");
}

function decrypt(oauthtokeninfo) {
    const decipher = crypto.createDecipheriv("aes256", key, iv);
    return decipher.update(oauthtokeninfo, "hex", "utf8") + decipher.final("utf8");
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
        const authInfoCookie = srcReq.cookies.authinfo;
        if (typeof authInfoCookie !== "undefined") {
            console.log("Found encrypted authinfo cookie");
            const decryptedCookie = decrypt(authInfoCookie);
            const decompressedCookie = JSON.parse(zlib.brotliDecompressSync(Buffer.from(decryptedCookie, "base64")));

            proxyReqOpts.headers["Authorization"] = "Bearer " + decompressedCookie.access_token;
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
            console.log("Successfully retrieved tokens, storing in encrypted cookie...");
            // store returned token info
            // contains among others both access_token and refresh_token
            const tokenInfo = JSON.stringify(data);
            const compressedTokenInfo = zlib.brotliCompressSync(Buffer.from(tokenInfo), {
                params: {
                    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
                }
            });
            const encryptedTokenInfo = encrypt(compressedTokenInfo.toString("base64"));
            console.log(`length of uncompressed and encrypted token: ${encrypt(tokenInfo).toString("base64").length}`);
            console.log(`length of compressed and encrypted token: ${encryptedTokenInfo.length}`);
            res.cookie("authinfo", encryptedTokenInfo, { maxAge: 60000, httpOnly: true, sameSite: "strict" });
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
