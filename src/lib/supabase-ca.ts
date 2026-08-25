/**
 * Certificado raíz público de Supabase — ancla de confianza para verificar el
 * TLS de la base. NO es un secreto: es la mitad pública de la CA, y va
 * commiteado a propósito.
 *
 *   CN         : Supabase Root 2021 CA
 *   Emisor     : sí mismo (self-signed, es el root de la cadena)
 *   Válido     : 2021-04-28  →  **2031-04-26**
 *   SHA-256    : 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:
 *                82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
 *
 * De dónde salió: dashboard de Supabase → Settings → Database → SSL
 * Configuration → «Download certificate» (archivo `prod-ca-2021.crt`). No hay
 * URL pública para bajarlo; hay que entrar al dashboard del proyecto.
 *
 * Cómo reemplazarlo cuando venza (o si Supabase rota la CA): bajar el nuevo
 * desde ese mismo lugar y pegar el PEM acá abajo, tal cual, con las líneas
 * BEGIN/END incluidas. Para confirmar que el archivo nuevo es realmente el root
 * de la cadena que sirve la base, comparar su fingerprint SHA-256 contra el del
 * último certificado de la cadena que presenta el servidor — tienen que ser
 * idénticos.
 *
 * Está inline como string y no como archivo `.crt` leído con `fs` a propósito:
 * un módulo `.ts` viaja siempre con el bundle (local, Vercel y el script del
 * seed), mientras que un archivo suelto necesitaría `outputFileTracingIncludes`
 * en la config de Next, que se desincroniza en silencio y falla solo en
 * producción.
 *
 * La cadena completa que verifica es:
 *   *.pooler.supabase.com → Supabase Intermediate 2021 CA → Supabase Root 2021 CA
 */
export const SUPABASE_CA_CERT = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;
